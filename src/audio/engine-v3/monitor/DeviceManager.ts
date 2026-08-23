// ============================================================
// src/audio/engine-v3/monitor/DeviceManager.ts
// Audio output device management (TC-2C-2)
//
// Владеет двумя hidden <audio> элементами (monitor + main).
// setSinkId — Chromium-only (iOS guard).
// ============================================================

export class DeviceManager {
  private _monitorEl: HTMLAudioElement | null = null
  private _mainEl: HTMLAudioElement | null = null
  private _devices: MediaDeviceInfo[] = []
  private _changeHandler: (() => void) | null = null

  readonly monitorStream: MediaStreamAudioDestinationNode
  readonly mainStream: MediaStreamAudioDestinationNode

  constructor(monitorStream: MediaStreamAudioDestinationNode, mainStream: MediaStreamAudioDestinationNode) {
    this.monitorStream = monitorStream
    this.mainStream = mainStream
  }

  get devices(): MediaDeviceInfo[] { return this._devices }

  async listOutputs(): Promise<MediaDeviceInfo[]> {
    try {
      const all = await navigator.mediaDevices.enumerateDevices()
      this._devices = all.filter(d => d.kind === 'audiooutput')
      return this._devices
    } catch { return [] }
  }

  async ensureMonitorPlaying(): Promise<void> { await this._ensureAudio('monitor') }

  private async _ensureAudio(target: 'monitor' | 'main'): Promise<HTMLAudioElement> {
    const key = target === 'monitor' ? '_monitorEl' : '_mainEl'
    if (this[key]) return this[key]!

    const el: HTMLAudioElement = document.createElement('audio')
    el.autoplay = true
    el.muted = false
    ;(el as any).playsInline = true
    el.style.display = 'none'
    el.srcObject = (target === 'monitor' ? this.monitorStream : this.mainStream) as any
    document.body.appendChild(el)
    el.volume = 1; el.muted = false
    try {
      await el.play()
      if (import.meta.env.DEV) console.log(`[DeviceManager] ${target} audio PLAYING`)
    } catch (e) {
      console.warn(`[DeviceManager] ${target} play() BLOCKED`, e)
    }
    this[key] = el
    return el
  }

  async setOutputDevice(deviceId: string, target: 'monitor' | 'main'): Promise<boolean> {
    const el = await this._ensureAudio(target)
    // Chromium-only (iOS Safari не имеет setSinkId)
    if (!('setSinkId' in HTMLAudioElement.prototype)) return false
    try {
      await (el as any).setSinkId(deviceId)
      const key = target === 'monitor' ? 'monitor:deviceId' : 'monitor:mainDeviceId'
      localStorage.setItem(key, deviceId)
      return true
    } catch { return false }
  }

  /** Lazy devicechange listener — при первом enable */
  enableChangeListener(): void {
    if (this._changeHandler) return
    this._changeHandler = () => { void this.listOutputs() }
    navigator.mediaDevices?.addEventListener('devicechange', this._changeHandler)
  }

  dispose(): void {
    if (this._changeHandler) {
      navigator.mediaDevices?.removeEventListener('devicechange', this._changeHandler)
      this._changeHandler = null
    }
    const dispose = (el: HTMLAudioElement | null) => {
      if (!el) return
      el.srcObject = null
      el.remove()
    }
    dispose(this._monitorEl)
    dispose(this._mainEl)
    this._monitorEl = null
    this._mainEl = null
  }
}
