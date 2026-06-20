// @TC-102: Resizable Columns — Pointer Events drag + ResizeObserver + clamp
import { useState, useRef, useCallback, useEffect } from 'react';
import { useUIStore, type FeedColWidths } from '../stores/ui.store';

const MIN_COL0 = 180;
const MAX_COL0 = 400;
const MIN_COL1 = 400;
const MIN_COL2 = 240;
const MAX_COL2 = 500;
const DEFAULT_COL0 = 280;
const DEFAULT_COL2 = 380;
const TABLET_COL0 = 220;
const TABLET_COL2 = 300;
const WIDE_COL0 = 320;
const WIDE_COL2 = 420;
const KEYBOARD_STEP = 10;

function getViewportDefaults(vw: number): { col0: number; col2: number } {
  if (vw < 1200) return { col0: TABLET_COL0, col2: TABLET_COL2 };
  if (vw >= 1600) return { col0: WIDE_COL0, col2: WIDE_COL2 };
  return { col0: DEFAULT_COL0, col2: DEFAULT_COL2 };
}

function clamp(value: number, min: number, max: number): number {
  return Math.round(Math.min(Math.max(value, min), max));
}

interface ResizeColumnsApi {
  displayWidths: { col0: number; col2: number };
  isDragging: boolean;
  isMobile: boolean;
  onPointerDown: (e: React.PointerEvent, side: 'col0' | 'col2') => void;
  onDoubleClick: (side: 'col0' | 'col2') => void;
  onKeyDown: (e: React.KeyboardEvent, side: 'col0' | 'col2') => void;
}

export function useResizeColumns(gridRef: React.RefObject<HTMLDivElement | null>): ResizeColumnsApi {
  const feedColWidths = useUIStore(s => s.feedColWidths);
  const setFeedColWidths = useUIStore(s => s.setFeedColWidths);
  const resetFeedColWidths = useUIStore(s => s.resetFeedColWidths);

  const [isDragging, setIsDragging] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [viewport, setViewport] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);

  // Live drag state (useState, no persist)
  const [liveWidths, setLiveWidths] = useState<{ col0: number; col2: number } | null>(null);

  // Refs for drag state machine
  const dragRef = useRef<{ side: 'col0' | 'col2'; startX: number; startCol0: number; startCol2: number } | null>(null);

  // ResizeObserver for viewport
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setViewport(entry.contentRect.width);
      }
    });
    ro.observe(el);

    // Mobile check
    const mq = window.matchMedia('(max-width: 767px)');
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);

    return () => {
      ro.disconnect();
      mq.removeEventListener('change', handler);
    };
  }, [gridRef]);

  // Clamp display widths
  const resolvedWidths: { col0: number; col2: number } = liveWidths ?? (() => {
    const defaults = getViewportDefaults(viewport);
    if (feedColWidths.col0 == null && feedColWidths.col2 == null) return defaults;

    // Respect viewport — clamp custom widths
    const available = viewport - MIN_COL1 - 12; // 12px for handles padding
    const raw0 = feedColWidths.col0 != null ? feedColWidths.col0 : defaults.col0;
    const raw2 = feedColWidths.col2 != null ? feedColWidths.col2 : defaults.col2;

    // Proportional scaling if overflow
    let col0 = clamp(raw0, MIN_COL0, Math.min(MAX_COL0, available));
    let col2 = clamp(raw2, MIN_COL2, Math.min(MAX_COL2, available - col0));

    return { col0, col2 };
  })();

  const onPointerDown = useCallback((e: React.PointerEvent, side: 'col0' | 'col2') => {
    if (isMobile) return;
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);

    dragRef.current = {
      side,
      startX: e.clientX,
      startCol0: resolvedWidths.col0,
      startCol2: resolvedWidths.col2,
    };
    setIsDragging(true);
  }, [isMobile, resolvedWidths.col0, resolvedWidths.col2]);

  // Global pointermove + pointerup (during drag)
  useEffect(() => {
    if (!isDragging) return;

    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const delta = e.clientX - d.startX;

      let newCol0 = d.startCol0;
      let newCol2 = d.startCol2;

      if (d.side === 'col0') {
        newCol0 = clamp(d.startCol0 + delta, MIN_COL0, MAX_COL0);
      } else {
        newCol2 = clamp(d.startCol2 - delta, MIN_COL2, MAX_COL2);
      }

      // Ensure col1 has at least MIN_COL1
      const available = viewport - MIN_COL1 - 12;
      if (newCol0 + newCol2 > available) {
        if (d.side === 'col0') {
          newCol0 = Math.min(newCol0, available - newCol2);
        } else {
          newCol2 = Math.min(newCol2, available - newCol0);
        }
      }

      setLiveWidths({ col0: Math.round(newCol0), col2: Math.round(newCol2) });
    };

    const onUp = (e: PointerEvent) => {
      const d = dragRef.current;
      if (d) {
        const target = e.target as HTMLElement;
        if (target?.releasePointerCapture) {
          try { target.releasePointerCapture(e.pointerId); } catch {}
        }
        // Commit to store (1 persist write)
        setFeedColWidths({
          col0: Math.round(liveWidths?.col0 ?? d.startCol0),
          col2: Math.round(liveWidths?.col2 ?? d.startCol2),
        });
      }
      dragRef.current = null;

      // Restore transition in next frame
      requestAnimationFrame(() => setIsDragging(false));
      // Clear live state after commit
      setLiveWidths(null);
    };

    const onCancel = (e: PointerEvent) => {
      onUp(e); // Treat cancel as commit
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onCancel);

    return () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onCancel);
    };
  }, [isDragging, viewport, liveWidths, setFeedColWidths]);

  const onDoubleClick = useCallback((side: 'col0' | 'col2') => {
    resetFeedColWidths();
    setLiveWidths(null);
  }, [resetFeedColWidths]);

  const onKeyDown = useCallback((e: React.KeyboardEvent, side: 'col0' | 'col2') => {
    if (isMobile) return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      const delta = e.key === 'ArrowLeft' ? -KEYBOARD_STEP : KEYBOARD_STEP;
      const current = feedColWidths[side];
      const newVal = current != null ? current + delta : (side === 'col0' ? DEFAULT_COL0 + delta : DEFAULT_COL2 + delta);
      const clamped = side === 'col0'
        ? clamp(newVal, MIN_COL0, MAX_COL0)
        : clamp(newVal, MIN_COL2, MAX_COL2);

      setFeedColWidths(side === 'col0' ? { col0: clamped } : { col2: clamped });
    }
    if (e.key === 'Home') {
      e.preventDefault();
      onDoubleClick(side);
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      // Committed via setFeedColWidths already
    }
  }, [isMobile, feedColWidths, setFeedColWidths, onDoubleClick]);

  return {
    displayWidths: resolvedWidths,
    isDragging,
    isMobile,
    onPointerDown,
    onDoubleClick,
    onKeyDown,
  };
}
