/**
 * Pure hit-testing helpers for waveform canvas.
 * No state mutations, no side effects.
 */

interface MarkerHitResult {
  id: string;
  time: number;
  color: string;
}

interface LoopHandleDetection {
  type: 'start' | 'end' | 'body' | null;
}

/**
 * Find the nearest marker to a click position.
 * @param clientX - Client X coordinate of the click
 * @param containerRect - Bounding rect of the container
 * @param markers - Array of markers to search
 * @param zoom - Current zoom level
 * @param scrollLeft - Current scroll position
 * @returns Nearest marker within threshold, or null
 */
export function findNearestMarker(
  clientX: number,
  containerRect: DOMRect,
  markers: any[],
  zoom: number,
  scrollLeft: number
): MarkerHitResult | null {
  if (!markers.length) return null;
  const clickX = clientX - containerRect.left;
  const threshold = 10; // pixels

  let best: { id: string; time: number; color: string; dist: number } | null = null;
  for (const m of markers) {
    const markerX = m.time * zoom - scrollLeft;
    const dist = Math.abs(clickX - markerX);
    if (dist < threshold && (!best || dist < best.dist)) {
      best = { id: m.id, time: m.time, color: m.color || '#4CAF50', dist };
    }
  }
  return best;
}

/**
 * Detect which part of the loop region was clicked.
 * @param clientX - Client X coordinate of the click
 * @param containerRect - Bounding rect of the container
 * @param loopActive - Whether loop is currently active
 * @param loopStartTime - Loop start time in seconds
 * @param loopEndTime - Loop end time in seconds
 * @param zoom - Current zoom level
 * @param scrollLeft - Current scroll position
 * @param loopHandlePx - Size of loop handle in pixels (default 10)
 * @returns 'start', 'end', 'body', or null
 */
export function detectLoopHandle(
  clientX: number,
  containerRect: DOMRect,
  loopActive: boolean,
  loopStartTime: number,
  loopEndTime: number,
  zoom: number,
  scrollLeft: number,
  loopHandlePx: number = 10
): 'start' | 'end' | 'body' | null {
  if (!loopActive) return null;
  const clickX = clientX - containerRect.left;
  const startX = loopStartTime * zoom - scrollLeft;
  const endX = loopEndTime * zoom - scrollLeft;

  if (Math.abs(clickX - startX) < loopHandlePx) return 'start';
  if (Math.abs(clickX - endX) < loopHandlePx) return 'end';
  if (clickX > startX + loopHandlePx && clickX < endX - loopHandlePx) return 'body';
  return null;
}
