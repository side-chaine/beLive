#!/usr/bin/env node
// beLiveBase city-metrics v2: loc/files/t30 + churn90/hotspot + birth-year по modules -> city-metrics.json
// Запуск на ПК (локальный git + node): node team-m/bLb/city-metrics.mjs
// t30 = файлы, тронутые за 30 дней; churn90 = коммиты на файл за 90 дней;
// hotspot = churn90 × loc/100 (модель Tornhill/CodeScene — формула наша, churn×size);
// birth = год первого коммита файла (слой «история города», паттерн Gource — без GPL-кода).
// Результат подбирает city-gen.mjs и перекрывает им yaml-метрики.

import { readFileSync, writeFileSync, statSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const DIR = dirname(fileURLToPath(import.meta.url));
const REPO = join(DIR, '..', '..'); // корень beLive
const YAML_PATH = join(DIR, 'houses.yaml');
const OUT_PATH = join(DIR, 'city-metrics.json');
const EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.css']);
const DAYS = 30, CHURN_DAYS = 90;
const HOTSPOT_THRESHOLD = 1000; // перегретый цех по hotspot (churn90×loc/100); young-repo калибровка 707: >1000

function parseModuleLists(text) {
  const res = [];
  // CEO_1-fix (04.09): парсить ТОЛЬКО секцию houses: — иначе регексп ловит районы
  // и метро (id: с теми же отступами), у них нет modules => «нули из ничего».
  const h0 = text.indexOf('\nhouses:');
  const m0 = text.indexOf('\nmetro:');
  const section = (h0 !== -1) ? text.slice(h0, m0 !== -1 ? m0 : undefined) : text;
  let cur = null;
  for (const raw of section.split('\n')) {
    const line = raw.replace(/#.*$/, '').replace(/\s+$/, '');
    const id = line.match(/^\s{2}-\s+id:\s*(.+)$/);
    if (id) { cur = { id: id[1].trim(), modules: [] }; res.push(cur); continue; }
    if (!cur) continue;
    const key = line.match(/^\s{4}key:\s*(.+)$/);
    if (key) { cur.key = key[1].trim(); continue; }
    const mods = line.match(/^\s{4}modules:\s*\[(.*)\]$/);
    if (mods) cur.modules = mods[1].split(',').map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
  }
  return res;
}

function walk(dir, files = []) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return files; }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, files);
    else if (EXT.has(p.slice(p.lastIndexOf('.')))) files.push(p);
  }
  return files;
}

function countLines(file) {
  try { return readFileSync(file, 'utf8').split('\n').length; } catch { return 0; }
}

// ── один git-вызов: имя файла → { touch30, churn90, birth } ──
const fileStats = new Map(); // rel -> {t30,churn,birth}
try {
  // 1) всё живое дерево: создатели и даты (одним логом)
  const logOut = execSync(
    `git log --numstat --format='%ad' --date=short --diff-filter=AM`,
    { cwd: REPO, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 }
  );
  let curDate = null;
  for (const line of logOut.split('\n')) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(line.trim())) { curDate = line.trim(); continue; }
    const m = line.match(/^(\d+)\s+(\d+)\s+(.+)$/);
    if (m && curDate) {
      const rel = m[3].trim();
      const s = fileStats.get(rel) || { t30: 0, churn: 0, birth: null };
      s.churn++; // коммит тронул файл (окно 90д отфильтруем по дате ниже)
      if (!s.birth) s.birth = Number(curDate.slice(0, 4));
      // churn90: считаем только коммиты моложе 90 дней
      const days = (Date.now() - new Date(curDate).getTime()) / 86400000;
      if (days <= CHURN_DAYS) s.churn90 = (s.churn90 || 0) + 1;
      if (days <= DAYS) s.t30++;
      fileStats.set(rel, s);
    }
  }
} catch (e) {
  console.error('git log не удался — t30/churn будут -1:', e.message);
}

const houses = parseModuleLists(readFileSync(YAML_PATH, 'utf8'));
const metrics = {};
for (const h of houses) {
  const key = h.key || h.id;
  let loc = 0, files = 0, t30 = 0, churnSum = 0, birthMin = null, any = false;
  for (const mod of h.modules) {
    const abs = join(REPO, mod);
    let list = [];
    if (!existsSync(abs)) continue;
    any = true;
    if (statSync(abs).isDirectory()) list = walk(abs);
    else if (EXT.has(mod.slice(mod.lastIndexOf('.')))) list = [abs];
    files += list.length;
    for (const f of list) {
      loc += countLines(f);
      const rel = f.slice(REPO.length + 1);
      const st = fileStats.get(rel);
      if (st) {
        if (st.t30) t30++;
        churnSum += (st.churn90 || 0);
        if (st.birth && (!birthMin || st.birth < birthMin)) birthMin = st.birth;
      }
    }
  }
  const hotspot = Math.round(churnSum * (loc / 100));
  metrics[key] = {
    loc, files,
    t30: any || fileStats.size ? t30 : -1,
    churn90: churnSum,
    hotspot,
    hot: hotspot > HOTSPOT_THRESHOLD && churnSum > 50, // hotspot>1000 И churn90>50 (оба условия — молодой репо)
    birth: birthMin,
    metric: birthMin ? `${birthMin}—2026` : null
  };
  console.log(`${key}: ${loc} loc, ${files} files, t30=${t30}, churn90=${churnSum}, hotspot=${hotspot}${metrics[key].hot ? ' 🔥' : ''}, birth=${birthMin || '?'}`);
}
writeFileSync(OUT_PATH, JSON.stringify(metrics, null, 2) + '\n');
console.log(`записано: ${OUT_PATH}`);
