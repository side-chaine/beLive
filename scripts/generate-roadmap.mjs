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
// SOURCE OF TRUTH = <ROADMAP_DIR>/roadmap-data.json, schema belive.roadmap.v2:
//   meta       generated, main, prod (+командные снимки: command, drift, kpi)
//   directions id, title, order
//   nodes      id, title, direction, state, progress 0..100, owner, pr[],
//              blocker, next, detail, updated (+опционально st, priority)
//   edges      from, to, kind=depends|related   (from = предпосылка, to = зависимый)
//
// Связи берутся ТОЛЬКО из edges[]. Порядок узлов в массиве ничего не значит:
// ложной линейной цепочки N0→N8 на карте и в mermaid больше нет.
//
// --check compares GENERATED ARTIFACTS with the committed artifacts. It deliberately
// does NOT compare roadmap-data.json.main with HEAD: main advances on every merge,
// so such a check would be permanently red. The main field is an informational
// snapshot; EXPECTED_MAIN can emit a non-blocking warning about its age.
//
// MIRROR_DIR (optional): a second location (the Windows bridge) that receives the
// generated MD/HTML. This removes the manual "copy from repo to bridge" step which
// would otherwise create a second source of truth. The target must carry the v2
// template (ROADMAP-TEMPLATE:v2): a stale v1 template is refused loudly (exit 3)
// BEFORE any write, because splicing v2 data into it would break the page silently.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const resolveDir = (v) => (isAbsolute(v) ? v : join(ROOT, v));

const BOARD  = resolveDir(process.env.ROADMAP_DIR || 'board');   // canonical location
const MIRROR = process.env.MIRROR_DIR ? resolveDir(process.env.MIRROR_DIR) : null;
const DATA = join(BOARD, 'roadmap-data.json');

const G_START = '<!-- GRAPH:START -->';
const G_END   = '<!-- GRAPH:END -->';
const D_START = '/*DATA:START*/';
const D_END   = '/*DATA:END*/';

// Подпись шаблона v2. v1-шаблон (18 КБ, JS читал DATA.cards/cls) содержит те же
// маркеры DATA:*, поэтому сплайс «удался бы» и сломал цель молча (ловушка MIRROR_DIR
// из ревью CEO, P1-7). Любая цель — BOARD или MIRROR — обязана нести подпись v2.
const TPL_V2 = 'ROADMAP-TEMPLATE:v2';

const args = new Set(process.argv.slice(2));
const esc = (s) => String(s).replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// --- 0. Parse + validate ----------------------------------------------------
let d;
try {
  d = JSON.parse(readFileSync(DATA, 'utf8'));
} catch (e) {
  console.error('✗ INVALID DATA · не читается roadmap-data.json:', e.message);
  process.exit(3);
}

const STATES = new Set(['done', 'active', 'blocked', 'waiting', 'queued', 'risk']);
const EDGE_KINDS = new Set(['depends', 'related']);
const errors = [];
const req = (o, fields, where) => fields.forEach(f => {
  if (o[f] === undefined || o[f] === null || o[f] === '') {errors.push(`${where}: нет обязательного поля "${f}"`);}
});

if (d.schema !== 'belive.roadmap.v2') {errors.push(`schema: ожидался "belive.roadmap.v2", найден ${JSON.stringify(d.schema)} — старую v1 нужно мигрировать`);}
req(d, ['meta', 'directions', 'nodes', 'edges'], 'root');

const dirIds = new Set();
if (!Array.isArray(d.directions) || d.directions.length === 0) {errors.push('directions: ожидается непустой массив направлений');}
(d.directions || []).forEach((x, i) => {
  const w = `directions[${i}] (${x?.id ?? '?'})`;
  if (typeof x !== 'object') { errors.push(`${w}: не объект`); return; }
  req(x, ['id', 'title', 'order'], w);
  if (dirIds.has(x.id)) {errors.push(`${w}: дубликат id направления`);}
  dirIds.add(x.id);
});

if (d.meta && (typeof d.meta.generated !== 'string' || !d.meta.main)) {
  req(d.meta, ['generated', 'main', 'prod'], 'meta');
}

