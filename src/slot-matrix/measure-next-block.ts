import type { TextBlock } from '../stores/blocks.store';
import { getBlockFontSize } from '../utils/block-utils';
import { MAX_SUB_BLOCK_LINES } from './slot-matrix.utils';

export interface NextBlockMeasurement {
  /** Реальная высота slotContainer следующего блока (px), ВКЛЮЧАЯ ПС + gaps.
   *  ИСПОЛЬЗОВАТЬ для travel target — flexbox центрирует по ПОЛНОЙ высоте.
   *
   *  ПОЧЕМУ containerHeight, а НЕ contentHeight:
   *  После switch ПС остаётся в grid (opacity:0.3, idle)
   *  → slotContainer.height = content + ПС + gaps
   *  → flexbox центрирует по ПОЛНОЙ высоте (включая ПС)
   *  → firstLine.top = blockRect.top + padding + (available - containerHeight) / 2
   *
   *  Если использовать contentHeight — промах до 38px! */
  containerHeight: number;
  /** Высота контента БЕЗ ПС строки (px).
   *  ПРИБЛИЖЕНИЕ — вычисляется вычитанием оценки ПС-части из containerHeight.
   *  Не учитывает переносы в ПС-строке. Для точного значения нужен 2-й reflow.
   *  ТОЛЬКО для диагностики — НЕ использовать в travel formula. */
  contentHeight: number;
  /** Смещение от верха контейнера до первой строки (px).
   *  В slot mode (align-content: center, intrinsic height) = обычно 0. */
  firstLineOffset: number;
  /** ID блока который был измерён. Staleness guard — если не совпадает
   *  с текущим nextBlock.id → measurement устарел, использовать fallback. */
  nextBlockId: string;
}

/**
 * Измеряет реальную высоту slotContainer следующего блока
 * через off-screen shadow элемент с теми же CSS-правилами.
 *
 * КРИТИЧЕСКИ ВАЖНО:
 * ─────────────────
 * - padding: 0 на строках (slot mode!)
 * - Включает ПС-строку от nextNextBlock (ПС всегда в grid)
 * - ПС margin-top: 8px (interBlockGap - slotGap = 24 - 16)
 * - font-size контента ≠ font-size ПС (разные блоки)
 * - font-family: inherit — совпадение с реальным DOM
 * - ОДИН REFLOW: все rows добавляются ДО appendChild
 *
 * gridTemplateRows: НЕ добавляется пока BUG-fontScale-inline не пофиксен.
 * При fontScale ≠ 1.0 minmax(Xpx, auto) ≠ CSS line-height → неточный shadow.
 * При fontScale = 1.0 minmax(Xpx, auto) = CSS line-height → точно.
 *
 * ВЫЗЫВАТЬ ТОЛЬКО вне rAF — один раз при смене shouldGrowPreview.
 */
export function measureNextBlock(params: {
  nextBlock: TextBlock;
  nextNextBlock: TextBlock | null;
  lines: string[];
  containerWidth: number;
  gapPx?: number;
  interBlockGapPx?: number;
  maxSubBlockLines?: number;
}): NextBlockMeasurement {
  const {
    nextBlock,
    nextNextBlock,
    lines,
    containerWidth,
    gapPx = 16,
    interBlockGapPx = 24,
    maxSubBlockLines = MAX_SUB_BLOCK_LINES,
  } = params;

  const effectiveLineCount = Math.min(nextBlock.lineIndices.length, maxSubBlockLines);
  const contentFontSize = getBlockFontSize(effectiveLineCount);

  // ── Shadow container: точная копия .slotContainer CSS ──
  const shadow = document.createElement('div');
  shadow.setAttribute('data-shadow-measure', 'true');
  shadow.style.cssText = [
    'position: fixed',
    'left: -9999px',
    'top: 0',
    'visibility: hidden',
    'pointer-events: none',
    'display: grid',
    `gap: ${gapPx}px`,
    'align-content: center',
    'justify-items: center',
    `width: ${containerWidth}px`,
    `font-size: ${contentFontSize}`,
    'font-family: inherit',
    'line-height: 1.25',
    'white-space: normal',
    'overflow-wrap: break-word',
    'word-break: normal',
  ].join('; ');

  // ── Content rows из nextBlock ──
  const visibleIndices = nextBlock.lineIndices.slice(0, maxSubBlockLines);
  for (const lineIndex of visibleIndices) {
    const row = document.createElement('div');
    row.textContent = lines[lineIndex] ?? '';
    row.style.cssText = [
      'padding: 0',
      'line-height: 1.25',
      'white-space: normal',
      'overflow-wrap: break-word',
      'word-break: normal',
    ].join('; ');
    shadow.appendChild(row);
  }

  // ── ПС row из nextNextBlock (добавить ДО appendChild — один reflow) ──
  let psAddedHeight = 0;
  if (nextNextBlock && nextNextBlock.lineIndices.length > 0) {
    const psLineIndex = nextNextBlock.lineIndices[0];
    const psEffectiveLines = Math.min(nextNextBlock.lineIndices.length, maxSubBlockLines);
    const psFontSize = getBlockFontSize(psEffectiveLines);
    // ПС margin-top = interBlockGap - slotGap = 24 - 16 = 8px
    // Grid gap (16px) + margin (8px) = 24px total (подтверждено CSS Grid spec)
    const psMarginTop = Math.max(0, interBlockGapPx - gapPx);

    const psRow = document.createElement('div');
    psRow.textContent = lines[psLineIndex] ?? '';
    psRow.style.cssText = [
      'padding: 0',
      'line-height: 1.25',
      'white-space: normal',
      'overflow-wrap: break-word',
      'word-break: normal',
      `margin-top: ${psMarginTop}px`,
      `font-size: ${psFontSize}`,
    ].join('; ');
    shadow.appendChild(psRow);

    // Приближение ПС высоты для вычисления contentHeight
    // Не учитывает переносы в ПС строке — для диагностики достаточно
    const psLineHeight = parseFloat(psFontSize) * 16 * 1.25;
    psAddedHeight = gapPx + psMarginTop + psLineHeight;
  }

  // ── ОДИН REFLOW: измеряем containerHeight (контент + ПС) ──
  document.body.appendChild(shadow);
  try {
    const containerRect = shadow.getBoundingClientRect();
    const firstRow = shadow.firstElementChild;
    const firstRowRect = firstRow?.getBoundingClientRect() ?? null;

    // contentHeight = containerHeight - ПС часть (приближение!)
    const contentHeight = Math.max(0, containerRect.height - psAddedHeight);

    return {
      containerHeight: containerRect.height,
      contentHeight,
      firstLineOffset: firstRowRect
        ? firstRowRect.top - containerRect.top
        : 0,
      nextBlockId: nextBlock.id,
    };
  } finally {
    if (shadow.parentNode) {
      shadow.parentNode.removeChild(shadow);
    }
  }
}
