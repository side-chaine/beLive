#!/usr/bin/env node
// bLb Frozen-boundary guard · v1 · 007_Мак (Far Light)
// Read-only сканер: ловит НОВЫЕ safe→frozen импорты / V2-глобалы вне allowlist (REGISTRY §7 BAC-101..108).
// НЕ пишет в репо, НЕ коммитит, НЕ PR-ит. Только вывод. Запуск: node frozen-guard.mjs [repo-root]
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(__dirname, '..', '..');
const SRC = path.join(ROOT, 'src');

// --- FROZEN-граница (REGISTRY §1 Frozen Zone + §7) ---
const FROZEN_SPEC = [
  /track\.orchestrator/,          // FROZEN orchestrator
  /patchV1/,                      // FROZEN bootstrap surface
  /AudioEngineV2/,                // FROZEN engine
  /bridges\//,                    // FROZEN bridges/*
  /live-guard/,                   // FROZEN bridge (legacy)
];
// V2-глобалы (BAC-105)
const V2_GLOBALS = [
  'window.audioEngine', 'window.app', 'window.trackCatalog', 'window.liveMode',
  'window.lyricsDisplay', 'window.markerManager', 'window.waveformEditor',
];

// --- ALLOWLIST (легитимные нарушители до флипа, REGISTRY §7) ---
// Импортёры frozen (BAC-101..104,107,108):
const EXPECTED_IMPORT_OFFENDERS = new Set([
  'track.actions.ts', 'QuickActions.tsx', 'MixerPanel.tsx', 'featureFlag.ts',
  'App.tsx', 'main.tsx', 'facade.ts', 'gateway-provider.ts',
]);
// Потребители V2-глобалов (BAC-105 ~12 safe-файлов):
const EXPECTED_GLOBAL_OFFENDERS = new Set([
  'mode-switch.service.ts', 'block-scene.service.ts', 'track.actions.ts', 'FullAvatar.tsx',
  'useStemWaveform.ts', 'useBackgroundManagers.ts', 'trigger-visual.ts', 'MonitorMixPanel.tsx',
  'upload.service.ts', 'live-mode.stub.ts', 'waveformEditor.stub.ts',
]);

// --- district-эвристика (REGISTRY §1) ---
function districtOf(rel) {
  if (/^src\/(audio|services\/track\.orchestrator)/.test(rel)) return 'Audio-core';
  if (/^src\/(lyrics|markers|tracks\/.*lyric)/.test(rel)) return 'Lyrics/Markers';
  if (/^src\/(character|avatar)/.test(rel)) return 'Character-AI';
  if (/^src\/(js\/ui|components|stores|features)/.test(rel)) return 'Avatar/UI';
  if (/^src\/gateway|^src\/workers|^src\/cloud/.test(rel)) return 'Build/Backend';
  if (/frozen|bridges|AudioEngineV2|patchV1/.test(rel)) return 'Frozen';
  return 'Other';
}

const IMPORT_RE = /import\s+(?:[^'"]*from\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;
const GLOBAL_RE = new RegExp(`(${V2_GLOBALS.map(g => g.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g');

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules' && !e.name.startsWith('.')) walk(p, out); }
    else if (/\.(ts|tsx)$/.test(e.name) && !e.name.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

let reds = [];
let expectedHit = 0;
const files = fs.existsSync(SRC) ? walk(SRC) : [];
for (const f of files) {
  const rel = path.relative(ROOT, f).split(path.sep).join('/');
  const base = path.basename(f);
  const isFrozenFile = /(track\.orchestrator|patchV1|AudioEngineV2|bridges\/|live-guard)/.test(rel);
  if (isFrozenFile) continue; // сами frozen-файлы не сканируем (Frozen=НИКТО, только чтение границы)
  const src = fs.readFileSync(f, 'utf8');
  const lines = src.split('\n');
  lines.forEach((line, i) => {
    let m;
    IMPORT_RE.lastIndex = 0;
    while ((m = IMPORT_RE.exec(line))) {
      const spec = m[1] || m[2];
      if (FROZEN_SPEC.some(re => re.test(spec))) {
        if (EXPECTED_IMPORT_OFFENDERS.has(base)) expectedHit++;
        else reds.push({ rel, line: i + 1, kind: 'import', detail: spec, dist: districtOf(rel) });
      }
    }
    GLOBAL_RE.lastIndex = 0;
    while ((m = GLOBAL_RE.exec(line))) {
      if (EXPECTED_GLOBAL_OFFENDERS.has(base)) expectedHit++;
      else reds.push({ rel, line: i + 1, kind: 'V2-global', detail: m[1], dist: districtOf(rel) });
    }
  });
}

console.log('\n=== bLb Frozen-boundary guard v1 ===');
console.log('root :', ROOT);
console.log('scan :', files.length, 'ts/tsx files (frozen excluded)');
console.log('allowlist (REGISTRY §7 BAC-101..108):', EXPECTED_IMPORT_OFFENDERS.size + EXPECTED_GLOBAL_OFFENDERS.size, 'known offenders');
console.log('expected offenders matched :', expectedHit);
if (reds.length === 0) {
  console.log('\nRESULT: 🟢 GREEN — новых нарушений границы Frozen НЕТ. Миграция под стражей.\n');
  process.exit(0);
}
console.log(`\nRESULT: 🔴 RED — ${reds.length} НОВЫХ нарушений границы Frozen (вне allowlist):`);
for (const r of reds.sort((a, b) => a.rel.localeCompare(b.rel))) {
  console.log(`  [${r.dist}] ${r.rel}:${r.line}  ${r.kind} -> ${r.detail}`);
}
console.log('\nДействие: разорвать связь в SAFE-файле (переключить на V3/engine-mode), frozen НЕ трогать.\n');
process.exit(2);
