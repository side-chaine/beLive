import { useMemo } from 'react';
import type { SlotMatrix, SubBlockRange, SlotGroup } from './slot-matrix.types';
import { computeSlotMatrix } from './compute-slot-matrix';
import { computeOffsetY } from './slot-matrix.utils';
import { MAX_SUB_BLOCK_LINES } from './slot-matrix.utils';
import { getActiveBlock, createSubBlocks, getBlockFontSize } from '../utils/block-utils';
import { getCanonicalBlockColor } from '../structure/block-colors';
import { useLyricsStore } from '../stores/lyrics.store';
import { useBlocksStore } from '../stores/blocks.store';
import { useTextStyleStore } from '../stores/textStyle.store';
import { useLoopStore } from '../stores/loop.store';
import type { TextBlock } from '../stores/blocks.store';

/** Gap для Grid режима — компенсирует убранный .line padding (4+8+4=16) */
const GRID_GAP = 16;

function getNextBlock(
  activeBlock: TextBlock | null,
  blocks: TextBlock[]
): TextBlock | undefined {
  if (!activeBlock || !blocks.length) return undefined;
  const idx = blocks.findIndex(b => b.id === activeBlock.id);
  if (idx < 0 || idx >= blocks.length - 1) return undefined;
  return blocks[idx + 1];
}

