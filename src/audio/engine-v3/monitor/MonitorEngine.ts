// ============================================================
// src/audio/engine-v3/monitor/MonitorEngine.ts
// Permanent Facade — window.monitorMix replacement (TC-2C-2)
//
// Permanent Facade (НЕ per-track swap): window.monitorMix = MonitorEngine
// один раз на boot, навсегда. V2/V3 — внутренний режим, не объекты.
//
// Legacy: window.MonitorMix класс (monitor-mix.js:1214) — если он загрузился
// до нас, усыновляем как V2-делегат. Если после — его guard
// (!window.monitorMix) не даст перезатереть нас.
// ============================================================

import { MonitorRouter } from './MonitorRouter'
import { PulseCalibrator } from './PulseCalibrator'
import { AutoMixController } from './AutoMixController'

export type BackendMode = 'v2' | 'v3'

export interface MonitorEngineState {
  enabled: boolean; delayMs: number; includeMusic: boolean
  musicLevel: number; outputDeviceId: string; mainDeviceId: string
  routeMainEnabled: boolean; compensateOn: 'monitor' | 'main'
  vocalToMain: boolean; vocalHallLevel: number; devices: MediaDeviceInfo[]
}

export class MonitorEngine {
  private _mode: BackendMode = 'v2'
  private _legacy: any = null
  private _router: MonitorRouter | null = null
  private _calibrator: PulseCalibrator | null = null
  private _autoMix: AutoMixController | null = null
  private _state: MonitorEngineState = {
    enabled: false, delayMs: 120, includeMusic: false,
    musicLevel: 0.15, outputDeviceId: '', mainDeviceId: '',
    routeMainEnabled: false, compensateOn: 'monitor',
    vocalToMain: false, vocalHallLevel: 0.2, devices: [],
  }

  constructor() {
    // Усыновляем/замещаем window.monitorMix
    const existing = (window as any).monitorMix
    if (existing && existing.constructor?.name !== 'MonitorEngine') {
      this._legacy = existing
    }
    (window as any).monitorMix = this
    if ((window as any).app) (window as any).app.monitorMix = this

    // Перенос state из legacy
    if (this._legacy) {
      this._state.enabled = this._legacy.enabled ?? false
      this._state.delayMs = this._legacy.delayMs ?? 120
      this._state.musicLevel = this._legacy.musicLevel ?? 0.15
      // ... при необходимости больше полей
    }
  }

  /** Подключить Router + контроллеры (вызывается из bootAether после создания Router) */
  setBackend(router: MonitorRouter, ctx: AudioContext): void {
    this._router = router
    this._calibrator = new PulseCalibrator(router, ctx)
    this._autoMix = new AutoMixController(router)
    this._autoMix.start()
  }

  setBackendMode(mode: BackendMode): void {
    this._mode = mode
  }

  // ── 11 property getters (контракт monitor-events.ts) ──
  get enabled(): boolean { return this._state.enabled }
  get delayMs(): number { return this._state.delayMs }
  get includeMusic(): boolean { return this._state.includeMusic }
  get musicLevel(): number { return this._state.musicLevel }
  get outputDeviceId(): string { return this._state.outputDeviceId }
  get mainDeviceId(): string { return this._state.mainDeviceId }
  get routeMainEnabled(): boolean { return this._state.routeMainEnabled }
  get compensateOn(): 'monitor' | 'main' { return this._state.compensateOn }
  get vocalToMain(): boolean { return this._state.vocalToMain }
  get vocalHallLevel(): number { return this._state.vocalHallLevel }
  get devices(): MediaDeviceInfo[] { return this._state.devices }

  getState(): MonitorEngineState { return { ...this._state } }

  // ── 34+ методов (делегация V2/V3) ──

  private _dispatch(event: string): void {
    document.dispatchEvent(new CustomEvent(event, { detail: this.getState() }))
  }

  async enable(opts?: any): Promise<void> {
    if (this._mode === 'v3' && this._router) {
      this._router.setRouteMain(true)
      this._state.enabled = true
    } else if (this._legacy) {
      await this._legacy.enable?.(opts)
      this._state.enabled = true
    }
    this._dispatch('monitor-state-changed')
  }

  disable(): void {
    if (this._mode === 'v3' && this._router) {
      this._router.setRouteMain(false)
      this._state.enabled = false
    } else if (this._legacy) {
      this._legacy.disable?.()
      this._state.enabled = false
    }
    this._dispatch('monitor-state-changed')
  }

  setRouteMain(on: boolean): void {
    if (this._mode === 'v3' && this._router) this._router.setRouteMain(on)
    else this._legacy?.setRouteMain?.(on)
    this._state.routeMainEnabled = on
    this._dispatch('monitor-route-changed')
  }

  setDelayMs(ms: number): void {
    if (this._mode === 'v3' && this._router) this._router.setDelayMs(ms)
    else this._legacy?.setDelayMs?.(ms)
    this._state.delayMs = ms
    this._dispatch('monitor-state-changed')
  }

