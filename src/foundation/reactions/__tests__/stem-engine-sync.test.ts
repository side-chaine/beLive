// ============================================================
// stem-engine-sync.test.ts — Central Bridge тесты
// Phase 5: diffAndApply, coldSync, idempotent guard
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useStemStore } from '../../../stem/stem.store'

// V2Adapter mock
const mockV2 = {
  getV2Engine: vi.fn(),
  delegateSync: vi.fn(),
}

vi.mock('../../../audio/engine-v3/V2Adapter', () => ({
  V2Adapter: {
    getInstance: () => mockV2,
  },
}))

const { initStemEngineSync } = await import('../stem-engine-sync')

describe('Central Bridge (stem-engine-sync)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useStemStore.setState({
      stemVolumes: {},
      stemMutes: {},
      stemSolos: {},
      stemPans: {},
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
