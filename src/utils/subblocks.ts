// subblocks.ts — единая точка вплавки BL-050-full в UI-слой.
//
// Пять потребителей (slot-matrix ×2, WagonTrain, BlockScenesModal,
// RehearsalLyrics, loop.store) зовут `createSubBlocksSmart` вместо legacy
// `createSubBlocks`. Разделение по слоям: square-full → block-utils,
// subblocks → square-full, UI → subblocks. Цикла нет.
//
// Если у блока нет logicalLines — движок идёт по LRC-домену (rule D exact/
// near), иначе — rule D на логических строках + логический→LRC маппинг.

import type { SubBlock } from './block-utils';
import {
  createSubBlocksFull,
  type SquareFullResult,
} from '../blocks/c36/square-full';

/** Минимальный контракт блока, нужный сплиттеру. */
export interface SubBlockSource {
  lineIndices: number[];
  /** Логические (Genius) строки — опционально (К1). */
  logicalLines?: readonly string[];
  /** logical index → локальный индекс в lineIndices. */
  logicalToLrc?: readonly number[];
}

export interface SmartSubBlocks {
  blocks: SubBlock[];
  result: SquareFullResult;
}

/**
 * Подблоки блока по полному движку (BL-050-full).
 * Никогда не бросает: любой сбой сплиттера = FALLBACK computeBalancedSplit.
 */
export function createSubBlocksSmart(
  source: SubBlockSource,
  lines: readonly string[],
  maxLines = 6,
): SmartSubBlocks {
  const lineIndices = source.lineIndices;
  if (lineIndices.length === 0) {
    return {
      blocks: [],
      result: {
        mode: 'fallback', units: [], roman: [], conf: 0, tRatio: null,
        groupSize: 0, copies: 0, guard: 'empty',
      },
    };
  }

  const hasLogical =
    !!source.logicalLines && source.logicalLines.length > 0 &&
    !!source.logicalToLrc && source.logicalToLrc.length === source.logicalLines.length;

  return createSubBlocksFull(
    lineIndices,
    [...lines],
    hasLogical
      ? { logicalLines: source.logicalLines, logicalToLrc: source.logicalToLrc }
      : {},
    maxLines,
  );
}

/** Только подблоки — для call-site'ов, которым контур §12.6 не нужен. */
export function subBlocksOf(
  source: SubBlockSource,
  lines: readonly string[],
  maxLines = 6,
): SubBlock[] {
  return createSubBlocksSmart(source, lines, maxLines).blocks;
}
