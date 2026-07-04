/**
 * Structure Formula Utility — converts blocks to A→P→B→... notation
 * Used by AI Expert for track context & comparison
 */

const BLOCK_TYPE_LETTER: Record<string, string> = {
  intro: 'I',
  verse: 'A',
  prechorus: 'P',
  chorus: 'B',
  postchorus: 'b',
  hook: 'H',
  bridge: 'C',
  interlude: 'L',
  outro: 'O',
  solo: 'S',
  instrumental: 'N',
  build: 'U',
  drop: 'D',
  breakdown: 'K',
  spoken: 'W',
  rap: 'R',
  unknown: '?',
};

/**
 * Convert block array to structure formula: "A→P→B→A→P→B→C→B→O"
 */
export function getStructureFormula(
  blocks: { type: string }[] | null | undefined,
): string {
  if (!blocks || blocks.length === 0) return '';
  return blocks.map(b => BLOCK_TYPE_LETTER[b.type] || '?').join('→');
}

/**
 * Get single letter for a block type
 */
export function getBlockLetter(type: string): string {
  return BLOCK_TYPE_LETTER[type] || '?';
}
