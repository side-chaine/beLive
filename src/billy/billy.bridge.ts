import {
  queueCssVar,
  clearQueuedCssVars,
} from '../runtime/visual/css-var-batch';
import {
  getPlaybackVisualScheduler,
  type PlaybackVisualFrameWriter,
} from '../playback';
import { getBillyHotState, resetBillyState } from './billy-runtime';
import { useBillyRuntimeStore } from './billy-runtime.store';

// ═══ Billy Bridge ═══
// Публикует CSS vars позиции Billy для остального приложения.
// Участвует в PlaybackVisualScheduler как writer.
// INV-BILLY-BRIDGE: Bridge маршрутизирует и публикует. Не владеет.
// INV-BILLY-NO-CGS: Читаем из singleton, не из DOM

// ── CSS Vars ──
const CSS_VAR_POS_X = '--bl-billy-pos-x';
const CSS_VAR_POS_Y = '--bl-billy-pos-y';
const CSS_VAR_Z = '--bl-billy-z';

// ── Z-index по зоне ──
const Z_INDEX_BY_ZONE: Record<string, number> = {
  corner: 999996,
  ground: 100,
  plaque: 110,
  rope: 90,
};

// ── Writer для PlaybackVisualScheduler ──
const BILLY_WRITER_ID = 'billy-position-writer';

const writer: PlaybackVisualFrameWriter = {
  id: BILLY_WRITER_ID,
  write() {
    const hot = getBillyHotState();
    const store = useBillyRuntimeStore.getState();

    // Normalized position (0..1) — для CSS calc consumers
    queueCssVar(CSS_VAR_POS_X, String(hot.posX));
    queueCssVar(CSS_VAR_POS_Y, String(hot.posY));

    // Z-index по зоне
    const z = Z_INDEX_BY_ZONE[store.zone] ?? 999996;
    queueCssVar(CSS_VAR_Z, String(z));
  },
};

// ── Event handlers ──
function handleTrackChange(): void {
  resetBillyState();
  useBillyRuntimeStore.getState().setMode('sleep');
  // Force publish after reset
  writer.write();
}

// ── Lifecycle ──
export function initBillyBridge(): () => void {
  const scheduler = getPlaybackVisualScheduler();

  // 1. Register writer with scheduler
  scheduler.registerWriter(writer);

  // 2. Subscribe to track change
  document.addEventListener('before-track-change', handleTrackChange);

  // 3. Start scheduler if not already running
  if (!scheduler.isRunning()) {
    scheduler.start();
  }

  // 4. Initial publication
  writer.write();

  console.log('[BillyBridge] initialized — writer registered');

  // 5. Return dispose function
  return () => {
    scheduler.unregister(BILLY_WRITER_ID);
    document.removeEventListener('before-track-change', handleTrackChange);
    // Clean CSS vars
    const root = document.documentElement;
    root.style.removeProperty(CSS_VAR_POS_X);
    root.style.removeProperty(CSS_VAR_POS_Y);
    root.style.removeProperty(CSS_VAR_Z);
    clearQueuedCssVars();
    console.log('[BillyBridge] disposed');
  };
}
