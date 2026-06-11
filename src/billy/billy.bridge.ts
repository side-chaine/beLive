import {
  queueCssVar,
  clearQueuedCssVars,
} from '../runtime/visual/css-var-batch';
import {
  getPlaybackVisualScheduler,
  type PlaybackVisualFrameWriter,
} from '../playback';
import { getBillyHotState, resetBillyState, invalidateLineCache } from './billy-runtime';
import { useBillyRuntimeStore } from './billy-runtime.store';

// ═══ Billy Bridge ═══
// Публикует CSS vars позиции Billy для остального приложения.
// Участвует в PlaybackVisualScheduler как writer.
// INV-BILLY-BRIDGE: Bridge маршрутизирует и публикует. Не владеет.
// INV-BILLY-NO-CGS: Читаем из singleton, не из DOM

// ── CSS Vars ──
const CSS_VAR_POS_X = '--bl-billy-pos-x';
const CSS_VAR_POS_Y = '--bl-billy-pos-y';

// ── Writer для PlaybackVisualScheduler ──
const BILLY_WRITER_ID = 'billy-position-writer';

const writer: PlaybackVisualFrameWriter = {
  id: BILLY_WRITER_ID,
  write() {
    const hot = getBillyHotState();

    // Normalized position (0..1) — для CSS calc consumers
    queueCssVar(CSS_VAR_POS_X, String(hot.posX));
    queueCssVar(CSS_VAR_POS_Y, String(hot.posY));
  },
};

// ── Event handlers ──
function handleTrackChange(): void {
  resetBillyState();
  invalidateLineCache();
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

  if (import.meta.env.DEV) console.log('[BillyBridge] initialized — writer registered');

  // 5. Return dispose function
  return () => {
    scheduler.unregister(BILLY_WRITER_ID);
    document.removeEventListener('before-track-change', handleTrackChange);
    // Clean CSS vars
    const root = document.documentElement;
    root.style.removeProperty(CSS_VAR_POS_X);
    root.style.removeProperty(CSS_VAR_POS_Y);
    clearQueuedCssVars();
    if (import.meta.env.DEV) console.log('[BillyBridge] disposed');
  };
}
