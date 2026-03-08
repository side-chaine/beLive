import React, { useRef, useEffect, useCallback } from 'react';
import { useSyncStore } from '../store/sync.store';
import { useWaveformData } from '../hooks/useWaveformData';
import { drawGrid } from '../canvas/draw-grid';
import { drawWaveform } from '../canvas/draw-waveform';
import { drawMarkers, drawMarkerHighlight, drawSelection, drawLoopRegion } from '../canvas/draw-markers';
import { useMarkersStore } from '../../stores/markers.store';

// Waveform colors per source mode
const COLORS = {
  instrumental: '#00bcd4',  // cyan
  vocal: '#e91e63',         // magenta/pink
};

export function WaveformCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null);
  const scrollLeftRef = useRef(0);
  const sizeRef = useRef({ w: 0, h: 0 });
  const fittedRef = useRef(false);
  const dragRef = useRef<{
    active: boolean;
    markerId: string | null;
    markerColor: string;
    currentTime: number;
  }>({ active: false, markerId: null, markerColor: '', currentTime: 0 });
  const hoverMarkerRef = useRef<string | null>(null);
  const lastClickedMarkerRef = useRef<string | null>(null);
  const selectedMarkerRef = useRef<string | null>(null);
  const selectionRef = useRef<{
    active: boolean;
    startTime: number;
    endTime: number;
  }>({ active: false, startTime: 0, endTime: 0 });
  const selectedMarkerIds = useRef<Set<string>>(new Set());
  const loopRef = useRef<{
    active: boolean;
    startTime: number;
    endTime: number;
  }>({ active: false, startTime: 0, endTime: 0 });
  const mouseDownRef = useRef<{
    x: number;
    time: number;
    isShift: boolean;
    moved: boolean;
  } | null>(null);
  const DRAG_THRESHOLD = 5;
  const LOOP_HANDLE_PX = 10;
  const loopDragRef = useRef<'start' | 'end' | 'body' | null>(null);
  const loopDragOffset = useRef(0);
  const followBeforeLoop = useRef(true);

  const zoom = useSyncStore((s) => s.zoom);
  const sourceMode = useSyncStore((s) => s.sourceMode);
  const followPlayhead = useSyncStore((s) => s.followPlayhead);
  const markersVisible = useSyncStore((s) => s.markersVisible);
  const markers = useMarkersStore((s) => s.markers);
  const {
    instrumentalData,
    vocalData,
    sampleRate,
    duration,
    loading,
    error,
  } = useWaveformData();

  // ─── Draw ─────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = sizeRef.current.w;
    const h = sizeRef.current.h;
    const scroll = scrollLeftRef.current;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    if (!duration) return;

    // Grid
    drawGrid(ctx, w, h, zoom, scroll, duration);

    // Instrumental
    if (
      instrumentalData &&
      (sourceMode === 'instrumental' || sourceMode === 'mix')
    ) {
      drawWaveform(
        ctx, instrumentalData, sampleRate,
        w, h, zoom, scroll,
        {
          color: COLORS.instrumental,
          opacity: sourceMode === 'mix' ? 0.5 : 0.8,
        }
      );
    }

    // Vocal
    if (
      vocalData &&
      (sourceMode === 'vocal' || sourceMode === 'mix')
    ) {
      drawWaveform(
        ctx, vocalData, sampleRate,
        w, h, zoom, scroll,
        {
          color: COLORS.vocal,
          opacity: sourceMode === 'mix' ? 0.65 : 0.8,
        }
      );
    }

    // Markers
    if (markersVisible && markers.length > 0) {
      drawMarkers(ctx, markers, zoom, scroll, w, h);
    }

    // Highlight dragged marker
    if (dragRef.current.active) {
      drawMarkerHighlight(ctx, dragRef.current.currentTime, dragRef.current.markerColor, zoom, scroll, h);
    }
    // Highlight selected marker (when not dragging)
    if (!dragRef.current.active && selectedMarkerRef.current) {
      const sel = markers.find((m: any) => m.id === selectedMarkerRef.current);
      if (sel) {
        drawMarkerHighlight(ctx, sel.time, sel.color || '#4CAF50', zoom, scroll, h);
      }
    }

    // Highlight all multi-selected markers
    if (selectedMarkerIds.current.size > 0) {
      for (const m of markers) {
        if (selectedMarkerIds.current.has(m.id)) {
          drawMarkerHighlight(ctx, m.time, m.color || '#4CAF50', zoom, scroll, h);
        }
      }
    }

    // Selection region
    if (selectionRef.current.active || selectionRef.current.startTime !== selectionRef.current.endTime) {
      if (selectionRef.current.startTime !== selectionRef.current.endTime) {
        drawSelection(ctx, selectionRef.current.startTime, selectionRef.current.endTime, zoom, scroll, h);
      }
    }

    // Loop region
    if (loopRef.current.active) {
      drawLoopRegion(ctx, loopRef.current.startTime, loopRef.current.endTime, zoom, scroll, h);
    }
  }, [zoom, sourceMode, instrumentalData, vocalData,
      sampleRate, duration, markersVisible, markers]);

  // ─── Canvas resize (Retina-aware) ────────
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      sizeRef.current = { w: width, h: height };
      draw();
    });

    ro.observe(container);
    return () => ro.disconnect();
  }, [draw]);

  // ─── Redraw on dependency change ────────
  useEffect(() => {
    draw();
  }, [draw]);

  // ─── Auto-fit zoom on first open ───────
  useEffect(() => {
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
  }, [duration, draw]);

  // ─── Playhead rAF (center-lock follow) ──────────
  useEffect(() => {
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
  }, [zoom, followPlayhead, draw]);

  // ─── Find nearest marker helper ─────────
  const findNearestMarker = useCallback(
    (clientX: number): { id: string; time: number; color: string } | null => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect || !markers.length) return null;
      const clickX = clientX - rect.left;
      const threshold = 10; // pixels

      let best: { id: string; time: number; color: string; dist: number } | null = null;
      for (const m of markers) {
        const markerX = m.time * zoom - scrollLeftRef.current;
        const dist = Math.abs(clickX - markerX);
        if (dist < threshold && (!best || dist < best.dist)) {
          best = { id: m.id, time: m.time, color: m.color || '#4CAF50', dist };
        }
      }
      return best;
    },
    [markers, zoom]
  );

  const detectLoopHandle = useCallback(
    (clientX: number): 'start' | 'end' | 'body' | null => {
      if (!loopRef.current.active) return null;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return null;
      const clickX = clientX - rect.left;
      const startX = loopRef.current.startTime * zoom - scrollLeftRef.current;
      const endX = loopRef.current.endTime * zoom - scrollLeftRef.current;

      if (Math.abs(clickX - startX) < LOOP_HANDLE_PX) return 'start';
      if (Math.abs(clickX - endX) < LOOP_HANDLE_PX) return 'end';
      if (clickX > startX + LOOP_HANDLE_PX && clickX < endX - LOOP_HANDLE_PX) return 'body';
      return null;
    },
    [zoom]
  );

  // ─── Mouse handlers (drag markers or seek) ─────
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const clickX = e.clientX - rect.left;
      const clickTime = (clickX + scrollLeftRef.current) / zoom;

      // Check loop handle (second priority after shift)
      if (!e.shiftKey) {
        const handle = detectLoopHandle(e.clientX);
        if (handle) {
          loopDragRef.current = handle;
          if (handle === 'body') {
            const clickX = e.clientX - rect.left;
            const startX = loopRef.current.startTime * zoom - scrollLeftRef.current;
            loopDragOffset.current = clickX - startX;
          }
          e.preventDefault();
          return;
        }
      }

      // Check marker first (highest priority)
      const nearest = findNearestMarker(e.clientX);
      if (nearest && !e.shiftKey) {
        selectedMarkerRef.current = nearest.id;
        lastClickedMarkerRef.current = nearest.id;
        selectionRef.current = { active: false, startTime: 0, endTime: 0 };
        selectedMarkerIds.current.clear();
        useSyncStore.getState().pushUndo();
        dragRef.current = {
          active: true,
          markerId: nearest.id,
          markerColor: nearest.color,
          currentTime: nearest.time,
        };
        draw();
        e.preventDefault();
        return;
      }

      // Record mousedown for click/drag detection
      mouseDownRef.current = {
        x: e.clientX,
        time: clickTime,
        isShift: e.shiftKey,
        moved: false,
      };

      // Clear previous selection on new mousedown
      selectedMarkerRef.current = null;
    },
    [zoom, findNearestMarker, detectLoopHandle, draw]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const currentX = e.clientX;

      // Loop handle drag
      if (loopDragRef.current) {
        const x = currentX - rect.left;
        const time = Math.max(0, Math.min((x + scrollLeftRef.current) / zoom, duration));

        if (loopDragRef.current === 'start') {
          loopRef.current.startTime = Math.min(time, loopRef.current.endTime - 0.1);
          const ae = (window as any).audioEngine;
          ae?.setLoop?.(loopRef.current.startTime, loopRef.current.endTime);
        } else if (loopDragRef.current === 'end') {
          loopRef.current.endTime = Math.max(time, loopRef.current.startTime + 0.1);
          const ae = (window as any).audioEngine;
          ae?.setLoop?.(loopRef.current.startTime, loopRef.current.endTime);
        } else if (loopDragRef.current === 'body') {
          const loopWidth = loopRef.current.endTime - loopRef.current.startTime;
          const newStart = Math.max(0, (x - loopDragOffset.current + scrollLeftRef.current) / zoom);
          if (newStart + loopWidth <= duration) {
            loopRef.current.startTime = newStart;
            loopRef.current.endTime = newStart + loopWidth;
            const ae = (window as any).audioEngine;
            ae?.setLoop?.(loopRef.current.startTime, loopRef.current.endTime);
          }
        }

        container.style.cursor = loopDragRef.current === 'body' ? 'grabbing' : 'ew-resize';
        draw();
        return;
      }

      // Marker drag
      if (dragRef.current.active) {
        const x = currentX - rect.left;
        const newTime = Math.max(0, Math.min((x + scrollLeftRef.current) / zoom, duration));
        dragRef.current.currentTime = newTime;
        container.style.cursor = 'grabbing';
        draw();
        return;
      }

      // Mouse is down — detect drag
      if (mouseDownRef.current) {
        const dx = Math.abs(currentX - mouseDownRef.current.x);

        if (!mouseDownRef.current.moved && dx > DRAG_THRESHOLD) {
          mouseDownRef.current.moved = true;

          // Start selection (or loop if shift)
          selectionRef.current = {
            active: true,
            startTime: mouseDownRef.current.time,
            endTime: mouseDownRef.current.time,
          };
          selectedMarkerIds.current.clear();
        }

        if (mouseDownRef.current.moved) {
          const time = Math.max(0, Math.min(
            (currentX - rect.left + scrollLeftRef.current) / zoom, duration
          ));
          selectionRef.current.endTime = time;

          // Find markers inside selection
          const start = Math.min(selectionRef.current.startTime, time);
          const end = Math.max(selectionRef.current.startTime, time);
          selectedMarkerIds.current.clear();
          for (const m of markers) {
            if (m.time >= start && m.time <= end) {
              selectedMarkerIds.current.add(m.id);
            }
          }

          container.style.cursor = 'col-resize';
          draw();
        }
        return;
      }

      // Hover detection (no button pressed)
      const loopHandle = detectLoopHandle(currentX);
      if (loopHandle === 'start' || loopHandle === 'end') {
        container.style.cursor = 'ew-resize';
      } else if (loopHandle === 'body') {
        container.style.cursor = 'grab';
      } else {
        const nearest = findNearestMarker(e.clientX);
        container.style.cursor = nearest ? 'grab' : 'crosshair';
        hoverMarkerRef.current = nearest?.id || null;
      }
    },
    [zoom, duration, markers, findNearestMarker, detectLoopHandle, draw]
  );

  const handleMouseUp = useCallback(
    () => {
      // End loop drag
      if (loopDragRef.current) {
        loopDragRef.current = null;
        console.log('[Sync] loop adjusted:',
          loopRef.current.startTime.toFixed(2), '-',
          loopRef.current.endTime.toFixed(2));
        const container = containerRef.current;
        if (container) container.style.cursor = 'crosshair';
        draw();
        return;
      }

      // End marker drag
      if (dragRef.current.active) {
        const { markerId, currentTime } = dragRef.current;
        dragRef.current = { active: false, markerId: null, markerColor: '', currentTime: 0 };

        if (markerId) {
          useMarkersStore.getState().updateMarker(markerId, { time: currentTime });
          console.log('[Sync] marker', markerId, 'moved to', currentTime.toFixed(2) + 's');
        }

        const container = containerRef.current;
        if (container) container.style.cursor = 'crosshair';
        draw();
        mouseDownRef.current = null;
        return;
      }

      // End selection or seek
      if (mouseDownRef.current) {
        const wasShift = mouseDownRef.current.isShift;
        const moved = mouseDownRef.current.moved;

        if (moved) {
          // Selection ended
          selectionRef.current.active = false;

          // Shift+drag → create loop
          if (wasShift) {
            const start = Math.min(selectionRef.current.startTime, selectionRef.current.endTime);
            const end = Math.max(selectionRef.current.startTime, selectionRef.current.endTime);
            if (end - start > 0.1) {
              loopRef.current = { active: true, startTime: start, endTime: end };
              const ae = (window as any).audioEngine;
              ae?.setLoop?.(start, end);
              // Save follow state and disable during loop
              followBeforeLoop.current = useSyncStore.getState().followPlayhead;
              if (useSyncStore.getState().followPlayhead) {
                useSyncStore.getState().toggleFollow();
              }
              console.log('[Sync] loop created:', start.toFixed(2), '-', end.toFixed(2));
            }
            selectionRef.current = { active: false, startTime: 0, endTime: 0 };
            selectedMarkerIds.current.clear();
          } else {
            const count = selectedMarkerIds.current.size;
            if (count > 0) {
              console.log('[Sync] selected', count, 'markers');
            }
          }
        } else {
          // Simple click → seek
          const clickTime = mouseDownRef.current.time;
          const clampedTime = Math.max(0, Math.min(clickTime, duration));
          const ae = (window as any).audioEngine;
          if (ae?.setCurrentTime) ae.setCurrentTime(clampedTime);

          // Clear selection
          selectionRef.current = { active: false, startTime: 0, endTime: 0 };
          selectedMarkerIds.current.clear();
        }

        mouseDownRef.current = null;
        const container = containerRef.current;
        if (container) container.style.cursor = 'crosshair';
        draw();
      }
    },
    [zoom, duration, draw]
  );

  // Expose delete for toolbar button
  useEffect(() => {
    (window as any).__syncDeleteMarker = () => {
      const { markers, deleteMarker } = useMarkersStore.getState();

      // Multi-select: delete all selected markers
      if (selectedMarkerIds.current.size > 0) {
        useSyncStore.getState().pushUndo();
        const ids = [...selectedMarkerIds.current];
        for (const id of ids) {
          const target = markers.find((m) => String(m.id) === String(id));
          if (target) deleteMarker(target.id);
        }
        selectedMarkerIds.current.clear();
        selectionRef.current = { active: false, startTime: 0, endTime: 0 };
        console.log('[Sync] deleted', ids.length, 'selected markers');
        draw();
        return;
      }

      // Single select: delete last clicked
      const id = lastClickedMarkerRef.current || hoverMarkerRef.current;
      if (!id) {
        console.log('[Sync] no marker selected to delete');
        return;
      }

      useSyncStore.getState().pushUndo();
      const target = markers.find((m) => String(m.id) === String(id));
      if (target) deleteMarker(target.id);
      lastClickedMarkerRef.current = null;
      hoverMarkerRef.current = null;
      selectedMarkerRef.current = null;
      console.log('[Sync] deleted marker', id);
      draw();
    };
    return () => { delete (window as any).__syncDeleteMarker; };
  }, [draw]);

  // Expose loop controls for toolbar
  useEffect(() => {
    (window as any).__syncClearLoop = () => {
      loopRef.current = { active: false, startTime: 0, endTime: 0 };
      const ae = (window as any).audioEngine;
      ae?.clearLoop?.();
      // Restore follow state
      if (followBeforeLoop.current && !useSyncStore.getState().followPlayhead) {
        useSyncStore.getState().toggleFollow();
      }
      console.log('[Sync] loop cleared, follow restored');
      draw();
    };
    (window as any).__syncHasLoop = () => loopRef.current.active;
    return () => {
      delete (window as any).__syncClearLoop;
      delete (window as any).__syncHasLoop;
    };
  }, [draw]);

  // Clear loop on Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && loopRef.current.active) {
        (window as any).__syncClearLoop?.();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  // ─── Wheel scroll (non-passive for preventDefault) ──
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const w = sizeRef.current.w;
      if (w <= 0) return;

      // Pinch-to-zoom (ctrlKey = trackpad pinch on Mac)
      if (e.ctrlKey || e.metaKey) {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;

        // Mouse position as anchor point
        const mouseX = e.clientX - rect.left;
        const mouseTime = (mouseX + scrollLeftRef.current) / zoom;

        // Apply zoom
        const factor = e.deltaY > 0 ? 0.92 : 1.08;
        const newZoom = Math.max(10, Math.min(500, zoom * factor));
        useSyncStore.getState().setZoom(newZoom);

        // Adjust scroll to keep mouse position anchored
        const newScroll = mouseTime * newZoom - mouseX;
        const maxScroll = Math.max(0, duration * newZoom - w);
        scrollLeftRef.current = Math.max(0, Math.min(newScroll, maxScroll));

        draw();

        // Update playhead
        const ph = playheadRef.current;
        if (ph) {
          const ae = (window as any).audioEngine;
          const t = ae?.getCurrentTime?.() ?? 0;
          const px = t * newZoom - scrollLeftRef.current;
          ph.style.left = `${px}px`;
          ph.style.display = px >= -2 && px <= w + 2 ? 'block' : 'none';
        }
        return;
      }

      // Normal scroll (horizontal)
      const totalWidth = duration * zoom;
      const maxScroll = Math.max(0, totalWidth - w);
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY)
        ? e.deltaX
        : e.deltaY;

      scrollLeftRef.current = Math.max(
        0,
        Math.min(scrollLeftRef.current + delta, maxScroll)
      );

      draw();

      const ph = playheadRef.current;
      if (ph) {
        const ae = (window as any).audioEngine;
        const t = ae?.getCurrentTime?.() ?? 0;
        const x = t * zoom - scrollLeftRef.current;
        ph.style.left = `${x}px`;
        ph.style.display = x >= -2 && x <= w + 2 ? 'block' : 'none';
      }
    };

    el.addEventListener('wheel', handler, {
      passive: false,
    });
    return () => el.removeEventListener('wheel', handler);
  }, [zoom, duration, draw]);

  // ─── Render ────────────────────────────
  if (loading) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--bl-c-text-secondary, #888)',
          fontSize: '13px',
        }}
      >
        Loading waveform...
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--bl-c-error, #f44)',
          fontSize: '13px',
        }}
      >
        {error}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{
        flex: 1,
        position: 'relative',
        overflow: 'hidden',
        cursor: 'crosshair',
        background: 'var(--bl-c-surface-0, #0d0d1a)',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
        }}
      />
      {/* Playhead */}
      <div
        ref={playheadRef}
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          width: '2px',
          background: '#ff4444',
          zIndex: 2,
          pointerEvents: 'none',
          boxShadow: '0 0 4px rgba(255,68,68,0.5)',
        }}
      />
    </div>
  );
}
