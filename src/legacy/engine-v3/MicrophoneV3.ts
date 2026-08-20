export class MicrophoneV3 {
  private _stream: MediaStream | null = null
  private _source: MediaStreamAudioSourceNode | null = null
  private _gain: GainNode | null = null
  private _enabled = false
  private _volume = 1

  get enabled(): boolean { return this._enabled }
  get volume(): number { return this._volume }
  get stream(): MediaStream | null { return this._stream }
  get source(): MediaStreamAudioSourceNode | null { return this._source }
  get gain(): GainNode | null { return this._gain }

  /** Запросить доступ к микрофону */
  async init(ctx: AudioContext): Promise<boolean> {
    try {
      this._stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      this._source = ctx.createMediaStreamSource(this._stream)
      this._gain = ctx.createGain()
      this._source.connect(this._gain)
      return true
    } catch {
      return false
    }
  }

  /** Установить громкость */
  setVolume(v: number): void {
    this._volume = Math.max(0, Math.min(1, v))
    if (this._gain) this._gain.gain.value = this._volume
  }

  /** Включить/выключить микрофон */
  setEnabled(v: boolean): void {
    this._enabled = v
    if (this._gain) this._gain.gain.value = v ? this._volume : 0
  }

  /** Получить MediaStream для WebRTC или записи */
  getStreamForCapture(): MediaStream | null {
    return this._stream
  }

  dispose(): void {
    this._stream?.getTracks().forEach(t => t.stop())
    this._stream = null
    this._source = null
    this._gain = null
  }
}
