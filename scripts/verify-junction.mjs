#!/usr/bin/env node
// scripts/verify-junction.mjs — G-7 gate «Стык»: ассерт на ПАРУ мест (registry = истина).
// Контракт §4 MICRO-PACK-G7-IMPL-2026-09-05 (блоки 1-6). Node: fs/path/url + execSync (tracked-истина, прецедент docvis:37).
// Реестр: scripts/junction-registry.yaml (замороженный формат §2.1; a/b = flow-JSON; комментарии #).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const rel = (p) => relative(root, p);

// ── Блок 1 · yaml-микропарсер (замороженный формат) ──
function parseRegistry() {
  const src = readFileSync(join(root, 'scripts', 'junction-registry.yaml'), 'utf8');
  const pairs = [];
  let cur = null;
  src.split('\n').forEach((raw, i) => {
    if (!raw.trim() || raw.trim().startsWith('#')) return;          // пустые и #-строки — skip
    const cut = raw.indexOf(' #');                                  // комментарий после значения
    const line = (cut === -1 ? raw : raw.slice(0, cut)).trim();
    if (!line) return;
    const idm = line.match(/^- id:\s*(\S+)/);
    if (idm) { if (cur) pairs.push(cur); cur = { id: idm[1] }; return; }   // flush на следующем - id
    if (!cur) { console.error(`registry: format break: ${i + 1}: ${raw}`); process.exit(1); }
    const km = line.match(/^([a-zA-Z0-9_]+):\s*(.*)$/);
    if (!km) { console.error(`registry: format break: ${i + 1}: ${raw}`); process.exit(1); }
    const key = km[1], val = km[2].trim();
    try { cur[key] = (key === 'a' || key === 'b') ? JSON.parse(val) : val; }  // b опционален (пара 4)
    catch { console.error(`registry: format break: ${i + 1}: ${raw}`); process.exit(1); }
  });
  if (cur) pairs.push(cur);                                          // flush на EOF
  return pairs;
}

// ── Блок 2 · TOML-резолв ПО ТАБЛИЦЕ (поправка-А, сердце) ──
function parseTomlTables(file) {
  const src = readFileSync(join(root, file), 'utf8');
  const tables = [];
  let cur = null;
  src.split('\n').forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith('#')) return;                       // [002-стресс]: # после trim — skip
    const tm = line.match(/^\[\[([^\]]+)\]\]$/);
    if (tm) { cur = { section: tm[1], kv: {}, kvLine: {} }; tables.push(cur); return; }
    if (!cur) return;                                                // вне корневых [[..]] — не наши ключи
    const eq = line.indexOf('=');
    if (eq === -1) return;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1);
    const cs = val.indexOf(' #');
    if (cs !== -1) val = val.slice(0, cs);
    val = val.trim();
    if (val.length >= 2 && (val[0] === '"' && val.endsWith('"')) || (val[0] === "'" && val.endsWith("'"))) val = val.slice(1, -1);
    cur.kv[key] = val;
    cur.kvLine[key] = i + 1;
  });
  return tables;
}
function resolveToml(file, p) {
  return parseTomlTables(file).filter((t) => t.section === p.b.section && t.kv.binding === p.b.binding);
}

