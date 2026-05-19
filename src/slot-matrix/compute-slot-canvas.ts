import type { SlotMatrix, SlotGroup, SlotCanvas, LayoutMode, Slot, SubBlockRange } from './slot-matrix.types';
import type { TextBlock } from '../stores/blocks.store';
import {
  computeLineHeight,
  computeSlotId,
  parseBracketedParts,
  DEFAULT_INTER_BLOCK_GAP,
  MAX_SUB_BLOCK_LINES,
} from './slot-matrix.utils';
import {
  getBlockFontSize,
} from '../utils/block-utils';
import { getCanonicalBlockColor } from '../structure/block-colors';

// ═══════════════════════════════════════
// PARAMS
// ═══════════════════════════════════════

export interface ComputeSlotCanvasParams {
  matrix: SlotMatrix;
  activeSlotGroup: SlotGroup;
  nextBlock?: TextBlock;
  lines: string[];
  fontScale: number;
  layoutMode?: LayoutMode;
  /** Viewport ширина (px) — ОБЯЗАТЕЛЬНЫЙ, из DOM */
  viewportWidth: number;
  /** Viewport высота: header→dock (px) — ОБЯЗАТЕЛЬНЫЙ, из DOM */
  viewportHeight: number;
  /** Ширина плашки в % (80) — из plateStore */
  plateWidth: number;
  /** Масштаб (1.0 = normal) */
  zoom?: number;
  /** ПС grow state — из shouldGrowPreview */
  shouldGrowPreview?: boolean;
  /** Gap между слотами (px) — из matrix.gapPx */
  gapPx?: number;
  /** Gap между контентом и ПС (px) */
  interBlockGap?: number;
  /** Max строк в подблоке */
  maxSubBlockLines?: number;
}

// ═══════════════════════════════════════
// COMPUTE SLOT CANVAS
// ═══════════════════════════════════════

/** Вычисляет позиции и размеры всех групп слотов на канве.
 *  Чистая функция — zero side effects, zero DOM access.
 *  Phase 3.5+: вызывается из useSlotCanvas() хука. */
export function computeSlotCanvas(params: ComputeSlotCanvasParams): SlotCanvas {
  const {
    matrix,
    activeSlotGroup,
    nextBlock,
    lines,
    fontScale,
    layoutMode = 'plate',
    viewportWidth,
    viewportHeight,
    plateWidth,
    zoom = 1.0,
    shouldGrowPreview = false,
    gapPx = 16,
    interBlockGap = DEFAULT_INTER_BLOCK_GAP,
    maxSubBlockLines = MAX_SUB_BLOCK_LINES,
  } = params;

  const groups: SlotGroup[] = [];

  // ═══ 1. Active group — заполнить позицию ═══
  const scaledHeight = activeSlotGroup.totalHeight * zoom;
  const widthPx = viewportWidth * (plateWidth / 100);

  // Y = центр viewport - половина высоты контента
  // БЕЗ matrix.offsetY — canvas вычисляет позицию с нуля
  const activeY = (viewportHeight / 2) - (scaledHeight / 2);

  groups.push({
    ...activeSlotGroup,
    x: 0,  // центрирование через CSS (left: 50%, transform)
    y: activeY,
    width: widthPx,
    height: scaledHeight,
    opacity: 1.0,
  });

  // ═══ 2. Preview group (ПС следующего блока) ═══
  if (nextBlock && nextBlock.lineIndices.length > 0) {
    const activeGroupBottom = activeY + scaledHeight;
    const previewGroup = computePreviewGroup({
      nextBlock,
      lines,
      fontScale,
      zoom,
      activeGroupBottom,
      widthPx,
      shouldGrowPreview,
      interBlockGap,
      maxSubBlockLines,
      gapPx,
    });

    if (previewGroup) {
      groups.push(previewGroup);
    }
  }

  const key = `${activeSlotGroup.id}-${zoom}-${Math.round(viewportWidth)}x${Math.round(viewportHeight)}`;

  return {
    key,
    groups,
    viewportWidth,
    viewportHeight,
    zoom,
    layoutMode,
  };
}

// ═══════════════════════════════════════
// PREVIEW GROUP HELPER
// ═══════════════════════════════════════

interface ComputePreviewGroupParams {
  nextBlock: TextBlock;
  lines: string[];
  fontScale: number;
  zoom: number;
  activeGroupBottom: number;
  widthPx: number;
  shouldGrowPreview: boolean;
  interBlockGap: number;
  maxSubBlockLines: number;
  gapPx: number;
}

/** Вычисляет preview SlotGroup для ПС следующего блока.
 *  Содержит 1 контент-слот (первая строка следующего блока).
 *  Позиция: ниже active group + interBlockGap. */
function computePreviewGroup(params: ComputePreviewGroupParams): SlotGroup | null {
  const {
    nextBlock,
    lines,
    fontScale,
    zoom,
    activeGroupBottom,
    widthPx,
    shouldGrowPreview,
    interBlockGap,
    maxSubBlockLines,
    gapPx,
  } = params;

  const psLineIndex = nextBlock.lineIndices[0];
  const psText = lines[psLineIndex] ?? '';
  const psFontSize = getBlockFontSize(
    Math.min(nextBlock.lineIndices.length, maxSubBlockLines)
  );
  const psLineHeight = computeLineHeight(psFontSize, fontScale);
  const psSlotId = computeSlotId(nextBlock.id, 0, 0);

  // Контент-слот ПС
  const psSlot: Slot = {
    id: psSlotId,
    blockId: nextBlock.id,
    subBlockIndex: 0,
    slotIndex: 0,
    lineIndex: psLineIndex,
    text: psText,
    parts: parseBracketedParts(psText, psSlotId),
    y: 0,
    height: psLineHeight,
    isEmpty: false,
    isPreview: false, // сам слот не preview — группа preview
  };

  // SubBlockRange для ПС группы
  const psSubBlock: SubBlockRange = {
    id: `${nextBlock.id}-0`,
    blockId: nextBlock.id,
    subBlockIndex: 0,
    startSlotIndex: 0,
    endSlotIndex: 0,
    isFirst: true,
    isLast: true,
  };

  const scaledLineHeight = psLineHeight * zoom;
  const previewY = activeGroupBottom + interBlockGap * zoom;

  return {
    id: `preview-${nextBlock.id}-0`,
    blockId: nextBlock.id,
    subBlockIndex: 0,
    slots: [psSlot],
    previewSlot: null,
    subBlock: psSubBlock,
    fontSize: psFontSize,
    blockType: nextBlock.type,
    blockColor: getCanonicalBlockColor(nextBlock.type),
    gridTemplateRows: `minmax(${psLineHeight}px, auto)`,
    contentHeight: psLineHeight,
    totalHeight: psLineHeight,
    activeSlotIndex: -1,
    isPreview: true,
    isActive: false,
    x: 0,
    y: previewY,
    width: widthPx,
    height: scaledLineHeight,
    opacity: shouldGrowPreview ? 0.95 : 0.3,
  };
}
