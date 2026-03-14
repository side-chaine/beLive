// beLive — Style Recipes
// Source-of-truth definitions for preset style bundles per mode.
// A recipe is a named combination of text-style store fields that creates
// a coherent visual scene. Used by Theme section presets and Random.

import type {
  WordFocusLevel,
  WordFxMode,
  LineActiveLevel,
  LineNextLevel,
  LineOthersLevel,
} from '../types/textStyle.types';

// ─── Recipe Bundle ────────────────────────────────────────────────────────────

export interface StyleRecipe {
  /** Unique machine ID — matches the preset label slug */
  id: string;
  /** Human-readable display label */
  label: string;
  wordFocusLevel: WordFocusLevel;
  wordFxMode: WordFxMode;
  lineActiveLevel: LineActiveLevel;
  lineNextLevel: LineNextLevel;
  lineOthersLevel: LineOthersLevel;
}

// ─── Rehearsal Recipes v1 ─────────────────────────────────────────────────────

export const REHEARSAL_STYLE_RECIPES: StyleRecipe[] = [
  {
    id: 'focus',
    label: 'Focus',
    wordFocusLevel: 'soft',
    wordFxMode: 'progress',
    lineActiveLevel: 'off',
    lineNextLevel: 'hint',
    lineOthersLevel: 'dim',
  },
  {
    id: 'soft-guide',
    label: 'Soft Guide',
    wordFocusLevel: 'soft',
    wordFxMode: 'underline',
    lineActiveLevel: 'soft',
    lineNextLevel: 'guide',
    lineOthersLevel: 'medium',
  },
  {
    id: 'loop-study',
    label: 'Loop Study',
    wordFocusLevel: 'off',
    wordFxMode: 'progress',
    lineActiveLevel: 'off',
    lineNextLevel: 'guide',
    lineOthersLevel: 'dim',
  },
  {
    id: 'minimal',
    label: 'Minimal',
    wordFocusLevel: 'off',
    wordFxMode: 'underline',
    lineActiveLevel: 'off',
    lineNextLevel: 'off',
    lineOthersLevel: 'dim',
  },
  {
    id: 'neon-trace',
    label: 'Neon Trace',
    wordFocusLevel: 'soft',
    wordFxMode: 'neon',
    lineActiveLevel: 'off',
    lineNextLevel: 'guide',
    lineOthersLevel: 'dim',
  },
  {
    id: 'pulse-cue',
    label: 'Pulse Cue',
    wordFocusLevel: 'soft',
    wordFxMode: 'bounce',
    lineActiveLevel: 'off',
    lineNextLevel: 'hint',
    lineOthersLevel: 'dim',
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Look up a recipe by id. Returns undefined if not found. */
export function getRecipeById(
  recipes: StyleRecipe[],
  id: string
): StyleRecipe | undefined {
  return recipes.find(r => r.id === id);
}