const nodeIds = new Set();
if (!Array.isArray(d.nodes) || d.nodes.length === 0) {errors.push('nodes: ожидается непустой массив узлов');}
(d.nodes || []).forEach((n, i) => {
  const w = `nodes[${i}] (${n?.id ?? '?'})`;
  if (typeof n !== 'object') { errors.push(`${w}: не объект`); return; }
  req(n, ['id', 'title', 'direction', 'state', 'progress', 'owner', 'pr', 'next', 'detail', 'updated'], w);
  if (!('blocker' in n)) {errors.push(`${w}: нет обязательного поля "blocker"`);}
  else if (n.blocker !== null && typeof n.blocker !== 'string') {errors.push(`${w}: blocker — ожидается строка или null`);}
  if (n.state !== undefined && !STATES.has(n.state)) {errors.push(`${w}: state "${n.state}" — нет такого состояния (done|active|blocked|waiting|queued|risk)`);}
  if (n.progress !== undefined && (typeof n.progress !== 'number' || !Number.isInteger(n.progress) || n.progress < 0 || n.progress > 100)) {errors.push(`${w}: progress ${JSON.stringify(n.progress)} — нужно целое число 0..100`);}
  if (n.direction !== undefined && !dirIds.has(n.direction)) {errors.push(`${w}: direction "${n.direction}" не объявлен в directions`);}
  if (n.pr !== undefined && !Array.isArray(n.pr)) {errors.push(`${w}: pr — ожидается массив номеров PR`);}
  if (n.st !== undefined && typeof n.st !== 'string') {errors.push(`${w}: st — ожидается строка`);}
  if (n.priority !== undefined && typeof n.priority !== 'number') {errors.push(`${w}: priority — ожидается число`);}
  if (nodeIds.has(n.id)) {errors.push(`${w}: дубликат id узла`);}
  nodeIds.add(n.id);
});

const edgeSeen = new Set();
(d.edges || []).forEach((e, i) => {
  const w = `edges[${i}]`;
  if (typeof e !== 'object') { errors.push(`${w}: не объект`); return; }
  req(e, ['from', 'to', 'kind'], w);
  if (e.from !== undefined && !nodeIds.has(e.from)) {errors.push(`${w}: from "${e.from}" — такого узла нет (опечатка в id?)`);}
  if (e.to !== undefined && !nodeIds.has(e.to)) {errors.push(`${w}: to "${e.to}" — такого узла нет (опечатка в id?)`);}
  if (e.from && e.from === e.to) {errors.push(`${w}: петля — узел "${e.from}" ссылается сам на себя`);}
  if (e.kind !== undefined && !EDGE_KINDS.has(e.kind)) {errors.push(`${w}: kind "${e.kind}" — ожидается depends|related`);}
  if (e.from && e.to && e.kind) {
    const k = `${e.from}→${e.to} (${e.kind})`;
    if (edgeSeen.has(k)) {errors.push(`${w}: дубликат ребра ${k}`);}
    edgeSeen.add(k);
  }
});

// Узел направления без единого узла — не ошибка, но предупредим (мусор в схеме).
(d.directions || []).forEach(x => {
  if ((d.nodes || []).some(n => n.direction === x.id)) {return;}
  console.warn(`⚠ направление "${x.id}" не содержит ни одного узла`);
});

if (errors.length) {
  console.error(`✗ INVALID DATA · ${errors.length} проблем(а):`);
  errors.forEach(e => console.error('   - ' + e));
  process.exit(3);
}

// --- 1. Mermaid -------------------------------------------------------------
// Сплошная стрелка — жёсткая зависимость, пунктир — мягкая связь («связано»).
// Рёбра — из edges[], никаких цепочек «по порядку массива».
const key = (id) => String(id).replace(/[^A-Za-z0-9_]/g, '_');
const mmd = ['```mermaid',
  '%% Единый граф · beLive · сплошная — жёсткая зависимость, пунктир — «связано»',
  'flowchart LR'];
