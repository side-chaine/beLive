import { useEffect } from 'react';
import { useTrackStore, TrackState } from '../stores/track.store';
import { interruptPracticeSession } from '../exercises/exercise.interruption';
import { useShowStore } from '../stores/show.store';
import { getTransport } from '../audio/engine-v3';

export function useKeyboardShortcuts() {
  const tracksMeta = useTrackStore((s: TrackState) => s.tracksMeta);
  const currentTrackIndex = useTrackStore((s: TrackState) => s.currentTrackIndex);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
        // Focus Mode → plain arrows не seek-ают, Shift+Arrow (смена трека) работает
        if (!e.shiftKey && document.documentElement.getAttribute('data-billy-control') === 'true') return;
        // ── Show scenario guard ──
        const showState = useShowStore.getState();
        if (showState.activeMode === 'scenario') {
          // Если презентация активна и слайд НЕ показан → beLive владеет стрелками
          if (showState.isPresenting && !showState.showSlide) {
            // let through — стрелки для seek
          } else {
            return;
          }
        }
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
            const transport = getTransport();
            // 🛡 V3 path: __v3Active ИЛИ старый orchestrator guard
            if (transport && ((window as any).__v3Active || (transport.state !== 'idle' && transport.orchestrator.all().length > 0))) {
              try {
                const ct = transport.currentTime;
                const d = transport.duration;
                if (d > 0 && (transport?.isAudioContextRunning ?? true)) {
                  const nt = Math.max(0, Math.min(d, ct + delta * 2))
                  void transport.seek(nt)
                  // publishSeek идёт через _onSeek (V3StatePublisher) — не дублируем (#TASK-013.4)
                }
              } catch { /* V3 seek failed — не роняем клавиатуру */ }
            } else {
              const transport = getTransport();
              const ct = transport?.currentTime ?? 0;
              const d = transport?.duration ?? 0;
              if (d > 0) transport?.seek(Math.max(0, Math.min(d, ct + delta * 2)));
            }
          });
        }
        return;
      }

      if (e.code === 'Space') {
        if (e.repeat) return;
        console.log('[KEYBOARD] Space pressed', { isTrusted: e.isTrusted, target: (e.target as HTMLElement)?.tagName, time: performance.now().toFixed(0) });
        // Show scenario guard: в презентации при showSlide=true — PresenterDock обрабатывает сам
        const showState = useShowStore.getState();
        if (showState.activeMode === 'scenario' && showState.isPresenting && showState.showSlide) return;
        e.preventDefault();
        const transport = getTransport();
        // 🛡 Единый V3 блок: __v3Active ИЛИ старый orchestrator guard
        if (transport && ((window as any).__v3Active || (transport.state !== 'idle' && transport.orchestrator.all().length > 0))) {
          if (transport.state === 'playing') {
            void transport.pause();
          } else if (transport?.isAudioContextRunning ?? true) {
            void transport.play();
          }
          } else {
            const transport = getTransport();
            const isPlaying = transport?.state === 'playing';
            if (isPlaying) { transport?.pause(); } else { transport?.play(); }
          }
        return;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [currentTrackIndex, tracksMeta.length]);
}
