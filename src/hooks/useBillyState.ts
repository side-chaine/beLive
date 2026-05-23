import { useMemo } from 'react';
import { useAudioStore } from '../stores/audio.store';
import { useTrackInfoStore } from '../stores/trackInfo.store';
import { useTrackStore } from '../stores/track.store';
import { useLoopStore } from '../stores/loop.store';
import { useRecordingStore } from '../stores/recording.store';

/**
 * Billy animation states.
 * 'jump' is transient — handled locally in BillyDock, not derived from stores.
 */
export type BillyAnimation = 'idle' | 'dance' | 'think' | 'sleep';

export interface BillyState {
  /** Derived animation from app state (priority: think > dance > sleep > idle) */
  animation: BillyAnimation;
  /** Loop is active — visual indicator on Billy */
  isLooping: boolean;
  /** Recording is active — visual indicator on Billy */
  isRecording: boolean;
  /** TrackInfoBoard overlay is open — Billy shows "active" state */
  trackInfoOpen: boolean;
  /** Whether a track is loaded */
  hasTrack: boolean;
}

/**
 * Combined hook for BillyDock state.
 * Subscribes to 5 Zustand stores with single-field selectors.
 * Derives animation with priority: think > dance > sleep > idle.
 *
 * Jump is NOT included — it's a transient click/track-change animation
 * handled locally in BillyDock component.
 */
export function useBillyState(): BillyState {
  const isPlaying = useAudioStore(s => s.isPlaying);
  const isAiStreaming = useTrackInfoStore(s => s.isAiStreaming);
  const hasTrack = useTrackStore(s => !!s.currentTrack);
  const isLooping = useLoopStore(s => s.isLooping);
  const isRecording = useRecordingStore(s => s.isRecording);
  const trackInfoOpen = useTrackInfoStore(s => s.isOpen);

  const animation = useMemo<BillyAnimation>(() => {
    if (isAiStreaming) return 'think';
    if (isPlaying) return 'dance';
    if (!hasTrack) return 'sleep';
    return 'idle';
  }, [isAiStreaming, isPlaying, hasTrack]);

  return { animation, isLooping, isRecording, trackInfoOpen, hasTrack };
}
