import { useTakesStore } from './takes.store';

/**
 * Takes bridge — session lifecycle management.
 * 
 * Responsibilities:
 * - Clear all takes when track changes
 * - Clear all takes on mode change (optional safety)
 * - Publish takes recording state for performance bridge
 */
export function initTakesBridge(): () => void {
  // Clean up takes when track changes
  const handleTrackChange = () => {
    useTakesStore.getState().cleanup();
  };
  document.addEventListener('before-track-change', handleTrackChange);

  // Stop take preview when engine transport stops/pauses
  const handlePlaybackChange = (e: Event) => {
    const detail = (e as CustomEvent)?.detail;
    if (detail && !detail.isPlaying) {
      // Engine stopped/paused — stop any active take preview
      // __stopPreviewFn is attached to store object, not state
      if ((useTakesStore as any).__stopPreviewFn) {
        (useTakesStore as any).__stopPreviewFn();
      }
    }
  };
  window.addEventListener('playback-state-changed', handlePlaybackChange);

  // Publish takes recording state to DOM for CSS consumption
  const unsubRecording = useTakesStore.subscribe(
    (state) => state.isRecording,
    (isRecording) => {
      if (isRecording) {
        document.documentElement.setAttribute('data-takes-recording', 'true');
      } else {
        document.documentElement.removeAttribute('data-takes-recording');
      }
    },
  );

  // Return cleanup function
  return () => {
    document.removeEventListener('before-track-change', handleTrackChange);
    window.removeEventListener('playback-state-changed', handlePlaybackChange);
    unsubRecording();
  };
}
