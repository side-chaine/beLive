#!/usr/bin/env node
// beLiveBase city-gen v3.2: houses.yaml (v0.3: здание=режим, этаж=файл; v0.3.2: метки этажей) -> city-state.json + инъекция CITY/TOUR
// Запуск на ПК (есть node): node team-m/bLb/city-gen.mjs
// Если рядом есть city-metrics.json (даёт city-metrics.mjs) — перекрывает loc/files/t30 из yaml.
// Без внешних зависимостей: парсер yaml минимальный, под формат houses.yaml v0.3 (совместим с v0.2 rooms).

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = dirname(fileURLToPath(import.meta.url));
const YAML_PATH = join(DIR, 'houses.yaml');
const METRICS_PATH = join(DIR, 'city-metrics.json');
const TOUR_PATH = join(DIR, 'tour.yaml');
const JSON_PATH = join(DIR, 'city-state.json');
const HTML_PATH = join(DIR, 'bLb-CITY-v0.2-quiet.html');

// Реестр реальных событий EventBus v2 (src/foundation/event-bus/types.ts, 28 шт.) + служебные city:*
const REAL_EVENTS = new Set([
  'audio:track-loaded', 'audio:track-fully-loaded', 'audio:track-stem-ready',
  'audio:playback-state-changed', 'audio:playback-rate-changed', 'audio:vocalmix-state-changed',
  'audio:microphone-state-changed', 'audio:monitor-state-changed', 'audio:monitor-route-changed',
  'audio:seek-position-changed',
  'track:before-change', 'track:load-failed',
  'catalog:track-saved', 'catalog:tracks-changed', 'catalog:catalog-close', 'catalog:catalog-cleared',
  'sync:blocks-applied', 'sync:active-line-changed', 'sync:lyrics-rendered', 'sync:save-track-markers',
  'sync:loop-set', 'sync:loop-cleared', 'sync:loopcompleted', 'sync:sections-updated',
  'ui:mode-changed', 'ui:block-scenes-loaded', 'ui:camera-permission-resolved',
  'practice:state-changed'
]);
const STATUSES = new Set(['alive', 'alive-partial', 'demo', 'planned', 'conserved', 'trash', 'cleared', 'external']);
const ARCHS = new Set(['tower', 'factory', 'arena', 'lab', 'archive', 'campus', 'house', 'plaza', 'gate', 'none']);
const GRID_W = 15, GRID_D = 14;

