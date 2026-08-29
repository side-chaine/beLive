/**
 * 062: BPM switch race stress — 100 rapid setPlaybackRate() calls.
 *
 * Цель: поймать гонки setPlaybackRate() / switchBackend().
 * Доказать: последний rate побеждает, старый callback не убивает новый backend,
 *           резервный stretch-6 не стартует, одновременно audible только один bus.
 *
 * @see MICRO-PACK-062.md
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

// Тесты Vitest выполняются в Node, поэтому `process` здесь существует.
// Объявление намеренно УЗКОЕ и локальное для файла: подключать @types/node
// в браузерный проект нельзя — это открыло бы fs/path/Buffer всему фронтенду,
// и ошибку «случайно использовал Node-API в браузерном коде» стало бы нечем ловить.
// В tsconfig задано "types": ["vite/client"], то есть node-типов нет — так и надо.
declare const process: {
  on(event: 'unhandledRejection', listener: (reason: unknown) => void): void
  off(event: 'unhandledRejection', listener: (reason: unknown) => void): void
}

// ═══════════════════════════════════════════════════════════
// Mocks — hoisted before all imports
// ═══════════════════════════════════════════════════════════

const mockGain = {
  gain: { value: 1, setValueAtTime: vi.fn(), cancelScheduledValues: vi.fn(), linearRampToValueAtTime: vi.fn() },
  connect: vi.fn((dest: any) => dest),
  disconnect: vi.fn(),
}
const mockAnalyser = {
  ...mockGain,
  fftSize: 256,
  getFloatTimeDomainData: vi.fn(),
  getByteFrequencyData: vi.fn(),
  frequencyBinCount: 128,
}
const mockDelay = {
  delayTime: { value: 0, setValueAtTime: vi.fn() },
  connect: vi.fn(),
  disconnect: vi.fn(),
}
const mockBuffer = {
  duration: 120, length: 48000 * 120, sampleRate: 48000, numberOfChannels: 2,
}

// Mock StretchInstance — lightweight stub, no WASM.
vi.mock('../pipeline/StretchInstance', () => {
  const _gain = {
    gain: { value: 1, setValueAtTime: vi.fn(), cancelScheduledValues: vi.fn(), linearRampToValueAtTime: vi.fn() },
    connect: vi.fn(),
    disconnect: vi.fn(),
  }
  const _eventListeners = new Map<string, Set<EventListener>>()
  const _eventTarget = {
    addEventListener: vi.fn((type: string, handler: EventListener) => {
      if (!_eventListeners.has(type)) _eventListeners.set(type, new Set())
      _eventListeners.get(type)!.add(handler)
    }),
    removeEventListener: vi.fn((type: string, handler: EventListener) => {
      _eventListeners.get(type)?.delete(handler)
    }),
    dispatchEvent: vi.fn((event: Event) => {
      const handlers = _eventListeners.get(event.type)
      if (handlers) handlers.forEach(h => h(event))
      return true
    }),
  }
  return {
    StretchInstance: class {
      isActive = true
      _started = false
      _id = ''
      stemId: string | null = null
      start = vi.fn(async function (this: any) { this._started = true })
      seek = vi.fn(async () => {})
      stop = vi.fn()
      init = vi.fn(async () => {})
      scheduleRate = vi.fn(async () => {})
      scheduleLoop = vi.fn(async () => {})
      loadBuffer = vi.fn(async () => {})
      chunkedLoad = vi.fn(async () => {})
      clearBuffers = vi.fn(async () => {})
      dispose = vi.fn()
      outputNode = { ..._gain, ..._eventTarget }
      constructor(id: string) {
        this._id = id
      }
    }
  }
})

// ═══════════════════════════════════════════════════════════
// Test constants
// ═══════════════════════════════════════════════════════════

const STEMS = ['vocals', 'bass', 'drums', 'guitar', 'other', 'keys'] as const
const RATES = [0.75, 0.8, 0.85, 0.9, 0.95, 1, 1.05, 1.1, 1.15] as const

function rateAt(i: number): number {
  return RATES[(i * 7 + 3) % RATES.length]
}

/** Advance vitest fake timers enough to fire all pending _scheduleCrossfadeEnd callbacks (100ms delay). */
async function flushTimers(ms = 300): Promise<void> {
  for (let i = 0; i < 10; i++) await vi.advanceTimersByTimeAsync(ms / 10)
}

