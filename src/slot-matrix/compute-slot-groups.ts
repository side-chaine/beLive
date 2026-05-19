import type { SlotGroup, Slot, SubBlockRange } from './slot-matrix.types';
import type { TextBlock } from '../stores/blocks.store';
import {
  computeLineHeight,
  computeSlotY,
  computeTotalHeight,
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

// ═══════════════════════════════════════
// PARAMS
// ═══════════════════════════════════════

export interface ComputeSlotGroupsParams {
  displayBlock: TextBlock;
  activeLineIndex: number;
  lines: string[];
  fontScale: number;
  nextBlock?: TextBlock;
  blockType: string;
  loopStartLine?: number | null;
  loopEndLine?: number | null;
  gapPx?: number;
  interBlockGap?: number;
  maxSubBlockLines?: number;
}

// ═══════════════════════════════════════
// COMPUTE SLOT GROUPS
// ═══════════════════════════════════════

/** Вычисляет ВСЕ SlotGroup для блока.
 *  Возвращает массив групп — по одной на подблок.
 *  Активная группа помечена isActive=true.
 *  ПС добавляется к активной группе как previewSlot.
 *  Позиции (x, y, width) = 0, заполняются в Phase 3.3. */
export function computeSlotGroups(params: ComputeSlotGroupsParams): SlotGroup[] {
  const {
    displayBlock,
    activeLineIndex,
    lines,
    fontScale,
    nextBlock,
    blockType,
    loopStartLine,
    loopEndLine,
    gapPx = DEFAULT_SLOT_GAP,
    interBlockGap = DEFAULT_INTER_BLOCK_GAP,
    maxSubBlockLines = MAX_SUB_BLOCK_LINES,
  } = params;

  // 1. Подблоки (логическое разбиение)
  const subBlocks = createSubBlocks(displayBlock.lineIndices, maxSubBlockLines, lines);
  
  // 2. Активный подблок
  const activeSubBlockIndex = getActiveSubBlockIndex(
    activeLineIndex, displayBlock, maxSubBlockLines, lines
  );

  // 3. Цвет блока
  const blockColor = getCanonicalBlockColor(blockType);

  // 4. Вычислить группу для каждого подблока
  const groups: SlotGroup[] = subBlocks.map((subBlock, subBlockIndex) => {
    const isActive = subBlockIndex === activeSubBlockIndex;
    const visibleLineIndices = subBlock.lineIndices;
    
    // Font size зависит от количества строк в подблоке
    const fontSize = getBlockFontSize(visibleLineIndices.length);
    const lineHeight = computeLineHeight(fontSize, fontScale);
    
    // Контент-слоты
    const contentSlots: Slot[] = visibleLineIndices.map((lineIndex, slotIndex) => {
      const slotId = computeSlotId(displayBlock.id, subBlockIndex, slotIndex);
      const text = lines[lineIndex] ?? '';
      
      return {
        id: slotId,
        blockId: displayBlock.id,
        subBlockIndex,
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

    // Активный слот
    const activeSlotIndex = Math.max(
      -1, visibleLineIndices.indexOf(activeLineIndex)
    );

    // SubBlockRange
    const subBlockRange: SubBlockRange = {
      id: `${displayBlock.id}-${subBlockIndex}`,
      blockId: displayBlock.id,
      subBlockIndex,
      startSlotIndex: 0,
      endSlotIndex: visibleLineIndices.length - 1,
      isFirst: subBlock.isFirst,
      isLast: subBlock.isLast,
    };

    // Grid template rows
    const gridTemplateRows = contentSlots
      .filter(s => !s.isEmpty)
      .map(s => `minmax(${s.height}px, auto)`)
      .join(' ');

    // Высоты
    const contentHeight = computeTotalHeight(
      visibleLineIndices.length, lineHeight, gapPx
    );

    // ПС — только для активной группы
    let previewSlot: Slot | null = null;
    let totalHeight = contentHeight;
    
    if (isActive && nextBlock && nextBlock.lineIndices.length > 0) {
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
      
      totalHeight = psY + psLineHeight;
    }

    return {
      id: `group-${displayBlock.id}-${subBlockIndex}`,
      blockId: displayBlock.id,
      subBlockIndex,
      slots: contentSlots,
      previewSlot,
      subBlock: subBlockRange,
      fontSize,
      blockType,
      blockColor,
      gridTemplateRows,
      contentHeight,
      totalHeight,
      activeSlotIndex,
      isPreview: false,
      isActive,
      x: 0,
      y: 0,
      width: 0,
      height: totalHeight,
      opacity: isActive ? 1.0 : 0.6,
    };
  });

  return groups;
}
