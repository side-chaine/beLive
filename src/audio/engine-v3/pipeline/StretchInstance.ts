// src/audio/engine-v3/pipeline/StretchInstance.ts
// Оборачивает один signalsmith-stretch инстанс + AudioBuffer
// REGIME 3: true time-stretch через schedule({ rate, input, loopStart, loopEnd })

// @ts-expect-error — SignalsmithStretch.mjs.d.ts exists in vendor/ but TS may not resolve .mjs imports
import SignalsmithStretch from '../vendor/SignalsmithStretch.mjs'

export interface StretchInstanceOptions {
  ctx: AudioContext
  blockMs?: number
  intervalMs?: number
}

export class StretchInstance {
  private readonly _ctx: AudioContext
  private readonly _id: string
  private _node: AudioWorkletNode | null = null
  private _buffer: AudioBuffer | null = null
  private readonly _inputGain: GainNode
  private readonly _outputGain: GainNode
  private _active = false
  private _stemId: string | null = null


  constructor(id: string, opts: StretchInstanceOptions) {
    this._id = id
    this._ctx = opts.ctx
    this._inputGain = opts.ctx.createGain()
    this._outputGain = opts.ctx.createGain()
    this._inputGain.gain.value = 1.0
    this._outputGain.gain.value = 1.0
    // Bypass routing до init
    this._inputGain.connect(this._outputGain)
  }

  get id(): string { return this._id }
  get inputNode(): AudioNode { return this._inputGain }
  get outputNode(): AudioNode { return this._outputGain }
  get isActive(): boolean { return this._active }
  get buffer(): AudioBuffer | null { return this._buffer }

  set stemId(value: string) {
    this._stemId = value
  }
  get inputTime(): number {
    return (this._node as any)?.inputTime ?? 0
  }

  async init(): Promise<void> {
    try {
      this._node = await SignalsmithStretch(this._ctx, {
        numberOfInputs: 0,    // 🎯 REGIME 3: NO live input — uses addBuffers() + schedule() only
        outputChannelCount: [2]
      }) as unknown as AudioWorkletNode

      // 054-C: blockMs 40 / intervalMs 20 → −45% CPU, вдвое лучше бас
      await (this._node as any).configure({
        blockMs: 40,
        intervalMs: 20,
        splitComputation: true
      })

      const latency = await (this._node as any).latency()
      console.log(`[StretchInstance:${this._id}] ✅ Init OK, latency: ${(latency * 1000).toFixed(1)}ms`)

      // ⚠️ НЕ подключаем AudioNode к stretchNode!
      // REGIME 3 работает ТОЛЬКО через addBuffers() + schedule({ input })
      // Live-input (AudioNode → stretchNode) блокирует REGIME 3.
      // Оставляем bypass: inputGain → outputGain (уже из constructor)
      // stretchNode.output по-прежнему подключен для schedule({ active: true })
      ;(this._node as unknown as AudioNode).connect(this._outputGain)

      // 🛡️ WASM crash guard: если processor упал — флаг _active = false
      ;(this._node as AudioWorkletNode).onprocessorerror = () => {
        console.warn(`[StretchInstance:${this._id}] ⚠️ WASM processor error — fallback to varispeed`)
        this._active = false
      }

      // 🛡️ Live error listener — ловим детали краха из try/catch в WasmProcessor
      // 🔧 FIX: addEventListener — НЕ затирает SignalSmith's внутренний onmessage,
      // который обрабатывает ответы addBuffers/dropBuffers/start и резолвит промисы.
      ;(this._node as AudioWorkletNode).port.addEventListener('message', (event) => {
        const data = event.data
        if (Array.isArray(data) && data[0] === 'error') {
          console.warn(`[StretchInstance:${this._id}] ❌ WASM runtime error (from worklet):`, data[1])
          this._active = false
          // Notify external listeners through outputGain
          this._outputGain.dispatchEvent(new CustomEvent('stretch-crash', {
            detail: { id: this._stemId ?? this._id, error: data[1] }
          }))
        }
        // time messages handled by signalsmith internally via its own handler
      })

      this._active = true
    } catch (e) {
      this._active = false
      console.warn(`[StretchInstance:${this._id}] ❌ Init failed — fallback to varispeed:`, e)
      // Оставляем bypass routing (inputGain → outputGain)
      this._inputGain.gain.value = 1.0
      this._outputGain.gain.value = 1.0
    }
  }