// ── Блок 3 · читатели A-сторон по kind ──
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function aEnvInCode(p) {                                             // пары 1, 2, 5
  let src;
  try { src = readFileSync(join(root, p.a.file), 'utf8'); } catch { return null; }
  const re = new RegExp(`\\b${escRe(p.a.env)}\\b`);
  const lines = src.split('\n');
  for (let i = 0; i < lines.length; i++) if (re.test(lines[i])) return { file: p.a.file, line: i + 1 };
  return null;
}
function workerIndex() {                                             // tracked-истина: git ls-files '*wrangler.toml'
  const readNames = (files) => {
    const out = new Map();
    for (const f of files) {
      let txt;
      try { txt = readFileSync(join(root, f), 'utf8'); } catch { continue; }
      const lines = txt.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const m = lines[i].match(/^\s*name\s*=\s*"([^"]+)"/);
        if (m) { if (!out.has(m[1])) out.set(m[1], { file: rel(join(root, f)), line: i + 1 }); break; }
      }
    }
    return out;
  };
  let tracked;
  try {
    tracked = execSync("git ls-files '*wrangler.toml'", { cwd: root, encoding: 'utf8', stdio: 'pipe' });
  } catch {                                                         // fallback: git нет / не репо
    console.log('  ⚠ tracked-истина недоступна, физический срез');  // деградация; вердикт может отличаться от CI
    const files = [];
    (function walk(dir, depth) {                                    // физический глоб depth≤2 без node_modules
      if (depth > 2) return;
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
        const p = join(dir, e.name);
        if (e.isDirectory()) walk(p, depth + 1);
        else if (e.name === 'wrangler.toml') files.push(rel(p));
      }
    })(root, 0);
    return readNames(files);
  }
  return readNames(tracked.trim().split('\n').map((s) => s.trim()).filter(Boolean)); // пустой вывод = 0 воркеров, НЕ fallback
}
function envFiles() {                                                // пара 3: readdir .env*
  const out = [];
  for (const e of readdirSync(root)) {
    if (!e.startsWith('.env') || !statSync(join(root, e)).isFile()) continue;
    const lines = readFileSync(join(root, e), 'utf8').split('\n');
    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i].trim();
      if (!raw || raw.startsWith('#')) continue;                     // ловушка 3: # коммент — skip
      const eq = raw.indexOf('=');
      if (eq === -1) continue;
      let val = raw.slice(eq + 1).trim();
      if (val.length >= 2 && (val[0] === '"' && val.endsWith('"')) || (val[0] === "'" && val.endsWith("'"))) val = val.slice(1, -1);
      if (!val) continue;                                            // пустые значения — skip
      out.push({ file: e, line: i + 1, key: raw.slice(0, eq).trim(), value: val });
    }
  }
  return out;
}
function classifyHost(v) {                                           // hostname→worker (пара 3)
  let host;
  try { host = new URL(v).hostname; } catch { return { skip: 'not-a-url' }; }
  if (!host) return { skip: 'empty-host' };
  if (host === 'localhost' || /^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return { skip: 'localhost/ip' };
  if (!host.endsWith('.workers.dev')) return { skip: 'external-host' };   // [002-стресс]
  return { worker: host.split('.')[0] };
}
function globCss() {                                                 // пара 4: src/**/*.css + css/*.css
  const out = [];
  (function walk(dir) {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules') continue;
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.css')) out.push(p);
    }
  })(join(root, 'src'));
  for (const e of readdirSync(join(root, 'css'), { withFileTypes: true }))
    if (e.isFile() && e.name.endsWith('.css')) out.push(join(root, 'css', e.name));
  return out;
}
function scanCss(file) {                                             // стек по `{`, skip @media/@keyframes
  const txt = readFileSync(file, 'utf8');
  const stack = [];
  let pre = '';
  const out = [];
  const flush = () => {
    const top = stack[stack.length - 1];
    if (!top || top.at) return;
    const sep = pre.indexOf(':');
    if (sep === -1) return;
    const prop = pre.slice(0, sep).trim();
    const value = pre.slice(sep + 1).trim();
    if (!/^[a-zA-Z-][a-zA-Z0-9-]*$/.test(prop)) return;
    const sel = top.sel.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\s+/g, ' ').trim(); // /* … */ не часть селектора + нормализация
    if (!/[a-zA-Z]/.test(sel)) return;                               // keyframe-проценты и пр. без букв
    out.push({ sel, prop, value });                                  // мультиселектор = ключ как есть
  };
  for (const ch of txt) {
    if (ch === '{') { const sel = pre.trim(); stack.push({ sel, at: stack.some((s) => s.at) || sel.startsWith('@') }); pre = ''; }
    else if (ch === ';') { flush(); pre = ''; }
    else if (ch === '}') { flush(); stack.pop(); pre = ''; }
    else pre += ch;
  }
  return out;
}
function cssDuplicates() {
  const keyCount = new Map();
  for (const f of globCss()) {
    for (const e of scanCss(f)) {
      const k = `${e.sel} { ${e.prop} }`;
      const hit = keyCount.get(k) ?? keyCount.set(k, { count: 0, files: new Set(), values: new Set() }).get(k);
      hit.count++; hit.files.add(rel(f)); hit.values.add(e.value);
    }
  }
  return [...keyCount.entries()].filter(([, h]) => h.count >= 2);    // Ключ в ≥2 файлах → warn
}

