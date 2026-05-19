// src/bridges/lyrics.bridge.ts
import { useLyricsStore } from '../stores/lyrics.store';
import { useMarkersStore } from '../stores/markers.store';
import { useTrackStore } from '../stores/track.store';
import {
  getPlaybackVisualScheduler,
  type PlaybackVisualFrameDetector,
  type PlaybackVisualFrameWriter,
} from '../playback';

/**
 * Lyrics Bridge
 *
 * Participates in the shared PlaybackVisualScheduler for playback-time line sync.
 * Scheduler lifecycle (start/stop) is currently owned by trigger bridge.
 */
export function initLyricsBridge(): () => void {
  // TC-10.14: Throttle GUARD logs — log ONCE per track, not every rAF frame
  let _guardLogged = false;
  let _guardLastCount = 0;

  const syncFromLegacy = () => {
    const ld = (window as any).lyricsDisplay;
    const legacyLines: unknown = ld?.lyrics;

    if (Array.isArray(legacyLines) && legacyLines.length > 0) {
      useLyricsStore.setState({ lines: [...legacyLines] });
    }
  };

  const clearStoreForTrackChange = () => {
    useLyricsStore.setState({ lines: [], activeLineIndex: -1 });
  };

  const onActiveLine = (e: Event) => {
    const d = (e as CustomEvent).detail;
    if (d) {
      if (!rafSyncActive) {
        useLyricsStore.setState({ activeLineIndex: d.lineIndex ?? -1 });
      }

      // If active line arrives but lines were not synced yet, sync now.
      if (useLyricsStore.getState().lines.length === 0) {
        syncFromLegacy();
      }
    }
  };

  const onLyricsRendered = () => {
    syncFromLegacy();
  };

  const onTrackLoaded = () => {
    // track-loaded is the real "data is ready" moment. Sync immediately + after a short delay.
    syncFromLegacy();
    setTimeout(syncFromLegacy, 50);
    setTimeout(syncFromLegacy, 250);
  };

  const onModeChanged = () => {
    // Entering Karaoke may not fire lyrics-rendered, so sync on every mode switch.
    syncFromLegacy();
    setTimeout(syncFromLegacy, 50);
  };

  const onBeforeTrackChange = () => {
    clearStoreForTrackChange();
    // TC-10.14: Reset guard throttle on track change
    _guardLogged = false;
    _guardLastCount = 0;
  };

  document.addEventListener('active-line-changed', onActiveLine);
  document.addEventListener('lyrics-rendered', onLyricsRendered);
  document.addEventListener('track-loaded', onTrackLoaded);
  window.addEventListener('mode-changed', onModeChanged);
  document.addEventListener('before-track-change', onBeforeTrackChange);

  // Initial sync (in case React mounts after legacy has already loaded a track)
  syncFromLegacy();
  const retryTimer = setTimeout(syncFromLegacy, 1000);

  // --- Playback visual scheduler integration (line sync) ---
  const scheduler = getPlaybackVisualScheduler();
  let frameActiveLineIndex = -1;
  let lastPublishedLineIndex = -1;
  let rafSyncActive = false;

  // Detector: compute active line from markers
  const detector: PlaybackVisualFrameDetector = {
    id: 'lyrics-line-detector',
    detect(ctx) {
      const t = ctx.currentTime ?? 0;
      const markers = useMarkersStore.getState().markers as any[];
      if (markers.length === 0) {
        frameActiveLineIndex = -1;
        return;
      }
      let bestLine = -1;
      let bestTime = -Infinity;
      let invalidCount = 0;
      const linesCount = useLyricsStore.getState().lines.length;

      for (const m of markers) {
        // Skip M2 markers — they have lineIndex: -1 and should not affect active line
        if (m.markerType === 'M2') continue;
        // Guard: skip markers with out-of-bounds lineIndex
        if (m.lineIndex < 0 || (linesCount > 0 && m.lineIndex >= linesCount)) {
          invalidCount++;
          continue;
        }
        if (m.time <= t && m.time > bestTime) {
          bestTime = m.time;
          bestLine = m.lineIndex;
        }
      }

      // TC-10.14: Throttled guard — log ONCE per track, not every frame
      if (invalidCount > 5 && !_guardLogged) {
        console.error(
          `[GUARD] CRITICAL: ${invalidCount} markers out of bounds. Data migration needed.`
        );
        _guardLogged = true;
        _guardLastCount = invalidCount;
      } else if (invalidCount > 0 && invalidCount !== _guardLastCount && !_guardLogged) {
        console.warn(`[GUARD] Filtered ${invalidCount} invalid marker(s) — skipping in detection`);
        _guardLastCount = invalidCount;
      }

      frameActiveLineIndex = bestLine;
    },
  };

  // Writer: publish line changes to store and legacy
  const writer: PlaybackVisualFrameWriter = {
    id: 'lyrics-line-writer',
    write() {
      if (frameActiveLineIndex < 0) return;
      if (frameActiveLineIndex === lastPublishedLineIndex) return;

      lastPublishedLineIndex = frameActiveLineIndex;
      useLyricsStore.setState({ activeLineIndex: frameActiveLineIndex });

      // Reverse-sync to legacy LD for MM/RBG listeners
      const ld = (window as any).lyricsDisplay;
      if (ld) {
        ld.currentLine = frameActiveLineIndex;
        try {
          document.dispatchEvent(new CustomEvent('active-line-changed', {
            detail: { lineIndex: frameActiveLineIndex, newLineIndex: frameActiveLineIndex }
          }));
        } catch (_) {}
      }
    },
  };

  // Register with scheduler (trigger bridge owns scheduler lifecycle)
  scheduler.registerDetector(detector);
  scheduler.registerWriter(writer);

  // Playback state listener for internal gating only (not rAF loop)
  function onPlaybackState(e: Event) {
    const d = (e as CustomEvent).detail;
    rafSyncActive = d?.isPlaying ?? false;
    if (!rafSyncActive) {
      frameActiveLineIndex = -1;
      lastPublishedLineIndex = -1;
    }
  }

  window.addEventListener('playback-state-changed', onPlaybackState);

  return () => {
    document.removeEventListener('active-line-changed', onActiveLine);
    document.removeEventListener('lyrics-rendered', onLyricsRendered);
    document.removeEventListener('track-loaded', onTrackLoaded);
    window.removeEventListener('mode-changed', onModeChanged);
    document.removeEventListener('before-track-change', onBeforeTrackChange);
    clearTimeout(retryTimer);
    scheduler.unregister('lyrics-line-detector');
    scheduler.unregister('lyrics-line-writer');
    window.removeEventListener('playback-state-changed', onPlaybackState);
  };
}
