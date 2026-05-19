import React from 'react';
import { drawGrid } from '../canvas/draw-grid';
import { drawWaveform } from '../canvas/draw-waveform';
import { drawMarkers, drawMarkerHighlight, drawSelection, drawLoopRegion } from '../canvas/draw-markers';

interface UseWaveformRenderOptions {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  sizeRef: React.MutableRefObject<{ w: number; h: number }>;
  scrollLeftRef: React.MutableRefObject<number>;
  zoom: number;
  sourceMode: string;
  instrumentalData: Float32Array | null;
  vocalData: Float32Array | null;
  sampleRate: number;
  duration: number;
  markersVisible: boolean;
  markers: any[];
  dragRef: React.MutableRefObject<{
    active: boolean;
    markerId: string | null;
    markerColor: string;
    currentTime: number;
  }>;
  selectedMarkerRef: React.MutableRefObject<string | null>;
  selectedMarkerIds: React.MutableRefObject<Set<string>>;
  selectionRef: React.MutableRefObject<{
    active: boolean;
    startTime: number;
    endTime: number;
  }>;
  loopRef: React.MutableRefObject<{
    active: boolean;
    startTime: number;
    endTime: number;
  }>;
}

const COLORS = {
  instrumental: '#00bcd4',
  vocal: '#e91e63',
};

export function useWaveformRender({
  canvasRef,
  sizeRef,
  scrollLeftRef,
  zoom,
  sourceMode,
  instrumentalData,
  vocalData,
  sampleRate,
  duration,
  markersVisible,
  markers,
  dragRef,
  selectedMarkerRef,
  selectedMarkerIds,
  selectionRef,
  loopRef,
}: UseWaveformRenderOptions): (() => void) {
  const draw = React.useCallback(() => {
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
      sampleRate, duration, markersVisible, markers, canvasRef, sizeRef, scrollLeftRef, dragRef, selectedMarkerRef, selectedMarkerIds, selectionRef, loopRef]);

  return draw;
}
