import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import { generatePeaks } from '../../sync/canvas/peaks';
import type { ViewMode } from '../takes.types';

interface TakesCanvasProps {
  instrumentalBuffer: AudioBuffer | null;
  vocalBuffer?: AudioBuffer | null;
  blockStart: number;
  blockEnd: number;
  isRecording?: boolean;
  viewMode: ViewMode;
  height?: number;
  referencePeaks?: [number, number][] | null;
  takePeaks?: [number, number][] | null;
  responseWindow?: { startTime: number; endTime: number; active: boolean } | null;
}

export function TakesCanvas({
  instrumentalBuffer,
  vocalBuffer,
  blockStart,
  blockEnd,
  isRecording = false,
  viewMode,
  height = 100,
  referencePeaks,
  takePeaks,
  responseWindow,
}: TakesCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const widthRef = useRef(300);

  // Compute peaks once per block/buffer change
  const instrumentalPeaks = useMemo(() => {
    if (!instrumentalBuffer) return null;
    const sr = instrumentalBuffer.sampleRate;
    const ch = instrumentalBuffer.getChannelData(0);
    const s0 = Math.max(0, Math.floor(blockStart * sr));
    const s1 = Math.min(ch.length, Math.ceil(blockEnd * sr));
    if (s1 <= s0) return null;
    return generatePeaks(ch.subarray(s0, s1), 0, s1 - s0, 500);
  }, [instrumentalBuffer, blockStart, blockEnd]);

  const vocalPeaks = useMemo(() => {
    if (!vocalBuffer) return null;
    const sr = vocalBuffer.sampleRate;
    const ch = vocalBuffer.getChannelData(0);
    const s0 = Math.max(0, Math.floor(blockStart * sr));
    const s1 = Math.min(ch.length, Math.ceil(blockEnd * sr));
    if (s1 <= s0) return null;
    return generatePeaks(ch.subarray(s0, s1), 0, s1 - s0, 500);
  }, [vocalBuffer, blockStart, blockEnd]);

  // Draw function
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = widthRef.current;
    const h = height;

    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';

    ctx.save();
    ctx.scale(dpr, dpr);

    // Background
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, w, h);

    // Recording tint
    if (isRecording) {
      ctx.fillStyle = 'rgba(255, 50, 50, 0.06)';
      ctx.fillRect(0, 0, w, h);
    }

    // Response window highlight (draw AFTER background, BEFORE waveform layers)
    if (responseWindow) {
      const startX = ((responseWindow.startTime - blockStart) / (blockEnd - blockStart)) * w;
      const endX = ((responseWindow.endTime - blockStart) / (blockEnd - blockStart)) * w;
      
      ctx.fillStyle = responseWindow.active
        ? 'rgba(255,165,0,0.16)'  // Stronger amber when recording
        : 'rgba(255,200,70,0.10)'; // Softer amber when waiting
      
      ctx.fillRect(startX, 0, Math.max(1, endX - startX), h);
    }

    // Layer 1: Base context by viewMode
    if (viewMode === 'inst' && instrumentalPeaks) {
      drawPeakBars(ctx, instrumentalPeaks, w, h, 'rgba(210,85,85,0.5)');
    } else if (viewMode === 'voc' && vocalPeaks) {
      drawPeakBars(ctx, vocalPeaks, w, h, 'rgba(79,139,255,0.55)');
    } else if (viewMode === 'mix') {
      if (instrumentalPeaks)
        drawPeakBars(ctx, instrumentalPeaks, w, h, 'rgba(210,85,85,0.35)');
      if (vocalPeaks)
        drawPeakBars(ctx, vocalPeaks, w, h, 'rgba(79,139,255,0.45)');
    }
    
    // Layer 2: Reference peaks (guide-green; bright green remains reserved for future match zones)
    if (referencePeaks && referencePeaks.length > 0) {
      drawContourBars(ctx, referencePeaks, w, h, 'rgba(88,190,125,0.85)', 0.18);
    }
    
    // Layer 3: Compare peaks (orange, solid fill)
    if (takePeaks && takePeaks.length > 0) {
      drawPeakBars(ctx, takePeaks, w, h, 'rgba(255,145,0,0.58)');
    }

    // Block boundaries
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0.5, 0); ctx.lineTo(0.5, h);
    ctx.moveTo(w - 0.5, 0); ctx.lineTo(w - 0.5, h);
    ctx.stroke();

    ctx.restore();
  }, [instrumentalPeaks, vocalPeaks, referencePeaks, takePeaks, height, blockStart, blockEnd, isRecording, viewMode, responseWindow]);

  // Resize observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(([entry]) => {
      widthRef.current = entry.contentRect.width;
      draw();
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [draw]);

  // Redraw on state change
  useEffect(() => { draw(); }, [draw]);

  // No data state
  if (!instrumentalBuffer) {
    return (
      <div style={{ height, background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555', fontSize: '12px' }}>
        Loading waveform...
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ width: '100%', height, position: 'relative' }}>
      <canvas
        ref={canvasRef}
        style={{ cursor: 'default', display: 'block' }}
      />
    </div>
  );
}

// Local peak bar drawing (solid fill)
function drawPeakBars(
  ctx: CanvasRenderingContext2D,
  peaks: [number, number][],
  width: number,
  height: number,
  color: string,
) {
  if (peaks.length === 0) return;
  const mid = height / 2;
  const barW = width / peaks.length;

  ctx.fillStyle = color;
  for (let i = 0; i < peaks.length; i++) {
    const [min, max] = peaks[i];
    const yTop = mid - max * mid;
    const yBot = mid - min * mid;
    const h = Math.max(1, yBot - yTop);
    ctx.fillRect(i * barW, yTop, Math.max(1, barW - 0.5), h);
  }
}

// Contour/skeleton bar drawing (narrower, stronger, outline-like)
function drawContourBars(
  ctx: CanvasRenderingContext2D,
  peaks: [number, number][],
  width: number,
  height: number,
  color: string,
  fillRatio: number = 0.3,
) {
  if (peaks.length === 0) return;
  const mid = height / 2;
  const barW = width / peaks.length;
  const narrowBarW = barW * fillRatio; // Narrower than normal bars

  ctx.fillStyle = color;
  for (let i = 0; i < peaks.length; i++) {
    const [min, max] = peaks[i];
    const yTop = mid - max * mid;
    const yBot = mid - min * mid;
    const h = Math.max(1, yBot - yTop);
    const xOffset = i * barW + (barW - narrowBarW) / 2; // Center the narrow bar
    ctx.fillRect(xOffset, yTop, Math.max(1, narrowBarW - 0.5), h);
  }
}
