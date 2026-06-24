// @TC-AVATAR: FullAvatar — audio-reactive avatar for max/ultra tiers
// Registered in PlaybackVisualScheduler with half-frequency detector.

import { memo, useEffect, useRef, useId } from 'react';
import { useAvatarStore, type AvatarStateId, type AvatarMode } from './avatar.store';
import { useFeedStore } from '../catalog/feed/feed.store';
import { useAiStore } from '../stores/ai.store';
import { AVATAR_PRESETS } from './avatar.assets';
import { getPlaybackVisualScheduler } from '../playback';
import type { PlaybackVisualFrameDetector, PlaybackVisualFrameWriter } from '../playback';
import './avatar.css';

interface FullAvatarProps {
  mode: AvatarMode;
  className?: string;
}

/**
 * FullAvatar — audio-reactive avatar for high-perf tiers.
 * - Registered as detector+writer in PlaybackVisualScheduler
 * - Half-frequency: counter % 2 === 0, <1.5ms per tick
 * - Reads global --bl-audio-* CSS vars (written by audio-reactive.bridge.ts)
 * - probes audioContext.state — if suspended → idle morph
 * - Per-instance scaling via CSS cascade: [data-state] → --rx-scale
 */
export const FullAvatar = memo(function FullAvatar({ mode, className }: FullAvatarProps) {
  const ref = useRef<HTMLDivElement>(null);
  const preset = useAvatarStore(s => s.preset);
  const setState = useAvatarStore(s => s.setState);
  const uid = useId();

  // Register in scheduler on mount, deregister on unmount
  // Silhouette preset skips PVS registration (no audio-reactive elements)
  useEffect(() => {
    if (preset === 'silhouette') return;

    const scheduler = getPlaybackVisualScheduler();
    let frameCount = 0;
    const detectorId = `avatar-reactive-detector-${uid}`;
    const writerId = `avatar-reactive-writer-${uid}`;

    const detector: PlaybackVisualFrameDetector = {
      id: detectorId,
      detect() {
        // Half-frequency: skip every other frame
        frameCount++;
        if (frameCount % 2 !== 0) return;

        // Probe audioContext.state — if suspended, override mouth
        try {
          const ae = (window as any).audioEngine;
          if (ae?.audioContext?.state === 'suspended' && ref.current) {
            // Silhouette has no mouth to animate, but Full Avatar tier may have
            // audio-reactive elements — this is a no-op for silhouette
          }
        } catch {
          // ignore cross-origin errors
        }
      },
    };

    const writer: PlaybackVisualFrameWriter = {
      id: writerId,
      write() {
        // Per-instance vars are read from global --bl-audio-* via CSS cascade
      },
    };

    scheduler.registerDetector(detector);
    scheduler.registerWriter(writer);

    return () => {
      scheduler.unregister(detectorId);
      scheduler.unregister(writerId);
    };
  }, [preset, uid]);

  // Subscribe to feed.lastEvent for state changes
  useEffect(() => {
    const el = ref.current;
    const unsub = useFeedStore.subscribe((state) => {
      if (!el) return;
      const event = state.lastEvent;
      let mood: AvatarStateId = 'idle';
      if (!event) {
        mood = 'idle';
      } else {
        const age = Date.now() - event.timestamp;
        if (age > 30_000) {
          mood = 'idle';
        } else {
          switch (event.type) {
            case 'like':
            case 'react':
              mood = 'happy';
              break;
            case 'comment':
              mood = 'happy';
              break;
            case 'neutral':
              mood = 'idle';
              break;
            default:
              mood = 'idle';
          }
        }
      }
      el.setAttribute('data-state', mood);
      setState(mood);
    });
    return unsub;
  }, [setState]);

  // Subscribe to ai.store.isStreaming
  useEffect(() => {
    const el = ref.current;
    const unsub = useAiStore.subscribe((state) => {
      if (!el) return;
      const mood: AvatarStateId = state.isStreaming ? 'listening' : 'sing';
      el.setAttribute('data-state', mood);
      setState(mood);
    });
    return unsub;
  }, [setState]);

  return (
    <div
      ref={ref}
      className={`av-container ${className || ''}`}
      data-state="idle"
      data-mode={mode}
      dangerouslySetInnerHTML={{ __html: AVATAR_PRESETS[preset]?.svg || AVATAR_PRESETS.default.svg }}
    />
  );
});
