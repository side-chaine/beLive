/**
 * verify-bridge-parity.ts — Gate Phase (P0)
 *
 * Проверяет что для каждого bridge есть wrapper-эквивалент.
 * Запуск: npx tsx scripts/verify-bridge-parity.ts
 *
 * 1. Парсит LEGACY_EVENT_MAP из facade.ts
 * 2. Для каждого ключа — ищет addEventListener в bridges/
 * 3. Для каждого канала+события — ищет eventBus.subscribe в wrappers/
 * 4. Если ключ есть в LEGACY_EVENT_MAP, но bridge не слушает → residue
 * 5. Если bridge слушает, но wrapper не подписан → PARITY FAIL
 */

import { readFileSync, existsSync } from 'fs'
import { globSync } from 'glob'

const FACADE_PATH = 'src/foundation/event-bus/facade.ts'
const BRIDGES_DIR = 'src/bridges'
const WRAPPERS_DIR = 'src/foundation/event-bus/wrappers'
const LEGACY_EVENT_MAP_LABEL = 'LEGACY_EVENT_MAP'

/** Разрешённые residue-события (sync-editor-closed и т.д.) */
const RESIDUE_ALLOWLIST = new Set(['sync-editor-closed'])

interface BridgeInfo {
  file: string
  events: string[] // addEventListener события
  lines: number
  engineCalls: number
}

interface WrapperInfo {
  file: string
  subscriptions: Array<{ channel: string; event: string }>
  lines: number
  hasTodo: boolean
}

function main(): void {
  const facade = readFileSync(FACADE_PATH, 'utf-8')
  const legacyMap = parseLegacyEventMap(facade)
  const bridges = scanBridges()
  const wrappers = scanWrappers()
  const parityResult = checkParity(legacyMap, bridges, wrappers)
  printReport(parityResult)
  process.exit(parityResult.failures > 0 ? 1 : 0)
}

/** Парсит LEGACY_EVENT_MAP из facade.ts (ключ и канал+событие) */
function parseLegacyEventMap(code: string): Map<string, { channel: string; event: string }> {
  const map = new Map<string, { channel: string; event: string }>()
  const start = code.indexOf(LEGACY_EVENT_MAP_LABEL)
  if (start === -1) {
    console.error('❌ LEGACY_EVENT_MAP не найден в facade.ts')
    process.exit(1)
  }

  // Ищем все строки вида: 'event-name': { channel: ..., event: ... }
  const re = /'([^']+)':\s*\{\s*channel:\s*EventBusChannel\.(\w+),\s*event:\s*'([^']+)'\s*\}/g
  let match: RegExpExecArray | null
  while ((match = re.exec(code)) !== null) {
    map.set(match[1], { channel: match[2], event: match[3] })
  }

  return map
}

/** Сканирует все .bridge.ts в src/bridges/ */
function scanBridges(): BridgeInfo[] {
  const files = globSync(`${BRIDGES_DIR}/**/*.bridge.ts`)
  return files.map((file) => {
    const content = readFileSync(file, 'utf-8')
    const lines = content.split('\n').length

    // addEventListener('event', ...)
    const eventMatches = content.matchAll(/addEventListener\s*\(\s*'([^']+)'/g)
    const events = Array.from(eventMatches, (m) => m[1])

    // engine-вызовы (audioEngine., delegateSync)
    const engineMatches = content.match(/audioEngine\.|delegateSync|setStemVolume|setCurrentTime|seekTo/g)
    const engineCalls = engineMatches ? engineMatches.length : 0

    return { file: file.replace(BRIDGES_DIR + '/', ''), events, lines, engineCalls }
  })
}

/** Сканирует все wrapper'ы в src/foundation/event-bus/wrappers/ */
function scanWrappers(): WrapperInfo[] {
  const files = globSync(`${WRAPPERS_DIR}/*.ts`)
  return files.map((file) => {
    const content = readFileSync(file, 'utf-8')
    const lines = content.split('\n').length
    const hasTodo = content.includes('TODO') || content.includes('FIXME')

    // eventBus.subscribe(Channel, 'event', ...)
    const subMatches = content.matchAll(
      /eventBus\.subscribe\s*\(\s*EventBusChannel\.(\w+)\s*,\s*'([^']+)'/g
    )
    const subscriptions = Array.from(subMatches, (m) => ({
      channel: m[1],
      event: m[2],
    }))

    return {
      file: file.replace(WRAPPERS_DIR + '/', ''),
      subscriptions,
      lines,
      hasTodo,
    }
  })
}

