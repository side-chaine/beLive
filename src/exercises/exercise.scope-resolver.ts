import { getBlockTimeRange } from '../utils/block-time-range';
import type { ExerciseScope } from './exercise.types';

interface MarkerLike {
  lineIndex: number;
  time: number;
}

export function resolveExerciseScope(
  scope: ExerciseScope,
  blocks: Array<{ id: string; lineIndices: number[] }>,
  markers: MarkerLike[],
  trackDuration?: number,
): { startTime: number; endTime: number } | null {
  const block = blocks.find((b) => b.id === scope.blockId);
  if (!block) return null;

  const blockRange = getBlockTimeRange(block, markers as any, trackDuration);
  if (!blockRange) return null;

  if (!scope.lineRange) return blockRange;

  const [startOffset, endOffset] = scope.lineRange;
  const lineIndices = block.lineIndices ?? [];
  const startLineGlobal = lineIndices[startOffset];
  const endLineGlobal = lineIndices[endOffset];

  if (startLineGlobal === undefined) return blockRange;

  const startMarker = markers.find((m) => m.lineIndex === startLineGlobal);
  const endMarker =
    endLineGlobal !== undefined
      ? markers.find((m) => m.lineIndex > endLineGlobal)
      : null;

  return {
    startTime: startMarker?.time ?? blockRange.startTime,
    endTime: endMarker?.time ?? blockRange.endTime,
  };
}
