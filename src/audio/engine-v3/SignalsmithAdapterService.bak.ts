// ============================================================
// src/audio/engine-v3/SignalsmithAdapterService.ts
// Адаптер Signalsmith Stretch для beLive V3
// Phase 1 — post-mix интеграция
//
// Топология (параллельная с crossfade):
//     ┌→ bypassGain ──→┐
// input┤                 ├→ _outputGain → destination
//     └→ stretchNode → stretchGain →┘
// ============================================================

import SignalsmithStretch from 'signalsmith-stretch'

export class SignalsmithAdapterService {
  private readonly _ctx: AudioContext
  private _stretchNode: AudioWorkletNode | null = null
  private readonly _inputGain: GainNode
  private readonly _bypassGain: GainNode
  private readonly _stretchGain: GainNode
  private readonly _outputGain: GainNode
  private _active = false
  private _currentRate = 1.0
  // 🌟 REGIME 2 (connected mode): rate→semitones для pitch correction
  // Формула: semitones = -12 * log2(rate)
  // rate=0.85 → +2.73sts, rate=0.5 → +12sts, rate=1.5 → -7.02sts
  private _currentSemitones = 0

  /** Ссылка на TransportV3 (устанавливается извне для rate routing) */
  setTransportRate: ((rate: number) => void) | null = null

  constructor(ctx: AudioContext) {
    this._ctx = ctx

    // Input — точка разделения сигнала на два параллельных пути
    this._inputGain = ctx.createGain()
    this._inputGain.gain.value = 1.0

    // Bypass path — сигнал идёт напрямую в обход stretch
    this._bypassGain = ctx.createGain()
    this._bypassGain.gain.value = 1.0

    // Stretch path — сигнал идёт через Signalsmith
    this._stretchGain = ctx.createGain()
    this._stretchGain.gain.value = 0.0

    // Output — summing junction: bypass + stretch микшируются
    this._outputGain = ctx.createGain()
    this._outputGain.gain.value = 1.0

    // Static wiring (до создания stretchNode):
    // input → bypassGain → output
    this._inputGain.connect(this._bypassGain)
    this._bypassGain.connect(this._outputGain)
    // input → stretchGin (stretchNode вставится в init)
    // stretchGain → output
    this._stretchGain.connect(this._outputGain)
  }

  get isActive(): boolean {
    return this._active
  }

  /** Вход — MonitorRouter._defaultBranch подключается сюда */
  get inputNode(): AudioNode {
    return this._inputGain
  }

  /** Выход — подключается к ctx.destination */
  get outputNode(): AudioNode {
    return this._outputGain
  }

  /** Инициализация Signalsmith (асинхронно, после constructor) */
  async init(): Promise<void> {
    try {
      this._stretchNode = await SignalsmithStretch(this._ctx, {
        outputChannelCount: [2]
      }) as unknown as AudioWorkletNode

      // Ручная конфигурация — 20ms latency (проверено в Spike)
      await (this._stretchNode as any).configure({
        blockMs: 20,
        intervalMs: 5
      })

      const latency = await (this._stretchNode as any).latency()
      console.log(`[SignalsmithAdapter] ✅ Initialized, latency: ${(latency * 1000).toFixed(1)}ms`)

      // Параллельная проводка: input → stretchNode → stretchGain → output
      this._inputGain.connect(this._stretchNode as unknown as AudioNode)
      ;(this._stretchNode as unknown as AudioNode).connect(this._stretchGain)

      // Phase 2: активен по умолчанию (pitch correction через semitones)
      this.setActive(true)
    } catch (e) {
      console.warn('[SignalsmithAdapter] ❌ Init failed — falling back to varispeed:', e)
      this._active = false
      this._bypassGain.gain.value = 1.0
      this._stretchGain.gain.value = 0.0
    }
  }

  /** Включить/выключить Signalsmith (crossfade 20ms) */
  setActive(on: boolean): void {
    // Guard: если Worklet не загрузился — не трогаем gain'ы
    if (on && !this._stretchNode) {
      console.warn('[SignalsmithAdapter] ❌ Cannot activate — stretchNode not initialized')
      return
    }
    if (!on && !this._stretchNode) {
      // Если stretchNode нет, мы уже в bypass — ничего не делаем
      this._active = false
      return
    }

    this._active = on
    const now = this._ctx.currentTime
    this._bypassGain.gain.cancelScheduledValues(now)
    this._stretchGain.gain.cancelScheduledValues(now)
    this._bypassGain.gain.setValueAtTime(this._bypassGain.gain.value, now)
    this._stretchGain.gain.setValueAtTime(this._stretchGain.gain.value, now)
    this._bypassGain.gain.linearRampToValueAtTime(on ? 0 : 1, now + 0.02)
    this._stretchGain.gain.linearRampToValueAtTime(on ? 1 : 0, now + 0.02)

    // 🔴 БАГФИК: переключаем режим stretchNode + pitch correction (via semitones)
    // REGIME 2 не поддерживает rate для time-stretch — используем semitones
    ;(this._stretchNode as any).schedule({
      active: on,
      semitones: this._currentSemitones
    })

    console.log(`[SignalsmithAdapter] ${on ? '✅ ACTIVE' : '⏸ BYPASS'} (rate=${this._currentRate}, st=${this._currentSemitones.toFixed(1)})`)
  }

  /** Установить rate — только когда Signalsmith активен.
   *  REGIME 2 (connected mode) → конвертируем rate в semitones для pitch correction.
   *  Varispeed: stems играют на rate, Signalsmith исправляет pitch.
   */
  setRate(rate: number): void {
    if (!this._active || !this._stretchNode) return
    this._currentRate = rate
    this._currentSemitones = -12 * Math.log2(rate)
    ;(this._stretchNode as any).schedule({ semitones: this._currentSemitones })
    console.log(`[SignalsmithAdapter] setRate ${rate} → semitones ${this._currentSemitones.toFixed(2)}`)
  }

  /** Текущий rate */
  get currentRate(): number {
    return this._currentRate
  }

  /** inputTime для UI sync */
  get inputTime(): number {
    return (this._stretchNode as any)?.inputTime ?? 0
  }

  /** Подписка на обновление времени (для lyrics sync) */
  setUpdateInterval(seconds: number, callback: (time: number) => void): void {
    if (this._stretchNode) {
      ;(this._stretchNode as any).setUpdateInterval(seconds, callback)
    }
  }

  dispose(): void {
    try { (this._stretchNode as any)?.disconnect?.() } catch {}
    this._inputGain.disconnect()
    this._bypassGain.disconnect()
    this._stretchGain.disconnect()
    this._outputGain.disconnect()
  }
}
