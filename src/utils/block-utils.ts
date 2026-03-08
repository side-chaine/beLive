import type { TextBlock } from '../stores/blocks.store';

/** Find block containing given line index */
export function getActiveBlock(
  lineIndex: number,
  blocks: TextBlock[]
): TextBlock | null {
  if (lineIndex < 0 || !blocks.length) return null;
  const exact = blocks.find(b => b.lineIndices.includes(lineIndex));
  if (exact) return exact;
  let best: TextBlock | null = null;
  let bestMax = -Infinity;
  for (const b of blocks) {
    const maxLine = Math.max(...b.lineIndices);
    if (maxLine < lineIndex && maxLine > bestMax) {
      bestMax = maxLine;
      best = b;
    }
  }
  return best;
}

/** Find next block after current */
export function getNextBlock(
  current: TextBlock | null,
  blocks: TextBlock[]
): TextBlock | null {
  if (!current || !blocks.length) return null;
  const idx = blocks.findIndex(b => b.id === current.id);
  return idx >= 0 && idx < blocks.length - 1 ? blocks[idx + 1] : null;
}

/** Dynamic font size based on line count in block */
export function getBlockFontSize(lineCount: number): string {
  if (lineCount <= 2) return '3.2rem';
  if (lineCount <= 4) return '2.6rem';
  if (lineCount <= 6) return '2.0rem';
  if (lineCount <= 8) return '1.6rem';
  return '1.3rem';
}
