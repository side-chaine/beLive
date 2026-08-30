/**
 * ARC-2e MICRO-PACK · pitch-engine modes · S4 (спека 001 Круг-3 §S4, вердикт 009 У-6)
 *
 * К-3: initFromNode на фейк-узле — status 'running', анализер повешен, passive-tick не бросает
 * К-4: acquire-инвариант 82e1c76 — micSource.acquire ⇒ getUserMedia НЕ зовётся; destroy ⇒ release=1
 * К-6: poison-continuation (У-4) — destroy в in-flight окне acquire; resolve continuation отдаёт
 *      refs через release=1, движок остаётся 'idle' (gen-гвард ловит механикой, не надеждой)
 * К-7: static-grep (?raw) — PitchTab не читает мёртвые facade-поля и не трогает facade-глобаль
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
// ?raw-импорт для static-grep К-7 (типизирован vite/client, прецедент BusFader18:22)
import pitchTabSrc from '../../../components/PitchTab.tsx?raw'
import { PitchEngine } from '../pitch-engine'

// ═══════════════════════════════════════════════════════════
// Fake AudioContext — паттерн live-trail-controller (минимум для движка)
// ═══════════════════════════════════════════════════════════

function makeFakeCtx(): any {
  return {
    state: 'running',
    sampleRate: 48000,
    currentTime: 0,
    resume: vi.fn(async () => {}),
    createAnalyser: vi.fn(() => ({
      fftSize: 0,
      frequencyBinCount: 128,
      smoothingTimeConstant: 0,
      connect: vi.fn(),
      disconnect: vi.fn(),
      getFloatTimeDomainData: vi.fn(),
      getFloatFrequencyData: vi.fn(),
    })),
    createBiquadFilter: vi.fn(() => ({
      type: '',
      frequency: { value: 0 },
      connect: vi.fn(),
      disconnect: vi.fn(),
    })),
    createMediaStreamSource: vi.fn(() => ({ connect: vi.fn(), disconnect: vi.fn() })),
    audioWorklet: { addModule: vi.fn(async () => {}) },
  }
}

const fakeStream = { getTracks: () => [], getAudioTracks: () => [] } as unknown as MediaStream

// ═══════════════════════════════════════════════════════════
// К-3 · initFromNode (passive-режим)
// ═══════════════════════════════════════════════════════════

describe('ARC-2e К-3: initFromNode — фейк-узел, passive-режим жив', () => {
  beforeEach(() => {
    (window as any).audioEngine = { audioContext: makeFakeCtx() }
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    delete (window as any).audioEngine
    delete (window as any).__belive
  })

  it('initFromNode: status running, анализер повешен на узел, passive-tick не бросает', async () => {
    vi.useFakeTimers()
    const eng = new PitchEngine()
    const fakeNode = { connect: vi.fn(), disconnect: vi.fn() }

    await eng.initFromNode(fakeNode as unknown as AudioNode)

    expect(eng.status).toBe('running')
    expect(fakeNode.connect).toHaveBeenCalled()   // analyser-тап повешен на source-узел

    expect(() => vi.advanceTimersByTime(50)).not.toThrow()   // passive-tick (46ms) отработал
    expect(eng.status).toBe('running')

    eng.destroy()
    expect(eng.status).toBe('idle')
  })
})

// ═══════════════════════════════════════════════════════════
// К-4 / К-6 · mic-режим через MicSourceV3 (refcount-баланс)
// ═══════════════════════════════════════════════════════════

describe('ARC-2e К-4/К-6: initFromMic — acquire-путь MicSourceV3 (инвариант 82e1c76)', () => {
  beforeEach(() => {
    (window as any).audioEngine = { audioContext: makeFakeCtx() }
    // jsdom не имеет AudioWorkletNode — минимальный stub (port + connect/disconnect)
    vi.stubGlobal('AudioWorkletNode', class {
      port = { onmessage: null, postMessage: vi.fn() }
      connect = vi.fn()
      disconnect = vi.fn()
    })
    // getUserMedia ЗАПРЕЩЁН: acquire-путь обязан обходиться без него
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn() } })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    delete (window as any).audioEngine
    delete (window as any).__belive
  })

  it('К-4: micSource.acquire ⇒ acquire=1, getUserMedia NOT called; destroy ⇒ release=1', async () => {
    const acquire = vi.fn(async () => fakeStream)
    const release = vi.fn()
    ;(window as any).__belive = { micSource: { acquire, release } }

    const eng = new PitchEngine()
    await eng.initFromMic()

    expect(eng.status).toBe('running')
    expect(acquire).toHaveBeenCalledTimes(1)
    expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled()

    eng.destroy()
    expect(release).toHaveBeenCalledTimes(1)   // каждый acquire ↔ ровно один release
    expect(eng.status).toBe('idle')
  })

  it('К-6: poison-continuation — destroy до resolve acquire; resolve отдаёт refs (release=1), движок idle', async () => {
    let resolveAcq!: (s: MediaStream) => void
    const acquire = vi.fn(() => new Promise<MediaStream>(r => { resolveAcq = r }))
    const release = vi.fn()
    ;(window as any).__belive = { micSource: { acquire, release } }

    const eng = new PitchEngine()
    const p = eng.initFromMic()        // in-flight acquire (pending)
    expect(eng.status).toBe('starting')

    eng.destroy()                      // poison в in-flight окне: status → 'idle', gen-гвард впереди
    expect(eng.status).toBe('idle')
    expect(release).not.toHaveBeenCalled()   // refs ещё не взяты — release только у continuation

    resolveAcq(fakeStream)             // мёртвая ветка просыпается
    await Promise.resolve()            // flush микротасков (×2 по спеке)
    await Promise.resolve()

    expect(acquire).toHaveBeenCalledTimes(1)
    expect(release).toHaveBeenCalledTimes(1)   // continuation отдал refs — refcount сбалансирован
    expect(eng.status).toBe('idle')

    await p
  })
})

// ═══════════════════════════════════════════════════════════
// К-7 · static-grep (?raw) — PitchTab-гигиена (Условие-2 Суда)
// ═══════════════════════════════════════════════════════════

describe('ARC-2e К-7: static-grep PitchTab (?raw)', () => {
  it('PitchTab не читает мёртвые facade-поля и вообще не трогает facade-глобаль', () => {
    // (III) канон-инвариант: нет ae?.isPlaying / ae?.vocalsGain / ae?.stems usage-паттернов
    expect(pitchTabSrc).not.toMatch(/ae\?\.\s*(isPlaying|vocalsGain|stems\b)/)
    // и нет прямого чтения facade-глобали (обе прежние декларации вычищены)
    expect(pitchTabSrc).not.toMatch(/\(window as any\)\.audioEngine/)
  })
})
