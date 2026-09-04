#!/usr/bin/env node
// scripts/verify-reach.mjs — G-1 gate: find unreachable src/ files from roots
// G1-FIX: line-based import parsing — side-effect imports/export-from/dynamic + comment-filter + .d.ts excluded
// Usage: node scripts/verify-reach.mjs
// Parses index.html <script src> tags + src/main.tsx as roots.
// BFS import/from graph (line-based, .ts/.tsx/.js/.mjs, no node_modules).
// Mode: warn, exit 0 always.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { existsSync } from 'node:fs';
import { dirname, join, resolve, relative, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const srcDir = join(root, 'src');
const RE_EXT = /\.(ts|tsx|js|mjs)$/;

// ── 1. Parse index.html <script src> for root files ──
const roots = [];
try {
  const html = readFileSync(join(root, 'index.html'), 'utf8');
  const re = /<script\b[^>]*\bsrc=["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const raw = m[1];
    if (raw.startsWith('/src/') || raw.startsWith('src/')) {
      const abs = join(root, raw.replace(/^\//, ''));
      if (existsSync(abs)) roots.push(abs);
    }
  }
} catch {}

// Always include src/main.tsx as root
const mainTsx = join(srcDir, 'main.tsx');
if (existsSync(mainTsx) && !roots.includes(mainTsx)) roots.push(mainTsx);

// ── 2. Resolve imports (relative + aliased) ──
function resolveImport(fromFile, spec) {
  if (spec.startsWith('.') || spec.startsWith('/')) {
    const base = spec.startsWith('/') ? root : dirname(fromFile);
    const abs = resolve(base, spec);
    // Try exact, then with extensions, then /index
    if (existsSync(abs) && RE_EXT.test(abs)) return abs;
    for (const ext of ['.ts', '.tsx', '.js', '.mjs']) {
      if (existsSync(abs + ext)) return abs + ext;
    }
    for (const ext of ['.ts', '.tsx', '.js', '.mjs']) {
      if (existsSync(join(abs, 'index' + ext))) return join(abs, 'index' + ext);
    }
  }
  return null;
}

// ── 3. BFS import graph (line-based) ──
const RE_IMPORT_FROM  = /^\s*import\s+[^'"]*?from\s+['"]([^'"]+)['"]/;
const RE_IMPORT_SIDE  = /^\s*import\s+['"]([^'"]+)['"]/;
const RE_EXPORT_FROM  = /^\s*export\s+[^'"]*?from\s+['"]([^'"]+)['"]/;
const RE_DYNAMIC      = /import\(\s*['"]([^'"]+)['"]\s*\)/;
const RE_COMMENT_LINE = /^\s*\/\//;
const RE_DYNAMIC_SKIP = /\/\/.*/; // strip trailing comment before import(
// G1-FIX-2 (CEO_1 17:40): многострочная закрывашка `} from 'spec'` + worker-рёбра
const RE_FROM_ANY   = /^\s*\}?[^'"]*?\bfrom\s+['"]([^'"]+)['"]/;
const RE_URL_WORKER = /new\s+URL\(\s*['"]([^'"]+)['"]\s*,\s*import\.meta\.url\s*\)/;

const visited = new Set();
const queue = [...roots];
for (const r of queue) visited.add(r);

while (queue.length > 0) {
  const file = queue.shift();
  let content;
  try { content = readFileSync(file, 'utf8'); } catch { continue; }

  const lines = content.split('\n');
  for (const line of lines) {
    if (RE_COMMENT_LINE.test(line)) continue; // skip full-line comments

    let spec = null;
    // (a) import X from 'spec'
    let m = RE_IMPORT_FROM.exec(line);
    if (m) { spec = m[1]; }
    // (b) import 'spec'  (side-effect)
    if (!spec) { m = RE_IMPORT_SIDE.exec(line); if (m) spec = m[1]; }
    // (c) export ... from 'spec'
    if (!spec) { m = RE_EXPORT_FROM.exec(line); if (m) spec = m[1]; }
    // (d) dynamic import('spec') — strip trailing comment first
    if (!spec) {
      const stripped = line.replace(RE_DYNAMIC_SKIP, '');
      m = RE_DYNAMIC.exec(stripped);
      if (m) spec = m[1];
    }
    // (c2) многострочная закрывашка: `} from 'spec'` (CEO_1: 57 шт в 42 файлах)
    if (!spec) { m = RE_FROM_ANY.exec(line); if (m) spec = m[1]; }
    // (e) ребро воркера/ассета: new URL('spec', import.meta.url)
    if (!spec) { m = RE_URL_WORKER.exec(line); if (m) spec = m[1]; }

    if (!spec) continue;
    const resolved = resolveImport(file, spec);
    if (resolved && !visited.has(resolved)) {
      visited.add(resolved);
      queue.push(resolved);
    }
  }
}

// ── 4. Collect all src/ files, report unreachable ──
function walkSrc(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) walkSrc(abs, out);
    else if (RE_EXT.test(entry.name) && !/\.d\.ts$/.test(entry.name)) out.push(abs);
  }
  return out;
}

const allSrcFiles = walkSrc(srcDir);
const unreachable = allSrcFiles.filter(f => !visited.has(f));

if (unreachable.length === 0) {
  console.log('verify-reach: all src/ files reachable');
} else {
  console.log(`verify-reach: ${unreachable.length} unreachable src/ file(s):`);
  for (const f of unreachable.sort()) {
    console.log(`  ${relative(root, f)}`);
  }
}
