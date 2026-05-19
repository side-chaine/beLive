import { useMemo } from 'react';
import type { Marker } from '../stores/markers.store';
import type { TextBlock } from '../stores/blocks.store';
import type { TransitionZone } from '../types/persistence.types';
import { useMarkersStore } from '../stores/markers.store';
import { useBlocksStore } from '../stores/blocks.store';

/**
 * Compute transition zones between blocks.
 *
 * A transition zone is a gap between blocks where:
 * - gapDuration > avgLineGap × 1.5  AND  gapDuration > 2.0s
 * - OR it's the last block (track end)
 *
 * Used to determine where M2 closing markers should be placed.
 */
export function computeTransitionZones(
  markers: Marker[],
  blocks: TextBlock[],
  trackDuration?: number,
): TransitionZone[] {
  if (!blocks.length || !markers.length) return [];

  const m1 = markers.filter(m => m.markerType !== 'M2');
  const m2 = markers.filter(m => m.markerType === 'M2');

  // Sort blocks by their first line index
  const sorted = [...blocks].sort(
    (a, b) => Math.min(...a.lineIndices) - Math.min(...b.lineIndices)
  );

  const zones: TransitionZone[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const blockA = sorted[i];
    const blockB = sorted[i + 1] ?? null;

    // Guard: пустые lineIndices → Math.max(...[]) = -Infinity
    if (!blockA.lineIndices.length) continue;
    if (blockB && !blockB.lineIndices.length) continue;

    const lastLineA   = Math.max(...blockA.lineIndices);
    const lastMarkerA = m1.find(m => m.lineIndex === lastLineA);
    if (!lastMarkerA) continue;

    // Avg gap внутри блока A
    const blockAMarkers = blockA.lineIndices
      .map(li => m1.find(m => m.lineIndex === li))
      .filter((m): m is Marker => !!m)
      .sort((a, b) => a.time - b.time);

    let avgGap = 3.5; // default fallback
    if (blockAMarkers.length >= 2) {
      const gaps = blockAMarkers
        .slice(1)
        .map((m, j) => m.time - blockAMarkers[j].time);
      avgGap = gaps.reduce((s, g) => s + g, 0) / gaps.length;
    }

    let toTime: number | null = null;
    let gapDuration           = -1;
    let isTrackEnd            = false;
    let needsZone             = false;

    if (blockB) {
      // Guard для blockB тоже (уже проверено выше, но для безопасности)
      if (blockB.lineIndices.length) {
        const firstLineB   = Math.min(...blockB.lineIndices);
        const firstMarkerB = m1.find(m => m.lineIndex === firstLineB);
        if (firstMarkerB) {
          toTime      = firstMarkerB.time;
          gapDuration = toTime - lastMarkerA.time;
          needsZone = gapDuration > avgGap * 1.5 && gapDuration > 2.0;
        }
      }
    } else {
      // Последний блок — всегда transition zone
      isTrackEnd  = true;
      toTime      = trackDuration ?? null;
      gapDuration = toTime !== null ? toTime - lastMarkerA.time : -1;
      needsZone   = true;
    }

    if (!needsZone) continue;

    const existingM2 = m2.find(m => m.afterBlockId === blockA.id);

    zones.push({
      afterBlockId:  blockA.id,
      beforeBlockId: blockB?.id ?? null,
      fromTime:      lastMarkerA.time,
      toTime,
      gapDuration,
      avgLineGap:    avgGap,
      suggestedTime: lastMarkerA.time + avgGap * 1.2,
      hasM2:         !!existingM2,
      m2Time:        existingM2?.time,
      isTrackEnd,
    });
  }

  return zones;
}

/**
 * React hook — reactive transition zones, computed via useMemo.
 * No new Zustand store needed.
 */
export function useTransitionZones(): TransitionZone[] {
  const markers  = useMarkersStore(s => s.markers);
  const blocks   = useBlocksStore(s => s.blocks);
  const duration = useMarkersStore(s => s.trackDuration);

  return useMemo(
    () => computeTransitionZones(markers, blocks, duration || undefined),
    [markers, blocks, duration]
  );
}
