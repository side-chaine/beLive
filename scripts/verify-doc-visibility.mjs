#!/usr/bin/env node
// scripts/verify-doc-visibility.mjs — G-3b gate: privacy boundary is machine-checked.
// Spec: MICRO-PACK-DOCS-REFORM v1.1 §R-4b (CEO_1 → Nikita-ratified).
//   visibility: private + NOT ignored → 🔴 LEAK (private would go public on push)
//   visibility: public  + ignored     → 🟡 invisible (exists for agents, absent for world)
// Warn mode (R-4b goes fail only after the week-of-green rule; D-4 lineage).
// Requires DOC-CENSUS.yaml with counters/meta only — private ZONES are listed below.
import { readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const censusPath = join(root, 'team-m', 'DOC-CENSUS.yaml');
if (!existsSync(censusPath)) { console.error('G-3b: DOC-CENSUS.yaml отсутствует (R-1.0)'); process.exit(1); }

// Private zones per .gitignore (Д-15, verified line-by-line by CEO_1 15:36)
const PRIVATE_ZONES = ['docs/archive/', 'docs/sync/', 'docs/agents/', 'docs/agents-hub/', 'vault/'];

function isIgnored(p) {
  try { execSync(`git check-ignore -q "${p}"`, { cwd: root, stdio: 'pipe' }); return true; } catch { return false; }
}
function zoneOf(p) { return PRIVATE_ZONES.find(z => p.startsWith(z)) || null; }

// Collect every .md on disk in private zones + census-declared visibility records (003's census entries when they land).
let leaks = [], invisibles = [], ok = 0;
for (const zone of PRIVATE_ZONES) {
  let files = [];
  try { files = execSync(`find ${zone} -name '*.md' -type f`, { cwd: root, encoding: 'utf8' }).trim().split('\n').filter(Boolean); } catch { continue; }
  for (const f of files) {
    if (!isIgnored(f)) { leaks.push(`${f} — в приватной зоне, но НЕ под ignore (Д-16: уедет на GitHub при push!)`); }
    else ok++;
  }
}
// Public docs must not be inside ignored zones (invisible class)
let pub = [];
try { pub = execSync("git ls-files 'docs/**/*.md' 'docs/*.md'", { cwd: root, encoding: 'utf8' }).trim().split('\n').filter(Boolean); } catch {}
for (const f of pub) {
  const z = zoneOf(f);
  if (z) invisibles.push(`${f} — tracked, но внутри ignore-зоны ${z} (невидимка)`);
}

console.log(`verify-doc-visibility (G-3b): private-zone files=${ok} ignored ✓, УТЕЧЕК=${leaks.length}, невидимок=${invisibles.length}`);
for (const l of leaks) console.log(`  🔴 LEAK: ${l}`);
for (const i of invisibles) console.log(`  🟡 INVISIBLE: ${i}`);
if (leaks.length === 0 && invisibles.length === 0) console.log('  ✅ граница публичности держится машиной');
// Warn mode: leak would exit 2 in fail-mode (D-4 flip), for now warn
process.exit(0);
