import {
  queueCssVar,
  clearQueuedCssVars,
} from '../runtime/visual/css-var-batch';
import {
  getPlaybackVisualScheduler,
  type PlaybackVisualFrameDetector,
  type PlaybackVisualFrameWriter,
} from '../playback';
import { useStemStore } from '../stem/stem.store';
import { BUILTIN_STEMS, REACTIVITY_PROFILES, STEM_SENSITIVITY } from '../stem/stemTypes';
import type { StemRole } from '../stem/stemTypes';
import { useRecordingStore } from '../stores/recording.store';
import { useTakesStore } from '../takes/takes.store';
import { usePerformanceStore } from '../performance/performance.store';

// ─── Frame-scoped state ───
let prevRms: Record<string, number> = {};
let stemEnergies: Record<string, number> = {};
let stemHits: Record<string, number> = {};
// TC-13-09: RMS cache — avoids double getStemMeterLevel call per tick
let rmsCache: Record<string, number> = {};

// TC-13-17: Kick-band detection cache for drums stem
let drumsFreqArray: Uint8Array | null = null;
let drumsKickEnergy = 0;
let prevKickEnergy = 0;

// ─── Throttle ───
let tickCount = 0;

// ─── CSS var names ───
const CSS_ENERGY = (id: string) => `--bl-stem-${id}-energy`;
const CSS_HIT    = (id: string) => `--bl-stem-${id}-hit`;

/**
 * Stem Reactive Bridge — Data Nervous System for Visual Mixer
 *
 * Participates in the shared PlaybackVisualScheduler for per-stem
 * audio-reactive CSS variable publishing.
 *
 * Detector: reads RMS from AudioEngineV2, applies per-role reactivity
 *           profiles (smoothing, hit detection), computes energy/hit.
 * Writer: publishes CSS vars (--bl-stem-{id}-energy, --bl-stem-{id}-hit)
 *         via batched queueCssVar for efficient DOM updates.
 *
 * Recording-safe: publishes zeros during recording to prevent visual
 *                 interference with capture stability.
 */