export function useSlotMatrix(): {
  matrix: SlotMatrix | null;
  displayBlock: TextBlock | null;
  nextBlock: TextBlock | undefined;
  subBlocks: SubBlockRange[];
  activeSubBlockIndex: number;
  offsetY: number;
  gridTemplateRows: string | undefined;
  visibleLineIndices: number[];
  isLastLineInSubBlock: boolean;
  activeSlotGroup: SlotGroup | null;
} {
  const lines = useLyricsStore(s => s.lines);
  const activeLineIndex = useLyricsStore(s => s.activeLineIndex);
  const blocks = useBlocksStore(s => s.blocks);
  const fontScale = useTextStyleStore(s => s.fontScale);
  const isLooping = useLoopStore(s => s.isLooping);
  const loopStartLine = useLoopStore(s => s.loopStartLine);
  const loopEndLine = useLoopStore(s => s.loopEndLine);

  // Текущий блок
  const displayBlock = useMemo(
    () => getActiveBlock(activeLineIndex, blocks),
    [activeLineIndex, blocks]
  );

  // Следующий блок
  const nextBlock = useMemo(
    () => getNextBlock(displayBlock, blocks),
    [displayBlock, blocks]
  );

  // Активный подблок — зависит от activeLineIndex
  const activeSubBlockIndex = useMemo(() => {
    if (!displayBlock) return 0;
    const subs = createSubBlocks(displayBlock.lineIndices, MAX_SUB_BLOCK_LINES, lines);
    for (let i = 0; i < subs.length; i++) {
      if (subs[i].lineIndices.includes(activeLineIndex)) return i;
    }
    return 0;
  }, [displayBlock, activeLineIndex]);

  // Ключ мемоизации — пересчёт ТОЛЬКО при смене подблока/fontScale
  const matrixKey = displayBlock
    ? `${displayBlock.id}-${activeSubBlockIndex}-${fontScale}`
    : '';

  // Матрица — НЕ зависит от activeLineIndex напрямую
  const matrix = useMemo(() => {
    if (!displayBlock || lines.length === 0) return null;
    return computeSlotMatrix({
      displayBlock,
      activeLineIndex,
      lines,
      fontScale,
      nextBlock: nextBlock ?? undefined,
      loopStartLine: isLooping ? loopStartLine : null,
      loopEndLine: isLooping ? loopEndLine : null,
      gapPx: GRID_GAP,
    });
    // matrixKey заменяет displayBlock + activeSubBlockIndex + fontScale
    // lines, nextBlock, loop — могут менять матрицу
  }, [matrixKey, lines, nextBlock, isLooping, loopStartLine, loopEndLine, activeLineIndex]);

  // SubBlockRange — берём из matrix (единственный источник)
  const subBlocks: SubBlockRange[] = matrix?.subBlocks ?? [];

  /** CSS Grid template rows — minmax() для роста при переносе текста */
  const gridTemplateRows = useMemo(() => {
    if (!matrix) return undefined;
    return matrix.slots
      .filter(s => !s.isEmpty)
      .map(s => `minmax(${s.height}px, auto)`)
      .join(' ');
  }, [matrix]);

  const offsetY = matrix ? matrix.offsetY : 0;

  /** Видимые lineIndex из matrix (единственный источник) */
  const visibleLineIndices = useMemo(() => {
    if (!matrix) return [];
    return matrix.slots
      .filter(s => !s.isPreview && !s.isEmpty)
      .map(s => s.lineIndex);
  }, [matrix]);

  /** Последняя строка в подблоке? (из matrix, не из локального SubBlock) */
  const isLastLineInSubBlock = useMemo(() => {
    if (!matrix || activeLineIndex < 0) return false;
    const contentSlots = matrix.slots.filter(s => !s.isPreview && !s.isEmpty);
    if (contentSlots.length === 0) return false;
    const lastSlot = contentSlots[contentSlots.length - 1];
    return lastSlot.lineIndex === activeLineIndex;
  }, [matrix, activeLineIndex]);

  /** Активная SlotGroup — деривация из matrix (O(1), ZERO duplication).
   *  Fix #1: fontSize от allContentSlots.length (включая empty),
   *    совпадает с computeSlotMatrix logic.
   *  Fix #2: activeSlotIndex = -1 если строка не найдена,
   *    не 0 (Math.max(0, indexOf) в matrix — неверный fallback).
   *  Fix #3: gridTemplateRows вычисляется из slots + previewSlot,
   *    не из замыкания (которое включает ПС в matrix.slots). */
  const activeSlotGroup = useMemo(() => {
    if (!matrix || !displayBlock) return null;

    // Все контент-слоты (включая empty — для правильного fontSize)
    const allContentSlots = matrix.slots.filter(s => !s.isPreview);
    // Непустые контент-слоты (для рендера и gridTemplateRows)
    const nonEmptySlots = allContentSlots.filter(s => !s.isEmpty);
    // ПС слот (отдельно от контент-слотов)
    const previewSlot = matrix.previewSlotIndex >= 0
      ? matrix.slots[matrix.previewSlotIndex] ?? null
      : null;
    const activeSubBlock = matrix.activeSubBlock;

    if (!activeSubBlock) return null;

    // FIX #1: fontSize от ВСЕХ контент-слотов (включая empty)
    const fontSize = getBlockFontSize(allContentSlots.length);
    const blockColor = getCanonicalBlockColor(displayBlock.type);

    // FIX #2: activeSlotIndex = -1 если activeLineIndex не в подблоке
    const activeSlotIndex = Math.max(-1,
      allContentSlots.findIndex(s => s.lineIndex === activeLineIndex)
    );

    // FIX #3: gridTemplateRows = slots rows + preview row (если есть)
    // Точное соответствие: grid rows count = nonEmptySlots + (previewSlot ? 1 : 0)
    const groupGridRows = [
      ...nonEmptySlots.map(s => `minmax(${s.height}px, auto)`),
      ...(previewSlot ? [`minmax(${previewSlot.height}px, auto)`] : []),
    ].join(' ');

    return {
      id: `group-${displayBlock.id}-${activeSubBlock.subBlockIndex}`,
      blockId: displayBlock.id,
      subBlockIndex: activeSubBlock.subBlockIndex,
      slots: nonEmptySlots,
      previewSlot,
      subBlock: activeSubBlock,
      fontSize,
      blockType: displayBlock.type,
      blockColor,
      gridTemplateRows: groupGridRows,
      contentHeight: matrix.contentHeight,
      totalHeight: matrix.totalHeight,
      activeSlotIndex,
      isPreview: false,
      isActive: true,
      x: 0,
      y: 0,
      width: 0,
      height: matrix.totalHeight,
      opacity: 1.0,
    } as SlotGroup;
  }, [matrix, displayBlock, activeLineIndex]);

  return { 
    matrix, 
    displayBlock, 
    nextBlock, 
    subBlocks, 
    activeSubBlockIndex, 
    offsetY,
    gridTemplateRows,
    visibleLineIndices,
    isLastLineInSubBlock,
    activeSlotGroup,
  };
}
