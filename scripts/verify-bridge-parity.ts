/**
 * verify-bridge-parity.ts — Gate Phase (P0) v2
 *
 * Проверяет паритет LEGACY_EVENT_MAP ↔ wrappers + манифест.
 * Запуск: npx tsx scripts/verify-bridge-parity.ts
 *
 * v2: manifest-based (bridge-manifest.json), signal-rule CHECK-B/C/D
 *
 * 1. Парсит LEGACY_EVENT_MAP из facade.ts (regex — как в v1)
 * 2. Сканирует wrappers/*.ts на подписки (eventBus.subscribe, addEventListener, scheduler.register*)
 * 3. Загружает bridge-manifest.json (residueAllowlist, records)
 * 4. CHECK-A: каждый ключ LEGACY_EVENT_MAP → обёртка подписаны ИЛИ allowlist ИЛИ prefix → ok; иначе FAIL
 * 5. CHECK-B: запись с wrapper и status≠'live' → файл существует И (≥1 сигнал ИЛИ signalExempt)
 * 6. CHECK-C: запись с bridge и status retired/retired-before-C → файл моста ОБЯЗАН отсутствовать
 */

import { readFileSync, existsSync } from 'fs'
import { globSync } from 'glob'

const FACADE_PATH = 'src/foundation/event-bus/facade.ts'
const WRAPPERS_DIR = 'src/foundation/event-bus/wrappers'
const MANIFEST_PATH = 'bridge-manifest.json'
const LEGACY_EVENT_MAP_LABEL = 'LEGACY_EVENT_MAP'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ManifestResidueAllowlist {
  keys: string[]
  prefixes: string[]
  note: string
}

interface ManifestRecord {
  id: string
  bridge: string | null
  wrapper: string | null
  status: string
  inBoot: boolean
  retiredAt: string | null
  testsRemoved: string[]
  knownGaps: string[]
  signalExempt?: boolean
  notes: string
}

interface ManifestData {
  version: number
  note: string
  residueAllowlist: ManifestResidueAllowlist
  records: ManifestRecord[]
}

interface WrapperInfo {
  file: string
  coveredEvents: Set<string>   // eventBus.subscribe → event name
  coveredChannelEvents: Set<string> // eventBus.subscribe → "Channel.event" pairs
  addListenerEvents: Set<string> // addEventListener('event')
  hasSchedulerSignals: boolean  // scheduler.register*
  totalSignals: number
}

// ---------------------------------------------------------------------------
// LEGACY_EVENT_MAP parsing (unchanged from v1)
// ---------------------------------------------------------------------------

function parseLegacyEventMap(code: string): Map<string, { channel: string; event: string }> {
  const map = new Map<string, { channel: string; event: string }>()
  const start = code.indexOf(LEGACY_EVENT_MAP_LABEL)
  if (start === -1) {
    console.error('❌ LEGACY_EVENT_MAP не найден в facade.ts')
    process.exit(1)
  }

  const re = /'([^']+)':\s*\{\s*channel:\s*EventBusChannel\.(\w+),\s*event:\s*'([^']+)'\s*\}/g
  let match: RegExpExecArray | null
  while ((match = re.exec(code)) !== null) {
    map.set(match[1], { channel: match[2], event: match[3] })
  }

  return map
}

// ---------------------------------------------------------------------------
// Scan wrappers — подписки + сигналы
// ---------------------------------------------------------------------------

