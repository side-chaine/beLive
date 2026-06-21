import type { Marker } from '../stores/markers.store';

export interface BlockTimeRange {
  startTime: number;
  endTime: number;
}

export interface BlockLike {
  lineIndices: number[];
  id?: string;
}

/**
 * Compute the time range for a block from its line indices and markers.
 * 
 * @param block - block with lineIndices array
 * @param markers - sorted marker array
 * @param trackDuration - total track duration (fallback for last block)
 * @returns BlockTimeRange or null if no start marker found
 */
export function getBlockTimeRange(
  block: BlockLike,
  markers: Marker[],
  trackDuration?: number,
): BlockTimeRange | null {
  if (!block.lineIndices.length || !markers.length) return null;

  const firstLine = Math.min(...block.lineIndices);
  const lastLine  = Math.max(...block.lineIndices);

  // Только M1 для startMarker
  const startMarker = markers.find(
    m => m.markerType !== 'M2' && m.lineIndex === firstLine
  );
  if (!startMarker) return null;

  let endTime: number | undefined;

  // Приоритет 1: M2 closing marker для этого блока
  if (block.id) {
    const m2 = markers.find(
      m => m.markerType === 'M2' && m.afterBlockId === block.id
    );
    if (m2 && m2.time >= startMarker.time) {
      // M2 clamp: не должен быть за концом трека
      if (trackDuration && m2.time > trackDuration) {
        console.warn(`[M2] time ${m2.time}s > trackDuration ${trackDuration}s — clamping`);
        endTime = trackDuration;
      } else {
        endTime = m2.time;
      }
    } else if (m2) {
      console.warn(`[M2] Invalid position: ${m2.time}s < start ${startMarker.time}s — ignoring`);
    }
  }

  // Приоритет 2: Первый M1 после последней строки (next block start = this block end)
  // This is the default closing mechanism — works when no M2 is placed
  if (endTime === undefined) {
    const nextM1 = markers.find(
      m => m.markerType !== 'M2' && m.lineIndex > lastLine
    );
    if (nextM1) endTime = nextM1.time;
  }

  // Приоритет 3: Fallback
  if (endTime === undefined) {
    endTime = trackDuration != null
      ? Math.min(startMarker.time + 30, trackDuration)
      : startMarker.time + 30;
  }

  return { startTime: startMarker.time, endTime };
}

/**
 * Compute merged time range for multiple blocks.
 */
export function getMergedBlockTimeRange(
  blocks: BlockLike[],
  markers: Marker[],
  trackDuration?: number,
): BlockTimeRange | null {
  let minStart = Infinity;
  let maxEnd = -Infinity;

  for (const block of blocks) {
    const range = getBlockTimeRange(block, markers, trackDuration);
    if (!range) continue;
    if (range.startTime < minStart) minStart = range.startTime;
    if (range.endTime > maxEnd) maxEnd = range.endTime;
  }

  if (minStart === Infinity) return null;
  return { startTime: minStart, endTime: maxEnd };
}

/**
 * Check if a block has valid timing for takes recording.
 * A block is takes-ready when it has a computable time range
 * with meaningful duration (>= 1 second).
 *
 * @param block - block with lineIndices
 * @param markers - sorted marker array
 * @param trackDuration - total track duration
 * @returns true if block can be used for recording
 */
export function isBlockTakesReady(
  block: BlockLike,
  markers: Marker[],
  trackDuration?: number,
): boolean {
  const range = getBlockTimeRange(block, markers, trackDuration);
  if (!range) return false;
  if (range.endTime <= range.startTime) return false;
  if (range.endTime - range.startTime < 1) return false;
  return true;
}