// ── Блок 4 · движок правил + сборка строк пары ──
function evalPair(p, workers) {
  const lines = (...l) => l.filter(Boolean);
  switch (p.kind) {
    case 'env-to-toml': {                                            // пара 1
      const a = aEnvInCode(p);
      if (!a) return { type: 'ok', lines: lines(`A ${p.a.file}: env ${p.a.env} не найден → A absent`) };
      const tabs = resolveToml(p.b.file, p);
      if (tabs.length > 1) return { type: 'violation', lines: lines(
        `A ${p.a.file}:${a.line} (${p.a.env})`,
        `B ${p.b.file}: ambiguous binding (${tabs.length} [[${p.b.section}]] с binding ${p.b.binding})`) };
      if (tabs.length === 0) return { type: 'violation', lines: lines(
        `A ${p.a.file}:${a.line} (${p.a.env})`,
        `B ${p.b.file}: нет [[${p.b.section}]] с binding ${p.b.binding} → B absent`) };
      const t = tabs[0];
      const val = t.kv[p.b.attr] ?? '';
      const ln = t.kvLine[p.b.attr] ?? '';
      if (p.b.nonEmpty && !val) return { type: 'violation', lines: lines(
        `A ${p.a.file}:${a.line} (${p.a.env})`,
        `B ${p.b.file}:${ln} (${p.b.attr}="${val}" — nonEmpty нарушен)`) };
      return { type: 'ok', lines: lines(`A ${p.a.file}:${a.line} (${p.a.env})`, `B ${p.b.file}:${ln} (${p.b.attr}="${val}")`) };
    }
    case 'code-to-worker': {                                         // пара 2
      const a = aEnvInCode(p);
      if (!a) return { type: 'ok', lines: lines(`A ${p.a.file}: env ${p.a.env} не найден → A absent`) };
      const w = workers.get(p.b.worker);
      if (!w) return { type: 'violation', lines: lines(
        `A ${p.a.file}:${a.line} (${p.a.env})`,
        `B worker ${p.b.worker}: не найден в tracked workerIndex (git ls-files) → B absent`) };
      return { type: 'ok', lines: lines(`A ${p.a.file}:${a.line} (${p.a.env})`, `B worker ${p.b.worker}: ${w.file}:${w.line}`) };
    }
    case 'env-to-worker': {                                          // пара 3
      const pat = new RegExp('^' + p.a.pattern.split('*').map(escRe).join('.*') + '$');
      const rows = [];
      let viol = false;
      for (const m of envFiles().filter((f) => pat.test(f.key))) {
        const h = classifyHost(m.value);
        if (h.skip) { rows.push(`   skip ${m.file}:${m.line} ${m.key} → ${h.skip} (НЕ violation)`); continue; }
        const w = workers.get(h.worker);
        if (w) rows.push(`   ok   ${m.file}:${m.line} ${m.key} → worker ${h.worker} → ${w.file}:${w.line}`);
        else { rows.push(`   🔴   ${m.file}:${m.line} ${m.key} → worker ${h.worker} НЕ найден в репо`); viol = true; }
      }
      return { type: viol ? 'violation' : 'ok', lines: rows };
    }
    case 'css-dup': {                                                // пара 4 · warn-only
      const dups = cssDuplicates();
      if (dups.length === 0) return { type: 'ok', lines: lines(`A ${p.a.files}: дублей ключей нет`) };
      const head = `${dups.length} dup key(s) в ≥2 файлах (первые 10):`;
      const top = dups.slice(0, 10).map(([k, h]) =>
        `   ${h.count}× ${k} — ${[...h.values].length > 1 ? 'разные значения · ' : ''}${[...h.files].join(', ')}`);
      return { type: 'warn', lines: [head, ...top] };
    }
    case 'kv-cross-worker': {                                        // пара 5 · sameIn
      const a = aEnvInCode(p);
      if (!a) return { type: 'ok', lines: lines(`A ${p.a.file}: env ${p.a.env} не найден → A absent`) };
      const per = p.b.files.map((f) => ({ file: f, tabs: resolveToml(f, p) }));   // per-file резолв
      const amb = per.filter((x) => x.tabs.length > 1);
      if (amb.length > 0) return { type: 'violation', lines: lines(
        `A ${p.a.file}:${a.line} (${p.a.env})`,
        ...amb.map((x) => `B ${x.file}: ambiguous binding (${x.tabs.length} [[${p.b.section}]] с binding ${p.b.binding})`)) };
      const miss = per.filter((x) => x.tabs.length === 0);
      if (miss.length > 0) return { type: 'violation', lines: lines(
        `A ${p.a.file}:${a.line} (${p.a.env})`,
        ...miss.map((x) => `B ${x.file}: нет [[${p.b.section}]] с binding ${p.b.binding} (missing-in-file) [002-стресс]`)) };
      const vals = per.map((x) => ({ x, v: x.tabs[0].kv[p.b.attr] ?? '', ln: x.tabs[0].kvLine[p.b.attr] ?? '' }));
      if (p.b.sameIn && new Set(vals.map((y) => y.v)).size > 1) return { type: 'violation', lines: lines(
        `A ${p.a.file}:${a.line} (${p.a.env})`,
        ...vals.map((y) => `B ${y.x.file}:${y.ln} (${p.b.attr}="${y.v}")`),
        `   sameIn: attr не совпадает во всех files`) };
      return { type: 'ok', lines: lines(`A ${p.a.file}:${a.line} (${p.a.env})`,
        ...vals.map((y) => `B ${y.x.file}:${y.ln} (${p.b.attr}="${y.v}")`), `   sameIn: совпадает во всех files`) };
    }
    case 'secret-external': {                                        // пара 6 · requires cf-token
      let found = false;
      try { found = readFileSync(join(root, p.a.file), 'utf8').split('\n').some((l) => l.includes(p.a.marker)); } catch {}
      return { type: 'unverified', lines: lines(
        `A ${p.a.file}: ${found ? `маркер ${p.a.marker} найден` : `маркер ${p.a.marker} НЕ найден`}`,
        `B external ${p.b.external} + requires ${p.requires}: секрет из репо не проверяется (§6)`) };
    }
    case 'env-to-example': {                                         // пара 7 · warn
      const a = aEnvInCode(p);
      if (!a) return { type: 'ok', lines: lines(`A ${p.a.file}: env ${p.a.env} не найден → A absent`) };
      let has = false;
      try { has = readFileSync(join(root, p.b.file), 'utf8').split('\n').some((l) => {
        const t = l.trim(); return !t.startsWith('#') && t.startsWith(`${p.b.key}=`); }); } catch {}
      if (!has) return { type: 'warn', lines: lines(`A ${p.a.file}:${a.line} (${p.a.env})`, `B ${p.b.file}: ключ ${p.b.key} ОТСУТСТВУЕТ`) };
      return { type: 'ok', lines: lines(`A ${p.a.file}:${a.line} (${p.a.env})`, `B ${p.b.file}: ключ ${p.b.key} presence ✓`) };
    }
    default: return { type: 'ok', lines: [`${p.kind}: kind не распознан`] };
  }
}

