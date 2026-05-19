/* ── Block Editor Types ── beLive Sprint 36 */

export type BlockType =
  | 'verse'
  | 'chorus'
  | 'prechorus'
  | 'bridge'
  | 'interlude'
  | 'intro'
  | 'outro';

/** Working block inside the editor (mutable during editing) */
export interface EditingBlock {
  id: string;
  text: string;
  type: BlockType;
  lineIndices: number[]; // tracked from parse, NOT recomputed at save
}

/** Block format expected by legacy save callbacks */
export interface SavedBlock {
  id: string;
  name: string;
  type: string;
  lineIndices: number[];
}

/** Config for each block type */
export const BLOCK_TYPE_CONFIG: {
  type: BlockType;
  label: string;
  labelRu: string;
  color: string;
  cssVar: string;
}[] = [
  { type: 'verse',     label: 'Verse',      labelRu: 'Куплет',      color: '#4CAF50', cssVar: '--bl-block-verse' },
  { type: 'prechorus', label: 'Pre-Chorus',  labelRu: 'Предприпев',  color: '#FFEB3B', cssVar: '--bl-block-prechorus' },
  { type: 'chorus',    label: 'Chorus',      labelRu: 'Припев',      color: '#F44336', cssVar: '--bl-block-chorus' },
  { type: 'bridge',    label: 'Bridge',      labelRu: 'Бридж',       color: '#9C27B0', cssVar: '--bl-block-bridge' },
  { type: 'interlude', label: 'Interlude',   labelRu: 'Интерлюдия',  color: '#E91E63', cssVar: '--bl-block-interlude' },
  { type: 'intro',     label: 'Intro',       labelRu: 'Интро',       color: '#2196F3', cssVar: '--bl-block-intro' },
  { type: 'outro',     label: 'Outro',       labelRu: 'Аутро',       color: '#00BCD4', cssVar: '--bl-block-outro' },
];

/** Get config for a block type (falls back to verse) */
export function getBlockTypeConfig(type: BlockType | string) {
  return BLOCK_TYPE_CONFIG.find(c => c.type === type) ?? BLOCK_TYPE_CONFIG[0];
}
