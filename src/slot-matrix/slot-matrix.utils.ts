import type { SlotPart } from './slot-matrix.types';

// ═══════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════

/** line-height множитель из CSS (.line { line-height: 1.25 }) */
export const LINE_HEIGHT_MULTIPLIER = 1.25;

/** gap между слотами из CSS (.activeBlock { gap: 8px }) */
export const DEFAULT_SLOT_GAP = 8;

/** Расстояние между контентом и ПС (из padding-bottom плашки 24px) */
export const DEFAULT_INTER_BLOCK_GAP = 24;

/** Максимум строк в подблоке (дополненный квадрат = до 6) */
export const MAX_SUB_BLOCK_LINES = 6;

// ═══════════════════════════════════════════════════
// ROOT FONT SIZE CACHE
// ═══════════════════════════════════════════════════

let _rootFontSizeCache: number | null = null;

/** Получить текущий root font size (кэшированный) */
export function getRootFontSize(): number {
  if (_rootFontSizeCache !== null) return _rootFontSizeCache;
  if (typeof document === 'undefined') return 16;
  _rootFontSizeCache = parseFloat(
    getComputedStyle(document.documentElement).fontSize
  ) || 16;
  return _rootFontSizeCache;
}

/** Сбросить кэш rootFontSize */
export function resetRootFontSizeCache(): void {
  _rootFontSizeCache = null;
}

/** Конвертировать rem в px */
export function remToPx(remValue: number): number {
  return remValue * getRootFontSize();
}

// ═══════════════════════════════════════════════════
// POSITION CALCULATIONS
// ═══════════════════════════════════════════════════

/** Вычислить lineHeight (чистая высота строки БЕЗ gap) */
export function computeLineHeight(
  fontSizeRem: string,
  fontScale: number
): number {
  const fontSizePx = remToPx(parseFloat(fontSizeRem));
  return fontSizePx * LINE_HEIGHT_MULTIPLIER * fontScale;
}

/** Вычислить Y позицию слота */
export function computeSlotY(
  slotIndex: number,
  lineHeight: number,
  gapPx: number
): number {
  return slotIndex * (lineHeight + gapPx);
}

/** Вычислить общую высоту (gap после последнего НЕ включается) */
export function computeTotalHeight(
  slotCount: number,
  lineHeight: number,
  gapPx: number
): number {
  if (slotCount <= 0) return 0;
  return (slotCount - 1) * (lineHeight + gapPx) + lineHeight;
}

/** Вычислить offsetY для центрирования активной строки */
export function computeOffsetY(
  activeSlotIndex: number,
  slotStep: number,
  lineHeight: number,
  totalHeight: number
): number {
  const activeSlotY = activeSlotIndex * slotStep;
  return (totalHeight / 2) - activeSlotY - (lineHeight / 2);
}

/** Сгенерировать ID слота */
export function computeSlotId(
  blockId: string,
  subBlockIndex: number,
  slotIndex: number
): string {
  return `${blockId}-${subBlockIndex}-${slotIndex}`;
}

// ═══════════════════════════════════════════════════
// BRACKET PARSING (бэк-вокал проводка)
// ═══════════════════════════════════════════════════

const BRACKET_REGEX = /(\([^)]+\))|([^()]+)/g;

/** Разобрать строку на части (lead + back вокал) */
export function parseBracketedParts(
  text: string,
  slotIdPrefix: string
): SlotPart[] {
  if (!text || !text.trim()) return [];

  const parts: SlotPart[] = [];
  let match: RegExpExecArray | null;
  let leadIdx = 0;
  let backIdx = 0;

  BRACKET_REGEX.lastIndex = 0;

  while ((match = BRACKET_REGEX.exec(text)) !== null) {
    if (match[1]) {
      parts.push({
        id: `${slotIdPrefix}-back-${backIdx++}`,
        type: 'back',
        text: match[1],
        bracketed: true,
      });
    } else if (match[2] && match[2].trim()) {
      parts.push({
        id: `${slotIdPrefix}-lead-${leadIdx++}`,
        type: 'lead',
        text: match[2].trim(),
        bracketed: false,
      });
    }
  }

  if (parts.length === 0 && text.trim()) {
    parts.push({
      id: `${slotIdPrefix}-lead-0`,
      type: 'lead',
      text: text.trim(),
      bracketed: false,
    });
  }

  return parts;
}

// ═══════════════════════════════════════════════════
// RESIZE LISTENER
// ═══════════════════════════════════════════════════

if (typeof window !== 'undefined') {
  window.addEventListener('resize', resetRootFontSizeCache);
}