describe('BPM switch race: 100 rapid changes', () => {
  let pipeline: any

  beforeEach(async () => {
    vi.useFakeTimers()
    if (typeof window !== 'undefined') (window as any).__belive = {}

    // Create mock AudioContext inline (no `new AudioContext()` — setup.ts already stubs global)
    const ctx = {
      state: 'running',
      currentTime: 0,
      sampleRate: 48000,
      destination: { connect: vi.fn() },
      createGain: vi.fn(() => ({
        gain: { value: 1, setValueAtTime: vi.fn(), cancelScheduledValues: vi.fn(), linearRampToValueAtTime: vi.fn() },
        connect: vi.fn(),
        disconnect: vi.fn(),
      })),
      createAnalyser: vi.fn(() => mockAnalyser),
      createDelay: vi.fn(() => mockDelay),
      createBufferSource: vi.fn(() => ({
        buffer: null,
        playbackRate: { value: 1, setValueAtTime: vi.fn(), cancelScheduledValues: vi.fn() },
        loop: false, loopStart: 0, loopEnd: 0, onended: null,
        start: vi.fn(), stop: vi.fn(), connect: vi.fn(), disconnect: vi.fn(),
      })),
      decodeAudioData: vi.fn().mockResolvedValue(mockBuffer),
      resume: vi.fn().mockResolvedValue(undefined),
    } as any

    const { HybridPipelineService } = await import('../pipeline/HybridPipelineService')
    pipeline = new HybridPipelineService(ctx)
    await pipeline.init()

    for (const stemId of STEMS) {
      await pipeline.loadStem(stemId, mockBuffer as any)
    }
    pipeline.setRate(1)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  // ── Test 1: last rate wins ─────────────────────────────

  it('last rate wins and stale switches cannot kill the active backend', async () => {
    await pipeline.play(32, 1)

    const unhandled: unknown[] = []
    const onUnhandled = (reason: unknown) => unhandled.push(reason)
    if (typeof process !== 'undefined') process.on('unhandledRejection', onUnhandled)

    for (let i = 0; i < 100; i++) {
      pipeline.setPlaybackRate(rateAt(i))
      await Promise.resolve()  // yield microtask between calls
    }

    // Fire all pending _scheduleCrossfadeEnd setTimeout callbacks
    await flushTimers()

    const finalRate = rateAt(99)
    const state = pipeline.getBackendState() as any

    expect(state).not.toBeNull()
    expect(state.rate).toBeCloseTo(finalRate, 6)
    // 067-D: single path — всегда stretch, backend не переключается
    expect(state.activeBackend).toBe('stretch')
    expect(state.audibleBusCount).toBe(1)
    // Single path: только Bus A (stretch) audible
    expect(state.busA.audible).toBe(true)
    expect(state.busB.audible).toBe(false)

    if (typeof process !== 'undefined') process.off('unhandledRejection', onUnhandled)
    expect(unhandled).toEqual([])
  })

  // ── Test 2: old cleanup doesn't pause newer backend ────

  it('does not let an old delayed cleanup pause a newer backend', async () => {
    await pipeline.play(20, 1)

    // Start a switch to stretch (0.85)
    pipeline.setPlaybackRate(0.85)
    // Advance 20ms — crossfade in progress, not yet complete
    await vi.advanceTimersByTimeAsync(20)
    // Switch back to direct (1.0) — should create NEWER generation
    pipeline.setPlaybackRate(1)
    // Fire all pending timers
    await flushTimers()

    const state = pipeline.getBackendState() as any
    expect(state).not.toBeNull()
    // 067-D: single path — всегда stretch
    expect(state.activeBackend).toBe('stretch')
    expect(state.busA.audible).toBe(true)
    expect(state.busB.audible).toBe(false)
    expect(state.audibleBusCount).toBe(1)
  })

  // ── Test 3: only assigned stretch slots ────────────────

  it('starts only assigned stretch slots', async () => {
    await pipeline.play(0, 1)

    // 067-D: single path — setPlaybackRate не переключает backend
    pipeline.setPlaybackRate(0.9)
    await flushTimers()

    const state = pipeline.getBackendState() as any
    expect(state).not.toBeNull()
    expect(state.stemCountA).toBeLessThanOrEqual(6)
    // 067-D: Bus B не наполняется
    expect(state.stemCountB).toBe(0)
    expect(state.audibleBusCount).toBe(1)
  })

  // ── Test 4: rapid setPlaybackRate never throws ─────────

  it('no unhandled rejections during 100 rapid setPlaybackRate calls', async () => {
    await pipeline.play(5, 1)

    const unhandled: unknown[] = []
    const onUnhandled = (reason: unknown) => unhandled.push(reason)
    if (typeof process !== 'undefined') process.on('unhandledRejection', onUnhandled)

    for (let i = 0; i < 100; i++) {
      const rate = rateAt(i)
      // setPlaybackRate is synchronous — void return, no catch needed
      pipeline.setPlaybackRate(rate)
      await Promise.resolve()
    }

    await flushTimers()

    if (typeof process !== 'undefined') process.off('unhandledRejection', onUnhandled)
    expect(unhandled).toEqual([])

    // After all chaos the pipeline should have a consistent state
    const state = pipeline.getBackendState() as any
    expect(state).not.toBeNull()
    expect(state.audibleBusCount).toBe(1)
  })

  // ── Test 5: A5 crash handler mutes only crashed stem's stretch gain ───

  it('A5 crash handler mutes only crashed stem\'s stretch gain', async () => {
    await pipeline.play(10, 1)

    // Get a stretch instance to dispatch crash event on its outputNode
    const crashedStemId = 'vocals'
    const instance = pipeline._stretchPool.get(crashedStemId)
    expect(instance).not.toBeNull()

    const busAGainBefore = pipeline._busAGain.gain.value
    const otherStemGainBefore = pipeline._stretchGains.get('bass').gain.value

    // Dispatch crash event
    const crashEvent = new CustomEvent('stretch-crash', {
      detail: { id: crashedStemId, error: 'test error' }
    })
    instance.outputNode.dispatchEvent(crashEvent)

    // After crash: crashed stem's stretch gain should be ramped to 0
    const crashedGain = pipeline._stretchGains.get(crashedStemId)
    expect(crashedGain.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0, expect.any(Number))

    // Other stems' stretch gains unchanged
    expect(pipeline._stretchGains.get('bass').gain.value).toBe(otherStemGainBefore)

    // _busAGain NOT touched (no global mute)
    expect(pipeline._busAGain.gain.value).toBe(busAGainBefore)
    expect(pipeline._busAGain.gain.setValueAtTime).not.toHaveBeenCalledWith(0, expect.any(Number))
  })
})
