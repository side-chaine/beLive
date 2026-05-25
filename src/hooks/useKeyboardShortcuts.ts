import { useEffect } from 'react';
import { useTrackStore, TrackState } from '../stores/track.store';
import { interruptPracticeSession } from '../exercises/exercise.interruption';

export function useKeyboardShortcuts() {
  const tracksMeta = useTrackStore((s: TrackState) => s.tracksMeta);
  const currentTrackIndex = useTrackStore((s: TrackState) => s.currentTrackIndex);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
        // Focus Mode → plain arrows не seek-ают, но Shift+Arrow (смена трека) работает!
        if (!e.shiftKey && document.documentElement.getAttribute('data-billy-control') === 'true') return;

        const delta = e.code === 'ArrowLeft' ? -1 : 1;
        if (e.shiftKey) {
          // Shift+Arrow → track prev/next (accumulated)
          e.preventDefault();
          // Interrupt practice first if active, then jump
          interruptPracticeSession(() => {
            (window as any).queueTrackJump?.(delta);
          });
        } else if (e.metaKey || e.ctrlKey) {
          // Cmd/Ctrl+Arrow → block navigation (→ TC-002)
        } else if (!e.altKey) {
          // Plain Arrow → seek ±2s
          e.preventDefault();
          // Interrupt practice first if active, then seek
          interruptPracticeSession(() => {
            const ae = (window as any).audioEngine;
            if (ae?.getCurrentTime) {
              const d = ae.getDuration?.() ?? 0;
              if (d > 0) ae.setCurrentTime(
                Math.max(0, Math.min(d, ae.getCurrentTime() + delta * 2))
              );
            }
          });
        }
        return;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [currentTrackIndex, tracksMeta.length]);
}
