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

vi.mock('../../../audio/engine-v3', () => ({
  V2Adapter: {
    getInstance: () => mockV2,
  },
  getTransport: vi.fn(),
}))

import { getTransport } from '../../../audio/engine-v3'
const { initStemEngineSync, resyncV3 } = await import('../stem-engine-sync')

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

// ═══ TC-005: resyncV3 ═══

describe('resyncV3', () => {
  it('should silently skip when V3 is not active', () => {
    // V2 ready, but no V3 transport
    mockV2.getV2Engine.mockReturnValue({})
    const cleanup = initStemEngineSync()
    
    // resyncV3 should not throw when V3 is not master
    expect(() => resyncV3()).not.toThrow()
    cleanup()
  })

  it('should apply current store state to V3 stems', () => {
    // Setup mock transport with orchestrator
    // Используем per-ID моки, чтобы итерация по стемам не затирала значения
    const mockStems: Record<string, { volume: number }> = {
      instrumental: { volume: 0 },
      vocals: { volume: 0 },
    }
    const mockOrchestrator = {
      all: vi.fn().mockReturnValue(Object.values(mockStems)),
      get: vi.fn((id: string) => mockStems[id] || null),
    }
    const mockTransport = {
      state: 'playing',
      orchestrator: mockOrchestrator,
    }
    
    // Mock getTransport to return our mock
    vi.mocked(getTransport).mockReturnValue(mockTransport as any)
    
    // Set initial store state
    useStemStore.getState().initStems(['instrumental', 'vocals'])
    useStemStore.getState().setStemVolume('instrumental', 0.5)
    
    const cleanup = initStemEngineSync()
    
    // Apply resync
    resyncV3()
    
    // V3 stem should get effective gain (0.5), vocals unchanged (default 1)
    expect(mockStems.instrumental.volume).toBe(0.5)
    expect(mockStems.vocals.volume).toBe(1)
    cleanup()
  })
})
