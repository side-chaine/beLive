// src/structure/block-colors.ts
// Canonical block color contract — single source of truth
// All consumers (theme, components, CSS) reference this

export const BLOCK_COLORS = {
  verse: '#4CAF50',
  prechorus: '#FFEB3B',
  chorus: '#F44336',
  bridge: '#9C27B0',
  interlude: '#E91E63',
  intro: '#2196F3',
  outro: '#00BCD4',
  unknown: '#9E9E9E',
  blank: 'rgba(255,255,255,0.1)',
} as const;

/**
 * Get canonical block color by type
 * Normalizes aliases (pre-chorus → prechorus)
 * Falls back to unknown for unrecognized types
 */
export function getCanonicalBlockColor(blockType?: string): string {
  if (!blockType) return BLOCK_COLORS.unknown;

  const normalized = blockType.toLowerCase().replace(/\s+/g, '');
  
  // Normalize aliases
  if (normalized === 'pre-chorus' || normalized === 'prechorus') {
    return BLOCK_COLORS.prechorus;
  }

  // Direct lookup
  const key = normalized as keyof typeof BLOCK_COLORS;
  if (key in BLOCK_COLORS) {
    return BLOCK_COLORS[key];
  }

  // Fallback
  return BLOCK_COLORS.unknown;
}
