// src/audio/engine-v3/pipeline/StemChain.ts
// Группировка стемов по шине.
// Bus A (stretch): Vocals, Guitar, Bass, Keys/Drums
// Bus B (varispeed): Drums, Other, Instrumental
//
// Топология Bus B:
//   stems → mergeGain → muteGain → DelayNode(22.67ms) → outputNode
//   DelayNode компенсирует STFT latency Bus A (20ms) + async scheduling gap (2.67ms)
//
// muteGain стоит ДО split → mute/solo = 0ms latency

import { StemPlayerV3 } from '../stems/StemPlayerV3'
import type { BusType } from './IPipelineController'

/** 22.67ms = 1 render quantum (128/44100 ≈ 2.9ms) + STFT window (20ms) */
export const BUS_B_DELAY_SEC = 22.67 / 1000

export class StemChain {
  readonly bus: BusType
  readonly stems: Map<string, StemPlayerV3> = new Map()

  private readonly _mergeGain: GainNode
  private readonly _muteGain: GainNode
  private readonly _outputGain: GainNode
  private readonly _delayNode: DelayNode | null = null
  private readonly _soloed: Set<string> = new Set()

  constructor(ctx: AudioContext, bus: BusType) {
    this.bus = bus
    this._mergeGain = ctx.createGain()
    this._mergeGain.gain.value = 1.0
    this._muteGain = ctx.createGain()
    this._muteGain.gain.value = 1.0
    this._outputGain = ctx.createGain()
    this._outputGain.gain.value = 1.0

    // muteGain стоит ДО split — mute/solo работают с 0ms latency
    this._mergeGain.connect(this._muteGain)

    if (bus === 'B') {
      // Bus B: DelayNode компенсирует STFT latency Bus A
      this._delayNode = ctx.createDelay(BUS_B_DELAY_SEC)
      this._delayNode.delayTime.value = BUS_B_DELAY_SEC
      this._muteGain.connect(this._delayNode)
      this._delayNode.connect(this._outputGain)
    } else {
      // Bus A: прямой выход
      this._muteGain.connect(this._outputGain)
    }
  }

  get outputNode(): AudioNode { return this._outputGain }
  get muteGain(): GainNode { return this._muteGain }
  get mergeGain(): GainNode { return this._mergeGain }
  get delayNode(): DelayNode | null { return this._delayNode }

  /** Добавить стем в цепь — подключается к mergeGain */
  addStem(stem: StemPlayerV3): void {
    this.stems.set(stem.id, stem)
    stem.outputNode.connect(this._mergeGain)
  }

  /** Удалить стем из цепи */
  removeStem(stemId: string): void {
    const stem = this.stems.get(stemId)
    if (stem) {
      try { stem.outputNode.disconnect() } catch {}
      this.stems.delete(stemId)
      this._soloed.delete(stemId)
    }
  }

  /** Mute/Unmute стема в этой цепи */
  muteStem(_stemId: string, _muted: boolean): void {
    console.warn('[StemChain] disabled (E8b): use pipeline.setStemVolume')
  }

  /** Плавная регулировка громкости (не только 0/1 как mute) */
  setStemVolume(_stemId: string, _volume: number): void {
    console.warn('[StemChain] disabled (E8b): use pipeline.setStemVolume')
  }

  /** Solo: все не-solo стемы приглушаются */
  soloStem(stemId: string, soloed: boolean): void {
    if (soloed) {
      this._soloed.add(stemId)
    } else {
      this._soloed.delete(stemId)
    }
    this._applySolo()
  }

  private _applySolo(): void {
    // E8b: removed direct stem.volume writes — single-writer is _applyEffectiveGain in HybridPipelineService.
    // Only mask bookkeeping here; isSoloActive()/isStemAudible() read the mask.
  }

  /** Solo-маска активна (есть хотя бы один засолоенный стем) */
  isSoloActive(): boolean {
    return this._soloed.size > 0
  }

  /** Стем слышим: solo-маска не активна ИЛИ стем в маске */
  isStemAudible(stemId: string): boolean {
    return this._soloed.size === 0 || this._soloed.has(stemId)
  }

  /** Глобальный mute — 0ms latency (muteGain до DelayNode) */
  setGlobalMute(muted: boolean): void {
    this._muteGain.gain.value = muted ? 0 : 1
  }

  /** 🟢 E.2: Установить задержку Bus B.
   *  pure-varispeed fallback → delay = 0 (нет STFT latency для компенсации). */
  setBusBDelay(sec: number): void {
    if (this._delayNode) {
      this._delayNode.delayTime.value = Math.max(0, Math.min(sec, 1.0))
    }
  }

  /** Запуск всех стемов с offset + rate */
  playAll(targetStart: number, offset: number, rate: number): void {
    for (const stem of this.stems.values()) {
      if (stem.getBuffer()) {
        stem.startAt(targetStart, offset, rate)
      }
    }
  }

  /** Пауза всех стемов */
  pauseAll(): void {
    for (const stem of this.stems.values()) stem.pause()
  }

  /** Loop */
  setLoopOnAll(start: number, end: number): void {
    for (const stem of this.stems.values()) stem.setLoop(start, end)
  }

  clearLoopOnAll(): void {
    for (const stem of this.stems.values()) stem.clearLoop()
  }

  dispose(): void {
    for (const stem of this.stems.values()) stem.dispose()
    this.stems.clear()
    try { this._mergeGain.disconnect() } catch {}
    try { this._muteGain.disconnect() } catch {}
    try { this._outputGain.disconnect() } catch {}
    if (this._delayNode) try { this._delayNode.disconnect() } catch {}
  }
}
