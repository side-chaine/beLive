/**
 * Draw time grid lines + labels on canvas.
 * Adapts interval spacing based on zoom level.
 */
export function drawGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  zoom: number,
  scrollLeft: number,
  duration: number
): void {
  // Choose interval based on zoom (pixelsPerSecond)
  let interval: number;
  if (zoom < 15) interval = 30;
  else if (zoom < 30) interval = 10;
  else if (zoom < 60) interval = 5;
  else if (zoom < 150) interval = 2;
  else if (zoom < 300) interval = 1;
  else interval = 0.5;

  const startTime = scrollLeft / zoom;
  const endTime = Math.min((scrollLeft + width) / zoom, duration);
  const firstMark = Math.floor(startTime / interval) * interval;

  ctx.lineWidth = 1;

  for (let t = firstMark; t <= endTime + interval; t += interval) {
    if (t < 0 || t > duration) continue;
    const x = Math.round(t * zoom - scrollLeft) + 0.5;

    // Grid line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();

    // Time label
    const min = Math.floor(t / 60);
    const sec = Math.floor(t % 60);
    const label = `${min}:${String(sec).padStart(2, '0')}`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.font = '10px monospace';
    ctx.fillText(label, x + 3, height - 4);
  }
}
