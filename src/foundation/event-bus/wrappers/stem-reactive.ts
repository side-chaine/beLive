// ============================================================
// src/foundation/event-bus/wrappers/stem-reactive.ts
// CLASS: SIDE-EFFECT
// ORIGINAL: src/bridges/stem-reactive.bridge.ts (264 строк, ❄️ FROZEN)
//
// Полный rewrite. Per-stem CSS vars, envelope follower, RMS cache.
// ============================================================

import { Subscription } from '../types'
import { useStemStore } from '../../../stem/stem.store'
import { useRecordingStore } from '../../../stores/recording.store'
import { useTakesStore } from '../../../takes/takes.store'
import { usePerformanceStore } from '../../../performance/performance.store'
import { getPlaybackVisualScheduler } from '../../../playback'
import type { PlaybackVisualFrameDetector, PlaybackVisualFrameWriter } from '../../../playback'
import { queueCssVar, clearQueuedCssVars } from '../../../runtime/visual/css-var-batch'
import { acquire, release } from '../../../services/playback-orchestrator.service'

const CSS_ENERGY = (id: string) => `--bl-stem-${id}-energy`
const CSS_HIT = (id: string) => `--bl-stem-${id}-hit`

export function initStemReactiveEvents(): () => void {
  const subs: Subscription[] = []
  const scheduler = getPlaybackVisualScheduler()

  // Module-level state (persistent across frames)
  const stemEnergies: Record<string, number> = {}
  const stemHits: Record<string, number> = {}
  const prevRms: Record<string, number> = {}
  const rmsCache: Record<string, number | undefined> = {}
  let drumsFreqArray: Uint8Array | null = null
  let drumsKickEnergy = 0
  let prevKickEnergy = 0
  let tickCount = 0

  // Phase A: drums kick-band detection (lazy re-fetch — C1/C2 fix)
  let drumsAnalyser: AnalyserNode | null = null

  const detector: PlaybackVisualFrameDetector = {
    id: 'stem-reactive-detector',
    detect() {
      // Phase 0: Recording-safe — skip ALL computation + zero stems (C5 fix)
      const isRecording = useRecordingStore.getState().isRecording || useTakesStore.getState().isRecording
      if (isRecording) {
        useStemStore.getState().loadedStems.forEach((id: string) => {
          if (id === 'instrumental') return
          stemEnergies[id] = 0; stemHits[id] = 0; prevRms[id] = 0
        })
        drumsKickEnergy = 0; prevKickEnergy = 0
        return
      }

      // Phase A: drums kick-band (60fps) — lazy re-fetch analyser + length guard
      if (!drumsAnalyser || drumsAnalyser.frequencyBinCount !== drumsFreqArray?.length) {
        const fresh = (window as any).audioEngine?.getStemAnalyser?.('drums')
        if (fresh) {
          drumsAnalyser = fresh
          drumsFreqArray = new Uint8Array(fresh.frequencyBinCount)
        }
      }
      if (drumsFreqArray && drumsAnalyser) {
        const expectedLen = drumsAnalyser.frequencyBinCount
        if (drumsFreqArray.length !== expectedLen) {
          drumsFreqArray = new Uint8Array(expectedLen)
        }
        drumsAnalyser.getByteFrequencyData(drumsFreqArray)
        // Bins 2-7 (50-150 Hz)
        let kickSum = 0; const kickCount = Math.min(7, drumsFreqArray.length) - 2
        for (let i = 2; i < Math.min(7, drumsFreqArray.length); i++) {
          kickSum += drumsFreqArray![i] / 255
        }
        drumsKickEnergy = kickCount > 0 ? kickSum / kickCount : 0
        // prevKickEnergy НЕ обновляется здесь — сохраняется для Phase B сравнения (C-R3-2 fix)
      }

      // Phase B — budget check + throttled envelope
      const perfBudget = usePerformanceStore.getState().getBudget()?.visualMixer
      if (perfBudget && perfBudget.enabled === false) return

      const targetFps = perfBudget?.cardUpdateFps ?? 30
      const throttleMax = Math.max(1, Math.round(60 / targetFps))
      if (tickCount % throttleMax !== 0) { tickCount++; return }
      tickCount++

      const loadedStems = useStemStore.getState().loadedStems

      loadedStems.forEach((stemId: string) => {
        if (stemId === 'instrumental') return

        // RMS
        const rms = (window as any).audioEngine?.getStemMeterLevel(stemId) ?? 0

        if (stemId === 'drums') {
          // Drums: instant attack + kick detection
          const kickHit = drumsKickEnergy > prevKickEnergy * 1.4 && drumsKickEnergy > 0.04
          stemEnergies[stemId] = kickHit
            ? Math.max(stemEnergies[stemId] || 0, drumsKickEnergy)
            : (stemEnergies[stemId] || 0) * 0.85
          stemHits[stemId] = kickHit ? 1 : (stemHits[stemId] || 0) * 0.85
        } else {
          // Non-drums: EMA smoothing
          const smoothing = 0.5
          const gain = 1
          const smoothed = (prevRms[stemId] ?? 0) * smoothing + rms * (1 - smoothing)
          stemEnergies[stemId] = Math.min(smoothed * gain, 1)
          prevRms[stemId] = smoothed
          stemHits[stemId] = 0
        }
      })
      prevKickEnergy = drumsKickEnergy  // обновляем ПОСЛЕ Phase B (C-R3-2 fix)
    },
  }

  const writer: PlaybackVisualFrameWriter = {
    id: 'stem-reactive-writer',
    write() {
      const loadedStems = useStemStore.getState().loadedStems
      loadedStems.forEach((stemId: string) => {
        if (stemId === 'instrumental') return
        queueCssVar(CSS_ENERGY(stemId), (stemEnergies[stemId] ?? 0).toFixed(3))
        queueCssVar(CSS_HIT(stemId), (stemHits[stemId] ?? 0).toFixed(3))
      })
      // Zero-fill for stems no longer in loadedStems
      Object.keys(stemEnergies).forEach((id) => {
        if (!loadedStems.includes(id)) {
          queueCssVar(CSS_ENERGY(id), '0')
          queueCssVar(CSS_HIT(id), '0')
        }
      })
    },
  }

  scheduler.registerDetector(detector)
  scheduler.registerWriter(writer)
  acquire('stem-reactive')

  // Handlers
  const onTrackChange = () => {
    drumsAnalyser = null; drumsFreqArray = null  // force re-fetch on next frame (C1 fix)
    Object.keys(stemEnergies).forEach((id) => {
      document.documentElement.style.setProperty(CSS_ENERGY(id), '0')
      document.documentElement.style.setProperty(CSS_HIT(id), '0')
    })
    clearQueuedCssVars('stem')
    Object.keys(stemEnergies).forEach((id) => delete stemEnergies[id])
    Object.keys(stemHits).forEach((id) => delete stemHits[id])
    Object.keys(prevRms).forEach((id) => delete prevRms[id])
    Object.keys(rmsCache).forEach((id) => delete rmsCache[id])
    drumsKickEnergy = 0; prevKickEnergy = 0
  }

  const onPlaybackState = (e: Event) => {
    const detail = (e as CustomEvent).detail
    if (detail?.isPlaying) {
      acquire('stem-reactive') // idempotent
    } else {
      Object.keys(stemEnergies).forEach((id) => {
        stemEnergies[id] = 0; stemHits[id] = 0; prevRms[id] = 0
      })
      drumsKickEnergy = 0; prevKickEnergy = 0
    }
  }

  document.addEventListener('before-track-change', onTrackChange)
  window.addEventListener('playback-state-changed', onPlaybackState)

  // EventBus cleanup only — listeners already on document/window
  return () => {
    release('stem-reactive')
    scheduler.unregister('stem-reactive-detector')
    scheduler.unregister('stem-reactive-writer')
    document.removeEventListener('before-track-change', onTrackChange)
    window.removeEventListener('playback-state-changed', onPlaybackState)
    // Remove all CSS vars
    Object.keys(stemEnergies).forEach((id) => {
      document.documentElement.style.removeProperty(CSS_ENERGY(id))
      document.documentElement.style.removeProperty(CSS_HIT(id))
    })
    clearQueuedCssVars('stem')
    subs.forEach(s => s.unsubscribe())
  }
}