const orderedDirs = [...d.directions].sort((a, b) => a.order - b.order);
orderedDirs.forEach(dir => {
  const dn = d.nodes.filter(n => n.direction === dir.id);
  if (!dn.length) {return;}
  mmd.push(`  subgraph D${key(dir.id)}["${esc(dir.title)}"]`, '    direction TB');
  dn.forEach(n => {
    const label = [`${n.id} · ${n.title}`, n.st ? esc(n.st) : null, `${n.progress}%`].filter(Boolean);
    mmd.push(`    ${key(n.id)}["${label.join('<br/>')}"]:::${n.state}`);
  });
  mmd.push('  end', '');
});
d.edges.forEach(e => {
  mmd.push(e.kind === 'depends'
    ? `  ${key(e.from)} --> ${key(e.to)}`
    : `  ${key(e.from)} -.- ${key(e.to)}`);
});
mmd.push('',
  '  classDef done fill:#123c2a,stroke:#39d98a,color:#eafff3;',
  '  classDef active fill:#4a3410,stroke:#ffc44d,color:#fff6de;',
  '  classDef blocked fill:#4a1c1c,stroke:#ff6b6b,color:#ffe9e9;',
  '  classDef waiting fill:#33204d,stroke:#a371f7,color:#f3ecff;',
  '  classDef queued fill:#1b2430,stroke:#7f93ad,color:#c9d6e5;',
  '  classDef risk fill:#4a1c1c,stroke:#ff6b6b,color:#ffe9e9,stroke-dasharray:5 4;',
  '```');
const graphBlock = mmd.join('\n');

// --- 2. HTML data block -----------------------------------------------------
// Body only — splice() owns the markers, otherwise they nest on every run.
const dataBlock = `const DATA = ${JSON.stringify(d, null, 2)};`;

// --- 3. splice --------------------------------------------------------------
function splice(text, start, end, body) {
  const a = text.indexOf(start), b = text.indexOf(end);
  if (a < 0 || b < 0 || b < a) {throw new Error(`markers not found: ${start} / ${end}`);}
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

function assertV2Template(dir) {
  const htmlPath = join(dir, 'ROADMAP-GRAPH.html');
  if (!existsSync(htmlPath)) {return;}  // файла нет — его поймает прежняя диагностика ниже
  const t = readText(htmlPath);
  if (t.includes(TPL_V2) && !/DATA\.cards|"cards"\s*:|"cls"\s*:/.test(t)) {return;}
  console.error(`✗ INVALID DATA · ${dir}: ROADMAP-GRAPH.html — шаблон не v2 (нет подписи ${TPL_V2} либо найдены v1-маркеры cards/cls).`);
  console.error('  Старый шаблон читает DATA.cards/cls и данными belive.roadmap.v2 ломается молча.');
  console.error('  Скопируйте в эту папку новый ROADMAP-GRAPH.html и повторите --write. Ничего не записано.');
  process.exit(3);
}

function targets() {
  assertV2Template(BOARD);
  const list = [render(BOARD)];
  if (MIRROR) {
    if (!existsSync(join(MIRROR, 'ROADMAP.md')) || !existsSync(join(MIRROR, 'ROADMAP-GRAPH.html'))) {
      console.error(`✗ INVALID DATA · MIRROR_DIR missing generated templates: ${MIRROR}`);
      process.exit(3);
    }
    assertV2Template(MIRROR);
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
  if (!head.startsWith(String(d.meta.main))) {
    console.warn(`⚠ roadmap snapshot main=${d.meta.main}, current HEAD=${head.slice(0, 12)} — informational, not a gate.`);
  }
}

const summary = `main ${d.meta.main} · ${d.nodes.length} nodes · ${d.directions.length} directions · ${d.edges.length} edges`;

if (args.has('--check')) {
  let stale = false;
  items.forEach(t => {
    if (t.mdNext !== t.mdText)   { console.error(`✗ STALE · ${t.mdPath} — run: node scripts/generate-roadmap.mjs --write`); stale = true; }
    if (t.htmlNext !== t.htmlText) { console.error(`✗ STALE · ${t.htmlPath} — run: node scripts/generate-roadmap.mjs --write`); stale = true; }
  });
  if (stale) {process.exit(1);}
  console.log(`✓ roadmap graph in sync · ${summary} · ${items.length} location(s)`);
  process.exit(0);
}

if (args.has('--write')) {
  items.forEach(t => { writeFileSync(t.mdPath, t.mdNext); writeFileSync(t.htmlPath, t.htmlNext); });
  console.log(`✓ generated · ${summary} · ${items.length} location(s)`);
  process.exit(0);
}

console.error('usage: node scripts/generate-roadmap.mjs --write | --check   [ROADMAP_DIR=... MIRROR_DIR=... EXPECTED_MAIN=...]');
process.exit(2);
