// ============================================================
// src/audio/engine-v3/monitor/PulseCalibrator.ts
// BT latency calibration — lookahead scheduler (TC-2C-3)
//
// Генерация 880Hz pluck с 6 гармониками на MonitorStreamDest.
// Lookahead: 150ms горизонт, 80ms re-check.
// ============================================================

import { MonitorRouter } from './MonitorRouter'

const LOOKAHEAD_SEC = 0.15
const CHECK_INTERVAL_MS = 80
const HARMONICS = [1, 2, 3, 4, 5, 6]
const HARMONIC_GAINS = [1.0, 0.6, 0.4, 0.3, 0.2, 0.1]

export class PulseCalibrator {
  private _router: MonitorRouter
  private _ctx: AudioContext
  private _schedulerTimer: ReturnType<typeof setTimeout> | null = null
  private _nextPulse = 0
  private _intervalSec = 0.667
  private _active = false

  constructor(router: MonitorRouter, ctx: AudioContext) {
    this._router = router
    this._ctx = ctx
  }

  private _emitPulse(time: number): void {
    const sampleRate = this._ctx.sampleRate
    const duration = 0.12
    const frames = Math.floor(sampleRate * duration)
    const buffer = this._ctx.createBuffer(1, frames, sampleRate)
    const data = buffer.getChannelData(0)

    const f0 = 880
    const tau = 0.028
    for (let i = 0; i < frames; i++) {
      const t = i / sampleRate
      let sample = 0
      for (let h = 0; h < HARMONICS.length; h++) {
        sample += HARMONIC_GAINS[h] * Math.sin(2 * Math.PI * f0 * HARMONICS[h] * t)
      }
      data[i] = sample * Math.exp(-t / tau) * 0.35
    }

    const src = this._ctx.createBufferSource()
    src.buffer = buffer
    const gain = this._ctx.createGain()
    gain.gain.value = 0.5
    src.connect(gain)
    gain.connect(this._router.monitorStream as any)
    src.start(time)
    src.onended = () => { try { src.disconnect(); gain.disconnect() } catch {} }
  }

  /** Запустить lookahead scheduler */
  beginPulseCalibration(_delayMs: number, intervalMs: number = 667): void {
    if (this._active) this.endPulseCalibration()
    this._active = true
    this._intervalSec = intervalMs / 1000
    this._nextPulse = this._ctx.currentTime + 0.05

    const schedule = () => {
      if (!this._active) return
      const now = this._ctx.currentTime
      while (this._nextPulse < now + LOOKAHEAD_SEC) {
        this._emitPulse(this._nextPulse)
        this._nextPulse += this._intervalSec
      }
      this._schedulerTimer = setTimeout(schedule, CHECK_INTERVAL_MS)
    }
    schedule()
  }

  endPulseCalibration(): void {
    this._active = false
    if (this._schedulerTimer !== null) {
      clearTimeout(this._schedulerTimer)
      this._schedulerTimer = null
    }
  }

  testPulse(): Promise<void> {
    return new Promise(resolve => {
      this._emitPulse(this._ctx.currentTime + 0.05)
      setTimeout(resolve, 200)
    })
  }

  stopSyncSequence(): void { this.endPulseCalibration() }
  previewDelayMs(_ms: number): void { /* drag preview — бездействует */ }
}
