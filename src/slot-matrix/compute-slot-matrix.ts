import type { Slot, SlotMatrix, SubBlockRange, LayoutMode } from './slot-matrix.types';
import {
  computeLineHeight,
  computeSlotY,
  computeTotalHeight,
  computeOffsetY,
  computeSlotId,
  parseBracketedParts,
  DEFAULT_SLOT_GAP,
  DEFAULT_INTER_BLOCK_GAP,
  MAX_SUB_BLOCK_LINES,
} from './slot-matrix.utils';
import {
  getBlockFontSize,
  createSubBlocks,
  getActiveSubBlockIndex,
} from '../utils/block-utils';
import { getCanonicalBlockColor } from '../structure/block-colors';
import { TextBlock } from '../stores/blocks.store';

// ═══════════════════════════════════════════════════
// PARAMS
// ═══════════════════════════════════════════════════

export interface ComputeSlotMatrixParams {
  displayBlock: TextBlock;
  activeLineIndex: number;
  lines: string[];
  fontScale: number;
  nextBlock?: TextBlock;
  loopStartLine?: number | null;
  loopEndLine?: number | null;
  gapPx?: number;
  interBlockGap?: number;
  maxSubBlockLines?: number;
  layoutMode?: LayoutMode;
}

// ═══════════════════════════════════════════════════
// COMPUTE SLOT MATRIX
// ═══════════════════════════════════════════════════