// ── Блок 5 + 6 · GRACE, печать, итог, exit ──
const pairs = parseRegistry();
const workers = workerIndex();
const graceCsv = process.env.JUNCTION_GRACE;
const grace = new Set(graceCsv ? graceCsv.split(',').map((s) => s.trim()).filter(Boolean) : []);
const MARK = { ok: '✅ ok', violation: '🔴 violation', warn: '🟡 warn', unverified: '⚪ UNVERIFIABLE', grace: '🟡 GRACE' };
if (graceCsv && graceCsv.trim()) console.log(`⚠ JUNCTION_GRACE active: ${grace.size} id(s)`);   // отравленное окружение видно сразу
const results = pairs.map((p) => ({ p, r: evalPair(p, workers) }));
let violations = 0, warns = 0, unverified = 0, graceCount = 0;
for (const { p, r } of results) {
  let type = r.type;
  if (type === 'violation' && grace.has(p.id)) type = 'grace';
  if (type === 'violation') violations++;
  else if (type === 'warn') warns++;
  else if (type === 'unverified') unverified++;
  else if (type === 'grace') graceCount++;
  console.log(`  ${MARK[type]} ${p.id}` + (type === 'grace' ? ` — жертва живая, CF-батч 🔴` : ''));
  for (const l of r.lines) console.log(l);
}
for (const jid of grace) {                                           // GRACE-STALE: забытый grace виден в каждом логе
  const hit = results.find((x) => x.p.id === jid);
  if (!hit || hit.r.type !== 'violation') console.log(`  🟡 GRACE-STALE (${jid}) — пора снять из deploy.yml`);
}
console.log(`junction: pairs=${pairs.length} violations=${violations} warns=${warns} unverified=${unverified} grace=${graceCount}`);
if (violations > 0) { console.log('G-7: СТЫК РАЗОРВАН'); process.exit(1); }
console.log('G-7: стыки целы');
process.exit(0);