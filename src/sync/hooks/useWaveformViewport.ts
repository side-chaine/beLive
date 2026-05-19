import React from 'react';
import { useSyncStore } from '../store/sync.store';

interface UseWaveformViewportOptions {
  containerRef: React.RefObject<HTMLDivElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  playheadRef: React.RefObject<HTMLDivElement | null>;
  sizeRef: React.MutableRefObject<{ w: number; h: number }>;
  scrollLeftRef: React.MutableRefObject<number>;
  fittedRef: React.MutableRefObject<boolean>;
  zoom: number;
  duration: number;
  followPlayhead: boolean;
  draw: () => void;
}

/**
 * Hook for managing waveform viewport: auto-fit zoom and playhead tracking.
 * Handles stable viewport calculations without touching interaction core.
 */
export function useWaveformViewport({
  containerRef,
  canvasRef,
  playheadRef,
  sizeRef,
  scrollLeftRef,
  fittedRef,
  zoom,
  duration,
  followPlayhead,
  draw,
}: UseWaveformViewportOptions): void {
  // ─── Auto-fit zoom on first open ───────
  React.useEffect(() => {
    if (fittedRef.current || duration <= 0) return;

    const tryFit = (): boolean => {
      const w = sizeRef.current.w;
      if (w <= 0) return false;
      const fitZoom = (w * 0.95) / duration;
      useSyncStore.getState().setZoom(
        Math.max(10, Math.min(500, fitZoom))
      );
      scrollLeftRef.current = 0;
      fittedRef.current = true;
      draw();
      return true;
    };

    // Try immediately; if canvas not sized yet, poll until ready
    if (tryFit()) return;
    const id = setInterval(() => {
      if (tryFit()) clearInterval(id);
    }, 50);
    return () => clearInterval(id);
  }, [duration, draw, sizeRef, scrollLeftRef, fittedRef]);

  // ─── Playhead rAF (center-lock follow) ──────────
  React.useEffect(() => {
    const el = playheadRef.current;
    if (!el) return;

    let rafId: number;

    const tick = () => {
      const ae = (window as any).audioEngine;
      const t: number = ae?.getCurrentTime?.() ?? 0;
      const w = sizeRef.current.w;

      // Follow mode: playhead locked at 30% from left, wave scrolls
      if (followPlayhead && w > 0) {
        const targetScroll = t * zoom - w * 0.3;
        const maxScroll = Math.max(0, duration * zoom - w);
        scrollLeftRef.current = Math.max(0, Math.min(targetScroll, maxScroll));
        draw();
      }

      // Position playhead
      const x = t * zoom - scrollLeftRef.current;
      el.style.left = `${x}px`;
      el.style.display = x >= -2 && x <= w + 2 ? 'block' : 'none';

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [zoom, followPlayhead, draw, sizeRef, scrollLeftRef, playheadRef, duration]);
}