export function computeSlotMatrix(params: ComputeSlotMatrixParams): SlotMatrix {
  const {
    displayBlock,
    activeLineIndex,
    lines,
    fontScale,
    nextBlock,
    loopStartLine,
    loopEndLine,
    gapPx = DEFAULT_SLOT_GAP,
    interBlockGap = DEFAULT_INTER_BLOCK_GAP,
    maxSubBlockLines = MAX_SUB_BLOCK_LINES,
    layoutMode = 'plate',
  } = params;

  // 1. Подблоки
  const subBlocks = createSubBlocks(displayBlock.lineIndices, maxSubBlockLines, lines);

  // 2. Активный подблок
  const activeSubBlockIndex = getActiveSubBlockIndex(
    activeLineIndex, displayBlock, maxSubBlockLines, lines
  );
  const activeSubBlock = subBlocks[activeSubBlockIndex] ?? subBlocks[0];
  const visibleLineIndices = activeSubBlock.lineIndices;

  // 3. Размеры текущего подблока
  const fontSize = getBlockFontSize(visibleLineIndices.length);
  const lineHeight = computeLineHeight(fontSize, fontScale);
  const slotStep = lineHeight + gapPx;

  // 4. SubBlockRange
  const subBlockRanges: SubBlockRange[] = subBlocks.map((sb, i) => ({
    id: `${displayBlock.id}-${i}`,
    blockId: displayBlock.id,
    subBlockIndex: i,
    startSlotIndex: 0,
    endSlotIndex: sb.lineIndices.length - 1,
    isFirst: sb.isFirst,
    isLast: sb.isLast,
    lineIndices: sb.lineIndices,
  }));

  const activeSubBlockRange = subBlockRanges[activeSubBlockIndex] ?? null;

  // 5. Контент-слоты
  const contentSlots: Slot[] = visibleLineIndices.map((lineIndex, slotIndex) => {
    const slotId = computeSlotId(displayBlock.id, activeSubBlockIndex, slotIndex);
    const text = lines[lineIndex] ?? '';

    return {
      id: slotId,
      blockId: displayBlock.id,
      subBlockIndex: activeSubBlockIndex,
      slotIndex,
      lineIndex,
      text,
      parts: parseBracketedParts(text, slotId),
      y: computeSlotY(slotIndex, lineHeight, gapPx),
      height: lineHeight,
      isEmpty: !text.trim(),
      isPreview: false,
      isLoopStart: loopStartLine != null && lineIndex === loopStartLine,
      isLoopEnd: loopEndLine != null && lineIndex === loopEndLine,
    };
  });

  // 6. Активный слот
  const activeSlotIndex = Math.max(0, visibleLineIndices.indexOf(activeLineIndex));

  // 7. ПС слот — два уровня:
  //    Уровень 1: подблок → подблок (тот же блок, цвет блока)
  //    Уровень 2: блок → блок (следующий блок, цвет следующего блока)
  let previewSlot: Slot | null = null;

  if (!activeSubBlock.isLast && subBlocks[activeSubBlockIndex + 1]) {
    // ── Уровень 1: следующий подблок того же блока ──
    const nextSubBlock = subBlocks[activeSubBlockIndex + 1];
    const psLineIndex = nextSubBlock.lineIndices[0];
    const psText = lines[psLineIndex] ?? '';
    const psEffectiveLines = Math.min(nextSubBlock.lineIndices.length, maxSubBlockLines);
    const psFontSize = getBlockFontSize(psEffectiveLines);
    const psLineHeight = computeLineHeight(psFontSize, fontScale);
    const psSlotIndex = contentSlots.length;

    const lastContentSlot = contentSlots[contentSlots.length - 1];
    const psY = lastContentSlot
      ? lastContentSlot.y + lastContentSlot.height + interBlockGap
      : interBlockGap;

    const previewId = computeSlotId(displayBlock.id, activeSubBlockIndex + 1, 0) + '-preview';

    previewSlot = {
      id: previewId,
      blockId: displayBlock.id,
      subBlockIndex: activeSubBlockIndex + 1,
      slotIndex: psSlotIndex,
      lineIndex: psLineIndex,
      text: psText,
      parts: parseBracketedParts(psText, previewId),
      y: psY,
      height: psLineHeight,
      isEmpty: false,
      isPreview: true,
      previewBlockType: displayBlock.type,
      previewBlockColor: getCanonicalBlockColor(displayBlock.type),
    };

  } else if (nextBlock && nextBlock.lineIndices.length > 0) {
    // ── Уровень 2: следующий блок ──
    const psLineIndex = nextBlock.lineIndices[0];
    const psText = lines[psLineIndex] ?? '';
    const psFontSize = getBlockFontSize(
      Math.min(nextBlock.lineIndices.length, maxSubBlockLines)
    );
    const psLineHeight = computeLineHeight(psFontSize, fontScale);
    const psSlotIndex = contentSlots.length;

    const lastContentSlot = contentSlots[contentSlots.length - 1];
    const psY = lastContentSlot
      ? lastContentSlot.y + lastContentSlot.height + interBlockGap
      : interBlockGap;

    const previewId = computeSlotId(nextBlock.id, 0, 0) + '-preview';

    previewSlot = {
      id: previewId,
      blockId: nextBlock.id,
      subBlockIndex: 0,
      slotIndex: psSlotIndex,
      lineIndex: psLineIndex,
      text: psText,
      parts: parseBracketedParts(psText, previewId),
      y: psY,
      height: psLineHeight,
      isEmpty: false,
      isPreview: true,
      previewBlockType: nextBlock.type,
      previewBlockColor: getCanonicalBlockColor(nextBlock.type),
    };
  }

  // 8. Собрать все слоты
  const allSlots = previewSlot ? [...contentSlots, previewSlot] : contentSlots;

  // 9. Итоговые вычисления
  const contentHeight = computeTotalHeight(
    visibleLineIndices.length, lineHeight, gapPx
  );
  const totalHeight = previewSlot
    ? previewSlot.y + previewSlot.height
    : contentHeight;

  // Центрируем по КОНТЕНТУ, не по ПС
  const offsetY = computeOffsetY(
    activeSlotIndex, slotStep, lineHeight, contentHeight
  );

  const key = `${displayBlock.id}-${activeSubBlockIndex}-${fontScale}-${fontSize}`;

  return {
    key,
    slots: allSlots,
    lineHeight,
    gapPx,
    slotStep,
    contentHeight,
    totalHeight,
    activeSlotIndex,
    previewSlotIndex: previewSlot ? contentSlots.length : -1,
    offsetY,
    layoutMode,
    interBlockGap,
    subBlocks: subBlockRanges,
    activeSubBlock: activeSubBlockRange,
  };
}
