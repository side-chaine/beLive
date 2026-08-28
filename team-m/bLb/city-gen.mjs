#!/usr/bin/env node
// beLiveBase city-gen: houses.yaml + LAYOUT -> city-state.json + bLb-SNAPSHOT.html
// Запуск на ПК (есть node): node team-m/bLb/city-gen.mjs
// Без внешних зависимостей: парсер houses.yaml минимальный, под известную структуру файла.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = dirname(fileURLToPath(import.meta.url));
const YAML_PATH = join(DIR, 'houses.yaml');
const JSON_PATH = join(DIR, 'city-state.json');
const HTML_PATH = join(DIR, 'bLb-SNAPSHOT.html');

const LAYOUT = [
  { id: 'gates', name: 'Врата', quarter: '001', gx: 4, gy: 7, h: 26, human: 'Вход в город. Гость заходит без забора и сразу начинает творить.' },
  { id: 'catalog', name: 'Площадь Каталог', quarter: '002', gx: 4, gy: 5, h: 30, human: 'Центральная площадь: витрина треков и PORT-дропзона.' },
  { id: 'studio', name: 'Завод Studio', quarter: '003-005', gx: 6, gy: 5, h: 40, human: 'Здесь рождаются треки: аудио-движок и стем-микшер. Ядро заморожено (охраняется).', note: 'frozen: AudioEngineV2, patchV1' },
  { id: 'academy', name: 'Академия Quest', quarter: '006-008', gx: 2, gy: 6, h: 34, human: 'Кампус практики: тейки, упражнения, сценарии.' },
  { id: 'show', name: 'Театр Show', quarter: '009-010', gx: 3, gy: 4, h: 36, human: 'Театр выступлений: движок историй и сцены.' },
  { id: 'split', name: 'Башня Split', quarter: '011', gx: 6, gy: 3, h: 44, human: 'Башня мониторинга и микса.' },
  { id: 'styles', name: 'Ателье Styles', quarter: '012', gx: 2, gy: 4, h: 30, human: 'Ателье стиля: темы, текстовые стили, пресеты.' },
  { id: 'notes', name: 'Лаб Notes', quarter: '013', gx: 7, gy: 4, h: 32, human: 'Лаборатория нот: детекция питча, пианино.' },
  { id: 'billy', name: 'Башня Билли', quarter: '014', gx: 5, gy: 3, h: 56, human: 'Башня Билли: мозг AI-персонажа, его голос и эмоции.' },
  { id: 'sync', name: 'Мастерская Sync', quarter: '018-019', gx: 3, gy: 6, h: 34, human: 'Мастерская синхронизации лирики: маркеры и word-sync.', note: 'FROZEN-READ: wordSync/markers stores' },
  { id: 'hub', name: 'Площадь Hub', quarter: '020', gx: 5, gy: 5, h: 28, human: 'Площадь ленты: фид и профили (демо-режим).', status: 'alive-demo' },
  { id: 'arenas', name: 'Арены Karaoke/Concert', quarter: '021-022', gx: 3, gy: 2, h: 38, human: 'Арены будущего: караоке и концерт. Чертёж готов — стройка после Репетиции.', status: 'planned' },
  { id: 'live', name: 'Арена Live', quarter: '023', gx: 4, gy: 2, h: 36, human: 'Живая арена: субтитры и live-контролы.' },
  { id: 'profile', name: 'Дом профиля', quarter: '029-030', gx: 1, gy: 5, h: 30, human: 'Дом жителя: профиль и аватар.' },
  { id: 'aiconfig', name: 'AI Подстанция', quarter: '031', gx: 6, gy: 2, h: 26, human: 'AI-подстанция: законсервирована до лучших времён.', status: 'conserved' },
  { id: 'scenes', name: 'Киностудия фонов', quarter: '032', gx: 1, gy: 3, h: 30, human: 'Киностудия: фоны режимов и блочные сцены.' },
  { id: 'dna', name: 'Архив ДНК', quarter: '034', gx: 1, gy: 4, h: 28, human: 'Архив ДНК треков: метаданные и структура.' },
  { id: 'blocks-old', name: 'Старая мастерская', quarter: '038', gx: 7, gy: 2, h: 24, human: 'Старая мастерская блоков: огорожена, под снос (W5, BAC-107).', status: 'trash-w5' },
  { id: 'infra', name: 'Подземка', quarter: 'infra', gx: 0, gy: 0, h: 0, human: 'Подземка города: EventBus-станция, старые мосты (исторические), scheduler-доставка.' },
  { id: 'external', name: 'За городом', quarter: 'external', gx: 0, gy: 0, h: 0, human: 'За горизонтом: склад Bank_beLive и облачные электростанции CF Workers.', status: 'external' }
];

