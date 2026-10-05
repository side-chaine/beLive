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
  private _inflight: Map<'monitor' | 'main', Promise<{ el: HTMLAudioElement; sinkId: string } | null>> = new Map()
  private _playing: Record<'monitor' | 'main', boolean> = { monitor: false, main: false }
  private _appliedSink: Record<'monitor' | 'main', string> = { monitor: '', main: '' }

  /** Батч-1: пуш о живости monitor-ветки. true = play успешен, false = fail/dispose. Подписчик: MonitorEngine (гасит _localTap). */
  onLocalRouteChange?: (live: boolean) => void

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

  async ensureMonitorPlaying(): Promise<string> {
    const r = await this._ensureAudio('monitor')
    return r ? this._appliedSink.monitor : ''
  }

  /** Батч-1: симметрия monitor-ветке. Возвращает применённый sinkId ('' = дефолт/нет). */
  async ensureMainPlaying(): Promise<string> {
    const r = await this._ensureAudio('main')
    return r ? this._appliedSink.main : ''
  }

  /** Батч-1: жив ли monitor-элемент (подключён + играет). */
  get monitorElementLive(): boolean {
    const el = this._monitorEl
    return !!el && el.isConnected && this._playing.monitor
  }

  private async _ensureAudio(target: 'monitor' | 'main'): Promise<{ el: HTMLAudioElement; sinkId: string } | null> {
    const key = target === 'monitor' ? '_monitorEl' : '_mainEl'
    const cached = this[key]
    if (cached) {
      if (!cached.isConnected || cached.error || cached.paused) {
        try { await cached.play(); this._playing[target] = true; this._pushLocalRoute(true) } catch (e) { console.warn(`[DeviceManager] ${target} play() retry BLOCKED`, e) }
      }
      return { el: cached, sinkId: this._appliedSink[target] }
    }
    if (this._inflight.has(target)) return this._inflight.get(target)!
    const p = (async (): Promise<{ el: HTMLAudioElement; sinkId: string } | null> => {
      const node = target === 'monitor' ? this.monitorStream : this.mainStream
      if (!(node?.stream)) { console.warn(`[DeviceManager] ${target} stream unavailable — skip`); return null }
      const el: HTMLAudioElement = document.createElement('audio')
      el.autoplay = true
      el.muted = false
      ;(el as any).playsInline = true
      el.style.display = 'none'
      el.srcObject = node.stream
      el.dataset.target = target
      document.body.appendChild(el)
      this[key] = el
      el.volume = 1; el.muted = false
      try {
        await el.play()
        this._playing[target] = true
        this._pushLocalRoute(true)
        if (import.meta.env.DEV) console.log(`[DeviceManager] ${target} audio PLAYING`)
      } catch (e) {
        console.warn(`[DeviceManager] ${target} play() BLOCKED`, e)
        this._pushLocalRoute(false)
      }
      try {
        const savedId = localStorage.getItem(target === 'monitor' ? 'monitor:deviceId' : 'monitor:mainDeviceId')
        if (savedId && 'setSinkId' in el) {
          try { await el.setSinkId(savedId); this._appliedSink[target] = savedId } catch (e) { console.warn(`[DeviceManager] ${target} restore sinkId failed`, e) }
        }
      } catch (e) { console.warn(`[DeviceManager] ${target} restore sinkId read failed`, e) }
      return { el, sinkId: this._appliedSink[target] }
    })()
    this._inflight.set(target, p)
    try { return await p } finally { this._inflight.delete(target) }
  }

  private _pushLocalRoute(live: boolean): void {
    try { this.onLocalRouteChange?.(live) } catch {}
  }

  async setOutputDevice(deviceId: string, target: 'monitor' | 'main'): Promise<boolean> {
    const r = await this._ensureAudio(target)
    if (!r) return false
    // Chromium-only (iOS Safari не имеет setSinkId)
    if (!('setSinkId' in r.el)) return false
    const key = target === 'monitor' ? 'monitor:deviceId' : 'monitor:mainDeviceId'
    try {
      localStorage.setItem(key, deviceId)
    } catch (e) { console.warn(`[DeviceManager] ${target} persist sinkId failed`, e) }
    try {
      await r.el.setSinkId(deviceId)
      this._appliedSink[target] = deviceId
      return true
    } catch (e) { console.warn('[DeviceManager] setSinkId FAILED', target, deviceId, e); return false }
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
    this._playing = { monitor: false, main: false }
    this._pushLocalRoute(false)
  }
}