function scanWrappers(): WrapperInfo[] {
  const files = globSync(`${WRAPPERS_DIR}/*.ts`)
  return files.map((file) => {
    const content = readFileSync(file, 'utf-8')

    // eventBus.subscribe(EventBusChannel.X, 'event', ...)
    const subMatches = content.matchAll(
      /eventBus\.subscribe\s*\(\s*EventBusChannel\.(\w+)\s*,\s*'([^']+)'/g
    )
    const coveredEvents = new Set<string>()
    const coveredChannelEvents = new Set<string>()
    for (const m of subMatches) {
      coveredEvents.add(m[2])
      coveredChannelEvents.add(`${m[1]}.${m[2]}`)
    }

    // addEventListener('event', ...)
    const addMatches = content.matchAll(/addEventListener\s*\(\s*'([^']+)'/g)
    const addListenerEvents = new Set<string>()
    for (const m of addMatches) {
      addListenerEvents.add(m[1])
    }

    // scheduler.register* (registerDetector, registerWriter, register)
    const hasSchedulerSignals = /scheduler\.register\w*\s*\(/.test(content)

    const totalSignals = coveredEvents.size + addListenerEvents.size + (hasSchedulerSignals ? 1 : 0)

    return {
      file: file.replace(WRAPPERS_DIR + '/', ''),
      coveredEvents,
      coveredChannelEvents,
      addListenerEvents,
      hasSchedulerSignals,
      totalSignals,
    }
  })
}

// ---------------------------------------------------------------------------
// CHECK-A: legacy-coverage
// ---------------------------------------------------------------------------

function checkA(
  legacyMap: Map<string, { channel: string; event: string }>,
  wrappers: WrapperInfo[],
  allowlist: ManifestResidueAllowlist,
): { covered: number; residue: number; failures: number; details: Array<{ legacy: string; channel: string; event: string; status: string }> } {
  // Collect all covered channel.event pairs from all wrappers
  const allCoveredPairs = new Set<string>()
  for (const w of wrappers) {
    for (const ce of w.coveredChannelEvents) allCoveredPairs.add(ce)
  }

  let covered = 0
  let residue = 0
  let failures = 0
  const details: Array<{ legacy: string; channel: string; event: string; status: string }> = []

  for (const [legacyKey, mapping] of legacyMap) {
    const pairKey = `${mapping.channel}.${mapping.event}`
    const isCovered = allCoveredPairs.has(pairKey)
    const inAllowlist = allowlist.keys.includes(legacyKey)
    const hasPrefix = allowlist.prefixes.some(p => legacyKey.startsWith(p))

    if (isCovered) {
      covered++
      details.push({ legacy: legacyKey, channel: mapping.channel, event: mapping.event, status: 'covered' })
    } else if (inAllowlist || hasPrefix) {
      residue++
      details.push({ legacy: legacyKey, channel: mapping.channel, event: mapping.event, status: 'residue' })
    } else {
      failures++
      details.push({ legacy: legacyKey, channel: mapping.channel, event: mapping.event, status: 'FAIL' })
    }
  }

  return { covered, residue, failures, details }
}

// ---------------------------------------------------------------------------
// CHECK-B/C/D: manifest records validation
// ---------------------------------------------------------------------------