const GOALS = [
  { icon: '🏗', text: 'ПК сносит мусор (W4/W5) — расчищаем кварталы' },
  { icon: '🎤', text: 'Репетиция → прод — первое здание на полную мощность' },
  { icon: '🎭', text: 'Потом — стройка Арен: Karaoke / Concert / Live' },
  { icon: '🗺', text: 'MVP-1 города: кадастр + генератор + карта' }
];

function parseInlineArray(s) {
  const inner = s.trim().replace(/^\[/, '').replace(/\]$/, '');
  if (!inner.trim()) return [];
  return inner.split(',').map(x => x.trim().replace(/^["']|["']$/g, ''));
}

function parseHousesYaml(text) {
  const houses = [];
  let cur = null;
  let blockKey = null;
  let blockBuf = [];
  const flushBlock = () => {
    if (cur && blockKey) cur[blockKey] = blockBuf.join(' ').replace(/\s+/g, ' ').trim();
    blockKey = null; blockBuf = [];
  };
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\t/g, '  ');
    const noComment = line.replace(/#.*$/, '').replace(/\s+$/, '');
    if (!noComment.trim()) continue;
    const item = noComment.match(/^\s*-\s+id:\s*(.+)$/);
    if (item) {
      flushBlock();
      cur = { id: item[1].trim().replace(/^["']|["']$/g, ''), modules: [] };
      houses.push(cur);
      continue;
    }
    if (!cur) continue;
    const kv = noComment.match(/^\s{4,}([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!kv) {
      if (blockKey) blockBuf.push(noComment.trim());
      continue;
    }
    flushBlock();
    const [, key, valRaw] = kv;
    const val = valRaw.trim();
    if (val === '>' || val === '|') { blockKey = key; continue; }
    if (val.startsWith('[')) { cur[key] = parseInlineArray(val); continue; }
    cur[key] = val.replace(/^["']|["']$/g, '');
  }
  flushBlock();
  return houses;
}

function normStatus(s) {
  if (!s) return 'alive';
  if (s.startsWith('trash')) return s;
  if (['alive', 'alive-demo', 'planned', 'conserved', 'external', 'placeholder'].includes(s)) return s;
  return 'alive';
}

const yamlText = readFileSync(YAML_PATH, 'utf8');
const houses = parseHousesYaml(yamlText);
const byQuarter = new Map(houses.map(h => [h.id, h]));

const warnings = [];
const buildings = LAYOUT.map(l => {
  const src = byQuarter.get(l.quarter);
  const b = { ...l, status: l.status || normStatus(src && src.status), modules: [], owner: 'center/007' };
  if (!src) { warnings.push(`layout ${l.id}: квартал ${l.quarter} не найден в houses.yaml`); return b; }
  b.modules = Array.isArray(src.modules) ? src.modules : [];
  if (src.owner) b.owner = String(src.owner).slice(0, 80);
  if (src.status && !l.status) b.status = normStatus(src.status);
  return b;
});

const layoutQuarters = new Set(LAYOUT.map(l => l.quarter));
for (const h of houses) if (!layoutQuarters.has(h.id)) warnings.push(`houses.yaml: квартал ${h.id} не на карте — добавить в LAYOUT`);

const state = {
  meta: {
    city: 'beLiveBase',
    title: 'Город будущего',
    phase: 'Phase 0 — чертежи',
    updated: new Date().toISOString().slice(0, 10),
    source: 'city-gen.mjs из houses.yaml',
    style: 'warcraft-dune-skeleton'
  },
  goals: GOALS,
  buildings
};

writeFileSync(JSON_PATH, JSON.stringify(state, null, 2) + '\n');

const html = readFileSync(HTML_PATH, 'utf8');
const START = '/*CITY-STATE-START*/', END = '/*CITY-STATE-END*/';
const i0 = html.indexOf(START), i1 = html.indexOf(END);
if (i0 === -1 || i1 === -1) throw new Error('в bLb-SNAPSHOT.html нет маркеров CITY-STATE');
const injected = `${START}\nconst CITY_STATE = ${JSON.stringify(state, null, 2)};\n${END}`;
writeFileSync(HTML_PATH, html.slice(0, i0) + injected + html.slice(i1 + END.length));

console.log(`city-gen: ${buildings.length} зданий, houses.yaml кварталов: ${houses.length}`);
if (warnings.length) { console.log('DRIFT:'); warnings.forEach(w => console.log('  ⚠ ' + w)); }
else console.log('drift: нет');
console.log(`записано: ${JSON_PATH}, ${HTML_PATH}`);
