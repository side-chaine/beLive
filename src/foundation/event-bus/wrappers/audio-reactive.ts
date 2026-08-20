// ============================================================
// src/foundation/event-bus/wrappers/audio-reactive.ts
// CLASS: SIDE-EFFECT
// ORIGINAL: src/bridges/audio-reactive.bridge.ts (139 строк, ❄️ FROZEN)
//
// EventBus-wrapper с полной parity.
// AnalyserNode lifecycle + FFT + 5 CSS vars + acquire/release
// ============================================================

import { eventBus } from '../event-bus'
import { EventBusChannel, Subscription } from '../types'
import { getPlaybackVisualScheduler } from '../../../playback'
import type { PlaybackVisualFrameDetector, PlaybackVisualFrameWriter } from '../../../playback'
import { queueCssVar, clearQueuedCssVars } from '../../../runtime/visual/css-var-batch'
import { acquire, release } from '../../../services/playback-orchestrator.service'

// Module-level HMR guard
let activeInstance = 0

export function initAudioReactiveEvents(): () => void {
  const myInstance = ++activeInstance
  const subs: Subscription[] = []

  // AnalyserNode lifecycle
  let analyser: AnalyserNode | null = null
  let dataArray: Uint8Array | null = null

  const setupAnalyser = () => {
    const ae = (window as any).audioEngine
    if (!ae?.audioContext) return
    try {
      const ctx = ae.audioContext as AudioContext
      analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.8
      dataArray = new Uint8Array(analyser.frequencyBinCount)

      if (ae.stereoMerger?.connect) {
        ae.stereoMerger.connect(analyser)
      } else if (ae.instrumentalGain?.connect) {
        ae.instrumentalGain.connect(analyser)
      } else {
        console.warn('[audio-reactive] connect failed: no stereoMerger or instrumentalGain')
      }
    } catch (e) {
      console.warn('[audio-reactive] connect failed:', e)
    }
  }

  const teardownAnalyser = () => {
    try {
      analyser?.disconnect()
    } catch { /* ignore */ }
    analyser = null
    dataArray = null
  }

  // Scheduler integration
  const scheduler = getPlaybackVisualScheduler()

  // Frame state
  let rafSyncActive = false
  let frameEnergy = 0
  let frameBass = 0
  let frameMid = 0
  let frameHigh = 0
  let frameBeat = 0

  const resetCssVars = () => {
    const root = document.documentElement
    root.style.setProperty('--bl-audio-energy', '0')
    root.style.setProperty('--bl-audio-bass', '0')
    root.style.setProperty('--bl-audio-mid', '0')
    root.style.setProperty('--bl-audio-high', '0')
    root.style.setProperty('--bl-audio-beat', '0')
  }

  // Detector: FFT analysis
  const detector: PlaybackVisualFrameDetector = {
    id: 'audio-reactive-events-detector',
    detect() {
      if (myInstance !== activeInstance) return
      if (!rafSyncActive || !analyser || !dataArray) {
        frameEnergy = 0; frameBass = 0; frameMid = 0; frameHigh = 0; frameBeat = 0
        return
      }

      analyser.getByteFrequencyData(dataArray)
      const len = dataArray.length
      const bassEnd = Math.floor(len * 0.1)    // 0-10%
      const midEnd = Math.floor(len * 0.4)      // 10-40%
      let energy = 0, bass = 0, mid = 0, high = 0

      for (let i = 0; i < len; i++) {
        const v = dataArray[i] / 255
        energy += v
        if (i < bassEnd) bass += v
        else if (i < midEnd) mid += v
        else high += v
      }

      energy /= len; bass /= bassEnd; mid /= (midEnd - bassEnd); high /= (len - midEnd)

      // 1. Сначала присваиваем frame-метрики (фикс off-by-one)
      frameEnergy = energy
      frameBass = bass
      frameMid = mid
      frameHigh = high

      // 2. Beat detection — scaled ramp : 0 (parity с bridge)
      const beatThreshold = 0.6
      const beat = frameBass > beatThreshold
        ? Math.min((frameBass - beatThreshold) / (1 - beatThreshold) * 2, 1)
        : 0

      // 3. Peak-hold: max(scaled, decayed_prev) — parity с bridge
      frameBeat = beat > frameBeat ? beat : frameBeat * 0.85
    },
  }

  // Writer: publish CSS vars
  const writer: PlaybackVisualFrameWriter = {
    id: 'audio-reactive-events-writer',
    write() {
      queueCssVar('--bl-audio-energy', frameEnergy.toFixed(3))
      queueCssVar('--bl-audio-bass', frameBass.toFixed(3))
      queueCssVar('--bl-audio-mid', frameMid.toFixed(3))
      queueCssVar('--bl-audio-high', frameHigh.toFixed(3))
      queueCssVar('--bl-audio-beat', frameBeat.toFixed(3))
    },
  }

  scheduler.registerDetector(detector)
  scheduler.registerWriter(writer)
  acquire('audio-reactive')

  // ── EventBus подписки ──
  subs.push(eventBus.subscribe(EventBusChannel.Audio, 'playback-state-changed', (p) => {
    rafSyncActive = p?.isPlaying ?? false
    if (rafSyncActive && !analyser) setupAnalyser()
    if (!rafSyncActive) {
      frameEnergy = 0; frameBass = 0; frameMid = 0; frameHigh = 0; frameBeat = 0
    }
  }))

  // Cleanup
  return () => {
    release('audio-reactive')
    scheduler.unregister('audio-reactive-events-detector')
    scheduler.unregister('audio-reactive-events-writer')
    subs.forEach(s => s.unsubscribe())
    teardownAnalyser()
    resetCssVars()
    clearQueuedCssVars('audio')
  }
}
