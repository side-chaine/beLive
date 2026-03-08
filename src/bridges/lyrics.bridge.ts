// src/bridges/lyrics.bridge.ts
import { useLyricsStore } from '../stores/lyrics.store';
import { useMarkersStore } from '../stores/markers.store';

export function initLyricsBridge(): () => void {
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
  };

  document.addEventListener('active-line-changed', onActiveLine);
  document.addEventListener('lyrics-rendered', onLyricsRendered);
  document.addEventListener('track-loaded', onTrackLoaded);
  document.addEventListener('mode-changed', onModeChanged);
  document.addEventListener('before-track-change', onBeforeTrackChange);

  // Initial sync (in case React mounts after legacy has already loaded a track)
  syncFromLegacy();
  const retryTimer = setTimeout(syncFromLegacy, 1000);

  // --- rAF playback sync (bypasses legacy DOM rebuild delay) ---
  let syncRafId: number | null = null;
  let rafSyncActive = false;

  function startSync() {
    if (syncRafId !== null) return;
    rafSyncActive = true;
    function tick() {
      const ae = (window as any).audioEngine;
      const t = ae?.getCurrentTime?.() ?? 0;
      const markers = useMarkersStore.getState().markers as any[];
      if (markers.length === 0) {
        syncRafId = requestAnimationFrame(tick);
        return;
      }
      let bestLine = -1;
      let bestTime = -Infinity;
      for (const m of markers) {
        if (m.time <= t && m.time > bestTime) {
          bestTime = m.time;
          bestLine = m.lineIndex;
        }
      }
      if (bestLine >= 0) {
        const current = useLyricsStore.getState().activeLineIndex;
        if (current !== bestLine) {
          useLyricsStore.setState({ activeLineIndex: bestLine });
          // Reverse-sync to legacy LD for MM/RBG listeners
          const ld = (window as any).lyricsDisplay;
          if (ld) {
            ld.currentLine = bestLine;
            try {
              document.dispatchEvent(new CustomEvent('active-line-changed', {
                detail: { lineIndex: bestLine, newLineIndex: bestLine }
              }));
            } catch (_) {}
          }
        }
      }
      syncRafId = requestAnimationFrame(tick);
    }
    syncRafId = requestAnimationFrame(tick);
  }

  function stopSync() {
    rafSyncActive = false;
    if (syncRafId !== null) {
      cancelAnimationFrame(syncRafId);
      syncRafId = null;
    }
  }

  window.addEventListener('playback-state-changed', (e: Event) => {
    const d = (e as CustomEvent).detail;
    if (d?.isPlaying) {
      startSync();
    } else {
      stopSync();
    }
  });

  return () => {
    document.removeEventListener('active-line-changed', onActiveLine);
    document.removeEventListener('lyrics-rendered', onLyricsRendered);
    document.removeEventListener('track-loaded', onTrackLoaded);
    document.removeEventListener('mode-changed', onModeChanged);
    document.removeEventListener('before-track-change', onBeforeTrackChange);
    clearTimeout(retryTimer);
    stopSync();
  };
}
