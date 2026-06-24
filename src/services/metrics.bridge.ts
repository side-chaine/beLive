// @TC-MET-02: Metrics Bridge — event subscriber, writes to metrics.store
// NO frozen zones touched. NO dispatchEvent. Subscriber-only.

import { useMetricsStore } from '../stores/metrics.store';
import { useExerciseStore } from '../exercises/exercise.store';
import { aggregateGenres } from './genre-aggregation.service';
import { backfillMissingMeta } from './metadata-backfill.service';
import { useTrackStore } from '../stores/track.store';

let _cleanup: (() => void) | null = null;

/**
 * Init metrics bridge — subscribe to events and external store changes.
 * Call once on app boot (from App.tsx useEffect).
 * Returns cleanup function for unmount.
 */
export function initMetricsBridge(): () => void {
  if (_cleanup) {
    if (import.meta.env.DEV) console.warn('[metrics] bridge already initialized — skip');
    return _cleanup;
  }

  const store = useMetricsStore;

  // ─── 1. track-fully-loaded → rehearsals ───
  const onTrackLoaded = () => {
    store.getState().incrementRehearsal();
  };
  document.addEventListener('track-fully-loaded', onTrackLoaded);

  // ─── 2. before-track-change → stop play time timer ───
  let sessionStart: number | null = null;
  let _isTiming = false;

  const onTrackStart = () => {
    if (_isTiming) return;
    sessionStart = Date.now();
    _isTiming = true;
  };

  const onTrackStop = () => {
    if (!_isTiming || sessionStart === null) return;
    const elapsed = Date.now() - sessionStart;
    store.getState().addPlayTimeMs(elapsed);
    sessionStart = null;
    _isTiming = false;
  };

  document.addEventListener('track-fully-loaded', onTrackStart);
  document.addEventListener('before-track-change', onTrackStop);

  // ─── 3. practice:completed + practice:completed-kept → practiceSessions ───
  const onPracticeCompleted = () => {
    store.getState().incrementPractice();
  };
  document.addEventListener('practice:completed', onPracticeCompleted);
  document.addEventListener('practice:completed-kept', onPracticeCompleted);

  // ─── 4. exercise.store → exercisesCompleted (external subscription) ───
  let prevExercises = 0;
  const unsubExercise = useExerciseStore.subscribe((state) => {
    const current = state.sessionProgress?.exercisesCompleted ?? 0;
    if (current > prevExercises) {
      store.getState().setExercisesCompleted(current);
    }
    prevExercises = current;
  });

  // ─── 5. Genre aggregation + backfill on tracks change ───
  const onTracksChanged = () => {
    // Immediate: aggregate from cache (if metadata already in IDB)
    aggregateGenres().then((genres) => {
      store.getState().recomputeGenres(genres);
    });

    // Background: backfill missing metadata, then re-aggregate
    const tracks = useTrackStore.getState().tracksMeta;
    if (tracks.length > 0) {
      backfillMissingMeta(tracks).then(() => {
        aggregateGenres().then((genres) => {
          store.getState().recomputeGenres(genres);
        });
      });
    }
  };
  document.addEventListener('tracks-changed', onTracksChanged);

  // Boot aggregation: subscribe to track.store, fire when tracksMeta is populated.
  // Resolves boot race: track.bridge.syncAll is async, so sync call sees empty store.
  let _didInitAggregate = false;
  const unsubTracks = useTrackStore.subscribe((state) => {
    if (state.tracksMeta.length > 0 && !_didInitAggregate) {
      _didInitAggregate = true;
      onTracksChanged();
    }
  });

  // ─── Cleanup ───
  _cleanup = () => {
    document.removeEventListener('track-fully-loaded', onTrackLoaded);
    document.removeEventListener('track-fully-loaded', onTrackStart);
    document.removeEventListener('before-track-change', onTrackStop);
    document.removeEventListener('practice:completed', onPracticeCompleted);
    document.removeEventListener('practice:completed-kept', onPracticeCompleted);
    document.removeEventListener('tracks-changed', onTracksChanged);
    unsubExercise();
    unsubTracks();
    _cleanup = null;
  };

  return _cleanup;
}
