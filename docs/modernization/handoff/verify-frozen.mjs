#!/usr/bin/env node
// scripts/verify-frozen.mjs
//
// Verify the FROZEN ZONE is untouched — on ANY machine, same output.
//
// WHY THIS EXISTS
//   2026-08-29: two agents compared "SHA" of AudioEngineV2.ts and got different
//   values (efa6fde0 vs c5311543). Panic: "frozen has diverged, OneDrive drift!".
//   Reality: one was a git blob hash (SHA-1), the other was `sha256sum` of the
//   file. Different algorithms, identical bytes. There was no divergence.
//
//   Comparing checksums across machines is only valid if BOTH sides use the
//   SAME algorithm. This script always uses git blob hashes (SHA-1), which are
//   directly comparable with `git rev-parse HEAD:<path>` on any clone.
//
// USAGE
//   node scripts/verify-frozen.mjs            # human-readable report
//   node scripts/verify-frozen.mjs --json     # machine-readable
//
// EXIT CODE
//   0 — every frozen path is identical to HEAD (clean)
//   1 — at least one frozen path differs from HEAD (STOP, ask the Boss)

import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'

// ── FROZEN ZONE — single source of truth, mirrors ADR-0015 ───────────────────
const FROZEN_FILES = [
  'src/audio/core/AudioEngineV2.ts',
  'src/audio/compat/patchV1.ts',
  'src/services/track.orchestrator.ts',
]
const FROZEN_DIRS = ['src/bridges']

const git = (args) => {
  try {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()
  } catch {
    return null
  }
}

function collectFiles() {
  const files = [...FROZEN_FILES]
  for (const dir of FROZEN_DIRS) {
    if (!existsSync(dir)) continue
    const tracked = git(['ls-files', dir])
    if (tracked) files.push(...tracked.split('\n').filter(Boolean))
  }
  return [...new Set(files)].sort()
}

function checkFile(file) {
  if (!existsSync(file)) return { file, status: 'MISSING' }

  // git blob hash of the file ON DISK (SHA-1, content-addressed)
  const diskBlob = git(['hash-object', file])
  // git blob hash of the file AS COMMITTED in HEAD
  const headBlob = git(['rev-parse', `HEAD:${file}`])
  const size = diskBlob ? git(['cat-file', '-s', diskBlob]) : null

  // `git status --porcelain` — catches staged/unstaged modifications too
  const statusOut = git(['status', '--porcelain', '--', file]) ?? ''

  let status
  if (!headBlob) status = 'NOT_IN_HEAD'
  else if (diskBlob !== headBlob) status = 'MODIFIED'
  else if (statusOut.trim() !== '') status = 'DIRTY_INDEX'
  else status = 'CLEAN'

  return { file, status, diskBlob, headBlob, size: size ? Number(size) : null }
}

const results = collectFiles().map(checkFile)
const dirty = results.filter((r) => r.status !== 'CLEAN')

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ head: git(['rev-parse', 'HEAD']), results, dirty: dirty.length }, null, 2))
  process.exit(dirty.length === 0 ? 0 : 1)
}

const head = git(['rev-parse', 'HEAD']) ?? '(unknown)'
const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']) ?? '(unknown)'

console.log('FROZEN ZONE VERIFICATION')
console.log('='.repeat(78))
console.log(`HEAD   : ${head}`)
console.log(`branch : ${branch}`)
console.log(`algo   : git blob hash (SHA-1) — comparable across machines`)
console.log('='.repeat(78))
console.log()
console.log('STATUS  SIZE      DISK-BLOB   HEAD-BLOB   FILE')
console.log('-'.repeat(78))

for (const r of results) {
  const mark = r.status === 'CLEAN' ? 'CLEAN ' : 'DIRTY!'
  const size = r.size != null ? String(r.size).padStart(7) : '      -'
  const disk = r.diskBlob ? r.diskBlob.slice(0, 8) : '--------'
  const headB = r.headBlob ? r.headBlob.slice(0, 8) : '--------'
  console.log(`${mark}  ${size}    ${disk}    ${headB}     ${path.normalize(r.file)}`)
}

console.log('-'.repeat(78))
console.log()

if (dirty.length === 0) {
  console.log(`✅ FROZEN CLEAN — ${results.length} path(s), 0 modified.`)
  console.log('   Every file is byte-identical to HEAD. Safe to proceed.')
  process.exit(0)
} else {
  console.log(`❌ FROZEN VIOLATED — ${dirty.length} of ${results.length} path(s) differ:`)
  console.log()
  for (const r of dirty) console.log(`   ${r.status.padEnd(12)} ${path.normalize(r.file)}`)
  console.log()
  console.log('   STOP. Per ADR-0015 any frozen modification requires an explicit OVERRIDE')
  console.log('   from the Boss. Do not continue, do not "fix it back" silently — escalate.')
  process.exit(1)
}
