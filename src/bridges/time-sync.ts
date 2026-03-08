import { useAudioStore } from '../stores/audio.store';

/**
 * Time Sync Bridge — polls audioEngine.getCurrentTime() at ~10Hz
 * and updates audio.store.currentTime during playback.
 *
 * Why needed: audio.bridge only updates currentTime on events
 * (play/pause/seek), not continuously. TransportBar and other
 * components need smooth time updates for progress display.
 *
 * 10Hz = imperceptible for progress bar, negligible CPU cost.
 * WaveformCanvas playhead uses its own rAF (60fps) for smoothness.
 */
export function initTimeSync(): () => void {
  const id = setInterval(() => {
    const { isPlaying } = useAudioStore.getState();
    if (!isPlaying) return;

    const ae = (window as any).audioEngine;
    if (!ae?.getCurrentTime) return;

    const t = ae.getCurrentTime();
    if (typeof t === 'number' && t >= 0) {
      useAudioStore.setState({ currentTime: t });
    }
  }, 100);

  return () => {
    clearInterval(id);
  };
}
