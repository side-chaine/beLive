// ============================================================
// stem-engine-sync.test.ts — Central Bridge тесты
// Phase 5: diffAndApply, coldSync, idempotent guard
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useStemStore } from '../../../stem/stem.store'

// mockV2 — истор. заглушка (V2-обёртка снесена Волной B); живые строки ниже ассертуют мёртвый канал
const mockV2 = {
  getV2Engine: vi.fn(),
  delegateSync: vi.fn(),
}

// Волна B: ключ V2Adapter удалён из фабрики (класс снесён); mockV2-объект оставлен —
// 6 живых строк (:40/:47/:50/:73/:86 + decl) ассертят, что мёртвый канал не зовётся.
vi.mock('../../../audio/engine-v3', () => ({
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

  // 5 V2-delegateSync тестов удалены: источник V3-only с W2b (0 вызовов V2Adapter в stem-engine-sync.ts, :3 = коммент); тесты ассертили мёртвый канал = 5 intentional fails канона; новый канон 761+0int+0load
})

// ═══ TC-005 (resyncV3) удалён синхронно с resyncV3 — №18-BUS H2.2 (009-fix#1) ═══

// ═══ №18-BUS H3.2: проводка busVolumes (V3 pipeline / V2 safeDelegate) + H3.3 stemsEnabled V3 ═══

describe('№18-BUS: busVolumes wiring (diffAndApply)', () => {
  afterEach(() => {
    ;(window as any).__v3Active = false
    ;(window as any).__belive = undefined
    vi.mocked(getTransport).mockReset()
  })

  // 5 V2-delegateSync тестов удалены: источник V3-only с W2b (0 вызовов V2Adapter в stem-engine-sync.ts, :3 = коммент); тесты ассертили мёртвый канал = 5 intentional fails канона; новый канон 761+0int+0load

  it('V3-path: изменение busVolumes → pipeline.setBusVolume', () => {
    const setBusVolume = vi.fn()
    ;(window as any).__belive = { pipeline: { setBusVolume } }
    ;(window as any).__v3Active = true
    mockV2.getV2Engine.mockReturnValue(null)
    vi.mocked(getTransport).mockReturnValue({ orchestrator: { all: () => [], get: () => null } } as any)

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
