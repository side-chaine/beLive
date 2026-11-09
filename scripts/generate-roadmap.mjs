#!/usr/bin/env node
// beLive roadmap generator · zero dependencies · Node >= 18
//
//   node scripts/generate-roadmap.mjs --write   # regenerate ROADMAP.md + ROADMAP-GRAPH.html
//   node scripts/generate-roadmap.mjs --check   # CI: fail if committed graph is stale
//
// Exit codes (CI must be able to tell the failures apart):
//   0  in sync            1  STALE (forgot --write)      2  usage
//   3  INVALID DATA (schema/enum/typo)                   4  markers missing
//
// SOURCE OF TRUTH = <ROADMAP_DIR>/roadmap-data.json.
// --check compares GENERATED ARTIFACTS with the committed artifacts. It deliberately
// does NOT compare roadmap-data.json.main with HEAD: main advances on every merge,
// so such a check would be permanently red. The main field is an informational
// snapshot; EXPECTED_MAIN can emit a non-blocking warning about its age.
//
// MIRROR_DIR (optional): a second location (the Windows bridge) that receives the
// generated MD/HTML. This removes the manual "copy from repo to bridge" step which
// would otherwise create a second source of truth.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const resolveDir = (v) => (isAbsolute(v) ? v : join(ROOT, v));

const BOARD  = resolveDir(process.env.ROADMAP_DIR || 'board');   // canonical location
const MIRROR = process.env.MIRROR_DIR ? resolveDir(process.env.MIRROR_DIR) : null;
const DATA = join(BOARD, 'roadmap-data.json');
const MD   = join(BOARD, 'ROADMAP.md');
const HTML = join(BOARD, 'ROADMAP-GRAPH.html');

const G_START = '<!-- GRAPH:START -->';
const G_END   = '<!-- GRAPH:END -->';
const D_START = '/*DATA:START*/';
const D_END   = '/*DATA:END*/';

const args = new Set(process.argv.slice(2));
const esc = (s) => String(s).replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// --- 0. Parse + validate ----------------------------------------------------
let d;
try {
  d = JSON.parse(readFileSync(DATA, 'utf8'));
} catch (e) {
  console.error('✗ INVALID DATA · cannot parse roadmap-data.json:', e.message);
  process.exit(3);
}

const CLS = new Set(['done', 'active', 'queued', 'risk']);
const errors = [];
const req = (o, fields, where) => fields.forEach(f => {
  if (o[f] === undefined || o[f] === null || o[f] === '') errors.push(`${where}: missing "${f}"`);
});

if (d.schema !== 'belive.roadmap.v1') errors.push('schema: expected belive.roadmap.v1');
req(d, ['generated', 'main', 'command', 'drift'], 'root');
if (!Array.isArray(d.kpi) || !d.kpi.every(k => Array.isArray(k) && k.length === 2)) errors.push('kpi: expected array of [value,label]');
if (!Array.isArray(d.nodes) || d.nodes.length === 0) errors.push('nodes: expected non-empty array');
if (!Array.isArray(d.cards)) errors.push('cards: expected array');
if (!Array.isArray(d.open)) errors.push('open: expected array');

const seen = new Set();
(d.nodes || []).forEach((n, i) => {
  const w = `nodes[${i}] (${n?.id ?? '?'})`;
  if (typeof n !== 'object') { errors.push(`${w}: not an object`); return; }
  req(n, ['id', 'nm', 'st', 'cls', 'd', 'who', 'next', 'block'], w);
  if (!CLS.has(n.cls)) errors.push(`${w}: cls "${n.cls}" not in done|active|queued|risk (typo?)`);
  if (typeof n.p !== 'number' || n.p < 0 || n.p > 100) errors.push(`${w}: p must be 0..100`);
  if (seen.has(n.id)) errors.push(`${w}: duplicate id`);
  seen.add(n.id);
});
(d.cards || []).forEach((c, i) => {
  if (typeof c !== 'object') { errors.push(`cards[${i}]: not an object`); return; }
  req(c, ['t', 'd', 'p', 'who', 'next'], `cards[${i}]`);
});
(d.open || []).forEach((o, i) => {
  if (!Array.isArray(o) || o.length !== 2) errors.push(`open[${i}]: expected [title, description]`);
});

if (errors.length) {
  console.error('✗ INVALID DATA · ' + errors.length + ' problem(s):');
  errors.forEach(e => console.error('   - ' + e));
  process.exit(3);
}

// --- 1. Mermaid -------------------------------------------------------------
const key = (n) => n.id.replace(/[^A-Za-z0-9]/g, '');
const mmd = ['```mermaid', 'flowchart LR',
  '  subgraph MOD["🔧 МОДЕРНИЗАЦИЯ · канон NODES.md / NODE-IDS.md"]', '    direction LR'];
