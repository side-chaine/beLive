import { TriggerEngine } from './trigger.engine';
import { WordLineDetector } from './detectors/word-line.detector';
import { useTriggerStore } from './trigger.store';
import {
  queueCssVar,
  clearQueuedCssVars,
} from '../runtime/visual/css-var-batch';
import {
  getPlaybackVisualScheduler,
  type PlaybackVisualFrameReader,
  type PlaybackVisualFrameDetector,
  type PlaybackVisualFrameWriter,
} from '../playback';


const CSS_WORD_ACTIVE = '--bl-word-active';
const CSS_WORD_PROGRESS = '--bl-word-progress';
const CSS_LINE_ACTIVE = '--bl-line-active';

const PROGRESS_STEP = 0.03;

/**
 * Trigger Bridge
 *
 * Currently owns the PlaybackVisualScheduler playback lifecycle (start/stop).
 * Other visual hot-path participants may register with the scheduler,
 * but do not own start/stop until a unified orchestration layer is introduced.
 */
export function initTriggerBridge(): () => void {
  const engine = new TriggerEngine();
  engine.addDetector(new WordLineDetector());

  const scheduler = getPlaybackVisualScheduler();

  let lastStoreLineIndex = -1;
  let lastStoreProgress = 0;
  let frameEvents: ReturnType<TriggerEngine['tick']> = [];

  // Reader: gather playback state into frame context
  const reader: PlaybackVisualFrameReader = {
    id: 'trigger-reader',
    read(ctx) {
      const ae = (window as any).audioEngine;
      if (ae && ae.getCurrentTime) {
        ctx.currentTime = ae.getCurrentTime();
        ctx.isPlaying = ae.isPlaying ?? false;
      }
    },
  };

  // Detector: run trigger engine to detect word/line events
  const detector: PlaybackVisualFrameDetector = {
    id: 'trigger-detector',
    detect(ctx) {
      if (ctx.currentTime !== undefined) {
        frameEvents = engine.tick(ctx.currentTime);
      } else {
        frameEvents = [];
      }
    },
  };

  // Writer: publish CSS vars and store updates
  const writer: PlaybackVisualFrameWriter = {
    id: 'trigger-writer',
    write() {
      // --- CSS variable injection ---
      let wordActive = 0;
      let wordProgress = 0;
      let lineActive = 0;

      for (const e of frameEvents) {
        if (e.id === 'word-active') wordActive = 1;
        if (e.id === 'word-progress') wordProgress = e.value;
        if (e.id === 'line-active') lineActive = 1;
      }

      // Queue CSS vars for batch write (scheduler will flush)
      queueCssVar(CSS_WORD_ACTIVE, String(wordActive));
      queueCssVar(CSS_WORD_PROGRESS, wordProgress.toFixed(3));
      queueCssVar(CSS_LINE_ACTIVE, String(lineActive));

      // --- Store snapshot (throttled, not 60Hz) ---
      let needsUpdate = false;
      const patch: Record<string, any> = {};

      for (const e of frameEvents) {
        if (e.id === 'word-start') {
          patch.activeWordId = e.metadata.wordId ?? null;
          patch.activeWordText = e.metadata.wordText ?? null;
          patch.activeWordConfidence = e.metadata.confidence ?? 0;
          needsUpdate = true;
        }
        // word-end: do NOT clear store — keep last word highlighted through gaps.
        // word-start will overwrite. line-end/track-change will clear.
        // Note: activeWordProgress removed from store — now CSS-var driven only
        // Progress tracking for throttling only, no store write
        if (e.id === 'word-progress' && Math.abs(e.value - lastStoreProgress) >= PROGRESS_STEP) {
          lastStoreProgress = e.value;
          // Store update removed — progress now CSS-var driven only
        }
        if (e.id === 'line-start') {
          patch.triggerLineIndex = e.metadata.lineIndex ?? -1;
          lastStoreLineIndex = e.metadata.lineIndex ?? -1;
          needsUpdate = true;
        }
        if (e.id === 'line-end' && e.metadata.lineIndex === lastStoreLineIndex) {
          patch.triggerLineIndex = -1;
          lastStoreLineIndex = -1;
          needsUpdate = true;
        }
      }

      if (needsUpdate) {
        useTriggerStore.setState(patch);
      }
    },
  };

  // Register with scheduler once
  scheduler.registerReader(reader);
  scheduler.registerDetector(detector);
  scheduler.registerWriter(writer);

  function startLoop() {
    if (scheduler.isRunning()) return;
    useTriggerStore.setState({ isActive: true });
    scheduler.start();
  }

  function stopLoop() {
    scheduler.stop();
    // Clear any pending batched vars before reset
    clearQueuedCssVars();
    // Reset CSS vars directly (cleanup path, no batching needed)
    const root = document.documentElement;
    root.style.setProperty(CSS_WORD_ACTIVE, '0');
    root.style.setProperty(CSS_WORD_PROGRESS, '0');
    root.style.setProperty(CSS_LINE_ACTIVE, '0');
    useTriggerStore.setState({ isActive: false });
  }

  function onPlaybackState(e: Event) {
    const detail = (e as CustomEvent).detail;
    if (detail?.isPlaying) {
      startLoop();
    } else {
      stopLoop();
    }
  }

  function onTrackChange() {
    // Note: Do NOT stop scheduler here — lifecycle is owned by playback-state-changed
    // Reset engine and visual state for track switch
    engine.resetAll();
    lastStoreLineIndex = -1;
    lastStoreProgress = 0;
    // Clear CSS vars for visual hygiene during track switch
    const root = document.documentElement;
    root.style.setProperty(CSS_WORD_ACTIVE, '0');
    root.style.setProperty(CSS_WORD_PROGRESS, '0');
    root.style.setProperty(CSS_LINE_ACTIVE, '0');
    // Clear pending batched vars
    clearQueuedCssVars();
    useTriggerStore.setState({
      activeWordId: null,
      activeWordText: null,
      activeWordConfidence: 0,
      triggerLineIndex: -1,
      isActive: false,
    });
  }

  function onKey(e: KeyboardEvent) {
    if (e.ctrlKey && e.shiftKey && e.key === 'T') {
      e.preventDefault();
      useTriggerStore.getState().toggleDebug();
    }
  }

  window.addEventListener('playback-state-changed', onPlaybackState);
  document.addEventListener('before-track-change', onTrackChange);
  window.addEventListener('keydown', onKey);

  console.log('[TriggerBridge] initialized');

  return () => {
    stopLoop();
    // Unregister from scheduler
    scheduler.unregister('trigger-reader');
    scheduler.unregister('trigger-detector');
    scheduler.unregister('trigger-writer');
    engine.dispose();
    window.removeEventListener('playback-state-changed', onPlaybackState);
    document.removeEventListener('before-track-change', onTrackChange);
    window.removeEventListener('keydown', onKey);
    const root = document.documentElement;
    root.style.removeProperty(CSS_WORD_ACTIVE);
    root.style.removeProperty(CSS_WORD_PROGRESS);
    root.style.removeProperty(CSS_LINE_ACTIVE);
    console.log('[TriggerBridge] disposed');
  };
}
