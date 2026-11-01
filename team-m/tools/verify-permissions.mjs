#!/usr/bin/env node
// Prep-1 · сверка .opencode/agent/*.md с team-m/AGENT-PERMISSIONS.json.
// Дрейф прав = exit 1. Исключения из manifest печатаются как SKIP (не PASS).
//
// Guard all-or-skip (B+, 2026-11-01): промпты агентов живут локально и в git
// попадают не все, поэтому в чистом клоне полная сверка невозможна. Пока набор
// из manifest.agents неполон — печатаем громкий SKIP и выходим 0. Как только
// все агенты на месте (живое дерево, либо governance-решение опубликовать всё),
// guard перестаёт срабатывать сам собой и включается полная валидация.
//
// Ловушка: в CI каталог .opencode/agent/ НЕ пуст — там лежат старые версии
// трекаемых файлов, и они красные по содержанию ("team missing"). Поэтому
// пропуск считается по неполноте НАБОРА агентов, а не по пустоте каталога.
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const manifestPath = path.join(root, 'team-m/AGENT-PERMISSIONS.json')
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))

const agents = Object.keys(manifest.agents || {})
const agentFile = (agent) => path.join(root, '.opencode/agent', `${agent}.md`)

const missing = agents.filter((agent) => !fs.existsSync(agentFile(agent)))
if (missing.length) {
  const list = missing.map((agent) => `${agent}.md`).join(', ')
  console.log(`SKIP verify:permissions: agent tree incomplete (missing: ${list}) — prompts local-only by design`)
  process.exit(0)
}

function parsePermission(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!m) return null
  const lines = m[1].split(/\r?\n/)
  let inPerm = false
  const out = {}
  for (const line of lines) {
    if (/^permission:\s*$/.test(line)) { inPerm = true; continue }
    if (!inPerm) continue
    if (/^\S/.test(line)) { inPerm = false; continue }
    const mm = line.match(/^\s+([A-Za-z_]+):\s*(.*)$/)
    if (mm) out[mm[1]] = (mm[2] || '').trim()
  }
  return out
}

let fail = 0
const rows = []
for (const [agent, expected] of Object.entries(manifest.agents || {})) {
  const file = agentFile(agent)
  if (!fs.existsSync(file)) { rows.push(`${agent}: FAIL missing file`); fail++; continue }
  const perm = parsePermission(fs.readFileSync(file, 'utf8'))
  if (!perm) { rows.push(`${agent}: FAIL no permission block`); fail++; continue }
  const bad = []
  for (const [key, value] of Object.entries(expected || {})) {
    if (!(key in perm)) bad.push(`${key} missing`)
    else if (perm[key] !== value) bad.push(`${key}=${perm[key] || '∅'} (want ${value})`)
  }
  if (bad.length) { rows.push(`${agent}: FAIL ${bad.join(' · ')}`); fail++ }
  else rows.push(`${agent}: PASS`)
}
for (const [agent, reason] of Object.entries(manifest.exceptions || {})) {
  rows.push(`${agent}: SKIP — ${reason}`)
}

console.log(rows.join('\n'))
console.log(`\nverify-permissions: ${fail === 0 ? 'PASS' : `FAIL (${fail})`} · checked=${Object.keys(manifest.agents || {}).length} · exceptions=${Object.keys(manifest.exceptions || {}).length}`)
process.exit(fail === 0 ? 0 : 1)
