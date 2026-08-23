// ============================================================
// stem-engine-sync.test.ts — Central Bridge тесты
// Phase 5: diffAndApply, coldSync, idempotent guard
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useStemStore } from '../../../stem/stem.store'

// V2Adapter mock
const mockV2 = {
  getV2Engine: vi.fn(),
  delegateSync: vi.fn(),
}

vi.mock('../../../audio/engine-v3', () => ({
  V2Adapter: {
    getInstance: () => mockV2,
  },
  getTransport: vi.fn(),
}))

// №18-BUS H2.2 (009-fix#1): resyncV3 удалён (мёртвый код) вместе с тестом TC-005
const { initStemEngineSync } = await import('../stem-engine-sync')
import { getTransport } from '../../../audio/engine-v3'

describe('Central Bridge (stem-engine-sync)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useStemStore.setState({
      stemVolumes: {},
      stemMutes: {},
      stemSolos: {},
      stemPans: {},
      busVolumes: {},
      stemsEnabled: false,
    })
  })

  it('should init and cleanup without error', () => {
    mockV2.getV2Engine.mockReturnValue({})
    const cleanup = initStemEngineSync()
    expect(typeof cleanup).toBe('function')
    cleanup() // no throw
  })

  it('should not delegate if V2 not ready', () => {
    mockV2.getV2Engine.mockReturnValue(null)
    initStemEngineSync()
    useStemStore.getState().setStemVolume('vocals', 0.5)
    expect(mockV2.delegateSync).not.toHaveBeenCalled()
  })

  it('should delegate when V2 is ready after cold-start', () => {
    mockV2.getV2Engine.mockReturnValue(null)
    initStemEngineSync()
    expect(mockV2.delegateSync).not.toHaveBeenCalled()

    // V2 becomes ready
    mockV2.getV2Engine.mockReturnValue({})
    useStemStore.getState().setStemVolume('vocals', 0.5)
    // After store change, diffAndApply should fire
    expect(mockV2.delegateSync).toHaveBeenCalledWith('setStemVolume', 'vocals', 0.5)
  })

  it('should be idempotent — same value does not re-delegate', () => {
    mockV2.getV2Engine.mockReturnValue({})
    initStemEngineSync()

    // Set initial value
    useStemStore.getState().setStemVolume('vocals', 0.5)
    const firstCalls = mockV2.delegateSync.mock.calls.length
    expect(firstCalls).toBeGreaterThan(0) // at least one delegate happened

    // Set same value again — should NOT add delegate calls
    useStemStore.getState().setStemVolume('vocals', 0.5)
    const totalCalls = mockV2.delegateSync.mock.calls.length
    // idempotent: total should equal first's total (no new calls)
    expect(totalCalls).toBe(firstCalls)
  })

  it('should delegate new values after prev is set', () => {
    mockV2.getV2Engine.mockReturnValue({})
    initStemEngineSync()

    useStemStore.getState().setStemVolume('vocals', 0.5)
    useStemStore.getState().setStemVolume('vocals', 0.8)

    expect(mockV2.delegateSync).toHaveBeenCalledWith('setStemVolume', 'vocals', 0.5)
    expect(mockV2.delegateSync).toHaveBeenCalledWith('setStemVolume', 'vocals', 0.8)
  })

  it('should handle stemMutes separately from stemVolumes', () => {
    mockV2.getV2Engine.mockReturnValue({})
    initStemEngineSync()

    useStemStore.getState().setStemMute('instrumental', true)
    expect(mockV2.delegateSync).toHaveBeenCalledWith('setStemMute', 'instrumental', true)

    vi.clearAllMocks()
    useStemStore.getState().setStemVolume('instrumental', 1)
    // stemVolumes changed, not stemMutes — should still fire
    expect(mockV2.delegateSync).toHaveBeenCalledWith('setStemVolume', 'instrumental', 1)
  })
})

// ═══ TC-005 (resyncV3) удалён синхронно с resyncV3 — №18-BUS H2.2 (009-fix#1) ═══

// ═══ №18-BUS H3.2: проводка busVolumes (V3 pipeline / V2 safeDelegate) + H3.3 stemsEnabled V3 ═══

describe('№18-BUS: busVolumes wiring (diffAndApply)', () => {
  afterEach(() => {
    ;(window as any).__v3Active = false
    ;(window as any).__belive = undefined
    vi.mocked(getTransport).mockReset()
  })

  it('V2-path: изменение busVolumes → safeDelegate(setBusVolume)', () => {
    mockV2.getV2Engine.mockReturnValue({})
    const cleanup = initStemEngineSync()

    useStemStore.getState().setBusVolume('music-bus', 0.42)
    expect(mockV2.delegateSync).toHaveBeenCalledWith('setBusVolume', 'music-bus', 0.42)

    // idempotent: то же значение — нового делегата нет
    vi.clearAllMocks()
    useStemStore.getState().setBusVolume('music-bus', 0.42)
    expect(mockV2.delegateSync).not.toHaveBeenCalledWith('setBusVolume', 'music-bus', 0.42)
    cleanup()
  })

  it('V3-path: изменение busVolumes → pipeline.setBusVolume', () => {
    const setBusVolume = vi.fn()
    ;(window as any).__belive = { pipeline: { setBusVolume } }
    ;(window as any).__v3Active = true
    mockV2.getV2Engine.mockReturnValue(null)
    vi.mocked(getTransport).mockReturnValue({ orchestrator: { all: () => [] } } as any)

    const cleanup = initStemEngineSync()
    useStemStore.getState().setBusVolume('vocal-bus', 0.6)
    expect(setBusVolume).toHaveBeenCalledWith('vocal-bus', 0.6)
    cleanup()
  })

  it('H3.3: V3 stemsEnabled=false глушит music+backing (vocals/instrumental не трогаются)', () => {
    const setStemMuted = vi.fn()
    ;(window as any).__belive = { pipeline: { setStemMuted, setBusVolume: vi.fn() } }
    ;(window as any).__v3Active = true
    mockV2.getV2Engine.mockReturnValue(null)
    vi.mocked(getTransport).mockReturnValue({ orchestrator: { all: () => [], get: () => null } } as any)

    useStemStore.getState().initStems(['drums', 'vocals', 'instrumental', 'backing'], true)
    const cleanup = initStemEngineSync()

    useStemStore.getState().setStemsEnabled(false)
    expect(setStemMuted).toHaveBeenCalledWith('drums', true)
    expect(setStemMuted).toHaveBeenCalledWith('backing', true)
    expect(setStemMuted).not.toHaveBeenCalledWith('vocals', true)
    expect(setStemMuted).not.toHaveBeenCalledWith('instrumental', true)

    // обратное включение снимает mute
    vi.clearAllMocks()
    useStemStore.getState().setStemsEnabled(true)
    expect(setStemMuted).toHaveBeenCalledWith('drums', false)
    expect(setStemMuted).toHaveBeenCalledWith('backing', false)
    cleanup()
  })
})
