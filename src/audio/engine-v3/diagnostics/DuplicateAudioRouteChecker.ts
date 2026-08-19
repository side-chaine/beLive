// src/audio/engine-v3/diagnostics/DuplicateAudioRouteChecker.ts
// MICRO-PACK 058: Automatic duplicate audio route checker
// Ловит duplicate audible routes до того, как пользователь услышит flanger / phase split / два темпа
//
// Usage:
//   import { checkDuplicateAudioRoutes, assertAudioRoutes } from './DuplicateAudioRouteChecker'
//   const records: RouteRecord[] = [ ... ]
//   const report = checkDuplicateAudioRoutes(records, 'direct')
//   if (!report.ok) { console.error(report.issues) }

export type RouteBus = 'A' | 'B'

export interface RouteRecord {
  stemId: string
  bus: RouteBus
  audible: boolean
  hasStretchInstance: boolean
  hasBuffer: boolean
  gain: number
  /** Фактический master bus gain (gain.value для busAGain/busBGain) */
  masterGain: number
  sourceTag?: string
}

export interface DuplicateRouteIssue {
  code:
    | 'ROUTE_SUFFIX'
    | 'DUPLICATE_STEM'
    | 'A_WITHOUT_STRETCH'
    | 'AUDIBLE_BOTH_BUSES'
    | 'UNKNOWN_STEM'
    | 'UNBUFFERED_SOURCE'
  stemId: string
  detail: string
  records: RouteRecord[]
}

export interface RouteCheckReport {
  ok: boolean
  checkedAt: number
  activeBackend: 'direct' | 'stretch' | 'unknown'
  audibleRoutes: RouteRecord[]
  issues: DuplicateRouteIssue[]
}

export const ROUTE_CHECK_EPSILON = 0.0005
const EPSILON = ROUTE_CHECK_EPSILON
const ROUTE_SUFFIX = /__route$/

export function checkDuplicateAudioRoutes(
  records: RouteRecord[],
  activeBackend: RouteCheckReport['activeBackend'] = 'unknown',
): RouteCheckReport {
  const issues: DuplicateRouteIssue[] = []
  const audible = records.filter(r => r.audible && Math.abs(r.gain) > EPSILON)
  const byStem = new Map<string, RouteRecord[]>()

  for (const record of audible) {
    const list = byStem.get(record.stemId) ?? []
    list.push(record)
    byStem.set(record.stemId, list)

    if (ROUTE_SUFFIX.test(record.stemId)) {
      issues.push({
        code: 'ROUTE_SUFFIX',
        stemId: record.stemId,
        detail: `Synthetic __route stem is audible: ${record.stemId}`,
        records: [record],
      })
    }

    if (record.bus === 'A' && !record.hasStretchInstance) {
      issues.push({
        code: 'A_WITHOUT_STRETCH',
        stemId: record.stemId,
        detail: `Bus A route has no Stretch instance and can fall back to varispeed: ${record.stemId}`,
        records: [record],
      })
    }

    if (!record.hasBuffer) {
      issues.push({
        code: 'UNBUFFERED_SOURCE',
        stemId: record.stemId,
        detail: `Audible route has no AudioBuffer: ${record.stemId}`,
        records: [record],
      })
    }
  }

  for (const [stemId, stemRecords] of byStem) {
    const buses = new Set(stemRecords.map(r => r.bus))
    if (stemRecords.length > 1) {
      issues.push({
        code: 'DUPLICATE_STEM',
        stemId,
        detail: `Same stem has ${stemRecords.length} audible routes: ${stemId}`,
        records: stemRecords,
      })
    }
    if (buses.has('A') && buses.has('B')) {
      issues.push({
        code: 'AUDIBLE_BOTH_BUSES',
        stemId,
        detail: `Same stem is audible on Bus A and Bus B outside a controlled crossfade: ${stemId}`,
        records: stemRecords,
      })
    }
  }

  return {
    ok: issues.length === 0,
    checkedAt: performance.now(),
    activeBackend,
    audibleRoutes: audible,
    issues,
  }
}

export function assertAudioRoutes(report: RouteCheckReport): void {
  if (report.ok) return
  const message = report.issues
    .map(issue => `[${issue.code}] ${issue.detail}`)
    .join('\n')
  throw new Error(`Duplicate audio route check failed\n${message}`)
}
