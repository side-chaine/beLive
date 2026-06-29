/**
 * Block Editor Types — beLive Sprint 36
 * BlockType импортируется из block-taxonomy.ts (SSOT)
 */

// Импортируем типы из SSOT
import type { BlockType, BlockRole } from '../blocks/parser/block-taxonomy';

export { BlockType, BlockRole };

/** Working block inside the editor (mutable during editing) */
export interface EditingBlock {
  id: string;
  text: string;
  type: BlockType;
  lineIndices: number[]; // tracked from parse, NOT recomputed at save
  instrument?: string;   // для Solo: 'guitar', 'piano', 'drums'...
  variant?: string;      // 'coda', 'spoken'...
}

/** Block format expected by legacy save callbacks */
export interface SavedBlock {
  id: string;
  name: string;
  type: string;
  lineIndices: number[];
  originalTag?: string;     // сохранённый оригинальный тег Genius
  instrument?: string;      // для Solo
  variant?: string;         // 'coda', 'spoken'...
  delivery?: string;        // 'sing', 'rap', 'spoken', 'scream', 'whisper'
  reviewRequired?: boolean;
  taxonomyVersion?: number;
}

/** Config entry for each block type */
export interface BlockTypeConfigEntry {
  type: BlockType;
  label: string;
  labelRu: string;
  color: string;
  cssVar: string;
  role: BlockRole;
}

/** Config for all block types */
export const BLOCK_TYPE_CONFIG: BlockTypeConfigEntry[] = [
  // Core
  { type: 'intro',        label: 'Intro',       labelRu: 'Вступление',    color: '#2196F3', cssVar: '--bl-block-intro',       role: 'core' },
  { type: 'verse',        label: 'Verse',       labelRu: 'Куплет',        color: '#4CAF50', cssVar: '--bl-block-verse',       role: 'core' },
  { type: 'prechorus',    label: 'Pre-Chorus',  labelRu: 'Предприпев',    color: '#FFC107', cssVar: '--bl-block-prechorus',   role: 'core' },
  { type: 'chorus',       label: 'Chorus',      labelRu: 'Припев',        color: '#F44336', cssVar: '--bl-block-chorus',     role: 'core' },
  { type: 'postchorus',   label: 'Post-Chorus', labelRu: 'Постприпев',    color: '#FF8A65', cssVar: '--bl-block-postchorus', role: 'core' },
  { type: 'hook',         label: 'Hook',        labelRu: 'Хук',           color: '#FFB300', cssVar: '--bl-block-hook',       role: 'core' },
  // Transition
  { type: 'bridge',       label: 'Bridge',      labelRu: 'Бридж',         color: '#9C27B0', cssVar: '--bl-block-bridge',     role: 'transition' },
  { type: 'interlude',    label: 'Interlude',   labelRu: 'Интерлюдия',    color: '#BA68C8', cssVar: '--bl-block-interlude',  role: 'transition' },
  // Instrumental
  { type: 'solo',         label: 'Solo',        labelRu: 'Соло',          color: '#FB8C00', cssVar: '--bl-block-solo',       role: 'instrumental' },
  { type: 'instrumental', label: 'Instrumental',labelRu: 'Инструментал',  color: '#78909C', cssVar: '--bl-block-instrumental', role: 'instrumental' },
  // Energy
  { type: 'build',        label: 'Build',       labelRu: 'Билд',          color: '#9CCC65', cssVar: '--bl-block-build',      role: 'energy' },
  { type: 'drop',         label: 'Drop',        labelRu: 'Дроп',          color: '#FF1744', cssVar: '--bl-block-drop',       role: 'energy' },
  { type: 'breakdown',    label: 'Breakdown',   labelRu: 'Брейкдаун',     color: '#455A64', cssVar: '--bl-block-breakdown',  role: 'energy' },
  // Speech
  { type: 'spoken',       label: 'Spoken',      labelRu: 'Говорят',       color: '#CFD8DC', cssVar: '--bl-block-spoken',     role: 'speech' },
  { type: 'rap',          label: 'Rap',         labelRu: 'Рэп',           color: '#64DD17', cssVar: '--bl-block-rap',        role: 'speech' },
  // Ending
  { type: 'outro',        label: 'Outro',       labelRu: 'Аутро',         color: '#00BCD4', cssVar: '--bl-block-outro',      role: 'ending' },
];

const UNKNOWN_CONFIG: BlockTypeConfigEntry = {
  type: 'verse',
  label: 'Unknown',
  labelRu: 'Неизвестно',
  color: '#9E9E9E',
  cssVar: '--bl-block-unknown',
  role: 'core',
};

/** Get config for a block type (falls back to unknown, NOT verse) */
export function getBlockTypeConfig(type: BlockType | string): BlockTypeConfigEntry {
  return BLOCK_TYPE_CONFIG.find(c => c.type === type) ?? UNKNOWN_CONFIG;
}