// ── парсер houses.yaml v0.2 (секции: meta/districts/houses/metro/open-seams) ──
function parseInlineArray(s) {
  const inner = s.trim().replace(/^\[/, '').replace(/\]$/, '');
  if (!inner.trim()) return [];
  return inner.split(',').map(x => x.trim().replace(/^["']|["']$/g, ''));
}
function parseYaml(text) {
  const out = { meta: {}, districts: [], houses: [], metro: [], openSeams: [] };
  let section = null;      // meta | districts | houses | metro | open-seams
  let cur = null;          // текущий элемент списка
  let listKey = null;      // текущий блочный список (gives/rooms/...)
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\t/g, '  ');
    const noComment = line.replace(/#.*$/, '').replace(/\s+$/, '');
    if (!noComment.trim()) continue;
    const top = noComment.match(/^([A-Za-z-]+):\s*(.*)$/);
    if (top && !line.startsWith(' ')) {
      section = top[1]; cur = null; listKey = null;
      continue;
    }
    if (section === 'open-seams') {
      const it = noComment.match(/^\s*-\s+(.+)$/);
      if (it) out.openSeams.push(it[1].trim().replace(/^["']|["']$/g, ''));
      continue;
    }
    if (section === 'meta') {
      // meta упрощённо: только скалярные kv верхнего уровня meta (version/date/author/layout)
      const kv = noComment.match(/^\s{2}([A-Za-z0-9_-]+):\s*(.+)$/);
      if (kv && !kv[2].startsWith('[')) out.meta[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, '');
      continue;
    }
    if (!['districts', 'houses', 'metro'].includes(section)) continue;
    const item = noComment.match(/^\s{2}-\s+id:\s*(.+)$/);
    if (item) {
      cur = { id: item[1].trim().replace(/^["']|["']$/g, '') };
      out[section].push(cur);
      listKey = null;
      continue;
    }
    if (!cur) continue;
    // блочный список: "    key:" затем "      - значение"
    const listStart = noComment.match(/^\s{4}([A-Za-z0-9_-]+):\s*$/);
    if (listStart) { cur[listStart[1]] = []; listKey = listStart[1]; continue; }
    const listItem = noComment.match(/^\s{6}-\s+(.+)$/);
    if (listItem && listKey) {
      cur[listKey].push(listItem[1].trim().replace(/^["']|["']$/g, ''));
      continue;
    }
    const kv = noComment.match(/^\s{4}([A-Za-z0-9_-]+):\s*(.*)$/);
    if (kv) {
      listKey = null;
      const [, key, valRaw] = kv;
      const val = valRaw.trim();
      if (val.startsWith('[')) { cur[key] = parseInlineArray(val); continue; }
      cur[key] = val.replace(/^["']|["']$/g, '');
    }
  }
  return out;
}
function parseGrid(s) {
  if (!s) return null;
  const m = String(s).match(/gx:\s*([\d.]+).*?gy:\s*([\d.]+).*?w:\s*([\d.]+).*?d:\s*([\d.]+)/);
  if (!m) return null;
  return { gx: Number(m[1]), gy: Number(m[2]), w: Number(m[3]), d: Number(m[4]) };
}
function parseMetrics(s) {
  if (!s) return null;
  const m = String(s).match(/loc:\s*(-?[\d.]+).*?files:\s*(-?[\d.]+).*?t30:\s*(-?[\d.]+)/);
  if (!m) return null;
  return { loc: Number(m[1]), files: Number(m[2]), t30: Number(m[3]) };
}
function parseVia(s) {
  if (!s) return undefined;
  return String(s).split(';').map(p => p.split(',').map(Number));
}

// ── tour.yaml (минимальный парсер: stops как блочный список kv) ──
function parseTour(text) {
  const stops = [];
  let cur = null;
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\t/g, '  ').replace(/#.*$/, '').replace(/\s+$/, '');
    if (!line.trim()) continue;
    const item = line.match(/^\s{2}-\s+building:\s*(.+)$/);
    if (item) { cur = { building: item[1].trim() }; stops.push(cur); continue; }
    if (!cur) continue;
    const kv = line.match(/^\s{4}([A-Za-z0-9_-]+):\s*(.+)$/);
    if (kv) {
      const v = kv[2].trim().replace(/^["']|["']$/g, '');
      cur[kv[1]] = kv[1] === 'dur' || kv[1] === 'zoom' ? Number(v) : v;
    }
  }
  return stops;
}

const yamlText = readFileSync(YAML_PATH, 'utf8');
const parsed = parseYaml(yamlText);
const warnings = [];
const errors = [];

// ── гейты ──
const gates = {};
{
  const gBlock = yamlText.match(/gates:\n((?:\s{4,}-.*|\s{6,}\S.*)*)/);
  if (gBlock) {
    let gm;
    const re1 = /id:\s*(\S+)/g;
    while ((gm = re1.exec(gBlock[1]))) gates[gm[1]] = 'open';
    const re2 = /id:\s*(\S+)[\s\S]*?state:\s*(\S+)/g;
    while ((gm = re2.exec(gBlock[1]))) gates[gm[1]] = gm[2];
  }
}

// ── кварталы ──
const districts = parsed.districts.map(d => {
  const g = parseGrid(d.grid) || { gx: 0, gy: 0, w: 1, d: 1 };
  return { id: d.id, name: d.name || d.id, hue: d.hue || 'core', ...g };
});
const districtIds = new Set(districts.map(d => d.id));

// ── метрики ПК (если есть) ──
let pcMetrics = {};
if (existsSync(METRICS_PATH)) {
  try { pcMetrics = JSON.parse(readFileSync(METRICS_PATH, 'utf8')); } catch (e) {
    warnings.push('city-metrics.json не парсится: ' + e.message);
  }
}

// ── здания ──
const buildings = [];
const infraNodes = new Set(); // render:none узлы (подземка) — легитимные станции метро, но не здания
for (const h of parsed.houses) {
  // render:none (подземка) и render:external (за городом) рисуются отдельно, не здания
  if (h.render === 'none' || h.render === 'external') {
    if (h.render === 'none') infraNodes.add(h.key || h.id);
    continue;
  }
  const key = h.key || h.id;
  const g = parseGrid(h.grid);
  const m = parseMetrics(h.metrics);
  const pc = pcMetrics[key] || {};
  const b = {
    id: key,
    name: h.quarter || key,
    vmo: h.id,
    dist: h.district,
    arch: h.arch || 'lab',
    st: h.status || 'alive',
    ...(g || { gx: 0, gy: 0, w: 1, d: 1 }),
    loc: 'loc' in pc ? pc.loc : (m ? m.loc : 0),
    files: 'files' in pc ? pc.files : (m ? m.files : 0),
    t30: 't30' in pc ? pc.t30 : (m ? m.t30 : -1),
    // З-6 слой 2: перегретые цеха (hotspot = churn90×loc/100, модель Tornhill)
    churn90: pc.churn90 != null ? pc.churn90 : null,
    hotspot: pc.hotspot != null ? pc.hotspot : null,
    hot: pc.hot === true,
    // З-6 слой 1: история города (birth = год первого коммита старейшего файла)
    birth: pc.birth != null ? pc.birth : null,
    route: h.route || null,
    what: h.what || '',
    gives: Array.isArray(h.gives) ? h.gives : [],
    // v0.3: этаж = файл (floors); rooms — legacy-псевдоним v0.2
    // v0.3.2: метки этажей [dark-code]/[dark-doc]/[shelved]/[backlog] — парсится из названия
    rooms: (Array.isArray(h.floors) && h.floors.length ? h.floors : (Array.isArray(h.rooms) ? h.rooms : [])).map(r => {
      const raw = String(r);
      const mark = raw.match(/\[(dark-code|dark-doc|shelved|backlog)\]/i);
      const clean = raw.replace(/\s*\[(dark-code|dark-doc|shelved|backlog)\]/i, '').trim();
      const i = clean.indexOf('|');
      const room = i === -1 ? { n: clean, d: '' } : { n: clean.slice(0, i), d: clean.slice(i + 1) };
      if (mark) room.mark = mark[1].toLowerCase();
      return room;
    }),
    mods: Array.isArray(h.modules) ? h.modules : [],
    owner: h.owner || 'center/007'
  };
  if (h.frozen) b.frozen = h.frozen;
  if (h.gate) b.gate = h.gate;
  buildings.push(b);
}
const buildingIds = new Set(buildings.map(b => b.id));

// ── метро ──
const metro = parsed.metro.map(m => ({
  id: m.id, from: m.from, to: m.to === 'none' ? null : m.to,
  ev: m.ev, pulse: Number(m.pulse || 0), via: parseVia(m.via)
}));

// ── валидация (дисциплина frozen-guard для города) ──
for (const b of buildings) {
  if (!b.what) errors.push(`${b.id}: нет what (здание должно говорить по-человечески)`);
  if (!b.gives.length) errors.push(`${b.id}: нет gives (что даёт пользователю)`);
  // v0.3: этаж = файл. alive/demo ОБЯЗАНЫ иметь этажи; planned — стройка, floors может быть пуст.
  if ((b.st === 'alive' || b.st === 'demo') && !b.rooms.length)
    errors.push(`${b.id}: живой режим без этажей (floors) — тёмное здание, снести или описать этажи (Никита 01:14)`);
  if (b.st === 'planned' && b.rooms.length === 0 && b.mods.length === 0)
    warnings.push(`${b.id}: planned без файлов — тёмный этаж .gitkeep; стройка после гейта`);
  else if ((b.st === 'alive' || b.st === 'demo') && b.rooms.some(r => /^тёмный этаж/i.test(r.n)))
    errors.push(`${b.id}: живой режим с тёмным этажом — снести или переназвать этаж`);
  if (!STATUSES.has(b.st)) errors.push(`${b.id}: неизвестный статус ${b.st}`);
  if (!ARCHS.has(b.arch)) errors.push(`${b.id}: неизвестный архетип ${b.arch}`);
  if (!districtIds.has(b.dist)) errors.push(`${b.id}: квартал ${b.dist} не найден`);
  if (b.gx < 0 || b.gy < 0 || b.gx + b.w > GRID_W || b.gy + b.d > GRID_D)
    errors.push(`${b.id}: grid вне границ города (15x14)`);
  if (b.gate && !(b.gate in gates)) errors.push(`${b.id}: гейт ${b.gate} не объявлен в meta.gates`);
  if (b.t30 === -1) warnings.push(`${b.id}: t30 не посчитан — ПК: node team-m/bLb/city-metrics.mjs`);
  if (b.st === 'planned' && (b.loc > 0 || b.files > 0))
    warnings.push(`${b.id}: planned, но loc/files > 0 — проверь статус (режим заявлен, файлы есть)`);
  // З-6: перегретый цех — ранний сигнал для 001/002 (рефактор-цели по данным)
  if (b.hot) warnings.push(`${b.id}: 🔥 ПЕРЕГРЕТЫЙ ЦЕХ — hotspot=${b.hotspot}, churn90=${b.churn90} (порог: hotspot>1000 И churn90>50) — рефактор-кандидат, телеметрия bLb`);
  if (b.birth && b.birth < 2025) warnings.push(`${b.id}: старожил с ${b.birth} — слой «история города» (паттерн Gource)`);
}
for (const m of metro) {
  if (!buildingIds.has(m.from) && !infraNodes.has(m.from)) errors.push(`metro ${m.id}: from=${m.from} нет среди зданий`);
  if (m.to && m.to !== 'none' && !buildingIds.has(m.to) && !infraNodes.has(m.to)) errors.push(`metro ${m.id}: to=${m.to} нет среди зданий`);
  if (!REAL_EVENTS.has(m.ev) && !m.ev.startsWith('city:'))
    errors.push(`metro ${m.id}: событие ${m.ev} не в реестре EventBus v2 и не city:*`);
}
// здания без линий метро (информационно)
for (const b of buildings) {
  const linked = metro.some(m => m.from === b.id || m.to === b.id);
  if (!linked) warnings.push(`${b.id}: нет ни одной линии метро — здание молчит в эфире событий`);
}

// ── тур ──
let tour = [];
if (existsSync(TOUR_PATH)) {
  tour = parseTour(readFileSync(TOUR_PATH, 'utf8'));
  for (const t of tour) if (!buildingIds.has(t.building) && t.building !== 'center')
    errors.push(`tour: остановка ${t.building} не найдена среди зданий`);
} else warnings.push('tour.yaml отсутствует — тур останется хардкодом HTML');

// ── итог ──
if (errors.length) {
  console.error('ОШИБКИ КАДАСТРА:');
  errors.forEach(e => console.error('  ✗ ' + e));
  process.exit(1);
}

const state = {
  meta: {
    city: 'beLiveBase',
    phase: 'Phase 0 · чертежи',
    updated: new Date().toISOString().slice(0, 10),
    cadastre: `houses.yaml ${parsed.meta.version || '?'}`,
    gates
  },
  districts,
  buildings,
  metro
};

writeFileSync(JSON_PATH, JSON.stringify(state, null, 2) + '\n');

// ── инъекция в тихий город ──
const html = readFileSync(HTML_PATH, 'utf8');
function inject(htmlText, start, end, body) {
  const i0 = htmlText.indexOf(start), i1 = htmlText.indexOf(end);
  if (i0 === -1 || i1 === -1) throw new Error(`в HTML нет маркеров ${start}`);
  return htmlText.slice(0, i0) + start + '\n' + body + '\n' + htmlText.slice(i1);
}
let out = inject(html, '/*CITY-STATE-START*/', '/*CITY-STATE-END*/',
  `const CITY = ${JSON.stringify(state, null, 2)};`);
if (tour.length) {
  out = inject(out, '/*TOUR-START*/', '/*TOUR-END*/',
    `const TOUR = ${JSON.stringify(tour, null, 2)};`);
}
writeFileSync(HTML_PATH, out);

console.log(`city-gen: ${buildings.length} зданий, ${districts.length} кварталов, ${metro.length} линий метро, тур: ${tour.length} остановок`);
if (warnings.length) { console.log('ПРЕДУПРЕЖДЕНИЯ:'); warnings.forEach(w => console.log('  ⚠ ' + w)); }
else console.log('drift: нет');
console.log(`записано: ${JSON_PATH}, ${HTML_PATH}`);
