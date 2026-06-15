import { useMonitorStore } from '../stores/monitor.store';
import {
  monitorGetState,
  monitorPersist,
  monitorSetMusicLevel,
  monitorSetAutoVerse,
  monitorSetAutoVerseLevel,
  monitorSetAutoChorus,
  monitorSetAutoChorusLevel,
  monitorSetAutoBridge,
  monitorSetAutoBridgeLevel,
  monitorSetAutoIntro,
  monitorSetAutoIntroLevel,
  monitorSetAutoPreChorus,
  monitorSetAutoPreChorusLevel,
  monitorSetAutoOutro,
  monitorSetAutoOutroLevel,
  monitorSetDelayMs,
  monitorSetHallVolume,
  monitorSetMonitorVolume,
} from '../services/monitor.state';

/* -------- types -------- */
interface LegacyMonitorState {
  enabled: boolean;
  delayMs: number;
  includeMusic: boolean;
  musicLevel: number;
  outputDeviceId: string;
  mainDeviceId: string;
  routeMainEnabled: boolean;
  compensateOn: 'monitor' | 'main';
  vocalToMain: boolean;
  vocalHallLevel: number;
  autoVerseOn?: boolean;
  autoVerseLevel?: number;
  autoChorusOn?: boolean;
  autoChorusLevel?: number;
  autoBridgeOn?: boolean;
  autoBridgeLevel?: number;
  autoIntroOn?: boolean;
  autoIntroLevel?: number;
  autoPreChorusOn?: boolean;
  autoPreChorusLevel?: number;
  autoOutroOn?: boolean;
  autoOutroLevel?: number;
}

/* -------- helpers -------- */
const getMix = (): any =>
  (window as any).app?.monitorMix ?? (window as any).monitorMix;

/** Map legacy getState() → store-compatible partial */
const mapLegacyState = (s: LegacyMonitorState) => ({
  enabled:          !!s.enabled,
  delayMs:          s.delayMs ?? 120,
  includeMusic:     !!s.includeMusic,
  musicLevel:       s.musicLevel ?? 0.15,
  outputDeviceId:   s.outputDeviceId ?? '',
  mainDeviceId:     s.mainDeviceId ?? '',
  routeMainEnabled: !!s.routeMainEnabled,
  compensateOn:     (s.compensateOn === 'main' ? 'main' : 'monitor') as const,
  vocalToMain:      !!s.vocalToMain,
  vocalHallLevel:   s.vocalHallLevel ?? 0.2,
  autoVerseOn:      !!s.autoVerseOn,
  autoVerseLevel:   s.autoVerseLevel ?? 0.3,
  autoChorusOn:     !!s.autoChorusOn,
  autoChorusLevel:  s.autoChorusLevel ?? 0.3,
  autoBridgeOn:     !!s.autoBridgeOn,
  autoBridgeLevel:  s.autoBridgeLevel ?? 0.3,
  autoIntroOn:      !!s.autoIntroOn,
  autoIntroLevel:   s.autoIntroLevel ?? 0.3,
  autoPreChorusOn:  !!s.autoPreChorusOn,
  autoPreChorusLevel: s.autoPreChorusLevel ?? 0.3,
  autoOutroOn:      !!s.autoOutroOn,
  autoOutroLevel:   s.autoOutroLevel ?? 0.3,
});

/* -------- hydrate -------- */
let hydrated = false;

function tryHydrate() {
  if (hydrated) return;
  const mix = getMix();
  if (!mix?.getState) return;

  // F60: Read ORIGINAL engine state BEFORE patch-in-place
  // This ensures we capture full 6-block truth from engine's native getState()
  const originalState = mix.getState();

  // Patch-in-place exact micro-port for getState + _persist + all AutoMix setters
  mix.getState = monitorGetState;
  mix._persist = monitorPersist;
  mix.setMusicLevel = monitorSetMusicLevel;
  mix.setAutoVerse = monitorSetAutoVerse;
  mix.setAutoVerseLevel = monitorSetAutoVerseLevel;
  mix.setAutoChorus = monitorSetAutoChorus;
  mix.setAutoChorusLevel = monitorSetAutoChorusLevel;
  mix.setAutoBridge = monitorSetAutoBridge;
  mix.setAutoBridgeLevel = monitorSetAutoBridgeLevel;
  mix.setAutoIntro = monitorSetAutoIntro;
  mix.setAutoIntroLevel = monitorSetAutoIntroLevel;
  mix.setAutoPreChorus = monitorSetAutoPreChorus;
  mix.setAutoPreChorusLevel = monitorSetAutoPreChorusLevel;
  mix.setAutoOutro = monitorSetAutoOutro;
  mix.setAutoOutroLevel = monitorSetAutoOutroLevel;
  mix.setDelayMs = monitorSetDelayMs;
  mix.setHallVolume = monitorSetHallVolume;
  mix.setMonitorVolume = monitorSetMonitorVolume;

  // Use ORIGINAL state for hydration, not patched state
  useMonitorStore.getState().syncFromLegacy(mapLegacyState(originalState));
  hydrated = true;
}

/* -------- event handlers -------- */
function onStateChanged(e: Event) {
  const detail = (e as CustomEvent).detail;
  if (detail) {
    useMonitorStore.getState().syncFromLegacy(mapLegacyState(detail));
  } else {
    // fallback: re-read from engine
    const mix = getMix();
    if (mix?.getState) {
      useMonitorStore.getState().syncFromLegacy(mapLegacyState(mix.getState()));
    }
  }
}

function onDeviceChange() {
  // Only refresh if panel is open (avoid unnecessary permission prompts)
  if (useMonitorStore.getState().open) {
    useMonitorStore.getState().refreshDevices();
  }
}

/* -------- init -------- */
export function initMonitorBridge() {
  // Hydrate: retry until monitorMix is available (legacy loads async)
  const maxAttempts = 30;
  let attempts = 0;
  const interval = setInterval(() => {
    attempts++;
    tryHydrate();
    if (hydrated || attempts >= maxAttempts) {
      clearInterval(interval);
      if (!hydrated) {
        console.warn('[monitor.bridge] monitorMix not found after', maxAttempts, 'attempts');
      }
    }
  }, 200);

  // Events from legacy engine (DOCUMENT, not WINDOW)
  document.addEventListener('monitor-state-changed', onStateChanged);
  document.addEventListener('monitor-route-changed', onStateChanged);

  // Device hot-plug (BT connect/disconnect)
  if (navigator.mediaDevices?.addEventListener) {
    navigator.mediaDevices.addEventListener('devicechange', onDeviceChange);
  }
}

/* -------- cleanup (for HMR) -------- */
export function destroyMonitorBridge() {
  document.removeEventListener('monitor-state-changed', onStateChanged);
  document.removeEventListener('monitor-route-changed', onStateChanged);
  if (navigator.mediaDevices?.removeEventListener) {
    navigator.mediaDevices.removeEventListener('devicechange', onDeviceChange);
  }
}
