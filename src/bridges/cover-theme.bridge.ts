import { useModeStore } from '../stores/mode.store';
import { useTrackStore } from '../stores/track.store';
import { applyCoverTheme } from '../services/cover-theme-applicator';
import '../styles/cover-theme.css';

// TC-COVER-02: Simplified bridge — no duplicate IDB read
// currentCoverTheme is now set by track.bridge.syncAll()
export function initCoverThemeBridge(): () => void {
  // Store subscription: applies theme when currentCoverTheme changes
  // Now currentCoverTheme is set in track.bridge.syncAll()
  const unsub = useTrackStore.subscribe((state, prevState) => {
    if (state.currentCoverTheme !== prevState.currentCoverTheme) {
      if (useModeStore.getState().mode === 'rehearsal') {
        applyCoverTheme(state.currentCoverTheme);
      }
    }
  });

  // Catalog cleared: reset theme
  const onCatalogCleared = () => {
    useTrackStore.getState().setCurrentCoverTheme(null);
  };
  document.addEventListener('catalog-cleared', onCatalogCleared);

  // Fallback: if track-loaded didn't fire (critical error)
  const onLoadFailed = () => {
    useTrackStore.getState().setCurrentCoverTheme(null);
  };
  document.addEventListener('track-load-failed', onLoadFailed);

  // At boot, currentCoverTheme is null because syncAll hasn't completed.
  // The store subscription above will apply the theme when syncAll finishes.
  const { currentCoverTheme } = useTrackStore.getState();
  if (currentCoverTheme && useModeStore.getState().mode === 'rehearsal') {
    applyCoverTheme(currentCoverTheme);
  }

  return () => {
    unsub();
    document.removeEventListener('catalog-cleared', onCatalogCleared);
    document.removeEventListener('track-load-failed', onLoadFailed);
  };
}