export function initStemReactiveBridge(): () => void {
  const scheduler = getPlaybackVisualScheduler();

  // ═══ DETECTOR ═══
  const detector: PlaybackVisualFrameDetector = {
    id: 'stem-reactive-detector',
    detect() {
      tickCount++;

      const ae = (window as any).audioEngine;
      if (!ae?.getStemMeterLevel) return;

      const isRecording = useRecordingStore.getState().isRecording
        || useTakesStore.getState().isRecording;
      if (isRecording) {
        stemEnergies = {};
        stemHits = {};
        prevRms = {};
        rmsCache = {};
        // TC-13-17: Reset drums kick-band cache
        drumsFreqArray = null;
        drumsKickEnergy = 0;
        prevKickEnergy = 0;
        // TC-14-PRE: No extra state to reset (diagnostic only, no peak history yet)
        return;
      }

      const stemIds = useStemStore.getState().loadedStems;
      const newHits: Record<string, number> = {};
      const newRmsCache: Record<string, number> = {};

      // ─── PHASE A: Hit Detection — runs EVERY tick (no throttle) ───
      for (const stemId of stemIds) {
        if (stemId === 'instrumental') continue;
        const stemDef = BUILTIN_STEMS[stemId];
        const role: StemRole = stemDef?.role ?? 'music';
        const profile = REACTIVITY_PROFILES[role] ?? REACTIVITY_PROFILES.music;

        const rms = ae.getStemMeterLevel(stemId) ?? 0;
        newRmsCache[stemId] = rms;  // Cache for Phase B

        // TC-13-17: Drums hit detection reads KICK BAND (50-150 Hz) only
        if (stemId === 'drums') {
          const analyser = ae.getStemAnalyser?.('drums') as AnalyserNode | null;
          if (analyser) {
            if (!drumsFreqArray || drumsFreqArray.length !== analyser.frequencyBinCount) {
              drumsFreqArray = new Uint8Array(analyser.frequencyBinCount);
            }
            analyser.getByteFrequencyData(drumsFreqArray);
            // Kick band: bins 2-7 (50-150 Hz at 44100Hz, fftSize=2048)
            let kickMax = 0;
            for (let b = 2; b <= 7; b++) {
              if (drumsFreqArray[b] > kickMax) kickMax = drumsFreqArray[b];
            }
            drumsKickEnergy = kickMax / 255; // Normalize 0-1
            
            // Hit detection uses KICK band only (not full RMS)
            const isHit = drumsKickEnergy > prevKickEnergy * 1.4 
                          && drumsKickEnergy > 0.04;  // ~10/255 threshold
            newHits[stemId] = isHit ? 1 : (stemHits[stemId] ?? 0) * 0.85;
          } else {
            // Fallback: use RMS if analyser not available
            const prev = prevRms[stemId] ?? 0;
            const isHit = rms > prev * 1.5 && rms > 0.02;
            newHits[stemId] = isHit ? 1 : (stemHits[stemId] ?? 0) * 0.85;
          }
          prevKickEnergy = drumsKickEnergy;

          // TC-14-01: Envelope Follower for drums (60fps — every tick)
          const prevDrumsEnergy = stemEnergies['drums'] ?? 0;
          if (drumsKickEnergy > prevDrumsEnergy) {
            stemEnergies['drums'] = drumsKickEnergy; // Instant attack!
          } else {
            stemEnergies['drums'] = prevDrumsEnergy * 0.85; // Fast decay (5 ticks from 0.918→0.41)
          }
        } else {
          // All other stems: original hit detection
          if (profile.useHit) {
            const prev = prevRms[stemId] ?? 0;
            const isHit = rms > prev * 1.5 && rms > 0.02;  // TC-13-09: threshold 0.05→0.02
            // Decay previous hit for smooth flash-out
            newHits[stemId] = isHit ? 1 : (stemHits[stemId] ?? 0) * (profile.hitDecay || 0.85);
          } else {
            newHits[stemId] = 0;
          }
        }
      }
      stemHits = newHits;
      prevRms = newRmsCache;
      rmsCache = newRmsCache;

      // ─── PHASE B: Energy — throttled by performance tier ───
      const vmBudget = usePerformanceStore.getState().getBudget()?.visualMixer;
      if (vmBudget && vmBudget.enabled === false) return;
      const targetFps = vmBudget?.cardUpdateFps || 30;
      const throttleMax = Math.max(1, Math.round(60 / targetFps));
      if (tickCount % throttleMax !== 0) return;

      const newEnergies: Record<string, number> = {};
      for (const stemId of stemIds) {
        if (stemId === 'instrumental') continue;
        const stemDef = BUILTIN_STEMS[stemId];
        const role: StemRole = stemDef?.role ?? 'music';
        const profile = REACTIVITY_PROFILES[role] ?? REACTIVITY_PROFILES.music;
        const prevEnergy = stemEnergies[stemId] ?? 0;
        
        // TC-14-01: Drums energy calculated in Phase A (60fps) — preserve value, skip EMA
        if (stemId === 'drums') {
          newEnergies['drums'] = stemEnergies['drums'] ?? 0;
        } else {
          // TC-13-09: Read from cache (populated in Phase A) — no double getStemMeterLevel call
          const rms = rmsCache[stemId] ?? ae.getStemMeterLevel(stemId) ?? 0;
          const smoothEnergy = prevEnergy * profile.smoothing + rms * (1 - profile.smoothing);
          const sensitivity = STEM_SENSITIVITY[stemId];
          const gain = sensitivity?.gain ?? profile.gainMultiplier ?? 1;
          const amplifiedEnergy = Math.min(1, smoothEnergy * gain);
          newEnergies[stemId] = amplifiedEnergy;
        }
      }
      stemEnergies = newEnergies;
    }
  };

  // ═══ WRITER ═══
  const writer: PlaybackVisualFrameWriter = {
    id: 'stem-reactive-writer',
    write() {
      for (const [stemId, energy] of Object.entries(stemEnergies)) {
        queueCssVar(CSS_ENERGY(stemId), energy.toFixed(3));
        queueCssVar(CSS_HIT(stemId), String(stemHits[stemId] ?? 0));
      }
      
      // Publish zeros for stems not in current energies
      const stemIds = useStemStore.getState().loadedStems;
      for (const id of stemIds) {
        if (id === 'instrumental') continue;
        if (!(id in stemEnergies)) {
          queueCssVar(CSS_ENERGY(id), '0');
          queueCssVar(CSS_HIT(id), '0');
        }
      }
      
    }
  };

  // ═══ Register with scheduler ═══
  scheduler.registerDetector(detector);
  scheduler.registerWriter(writer);

  // ═══ Diagnostic: verify registration ═══
  const diagDetector = scheduler as any;
  if (diagDetector._detectors) {
    const registered = diagDetector._detectors.some((d: any) => d.id === 'stem-reactive-detector');
    if (import.meta.env.DEV) console.log('[StemReactiveBridge] detector registered:', registered);
  }
  if (diagDetector._writers) {
    const registered = diagDetector._writers.some((w: any) => w.id === 'stem-reactive-writer');
    if (import.meta.env.DEV) console.log('[StemReactiveBridge] writer registered:', registered);
  }

  // ═══ Start scheduler if not already running ═══
  // Note: trigger.bridge controls scheduler lifecycle for lyrics triggers,
  // but Visual Mixer needs scheduler running independently for stem reactivity.
  // This ensures CSS vars are published even when track is paused.
  if (!scheduler.isRunning()) {
    scheduler.start();
    if (import.meta.env.DEV) console.log('[StemReactiveBridge] scheduler started (independent of trigger.bridge)');
  }

  // ═══ Track change cleanup ═══
  function onTrackChange() {
    stemEnergies = {};
    stemHits = {};
    prevRms = {};
    const root = document.documentElement;
    const stemIds = useStemStore.getState().loadedStems;
    for (const id of stemIds) {
      root.style.setProperty(CSS_ENERGY(id), '0');
      root.style.setProperty(CSS_HIT(id), '0');
    }
    clearQueuedCssVars();
  }
  document.addEventListener('before-track-change', onTrackChange);

  // ═══ Playback state ═══
  function onPlaybackState(e: Event) {
    const detail = (e as CustomEvent).detail;
    if (detail?.isPlaying) {
      // Playback resumed: ensure scheduler is running
      if (!scheduler.isRunning()) {
        scheduler.start();
        if (import.meta.env.DEV) console.log('[StemReactive] scheduler restarted on playback resume');
      }
    } else {
      // Playback paused: clear energies but DON'T stop scheduler
      // Visual Mixer should continue showing last known state
      stemEnergies = {};
      stemHits = {};
      prevRms = {};
    }
  }
  window.addEventListener('playback-state-changed', onPlaybackState);

  if (import.meta.env.DEV) console.log('[StemReactiveBridge] initialized — detector + writer registered with scheduler');

  // ═══ Cleanup on unmount ═══
  return () => {
    scheduler.unregister('stem-reactive-detector');
    scheduler.unregister('stem-reactive-writer');
    document.removeEventListener('before-track-change', onTrackChange);
    window.removeEventListener('playback-state-changed', onPlaybackState);
    const root = document.documentElement;
    const stemIds = useStemStore.getState().loadedStems;
    for (const id of stemIds) {
      root.style.removeProperty(CSS_ENERGY(id));
      root.style.removeProperty(CSS_HIT(id));
    }
    stemEnergies = {};
    stemHits = {};
    prevRms = {};
  };
}
