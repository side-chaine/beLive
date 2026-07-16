import { V2Adapter } from './V2Adapter'

export class CaptureBusV3 {
  private _dest: MediaStreamAudioDestinationNode | null = null
  private _stream: MediaStream | null = null

  /** Создать MediaStreamDestination. НЕ использует deprecated captureStream() */
  init(ctx: AudioContext): void {
    this._dest = ctx.createMediaStreamDestination()
    this._stream = this._dest.stream
  }

  get destination(): MediaStreamAudioDestinationNode | null { return this._dest }
  get stream(): MediaStream | null { return this._stream }

  /** Подключить источник к capture bus */
  connect(source: AudioNode): void {
    if (this._dest) source.connect(this._dest)
  }

  /** Отключить источник */
  disconnect(source: AudioNode): void {
    if (this._dest) source.disconnect(this._dest)
  }

  /** Получить stream для записи (замена captureStream()) */
  getCaptureStream(): MediaStream | null {
    // V3 native — через destination.stream
    if (this._stream) return this._stream
    // V2 fallback
    try {
      return V2Adapter.getInstance().delegateSync('getProgramCaptureStream') as MediaStream ?? null
    } catch {
      return null
    }
  }

  dispose(): void {
    this._dest = null
    this._stream = null
  }
}
