/**
 * ARC-2e MICRO-PACK · VocalTap · S4 (спека 001 Круг-3 §S4, вердикт 009 У-6)
 *
 * К-1: loadStem('vocals') присваивает vocalReferenceTap (У-1); повторный loadStem того же
 *      инстанса НЕ дублирует ребро (гвард-дубля `!==` — Условие-1 Суда)
 * К-2: reset() рвёт зомби-ребро outputNode→_vocalHallSend ДО зануления тапа (У-2) —
 *      слот переиспользуется пулом, без дисконнекта чужой стем идёт в зал педагога
 * К-5: тап присваивается БЕЗ setVocalHallTarget (router=null) — контракт У-1;
 *      на непатченном коде (присвоение только при живом target) кейс красный
 *
 * Мок-стенд: BusFader18-паттерн (vi.mock StretchInstance с outputNode-моком, :28-67)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ═══════════════════════════════════════════════════════════
// Mock StretchInstance — per-instance outputNode (BusFader18 :28-67)
// ═══════════════════════════════════════════════════════════

vi.mock('../StretchInstance', () => {
  const makeGain = () => ({
    gain: { value: 1, setValueAtTime: vi.fn(), cancelScheduledValues: vi.fn(), linearRampToValueAtTime: vi.fn() },
    connect: vi.fn(),
    disconnect: vi.fn(),
  })
  return {
    StretchInstance: class {
      isActive = true
      stemId: string | null = null
      start = vi.fn(async function (this: any) { this._started = true })
      seek = vi.fn(async () => {})
      stop = vi.fn()
      init = vi.fn(async () => {})
      scheduleRate = vi.fn(async () => {})
      scheduleLoop = vi.fn(async () => {})
      scheduleLoopNone = vi.fn(async () => {})
      loadBuffer = vi.fn(async () => {})
      chunkedLoad = vi.fn(async () => {})
      clearBuffers = vi.fn(async () => {})
      dispose = vi.fn()
      _listeners = new Map<string, Set<EventListener>>()
      outputNode = {
        ...makeGain(),
        addEventListener: vi.fn((type: string, h: EventListener) => {
          if (!this._listeners.has(type)) this._listeners.set(type, new Set())
          this._listeners.get(type)!.add(h)
        }),
        removeEventListener: vi.fn((type: string, h: EventListener) => {
          this._listeners.get(type)?.delete(h)
        }),
        dispatchEvent: vi.fn((event: Event) => {
          this._listeners.get(event.type)?.forEach(h => h(event))
          return true
        }),
      }
      constructor(id?: string) { this.stemId = id ?? null }
    },
  }
})

// ═══════════════════════════════════════════════════════════
// Helpers (BusFader18 :73-114)
// ═══════════════════════════════════════════════════════════

const BUF = { duration: 120, length: 48000 * 120, sampleRate: 48000, numberOfChannels: 2 } as any

function makeCtx(): any {
  return {
    state: 'running',
    currentTime: 0,
    sampleRate: 48000,
    destination: { connect: vi.fn() },
    createGain: vi.fn(() => ({
      gain: { value: 1, setValueAtTime: vi.fn(), cancelScheduledValues: vi.fn(), linearRampToValueAtTime: vi.fn() },
      connect: vi.fn(),
      disconnect: vi.fn(),
    })),
    createAnalyser: vi.fn(() => ({
      gain: { value: 1, setValueAtTime: vi.fn(), cancelScheduledValues: vi.fn(), linearRampToValueAtTime: vi.fn() },
      connect: vi.fn(),
      disconnect: vi.fn(),
      fftSize: 256,
      frequencyBinCount: 128,
      getFloatTimeDomainData: vi.fn(),
      getByteFrequencyData: vi.fn(),
    })),
    createDelay: vi.fn(() => ({ delayTime: { value: 0, setValueAtTime: vi.fn() }, connect: vi.fn(), disconnect: vi.fn() })),
    createBufferSource: vi.fn(() => ({
      buffer: null,
      playbackRate: { value: 1, setValueAtTime: vi.fn(), cancelScheduledValues: vi.fn() },
      loop: false, loopStart: 0, loopEnd: 0, onended: null,
      start: vi.fn(), stop: vi.fn(), connect: vi.fn(), disconnect: vi.fn(),
    })),
    decodeAudioData: vi.fn().mockResolvedValue(BUF),
    resume: vi.fn().mockResolvedValue(undefined),
  }
}

async function makePipeline(): Promise<any> {
  const { HybridPipelineService } = await import('../HybridPipelineService')
  const p = new HybridPipelineService(makeCtx())
  await p.init()
  return p
}

const fakeGainTarget = () => ({ connect: vi.fn(), disconnect: vi.fn() })

// ═══════════════════════════════════════════════════════════
// К-1 / К-2 / К-5
// ═══════════════════════════════════════════════════════════

describe('ARC-2e: vocalReferenceTap (S1 HPS)', () => {
  let pipeline: any

  beforeEach(async () => {
    if (typeof window !== 'undefined') (window as any).__belive = {}
    pipeline = await makePipeline()
  })

  afterEach(() => { vi.restoreAllMocks() })

  it('К-1: loadStem("vocals") присваивает тап; повторный loadStem не дублирует ребро (гвард-дубля)', async () => {
    pipeline.setVocalHallTarget(fakeGainTarget())
    expect(pipeline.vocalReferenceTap).toBeNull()          // до загрузки — честный null

    await pipeline.loadStem('vocals', BUF)
    expect(pipeline.vocalReferenceTap).not.toBeNull()      // У-1: тап жив
    const src = pipeline.vocalReferenceTap
    const send = (pipeline as any)._vocalHallSend
    const edgesToSend = () =>
      (src.connect as any).mock.calls.filter((c: any[]) => c[0] === send).length
    expect(edgesToSend()).toBe(1)                           // ребро в зал проставлено ровно один раз

    // повторный loadStem того же инстанса (ensureSlot идемпотентен по stemId) —
    // гвард `this._vocalHallSource !== instance.outputNode` НЕ даёт ребру задублироваться
    ;(src.connect as any).mockClear()
    await pipeline.loadStem('vocals', BUF)
    expect(pipeline.vocalReferenceTap).toBe(src)           // тот же физический узел (слот один на всегда)
    expect(src.connect).toHaveBeenCalledTimes(1)           // единственный connect — stretchGain (:217)
    expect(edgesToSend()).toBe(0)                           // ребро к _vocalHallSend НЕ пересоздано
  })

  it('К-2: reset() рвёт зомби-ребро (disconnect outputNode→send) и обнуляет тап', async () => {
    pipeline.setVocalHallTarget(fakeGainTarget())
    await pipeline.loadStem('vocals', BUF)
    const src = pipeline.vocalReferenceTap
    expect(src).not.toBeNull()

    await pipeline.reset()
    // disconnect на instance.outputNode в reset зовётся ТОЛЬКО ARC-2e-патч-строкой — чистый ассерт
    expect(src.disconnect).toHaveBeenCalled()
    expect(pipeline.vocalReferenceTap).toBeNull()          // окно reset→loadStem = честное «—»
  })

  it('К-5: router-null — тап присваивается БЕЗ setVocalHallTarget (У-1-контракт)', async () => {
    // НЕ ставим vocalHallTarget — MonitorRouter мёртв (main.tsx:157), зал не подключён
    await pipeline.loadStem('vocals', BUF)
    expect(pipeline.vocalReferenceTap).not.toBeNull()      // на непатченном коде — красный
  })
})
