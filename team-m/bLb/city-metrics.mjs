#!/usr/bin/env node
// beLiveBase city-metrics: реальные loc/files/t30 по modules из houses.yaml -> city-metrics.json
// Запуск на ПК (локальный git + node): node team-m/bLb/city-metrics.mjs
// t30 = число файлов модулей, тронутых коммитами за последние 30 дней (git log --since).
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
const DAYS = 30;

function parseModuleLists(text) {
  // минимальный разбор: id/key + modules: [...]
  const res = [];
  let cur = null;
  for (const raw of text.split('\n')) {
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

// файлы, тронутые за последние DAYS дней (весь репо, один вызов git)
let touched = new Set();
try {
  const out = execSync(`git log --since="${DAYS}.days" --name-only --pretty=format:`, {
    cwd: REPO, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024
  });
  touched = new Set(out.split('\n').map(s => s.trim()).filter(Boolean));
} catch (e) {
  console.error('git log не удался — t30 будет -1:', e.message);
}

const houses = parseModuleLists(readFileSync(YAML_PATH, 'utf8'));
const metrics = {};
for (const h of houses) {
  const key = h.key || h.id;
  let loc = 0, files = 0, t30 = 0, any = false;
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
      if (touched.has(rel)) t30++;
    }
  }
  metrics[key] = { loc, files, t30: any || touched.size ? t30 : -1 };
  console.log(`${key}: ${loc} loc, ${files} files, ${t30} touch/${DAYS}d`);
}
writeFileSync(OUT_PATH, JSON.stringify(metrics, null, 2) + '\n');
console.log(`записано: ${OUT_PATH}`);
