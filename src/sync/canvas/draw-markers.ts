interface MarkerLike {
  time: number;
  lineIndex?: number;
  color?: string;
  blockType?: string;
}

const FALLBACK_COLOR = '#4caf50';

export function drawMarkers(
  ctx: CanvasRenderingContext2D,
  markers: MarkerLike[],
  zoom: number,
  scrollLeft: number,
  canvasWidth: number,
  canvasHeight: number
): void {
  if (!markers || markers.length === 0) return;

  const startTime = scrollLeft / zoom;
  const endTime = (scrollLeft + canvasWidth) / zoom;

  for (const marker of markers) {
    if (marker.time < startTime - 1 || marker.time > endTime + 1) continue;

    const x = Math.round(marker.time * zoom - scrollLeft) + 0.5;
    const color = marker.color || FALLBACK_COLOR;

    // Marker line
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvasHeight);
    ctx.stroke();

    // Circle pin head
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.arc(x, 8, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Line number
    if (marker.lineIndex != null) {
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = color;
      ctx.font = '9px monospace';
      ctx.fillText(String(marker.lineIndex + 1), x + 5, 16);
    }

    ctx.globalAlpha = 1.0;
  }
}

export function drawMarkerHighlight(
  ctx: CanvasRenderingContext2D,
  time: number,
  color: string,
  zoom: number,
  scrollLeft: number,
  canvasHeight: number
): void {
  const x = Math.round(time * zoom - scrollLeft) + 0.5;

  // Glow line
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.globalAlpha = 1;
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x, canvasHeight);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Bright circle
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x, 8, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.globalAlpha = 1.0;
}

export function drawSelection(
  ctx: CanvasRenderingContext2D,
  startTime: number,
  endTime: number,
  zoom: number,
  scrollLeft: number,
  canvasHeight: number
): void {
  const x1 = Math.round(startTime * zoom - scrollLeft);
  const x2 = Math.round(endTime * zoom - scrollLeft);
  const left = Math.min(x1, x2);
  const width = Math.abs(x2 - x1);

  ctx.fillStyle = 'rgba(0, 255, 100, 0.12)';
  ctx.fillRect(left, 0, width, canvasHeight);

  ctx.strokeStyle = 'rgba(0, 255, 100, 0.4)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.strokeRect(left, 0, width, canvasHeight);
  ctx.setLineDash([]);
}

export function drawLoopRegion(
  ctx: CanvasRenderingContext2D,
  startTime: number,
  endTime: number,
  zoom: number,
  scrollLeft: number,
  canvasHeight: number
): void {
  const x1 = Math.round(startTime * zoom - scrollLeft);
  const x2 = Math.round(endTime * zoom - scrollLeft);
  const left = Math.min(x1, x2);
  const width = Math.abs(x2 - x1);

  ctx.fillStyle = 'rgba(255, 180, 0, 0.1)';
  ctx.fillRect(left, 0, width, canvasHeight);

  ctx.strokeStyle = 'rgba(255, 180, 0, 0.6)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(left, 0);
  ctx.lineTo(left, canvasHeight);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(left + width, 0);
  ctx.lineTo(left + width, canvasHeight);
  ctx.stroke();
}
