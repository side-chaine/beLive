#!/usr/bin/env node
// В1 п.6: ratchet `as any` (ORDER-V1 п.6) — gate на НОВЫЙ код.
// Методика счёта = замер 007: grep -rc " as any" src --include=*.ts --include=*.tsx (строки с вхождением).
// baseline 608 = 597 (замер 007 до В1, 12.09) + 11 фасад-тестов п.3; ratchet: нового as-any не добавлять.
// exit 1 при превышении.
// Не трогать eslint max-warnings — ratchet отдельный механизм (MICRO-PACK-V1 п.6).
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, extname, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const BASELINE = 608

const SRC_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'src')

function walk(dir) {
  let out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) out = out.concat(walk(full))
    else if (extname(full) === '.ts' || extname(full) === '.tsx') out.push(full)
  }
  return out
}

const total = walk(SRC_DIR).reduce((sum, file) => {
  const lines = readFileSync(file, 'utf8').split('\n')
  return sum + lines.filter((line) => line.includes(' as any')).length
}, 0)

console.log(`${total}/${BASELINE}`)
if (total > BASELINE) {
  console.error(`✗ ratchet as-any: превышение baseline (${total} > ${BASELINE}) — новый код с « as any» запрещён`)
  process.exit(1)
}
console.log(`✓ ratchet as-any: в пределах baseline (${total} ≤ ${BASELINE})`)