/** Сравнивает: для каждого LEGACY ключа — bridge слушает? wrapper подписан? */
function checkParity(
  legacyMap: Map<string, { channel: string; event: string }>,
  bridges: BridgeInfo[],
  wrappers: WrapperInfo[],
): {
  total: number
  covered: number
  failures: number
  residues: number
  bridgeCandidates: string[]
  details: Array<{
    legacy: string
    channel: string
    event: string
    hasBridge: boolean
    hasWrapper: boolean
    isResidue: boolean
  }>
} {
  const details: Array<{
    legacy: string
    channel: string
    event: string
    hasBridge: boolean
    hasWrapper: boolean
    isResidue: boolean
  }> = []

  let covered = 0
  let failures = 0
  let residues = 0

  // Все addEventListener события из bridges
  const bridgeEvents = new Set<string>()
  for (const b of bridges) {
    for (const e of b.events) bridgeEvents.add(e)
  }

  // Все wrapper подписки (канал+событие)
  const wrapperSubs = new Set<string>()
  for (const w of wrappers) {
    for (const s of w.subscriptions) wrapperSubs.add(`${s.channel}.${s.event}`)
  }

  for (const [legacyKey, mapping] of legacyMap) {
    const hasBridge = bridgeEvents.has(legacyKey)
    const hasWrapper = wrapperSubs.has(`${mapping.channel}.${mapping.event}`)
    const isResidue = RESIDUE_ALLOWLIST.has(legacyKey) || legacyKey.startsWith('practice:')

    details.push({ legacy: legacyKey, channel: mapping.channel, event: mapping.event, hasBridge, hasWrapper, isResidue })

    if (!hasBridge && !isResidue) {
      // LEGACY ключ есть, никто не слушает — можно удалить из карты
      residues++
    }

    if (hasBridge && !hasWrapper && !isResidue) {
      // Bridge слушает, wrapper не подписан → FAIL
      failures++
    }

    if (hasWrapper && !isResidue) {
      covered++
    }
  }

  // Bridges без engine-вызовов → кандидаты на простой retire
  const bridgeCandidates = bridges
    .filter((b) => b.engineCalls === 0 && b.file !== 'exercise.bridge.ts' && b.file !== 'time-sync')
    .map((b) => b.file)

  return { total: legacyMap.size, covered, failures, residues, bridgeCandidates, details }
}

function printReport(result: ReturnType<typeof checkParity>): void {
  console.log('\n=== 🛡️ BRIDGE PARITY REPORT ===\n')
  console.log(`LEGACY_EVENT_MAP entries: ${result.total}`)
  console.log(`Covered by wrappers:    ${result.covered}`)
  console.log(`PARITY FAILURES:        ${result.failures} 🔴`)
  console.log(`Residue (no listener):  ${result.residues} 🟡`)
  console.log(`\nBridges ready to retire (0 engine calls): ${result.bridgeCandidates.length}`)
  for (const b of result.bridgeCandidates) {
    console.log(`  🟢 ${b}`)
  }

  if (result.failures > 0) {
    console.log('\n🔴 PARITY FAILURES:')
    for (const d of result.details) {
      if (d.hasBridge && !d.hasWrapper && !d.isResidue) {
        console.log(`  ${d.legacy}: bridge слушает, wrapper НЕТ (→${d.channel}.${d.event})`)
      }
    }
  }

  if (result.residues > 0) {
    console.log('\n🟡 RESIDUE EVENTS (в LEGACY_MAP, никто не слушает):')
    for (const d of result.details) {
      if (!d.hasBridge && !d.isResidue) {
        console.log(`  ${d.legacy}: никто не слушает`)
      }
    }
  }

  console.log('\n=== DETAIL ===')
  for (const d of result.details) {
    const bridge = d.hasBridge ? '✅' : '❌'
    const wrapper = d.hasWrapper ? '✅' : '❌'
    const note = d.isResidue ? ' (residue)' : ''
    console.log(`  ${d.legacy} → bridge:${bridge} wrapper:${wrapper}${note}`)
  }

  console.log(`\n${result.failures > 0 ? '❌ PARITY FAILED' : '✅ PARITY PASS'}`)
}

main()
