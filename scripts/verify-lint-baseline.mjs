#!/usr/bin/env node
// N1b/1c (Центр_5): ratchet lint-предупреждений — по образцу verify-asany.mjs,
// конвенция holdlist'ов: видимость, причина, затяжка только вниз.
//
//   ERROR   — всегда красный. Базлайна для ошибок нет и не будет.
//   WARNING — через per-file baseline: новый файл с ворнингами или рост = красный.
//
//   node scripts/verify-lint-baseline.mjs            # check (CI)
//   node scripts/verify-lint-baseline.mjs --report   # только цифры, exit 0
//   node scripts/verify-lint-baseline.mjs --update   # переснять baseline (отказ при errors>0)
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const BASELINE_FILE = join(ROOT, 'scripts', 'lint-baseline.json')
const args = new Set(process.argv.slice(2))

// ESLint запускаем ровно как `npm run lint` (flat config подхватится сам).
// exit 1 = есть находки (норма); exit >=2 = упал конфиг/раннер.
const proc = spawnSync('npx', ['eslint', '.', '-f', 'json'], {
  cwd: ROOT, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024,
})
if (proc.status !== null && proc.status > 1) {
  console.error(`✗ eslint упал (exit ${proc.status}):`); console.error(proc.stderr)
  process.exit(2)
}
const results = JSON.parse(proc.stdout)

const errors = []
const warningsByFile = new Map()
for (const r of results) {
  const rel = relative(ROOT, r.filePath).replace(/\\/g, '/')
  for (const m of r.messages) {
    if (m.severity === 2) {
      errors.push(`${rel}:${m.line} ${m.ruleId} — ${m.message}`)
    } else {
      warningsByFile.set(rel, (warningsByFile.get(rel) ?? 0) + 1)
    }
  }
}

if (args.has('--report')) {
  const total = [...warningsByFile.values()].reduce((a, b) => a + b, 0)
  console.log(`lint: errors=${errors.length}, warnings=${total}, files=${warningsByFile.size}`)
  console.log('--- топ-15 по ворнингам ---')
  for (const [f, n] of [...warningsByFile].sort((a, b) => b[1] - a[1]).slice(0, 15)) {
    console.log(`${String(n).padStart(4)}  ${f}`)
  }
  if (errors.length) { console.log('--- errors (первые 10) ---'); errors.slice(0, 10).forEach((e) => console.log('  ' + e)) }
  process.exit(0)
}

if (errors.length) {
  console.error(`✗ lint-baseline: ${errors.length} error(s) — базлайном не покрываются, чинить:`)
  errors.slice(0, 10).forEach((e) => console.error('  ' + e))
  if (errors.length > 10) {
    console.error(`  … ещё ${errors.length - 10}`)
  }
  process.exit(1)
}

if (args.has('--update')) {
  const baseline = Object.fromEntries([...warningsByFile].sort((a, b) => a[0].localeCompare(b[0])))
  writeFileSync(BASELINE_FILE, JSON.stringify({
    version: 1,
    note: 'N1b/1c: ratchet lint-ворнингов. Ошибки базлайном НЕ покрываются. Вниз — только --update после выжигания долга. FROZEN/708-долг лежит здесь до своих узлов (N6/N7, TrackMap).',
    updated: new Date().toISOString().slice(0, 10),
    updatedBy: '805/N1b',
    baseline,
  }, null, 2) + '\n')
  const total = Object.values(baseline).reduce((a, b) => a + b, 0)
  console.log(`✓ baseline переснят: ${Object.keys(baseline).length} файлов, ${total} ворнингов`)
  process.exit(0)
}

if (!existsSync(BASELINE_FILE)) {
  console.error('✗ нет scripts/lint-baseline.json — сними: node scripts/verify-lint-baseline.mjs --update')
  process.exit(2)
}
const { baseline } = JSON.parse(readFileSync(BASELINE_FILE, 'utf8'))

let fail = false
for (const [file, count] of warningsByFile) {
  const allowed = baseline[file]
  if (allowed === undefined) { console.error(`✗ НОВЫЙ долг: ${file} (${count} warn)`); fail = true }
  else if (count > allowed) { console.error(`✗ РОСТ: ${file} ${allowed} → ${count}`); fail = true }
}
if (fail) {
  process.exit(1)
}

const stale = Object.entries(baseline).filter(([f, n]) => (warningsByFile.get(f) ?? 0) < n)
const curTotal = [...warningsByFile.values()].reduce((a, b) => a + b, 0)
const baseTotal = Object.values(baseline).reduce((a, b) => a + b, 0)
console.log(`✓ lint-baseline: ${curTotal}/${baseTotal} warn, файлов ${warningsByFile.size}`)
if (stale.length) {
  console.log(`↘ ratchet вниз доступен (${stale.length} файл(ов), −${baseTotal - curTotal}): --update && commit`)
}
