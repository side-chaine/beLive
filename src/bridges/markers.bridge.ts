import { useMarkersStore } from '../stores/markers.store';
import { useLyricsStore } from '../stores/lyrics.store';

/**
 * Markers Bridge — syncs legacy markerManager → React markers.store
 *
 * Two sync mechanisms:
 * 1) DOM events (track-loaded, sections-updated) — bulk sync on track load
 * 2) markerManager.subscribe() — real-time sync on individual marker ops
 *    (markerAdded, markerUpdated, markerDeleted, markersReset)
 *
 * This enables key "1" marker placement to instantly show in React.
 */
export function initMarkersBridge(): () => void {
  let mmSubscribed = false;
  let pollId: ReturnType<typeof setInterval> | null = null;

  // Sync function: copy markers from legacy to React store
  const syncMarkers = () => {
    const mm = (window as any).markerManager;
    if (mm?.markers) {
      // Guard: filter markers with out-of-bounds lineIndex
      // Only filter when lines are loaded (linesCount > 0) to avoid
      // deleting all markers on early sync before lyrics are hydrated
      const linesCount = useLyricsStore.getState().lines.length;
      let validMarkers = mm.markers;
      if (linesCount > 0) {
        const before = mm.markers.length;
        validMarkers = mm.markers.filter((m: any) =>
          m.markerType === 'M2' || (m.lineIndex >= 0 && m.lineIndex < linesCount)
        );
        const filtered = before - validMarkers.length;
        if (filtered > 5) {
          console.error(
            `[GUARD] CRITICAL: ${filtered} invalid markers filtered during mirror. Data migration needed.`
          );
        } else if (filtered > 0) {
          console.warn(`[GUARD] Filtered ${filtered} invalid marker(s) during mirror.`);
        }
      }

      useMarkersStore.setState({
        markers: validMarkers,
        sections: mm.sections ? [...mm.sections] : [],
        trackDuration: mm.trackDuration || 0,
      });
    }
  };

  // --- 1) DOM event listeners (bulk sync) ---

  const onSectionsUpdated = () => syncMarkers();

  const onTrackLoaded = () => {
    setTimeout(syncMarkers, 500);
  };

  document.addEventListener('sections-updated', onSectionsUpdated);
  document.addEventListener('track-loaded', onTrackLoaded);

  // --- 2) markerManager.subscribe (real-time sync) ---

  const subscribeToMM = (): boolean => {
    const mm = (window as any).markerManager;
    if (!mm?.subscribe || mmSubscribed) return mmSubscribed;

    mm.subscribe('markerAdded', () => {
      syncMarkers();
    });

    mm.subscribe('markerUpdated', () => {
      syncMarkers();
    });

    mm.subscribe('markerDeleted', () => {
      syncMarkers();
    });

    mm.subscribe('markersReset', () => {
      syncMarkers();
    });

    mmSubscribed = true;
    return true;
  };

  // Try immediately, poll if markerManager not ready yet
  if (!subscribeToMM()) {
    pollId = setInterval(() => {
      if (subscribeToMM() && pollId) {
        clearInterval(pollId);
        pollId = null;
      }
    }, 200);
  }

  // --- Cleanup ---

  return () => {
    document.removeEventListener('sections-updated', onSectionsUpdated);
    document.removeEventListener('track-loaded', onTrackLoaded);
    if (pollId) clearInterval(pollId);
    // Note: markerManager.subscribe has no unsubscribe — acceptable
    // since bridge lives for entire app lifetime
  };
}
