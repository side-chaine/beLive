export interface MeterData {
  rms: number
  peak: number
  isClipping: boolean
}

export class MeterNodeV3 {
  private _analyser: AnalyserNode
  private _data: Float32Array
  private _clipCount = 0
  private readonly CLIP_THRESHOLD = 0.98

  constructor(ctx: AudioContext, fftSize: number = 256) {
    this._analyser = ctx.createAnalyser()
    this._analyser.fftSize = fftSize
    this._data = new Float32Array(this._analyser.frequencyBinCount)
  }

  get analyser(): AnalyserNode { return this._analyser }
  get fftSize(): number { return this._analyser.fftSize }

  /** Подключить источник к метру */
  connect(source: AudioNode): void {
    source.connect(this._analyser)
  }

  disconnect(source: AudioNode): void {
    source.disconnect(this._analyser)
  }

  /** Получить RMS + peak за одно чтение */
  read(): MeterData {
    this._analyser.getFloatTimeDomainData(this._data)
    let sum = 0
    let peak = 0
    for (let i = 0; i < this._data.length; i++) {
      const abs = Math.abs(this._data[i])
      sum += abs * abs
      if (abs > peak) peak = abs
    }
    const rms = Math.sqrt(sum / this._data.length)
    const isClipping = peak >= this.CLIP_THRESHOLD
    if (isClipping) this._clipCount++
    return { rms, peak, isClipping }
  }

  /** Сбросить счётчик клиппинга */
  resetClipCount(): void { this._clipCount = 0 }
  get clipCount(): number { return this._clipCount }
}