  setCompensateTarget(t: 'monitor' | 'main'): void {
    if (this._mode === 'v3' && this._router) this._router.setCompensateTarget(t)
    else this._legacy?.setCompensateTarget?.(t)
    this._state.compensateOn = t
    this._dispatch('monitor-route-changed')
  }

  setIncludeMusic(on: boolean): void {
    if (this._mode === 'v3' && this._router) this._router.setMusicLevel(on ? this._state.musicLevel : 0)
    else this._legacy?.setIncludeMusic?.(on)
    this._state.includeMusic = on
    this._dispatch('monitor-state-changed')
  }

  setMusicLevel(v: number): void {
    if (this._mode === 'v3' && this._router) this._router.setMusicLevel(v)
    else this._legacy?.setMusicLevel?.(v)
    this._state.musicLevel = v
    if (this._state.includeMusic) this._dispatch('monitor-state-changed')
  }

  setVocalToMain(on: boolean): void {
    if (this._mode === 'v3' && this._router) this._router.setVocalToMain(on)
    else this._legacy?.setVocalToMain?.(on)
    this._state.vocalToMain = on
    this._dispatch('monitor-route-changed')
  }

  setVocalHallLevel(v: number): void {
    if (this._mode === 'v3' && this._router) this._router.setVocalHallLevel(v)
    else this._legacy?.setVocalHallLevel?.(v)
    this._state.vocalHallLevel = v
  }

  // AutoMix config
  setAutoVerse(on: boolean): void { this._legacy?.setAutoVerse?.(on) }
  setAutoVerseLevel(v: number): void { this._legacy?.setAutoVerseLevel?.(v) }
  setAutoChorus(on: boolean): void { this._legacy?.setAutoChorus?.(on) }
  setAutoChorusLevel(v: number): void { this._legacy?.setAutoChorusLevel?.(v) }
  setAutoBridge(on: boolean): void { this._legacy?.setAutoBridge?.(on) }
  setAutoBridgeLevel(v: number): void { this._legacy?.setAutoBridgeLevel?.(v) }
  setAutoIntro(on: boolean): void { this._legacy?.setAutoIntro?.(on) }
  setAutoIntroLevel(v: number): void { this._legacy?.setAutoIntroLevel?.(v) }
  setAutoPreChorus(on: boolean): void { this._legacy?.setAutoPreChorus?.(on) }
  setAutoPreChorusLevel(v: number): void { this._legacy?.setAutoPreChorusLevel?.(v) }
  setAutoOutro(on: boolean): void { this._legacy?.setAutoOutro?.(on) }
  setAutoOutroLevel(v: number): void { this._legacy?.setAutoOutroLevel?.(v) }

  setLineUpSource(s: 'pulse' | 'voc'): void { this._legacy?.setLineUpSource?.(s) }
  setHallVolume(v: number): void { if (this._router) this._router.setHallVolume(v) }
  setMonitorVolume(v: number): void { if (this._router) this._router.setMonitorVolume(v) }

  previewDelayMs(ms: number): void {
    if (this._mode === 'v3' && this._calibrator) { this._calibrator.previewDelayMs(ms); return }
    this._legacy?.previewDelayMs?.(ms)
  }
  beginPulseCalibration(d: number, i: number): void {
    if (this._mode === 'v3' && this._calibrator) { this._calibrator.beginPulseCalibration(d, i); return }
    this._legacy?.beginPulseCalibration?.(d, i)
  }
  endPulseCalibration(): void {
    if (this._mode === 'v3' && this._calibrator) { this._calibrator.endPulseCalibration(); return }
    this._legacy?.endPulseCalibration?.()
  }
  stopSyncSequence(): void {
    if (this._mode === 'v3' && this._calibrator) { this._calibrator.stopSyncSequence(); return }
    this._legacy?.stopSyncSequence?.()
  }
  async testPulse(): Promise<void> {
    if (this._mode === 'v3' && this._calibrator) return this._calibrator.testPulse()
    return this._legacy?.testPulse?.()
  }
  async listOutputs(): Promise<MediaDeviceInfo[]> { return this._legacy?.listOutputs?.() ?? [] }

  /** Для __switchToV3 — принять состояние от legacy */
  adoptState(legacy: any): void {
    if (!legacy) return
    this._state.enabled = legacy.enabled ?? false
    this._state.delayMs = legacy.delayMs ?? 120
    this._state.includeMusic = legacy.includeMusic ?? false
    this._state.musicLevel = legacy.musicLevel ?? 0.15
    this._state.outputDeviceId = legacy.outputDeviceId ?? ''
    this._state.mainDeviceId = legacy.mainDeviceId ?? ''
    this._state.routeMainEnabled = legacy.routeMainEnabled ?? false
    this._state.compensateOn = legacy.compensateOn ?? 'monitor'
    this._state.vocalToMain = legacy.vocalToMain ?? false
    this._state.vocalHallLevel = legacy.vocalHallLevel ?? 0.2
  }
}