function checkRecords(
  records: ManifestRecord[],
  wrappers: WrapperInfo[],
): { failures: number; details: Array<{ id: string; check: string; ok: boolean; msg: string }> } {
  const details: Array<{ id: string; check: string; ok: boolean; msg: string }> = []
  let failures = 0

  // Build wrapper file → signals lookup
  const wrapperSignals = new Map<string, WrapperInfo>()
  for (const w of wrappers) {
    wrapperSignals.set(w.file, w)
  }

  for (const rec of records) {
    // CHECK-B: wrapper + status ≠ 'live'
    if (rec.wrapper && rec.status !== 'live') {
      const wrapperAbsPath = rec.wrapper
      const fileExists = existsSync(wrapperAbsPath)

      if (!fileExists) {
        failures++
        details.push({ id: rec.id, check: 'CHECK-B', ok: false, msg: `wrapper file not found: ${rec.wrapper}` })
        continue
      }

      // ≥1 signal from scan OR signalExempt
      const wrapperRel = rec.wrapper.replace('src/foundation/event-bus/wrappers/', '')
      const wrapperInfo = wrapperSignals.get(wrapperRel)
      const hasSignals = wrapperInfo ? wrapperInfo.totalSignals > 0 : false
      const exempt = rec.signalExempt === true

      if (!hasSignals && !exempt) {
        failures++
        details.push({ id: rec.id, check: 'CHECK-B', ok: false, msg: `wrapper has 0 signals and no signalExempt flag: ${rec.wrapper}` })
      } else {
        details.push({ id: rec.id, check: 'CHECK-B', ok: true, msg: exempt ? 'signalExempt' : `${wrapperInfo!.totalSignals} signal(s)` })
      }
    }

    // CHECK-C: bridge + status retired/retired-before-C → bridge file must NOT exist
    if (rec.bridge && (rec.status === 'retired' || rec.status === 'retired-before-C')) {
      const fileExists = existsSync(rec.bridge)
      if (fileExists) {
        failures++
        details.push({ id: rec.id, check: 'CHECK-C', ok: false, msg: `bridge file still exists (should be removed): ${rec.bridge}` })
      } else {
        details.push({ id: rec.id, check: 'CHECK-C', ok: true, msg: 'bridge file absent ✓' })
      }
    }
  }

  return { failures, details }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  // Load facade
  const facade = readFileSync(FACADE_PATH, 'utf-8')
  const legacyMap = parseLegacyEventMap(facade)

  // Load manifest
  const manifest: ManifestData = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'))

  // Scan wrappers
  const wrappers = scanWrappers()

  // CHECK-A: legacy coverage
  const checkAResult = checkA(legacyMap, wrappers, manifest.residueAllowlist)

  // CHECK-B/C/D: manifest records
  const checkBCD = checkRecords(manifest.records, wrappers)

  const totalFailures = checkAResult.failures + checkBCD.failures

  // Report
  console.log('\n=== 🛡️ BRIDGE PARITY REPORT v2 ===\n')
  console.log(`LEGACY_EVENT_MAP entries: ${legacyMap.size}`)
  console.log(`Covered by wrappers:    ${checkAResult.covered}`)
  console.log(`Residue (allowlist):    ${checkAResult.residue}`)
  console.log(`CHECK-A FAILURES:       ${checkAResult.failures} 🔴`)
  console.log(`CHECK-B/C/D FAILURES:   ${checkBCD.failures} 🔴`)
  console.log(`Manifest records:       ${manifest.records.length}`)
  console.log(`Wrappers scanned:       ${wrappers.length}`)

  if (checkAResult.failures > 0) {
    console.log('\n🔴 CHECK-A FAILURES (ключ без подписки и без allowlist):')
    for (const d of checkAResult.details) {
      if (d.status === 'FAIL') {
        console.log(`  ${d.legacy}: → ${d.channel}.${d.event}`)
      }
    }
  }

  if (checkBCD.failures > 0) {
    console.log('\n🔴 CHECK-B/C/D FAILURES:')
    for (const d of checkBCD.details) {
      if (!d.ok) {
        console.log(`  [${d.check}] ${d.id}: ${d.msg}`)
      }
    }
  }

  console.log('\n=== DETAIL (CHECK-A) ===')
  for (const d of checkAResult.details) {
    const icon = d.status === 'covered' ? '✅' : d.status === 'residue' ? '🟡' : '❌'
    const note = d.status === 'residue' ? ' (residue)' : ''
    console.log(`  ${icon} ${d.legacy} → ${d.channel}.${d.event}${note}`)
  }

  console.log('\n=== DETAIL (CHECK-B/C/D) ===')
  for (const d of checkBCD.details) {
    const icon = d.ok ? '✅' : '❌'
    console.log(`  ${icon} [${d.check}] ${d.id}: ${d.msg}`)
  }

  console.log(`\n${totalFailures > 0 ? '❌ PARITY FAILED' : '✅ PARITY PASS'}`)
  process.exit(totalFailures > 0 ? 1 : 0)
}

main()
