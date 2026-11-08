#!/usr/bin/env node
// N1b/1d (Центр_5): typecheck-гейт с ВРЕМЕННЫМ allowlist только для файлов пакета
// TrackMap (708). Любая ошибка вне allowlist = красный. После мержа
// 708/trackmap-loop-drag allowlist пустеет (--update) и гейт становится строгим.
//   node scripts/verify-typecheck.mjs           # check (CI)
//   node scripts/verify-typecheck.mjs --update  # переснять (отказ, если есть не-708 ошибки)
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const ALLOWLIST = join(ROOT, 'scripts', 'ts-allowlist.json')
const args = new Set(process.argv.slice(2))

// Канон 708 (Центр_5, сверено с diff их ветки c328445): только эти файлы могут
// находиться в allowlist. FREE-файл сюда протащить нельзя — только правкой этого
// списка в ревью.
const TRACKMAP = new Set([
  'src/components/CurrentTrackBadge.tsx', 'src/components/Header.tsx',
  'src/components/LoopContour.tsx', 'src/components/LoopHandles.tsx',
  'src/components/LoopRuler.tsx', 'src/components/SubSegmentRow.tsx',
  'src/components/WagonTrain.tsx', 'src/components/loop-geometry.ts',
  'src/components/loop-geometry.test.ts', 'src/components/useLoopContourGeometry.ts',
  'src/components/useLoopDrag.ts', 'src/hooks/useBillyZoneCache.ts',
  'src/stores/loop.store.ts',
])
const isTrackmap = (f) => f.startsWith('src/trackmap/') || TRACKMAP.has(f)

const proc = spawnSync('npx', ['tsc', '--noEmit'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
const lines = (proc.stdout ?? '').split('\n').filter((l) => /error TS\d+:/.test(l))

const counts = new Map() // "file|code" → { file, code, count, samples[] }
for (const l of lines) {
  const m = l.match(/^(.*)\((\d+),\d+\): error (TS\d+): (.*)$/)
  if (!m) {
    continue
  }
  const key = `${m[1]}|${m[3]}`
  const e = counts.get(key) ?? { file: m[1], code: m[3], count: 0, samples: [] }
  e.count++
  if (e.samples.length < 3) {
    e.samples.push(`${m[1]}:${m[2]} ${m[3]} ${m[4].slice(0, 90)}`)
  }
  counts.set(key, e)
}

if (args.has('--update')) {
  const foreign = [...counts.values()].filter((e) => !isTrackmap(e.file))
  if (foreign.length) {
    console.error('✗ --update отказ: есть ошибки вне зоны 708 — чини сначала их:')
    foreign.forEach((e) => e.samples.forEach((s) => console.error('  ' + s)))
    process.exit(1)
  }
  const members = [...counts.values()]
    .sort((a, b) => a.file.localeCompare(b.file))
    .map((e) => ({ file: e.file, code: e.code, count: e.count, owner: '708', until: 'merge 708/trackmap-loop-drag', reason: 'unused в зоне 708, вылечено в их ветке c328445' }))
  writeFileSync(ALLOWLIST, JSON.stringify({
    version: 1,
    note: 'N1b/1d: ВРЕМЕННЫЕ исключения typecheck-гейта — только файлы пакета TrackMap (708). После их мержа: --update (пустеет), гейт строгий.',
    members,
  }, null, 2) + '\n')
  console.log(`✓ ts-allowlist переснят: ${members.length} записей (только 708)`)
  process.exit(0)
}

const { members } = JSON.parse(readFileSync(ALLOWLIST, 'utf8'))
const allowed = new Map()
for (const m of members) {
  if (!isTrackmap(m.file)) { console.error(`✗ КАНОН НАРУШЕН: ${m.file} не из списка 708 — правь скрипт в ревью, не allowlist`); process.exit(2) }
  allowed.set(`${m.file}|${m.code}`, m.count)
}

let fail = false
for (const e of counts.values()) {
  const cap = allowed.get(`${e.file}|${e.code}`)
  if (cap === undefined || e.count > cap) { e.samples.forEach((s) => console.error('✗ ' + s)); fail = true }
}
if (fail) { console.error('✗ typecheck: ошибки вне allowlist (или сверх него)'); process.exit(1) }

const stale = [...allowed].filter(([k, cap]) => {
  const e = counts.get(k); return !e || e.count < cap
})
console.log(`✓ typecheck: ${lines.length} ошибок, все в 708-allowlist`)
if (stale.length) {
  console.log(`↘ allowlist протух (${stale.length} записей, видимо мержнут TrackMap): --update && commit`)
}
