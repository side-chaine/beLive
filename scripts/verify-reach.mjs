#!/usr/bin/env node
// scripts/verify-reach.mjs — G-1 gate: find unreachable src/ files from roots
// Usage: node scripts/verify-reach.mjs
// Parses index.html <script src> tags + src/main.tsx as roots.
// BFS import/from graph (regex, .ts/.tsx/.js/.mjs, no node_modules).
// Mode: warn, exit 0 always.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { existsSync } from 'node:fs';
import { dirname, join, resolve, relative, posix } from 'node:path';

const root = resolve(new URL('.', import.meta.url).pathname, '..');
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

// ── 3. BFS import graph ──
const IMPORT_RE = /(?:import\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\))/g;

const visited = new Set();
const queue = [...roots];
for (const r of queue) visited.add(r);

while (queue.length > 0) {
  const file = queue.shift();
  let content;
  try { content = readFileSync(file, 'utf8'); } catch { continue; }

  IMPORT_RE.lastIndex = 0;
  let m;
  while ((m = IMPORT_RE.exec(content)) !== null) {
    const spec = m[1] || m[2];
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
    else if (RE_EXT.test(entry.name)) out.push(abs);
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