  /**
   * Загрузить буфер одним вызовом addBuffers (REGIME 3).
   * subarray() НЕ ИСПОЛЬЗОВАТЬ — signalsmith передаёт ArrayBuffer через
   * transferable postMessage, что детачит исходный буфер.
   * Весь буфер целиком — безопасно, addBuffers асинхронна (postMessage).
   */
  async chunkedLoad(buffer: AudioBuffer): Promise<void> {
    if (!this._node || !this._active) return
    this._buffer = buffer

    const channels: Float32Array[] = []
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      channels.push(buffer.getChannelData(c))
    }

    await (this._node as any).addBuffers(channels)

    console.log(`[StretchInstance:${this._id}] ✅ Load complete (${buffer.duration.toFixed(1)}s, ${buffer.length} samples)`)

  }


  /** Alias для обратной совместимости */
  async loadBuffer(buffer: AudioBuffer): Promise<void> {
    return this.chunkedLoad(buffer)
  }

  /** 🎯 Начать REGIME 3 playback — start() вместо schedule() для корректной инициализации */
  async start(offset: number, rate: number): Promise<void> {
    if (!this._node || !this._active) return
    const maxTime = this._buffer?.duration ?? 3600
    const safeOffset = Math.min(offset, maxTime - 0.1)
    if (safeOffset < 0 || !Number.isFinite(safeOffset)) return
    await (this._node as any).start({
      input: safeOffset,
      rate,
      semitones: 0,
      active: true
    })
    if (import.meta.env.DEV) console.log(`[RECON-1] StretchInstance:${this._id} | start(offset=${safeOffset.toFixed(2)}, rate=${rate.toFixed(3)}) ✅ resolved | buffer=${this._buffer?.duration.toFixed(1)}s | active=${this._active} | node=${!!this._node}`)
  }

  /** Запланировать rate change с сохранением pitch (semitones=0) */
  async scheduleRate(rate: number, semitones: number = 0): Promise<void> {
    if (!this._node || !this._active) return
    await (this._node as any).schedule({
      rate,
      semitones,
      active: true
    })
  }

  /** Seek с валидацией границ — защита от WASM RangeError */
  async seek(offset: number, rate: number): Promise<void> {
    if (!this._node || !this._active) return
    // Валидация: не выходим за пределы буфера
    const maxTime = this._buffer?.duration ?? 3600
    const safeOffset = Math.min(offset, maxTime - 0.1)
    if (safeOffset < 0 || !Number.isFinite(safeOffset)) return
    await (this._node as any).schedule({
      input: safeOffset,
      rate,
      semitones: 0,
      active: true
    })
  }

  /** Запланировать loop (native — без щелчков) */
  async scheduleLoop(start: number, end: number): Promise<void> {
    if (!this._node || !this._active) return
    await (this._node as any).schedule({ loopStart: start, loopEnd: end })
  }

  /** Снять loop (M2, Корень B): возвращаем ноду к дефолту вендора loopStart=0, loopEnd=0.
   *  Подтверждено SignalsmithStretch.mjs:48-49 (дефолт) + :424-425 (loopLength<=0 → без wrap). */
  async scheduleLoopNone(): Promise<void> {
    if (!this._node || !this._active) return
    await (this._node as any).schedule({ loopStart: 0, loopEnd: 0 })
  }

  /** Запланировать seek */
  async scheduleSeek(time: number): Promise<void> {
    if (!this._node || !this._active) return
    await (this._node as any).schedule({ input: time })
  }

  /** Стоп */
  stop(): void {
    if (!this._node) return
    ;(this._node as any).stop()
  }

  /** 🧹 Очистить все буферы в WASM — вызывается при reset() для предотвращения утечки памяти между треками */
  async clearBuffers(): Promise<void> {
    if (!this._node) return
    try {
      // Без аргумента signalsmith очищает все буферы и сбрасывает audioBuffersStart/End в 0
      await (this._node as any).dropBuffers()
      this._buffer = null
      if (import.meta.env.DEV) console.log(`[StretchInstance:${this._id}] 🧹 Buffers cleared`)
    } catch (e) {
      console.warn(`[StretchInstance:${this._id}] clearBuffers failed:`, e)
    }
  }



  dispose(): void {
    this.stop()    // stop() больше не проверяет _active — disconnect и при крахе
    try { (this._node as any)?.disconnect?.() } catch {}
    this._inputGain.disconnect()
    this._outputGain.disconnect()
    this._node = null
    this._buffer = null
  }
}
