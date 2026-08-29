#!/usr/bin/env node
// scripts/sync-bridge.mjs — держит мост в актуальном состоянии
//
// WHY: 2026-08-29 в мосте лежал УСТАРЕВШИЙ 02-PROGRAM-ROADMAP.md — без
//      предупреждения «НЕ ИСПОЛНЯТЬ», которое к тому моменту уже было
//      добавлено в репо. 007 читает мост, а не репо. Он мог пойти резать
//      по карте, которую я сам признал мёртвой.
//      Мост — это канал, а канал без синхронизации опаснее, чем его отсутствие.
//
// USAGE:
//   node scripts/sync-bridge.mjs           # синхронизировать
//   node scripts/sync-bridge.mjs --check   # только проверить, не копировать

import { readdirSync, copyFileSync, mkdirSync, existsSync, statSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { createHash } from 'crypto'

const REPO = 'C:/Users/nikit/OneDrive/Документы/BeLive/'
const BRIDGE = 'C:/Users/nikit/beLive-bridge/from-windows/'
const CHECK = process.argv.includes('--check')

const MAP = [
  { from: 'docs/modernization', to: 'docs', exts: ['.md'] },
  { from: 'docs/audit', to: 'docs', exts: ['.md', '.json'] },
  { from: 'scripts', to: '.', exts: ['.mjs'] },
]

const md5 = (p) => createHash('md5').update(readFileSync(p)).digest('hex')

let copied = 0, stale = 0, fresh = 0

for (const m of MAP) {
  const srcDir = join(REPO, m.from)
  if (!existsSync(srcDir)) { console.log('skip (no dir):', m.from); continue }

  for (const name of readdirSync(srcDir)) {
    if (!m.exts.some((e) => name.endsWith(e))) continue
    const src = join(srcDir, name)
    if (!statSync(src).isFile()) continue

    const dst = m.to === '.' ? join(BRIDGE, name) : join(BRIDGE, m.to, name)
    const dstDir = dirname(dst)
    if (!existsSync(dstDir)) mkdirSync(dstDir, { recursive: true })

    if (!existsSync(dst)) {
      if (!CHECK) { copyFileSync(src, dst); copied++ }
      else { console.log('MISSING:', name); stale++ }
      continue
    }

    if (md5(src) === md5(dst)) { fresh++; continue }

    stale++
    if (!CHECK) { copyFileSync(src, dst); copied++ }
    else console.log('STALE:  ', name)
  }
}

console.log('=== BRIDGE SYNC ===')
console.log('fresh  :', fresh)
console.log(CHECK ? 'stale  :' : 'copied :', CHECK ? stale : copied)
if (CHECK && stale) {
  console.log('\n⚠️  BRIDGE STALE — 007 читает устаревшие файлы. Запусти без --check.')
  process.exitCode = 1
}