d.nodes.forEach(n => mmd.push(`    ${key(n)}["${n.id} ${n.nm}<br/>${esc(n.st)}"]`));
for (let i = 1; i < d.nodes.length; i++) mmd.push(`    ${key(d.nodes[i - 1])} --> ${key(d.nodes[i])}`);
mmd.push('  end', '', '  subgraph PROD["🚀 ПРОДУКТ · уже в main"]', '    direction TB');
d.cards.forEach((c, i) => mmd.push(`    P${i + 1}["${esc(c.t)}<br/>${esc(c.p)}"]`));
mmd.push('  end', '', '  subgraph OPEN["⏳ ЖДЁТ РЕШЕНИЯ НИКИТЫ"]', '    direction TB');
d.open.forEach((o, i) => mmd.push(`    O${i + 1}["${esc(o[0])}"]`));
mmd.push('  end', '',
  `  GATES["🛡️ ГЕЙТЫ<br/>${d.kpi.map(k => esc(k[0]) + ' ' + esc(k[1])).join(' · ')}"]`,
  `  MAIN["main ${d.main}"]`, '',
  `  ${key(d.nodes[1])} -.опирается.-> GATES`,
  `  ${key(d.nodes[2])} -.проверен.-> GATES`,
  '  PROD -.защищено.-> GATES',
  '  O1 -.после GO.-> ' + key(d.nodes[3]),
  '  O5 -.после GO.-> GATES',
  '  MAIN -.истина.-> GATES', '',
  '  classDef done fill:#123c2a,stroke:#39d98a,color:#eafff3;',
  '  classDef active fill:#4a3410,stroke:#ffc44d,color:#fff6de;',
  '  classDef queued fill:#1b2430,stroke:#55657a,color:#c9d6e5;',
  '  classDef risk fill:#4a1c1c,stroke:#ff6b6b,color:#ffe9e9;',
  '  classDef gate fill:#1c2c46,stroke:#6aa9ff,color:#e8f1ff;', '');
for (const cls of CLS) {
  const ids = d.nodes.filter(n => n.cls === cls).map(key);
  if (ids.length) mmd.push(`  class ${ids.join(',')} ${cls};`);
}
mmd.push('  class GATES,MAIN gate;', '```');
const graphBlock = mmd.join('\n');

// --- 2. HTML data block -----------------------------------------------------
// Body only — splice() owns the markers, otherwise they nest on every run.
const dataBlock = `const DATA = ${JSON.stringify(d, null, 2)};`;

// --- 3. splice --------------------------------------------------------------
function splice(text, start, end, body) {
  const a = text.indexOf(start), b = text.indexOf(end);
  if (a < 0 || b < 0 || b < a) throw new Error(`markers not found: ${start} / ${end}`);
  return text.slice(0, a + start.length) + '\n' + body + '\n' + text.slice(b);
}

// Git on Windows may check out CRLF while the generator emits LF. Compare in a
// normalised form, otherwise a fresh `git am` falsely reports STALE locally.
const readText = (p) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

function render(dir) {
  const mdPath = join(dir, 'ROADMAP.md');
  const htmlPath = join(dir, 'ROADMAP-GRAPH.html');
  const mdText = readText(mdPath);
  const htmlText = readText(htmlPath);
  return {
    mdPath, htmlPath, mdText, htmlText,
    mdNext: splice(mdText, G_START, G_END, graphBlock),
    htmlNext: splice(htmlText, D_START, D_END, dataBlock),
  };
}

function targets() {
  const list = [render(BOARD)];
  if (MIRROR) {
    if (!existsSync(join(MIRROR, 'ROADMAP.md')) || !existsSync(join(MIRROR, 'ROADMAP-GRAPH.html'))) {
      console.error(`✗ INVALID DATA · MIRROR_DIR missing generated templates: ${MIRROR}`);
      process.exit(3);
    }
    list.push(render(MIRROR));
  }
  return list;
}

let items;
try { items = targets(); }
catch (e) { console.error('✗ INVALID DATA · ' + e.message); process.exit(4); }

// --- 4. Non-blocking snapshot-age warning -----------------------------------
// Never a failure: main moves on every merge, so the snapshot is expected to lag.
if (process.env.EXPECTED_MAIN) {
  const head = process.env.EXPECTED_MAIN;
  if (!head.startsWith(String(d.main))) {
    console.warn(`⚠ roadmap snapshot main=${d.main}, current HEAD=${head.slice(0, 12)} — informational, not a gate.`);
  }
}

if (args.has('--check')) {
  let stale = false;
  items.forEach(t => {
    const tag = t.mdPath;
    if (t.mdNext !== t.mdText)   { console.error(`✗ STALE · ${tag} — run: node scripts/generate-roadmap.mjs --write`); stale = true; }
    if (t.htmlNext !== t.htmlText) { console.error(`✗ STALE · ${t.htmlPath} — run: node scripts/generate-roadmap.mjs --write`); stale = true; }
  });
  if (stale) process.exit(1);
  console.log(`✓ roadmap graph in sync · main ${d.main} · ${d.nodes.length} nodes · ${d.cards.length} lines · ${items.length} location(s)`);
  process.exit(0);
}

if (args.has('--write')) {
  items.forEach(t => { writeFileSync(t.mdPath, t.mdNext); writeFileSync(t.htmlPath, t.htmlNext); });
  console.log(`✓ generated · main ${d.main} · ${d.nodes.length} nodes · ${d.cards.length} product lines · ${d.open.length} open decisions · ${items.length} location(s)`);
  process.exit(0);
}

console.error('usage: node scripts/generate-roadmap.mjs --write | --check   [ROADMAP_DIR=... MIRROR_DIR=... EXPECTED_MAIN=...]');
process.exit(2);
