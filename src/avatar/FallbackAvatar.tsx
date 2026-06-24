// @TC-AVATAR: FallbackAvatar — CSS-animated SVG, no audio-reactive
// Renders ONCE via React.memo(). State changes via direct DOM (setAttribute).
// Used on lite/balanced tiers (allowAvatar: false).

import { memo, useEffect, useRef } from 'react';
import { useAvatarStore, type AvatarStateId, type AvatarMode } from './avatar.store';
import { useFeedStore } from '../catalog/feed/feed.store';
import { useAiStore } from '../stores/ai.store';
import { AVATAR_PRESETS } from './avatar.assets';
import './avatar.css';

interface FallbackAvatarProps {
  mode: AvatarMode;
  className?: string;
}

/**
 * FallbackAvatar — CSS-animated SVG avatar for low-perf tiers.
 * - React.memo(): renders ONCE, 0 re-renders on state change
 * - Subscribes to feed.lastEvent + ai.isStreaming via zustand subscribe()
 * - State changes via ref.current.setAttribute('data-state', mood) — direct DOM
 * - No registration in PlaybackVisualScheduler
 * - No subscription to --bl-audio-* CSS vars
 */
export const FallbackAvatar = memo(function FallbackAvatar({ mode, className }: FallbackAvatarProps) {
  const ref = useRef<HTMLDivElement>(null);
  const preset = useAvatarStore(s => s.preset);
  const setState = useAvatarStore(s => s.setState);

  // Subscribe to feed.lastEvent for happy/idle/error state changes
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
          mood = 'idle'; // TTL 30s — stale event
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

  // Subscribe to ai.store.isStreaming for listening state
  useEffect(() => {
    const el = ref.current;
    const unsub = useAiStore.subscribe((state) => {
      if (!el) return;
      const mood: AvatarStateId = state.isStreaming ? 'listening' : 'idle';
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
