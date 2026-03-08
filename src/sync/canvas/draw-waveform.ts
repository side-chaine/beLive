import { generatePeaks } from './peaks';

export interface WaveformStyle {
  color: string;
  opacity?: number;
}

/**
 * Draw a waveform from raw audio data onto canvas.
 * Only processes the visible time region (fast).
 */
export function drawWaveform(
  ctx: CanvasRenderingContext2D,
  data: Float32Array,
  sampleRate: number,
  canvasWidth: number,
  canvasHeight: number,
  zoom: number,
  scrollLeft: number,
  style: WaveformStyle
): void {
  const { color, opacity = 0.8 } = style;

  // Visible time range
  const startTime = scrollLeft / zoom;
  const endTime = (scrollLeft + canvasWidth) / zoom;

  // Convert to sample indices
  const startSample = Math.max(
    0,
    Math.floor(startTime * sampleRate)
  );
  const endSample = Math.min(
    data.length,
    Math.ceil(endTime * sampleRate)
  );

  if (startSample >= endSample) return;

  // Generate peaks for visible region
  const peaks = generatePeaks(
    data,
    startSample,
    endSample,
    canvasWidth
  );

  if (peaks.length === 0) return;

  // Draw filled waveform (mirrored: top = max, bottom = min)
  const centerY = canvasHeight / 2;
  const amplitude = canvasHeight / 2;

  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.fillStyle = color;

  ctx.beginPath();

  // Top edge: max values (left to right)
  for (let i = 0; i < peaks.length; i++) {
    const y = centerY - peaks[i][1] * amplitude;
    if (i === 0) ctx.moveTo(i, y);
    else ctx.lineTo(i, y);
  }

  // Bottom edge: min values (right to left)
  for (let i = peaks.length - 1; i >= 0; i--) {
    const y = centerY - peaks[i][0] * amplitude;
    ctx.lineTo(i, y);
  }

  ctx.closePath();
  ctx.fill();

  ctx.restore();
}
