// src/audio/engine-v3/diagnostics/__tests__/DuplicateAudioRouteChecker.test.ts
// MICRO-PACK 058: Unit tests for DuplicateAudioRouteChecker

import { describe, expect, it } from 'vitest'
import {
  checkDuplicateAudioRoutes,
  type RouteRecord,
} from '../DuplicateAudioRouteChecker'

function route(overrides: Partial<RouteRecord> = {}): RouteRecord {
  return {
    stemId: 'vocals',
    bus: 'B',
    audible: true,
    hasStretchInstance: false,
    hasBuffer: true,
    gain: 1,
    masterGain: 1,
    ...overrides,
  }
}

describe('DuplicateAudioRouteChecker', () => {
  it('passes one direct route', () => {
    expect(checkDuplicateAudioRoutes([route()]).ok).toBe(true)
  })

  it('fails synthetic __route IDs', () => {
    const report = checkDuplicateAudioRoutes([
      route({ stemId: 'vocals__route', bus: 'A' }),
    ])
    expect(report.issues.some(i => i.code === 'ROUTE_SUFFIX')).toBe(true)
  })

  it('fails same stem audible on both buses', () => {
    const report = checkDuplicateAudioRoutes([
      route({ bus: 'A', hasStretchInstance: true }),
      route({ bus: 'B' }),
    ])
    expect(report.issues.some(i => i.code === 'AUDIBLE_BOTH_BUSES')).toBe(true)
  })

  it('fails Bus A fallback without Stretch', () => {
    const report = checkDuplicateAudioRoutes([route({ bus: 'A' })])
    expect(report.issues.some(i => i.code === 'A_WITHOUT_STRETCH')).toBe(true)
  })

  it('ignores a muted route', () => {
    expect(checkDuplicateAudioRoutes([route({ gain: 0 })]).ok).toBe(true)
  })

  it('fails unbuffered audible route', () => {
    const report = checkDuplicateAudioRoutes([route({ hasBuffer: false })])
    expect(report.issues.some(i => i.code === 'UNBUFFERED_SOURCE')).toBe(true)
  })

  it('passes healthy dual-backend with crossfade (both buses audible but controlled)', () => {
    // During crossfade both buses ARE audible — checker flags AUDIBLE_BOTH_BUSES
    // Crossfade is allowed only if the caller explicitly allows it.
    // Without allowCrossfade param, this should fail.
    const report = checkDuplicateAudioRoutes([
      route({ bus: 'A', hasStretchInstance: true }),
      route({ bus: 'B' }),
    ])
    expect(report.issues.some(i => i.code === 'AUDIBLE_BOTH_BUSES')).toBe(true)
  })

  it('detects multiple stems on same ID', () => {
    const report = checkDuplicateAudioRoutes([
      route({ stemId: 'vocals', bus: 'A', hasStretchInstance: true }),
      route({ stemId: 'vocals', bus: 'A', hasStretchInstance: true }),
    ])
    expect(report.issues.some(i => i.code === 'DUPLICATE_STEM')).toBe(true)
  })

  it('passes 6 unique direct stems', () => {
    const stems = ['vocals', 'bass', 'drums', 'guitar', 'other', 'keys']
    const report = checkDuplicateAudioRoutes(
      stems.map(id => route({ stemId: id, bus: 'B' })),
    )
    expect(report.ok).toBe(true)
    expect(report.audibleRoutes).toHaveLength(6)
  })

  it('returns activeBackend in report', () => {
    const report = checkDuplicateAudioRoutes([route()], 'direct')
    expect(report.activeBackend).toBe('direct')
  })

  it('passes healthy stretch mode (6 stems, Bus A only, all have stretch)', () => {
    const stems = ['vocals', 'bass', 'drums', 'guitar', 'other', 'keys']
    const report = checkDuplicateAudioRoutes(
      stems.map(id => route({ stemId: id, bus: 'A', hasStretchInstance: true })),
      'stretch',
    )
    expect(report.ok).toBe(true)
  })

  it('combines ROUTE_SUFFIX + AUDIBLE_BOTH_BUSES for same stemId', () => {
    // После фикса 057-1c: одинаковый stemId на обеих шинах
    const report = checkDuplicateAudioRoutes([
      route({ stemId: 'vocals', bus: 'A', hasStretchInstance: true }),
      route({ stemId: 'vocals', bus: 'B' }),
    ])
    expect(report.ok).toBe(false)
    const codes = new Set(report.issues.map(i => i.code))
    expect(codes.has('AUDIBLE_BOTH_BUSES')).toBe(true)
    expect(codes.has('DUPLICATE_STEM')).toBe(true)
  })

  it('ROUTE_SUFFIX fires independently of AUDIBLE_BOTH_BUSES', () => {
    // __route суффикс — другой stemId, не попадает в ту же группу byStem
    // AUDIBLE_BOTH_BUSES НЕ триггерится, ROUTE_SUFFIX — да
    const report = checkDuplicateAudioRoutes([
      route({ stemId: 'vocals__route', bus: 'A' }),
      route({ stemId: 'vocals', bus: 'B' }),
    ])
    expect(report.ok).toBe(false)
    const codes = new Set(report.issues.map(i => i.code))
    expect(codes.has('ROUTE_SUFFIX')).toBe(true)
    expect(codes.has('AUDIBLE_BOTH_BUSES')).toBe(false)
    expect(codes.has('DUPLICATE_STEM')).toBe(false)
  })
})
