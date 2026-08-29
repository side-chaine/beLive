#!/usr/bin/env node
// scripts/audit-city.mjs — «карта коммуникаций города»
//
// WHAT: строит граф импортов src/ и отвечает на четыре вопроса:
//   1. Кто никому не нужен?      (orphans — мёртвый код)
//   2. Кто всех держит?          (hubs —单点 отказа)
//   3. Где круговые зависимости? (cycles — неразрешимые связки)
//   4. Где плотные районы?       (по модулям)
//
// WHY: перед тем как что-то сносить или переписывать, нужна карта.
//      Без карты работа превращается в угадывание (см. инцидент 2026-08-29,
//      когда удаление «9 orphan-файлов» задело 591 файл).
//
// USAGE: node scripts/audit-city.mjs [--json]

import { execSync } from 'child_process'
import { readFileSync } from 'fs'

const files = execSync('git ls-files "src/**/*.ts" "src/**/*.tsx"', { encoding: 'utf8' })
  .split('\n').filter(Boolean)
  .filter((f) => !/\.d\.ts$/.test(f))

const IMPORT_RE = /(?:^|\n)\s*(?:import|export)[\s\S]*?from\s+['"]([^'"]+)['"]/g
const DYN_RE = /import\(\s*['"]([^'"]+)['"]\s*\)/g
const REQ_RE = /require\(\s*['"]([^'"]+)['"]\s*\)/g

const resolve = (from, spec) => {
  if (!spec.startsWith('.')) return null // внешний пакет — не наш город
  const base = from.split('/').slice(0, -1)
  const parts = (base.join('/') + '/' + spec).split('/')
  const out = []
  for (const p of parts) {
    if (p === '' || p === '.') continue
    if (p === '..') { out.pop(); continue }
    out.push(p)
  }
  let joined = out.join('/')
  const cands = [joined, joined + '.ts', joined + '.tsx', joined + '/index.ts', joined + '/index.tsx']
  return cands.find((c) => files.includes(c)) || joined
}

const edges = new Map()   // from -> Set(to)
const rev = new Map()     // to   -> Set(from)
for (const f of files) { edges.set(f, new Set()); rev.set(f, new Set()) }

for (const f of files) {
  let src
  try { src = readFileSync(f, 'utf8') } catch { continue }
  const deps = new Set()
  for (const re of [IMPORT_RE, DYN_RE, REQ_RE]) {
    re.lastIndex = 0
    let m
    while ((m = re.exec(src))) {
      const r = resolve(f, m[1])
      if (r && r !== f) deps.add(r)
    }
  }
  for (const d of deps) {
    edges.get(f).add(d)
    if (!rev.has(d)) rev.set(d, new Set())
    rev.get(d).add(f)
  }
}

const ENTRY = /^(src\/main\.tsx|src\/App\.tsx)$/
const isTest = (f) => /\.(test|spec)\.(ts|tsx)$/.test(f)

const orphans = files.filter(
  (f) => (rev.get(f)?.size ?? 0) === 0 && !ENTRY.test(f) && !isTest(f) && !f.endsWith('.d.ts')
)

const hubs = files
  .map((f) => ({ f, n: rev.get(f)?.size ?? 0 }))
  .filter((x) => x.n >= 8)
  .sort((a, b) => b.n - a.n)

// циклы: DFS
const cycles = []
const seen = new Set()
const stack = []
const onStack = new Set()
const dfs = (n) => {
  seen.add(n); stack.push(n); onStack.add(n)
  for (const d of edges.get(n) ?? []) {
    if (onStack.has(d)) {
      const i = stack.indexOf(d)
      const c = stack.slice(i).concat(d)
      const key = [...c].sort().join('|')
      if (!cycles.some((x) => x.key === key)) cycles.push({ key, path: c })
    } else if (!seen.has(d)) dfs(d)
  }
  stack.pop(); onStack.delete(n)
}
for (const f of files) if (!seen.has(f)) dfs(f)

const byModule = {}
for (const f of files) {
  const m = f.split('/')[1] ?? '.'
  byModule[m] = (byModule[m] ?? 0) + 1
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ files: files.length, orphans, hubs, cycles: cycles.map((c) => c.path), byModule }, null, 2))
} else {
  console.log('=== CITY MAP ===')
  console.log('files tracked      :', files.length)
  console.log('orphans (dead)     :', orphans.length)
  console.log('hubs (>=8 importers):', hubs.length)
  console.log('import cycles      :', cycles.length)
  console.log('\n--- ORPHANS (никто не импортирует, не entry point) ---')
  console.log(orphans.sort().join('\n') || '(none)')
  console.log('\n--- HUBS (на них держится город) ---')
  for (const h of hubs.slice(0, 20)) console.log(String(h.n).padStart(3), h.f)
  console.log('\n--- CYCLES ---')
  for (const c of cycles.slice(0, 15)) console.log(c.path.join(' -> '))
  if (!cycles.length) console.log('(none)')
  console.log('\n--- MODULES (районы) ---')
  console.log(Object.entries(byModule).sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k}:${v}`).join('  '))
}
