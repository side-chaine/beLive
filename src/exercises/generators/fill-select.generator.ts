/**
 * Fill & Select Generator
 * 
 * Extracted from stable 3-Take Challenge recipe.
 * Implements: Record until slots filled, then select best pattern.
 * 
 * Family: fill-select (slot-based comparison learning)
 * Version: 1.0.0 (initial extraction)
 */

import type { Exercise, BackingMode } from '../exercise.types';
import type { GeneratorDef, GeneratorParams } from './generator.types';

/**
 * Generate unique exercise id
 * Matches current stable behavior
 */
function genExerciseId(prefix: string, blockId: string): string {
  return `ex-${prefix}-${blockId}-${Date.now()}`;
}

/**
 * Fill & Select Generator Definition
 * 
 * Stable recipe extracted with identical behavior:
 * - Record single step repeatedly
 * - Fill slots until target reached (default 3)
 * - Learner selects best take after completion
 */
export const fillSelectGenerator: GeneratorDef = {
  metadata: {
    // Identity
    id: 'triple-take',
    family: 'fill-select',
    version: { major: 1, minor: 0, patch: 0 },

    // Recipe-facing display (identical to current stable)
    name: '3-Take Challenge',
    icon: '🔄',
    category: 'drill',
    description: 'Record 3 takes and pick the best',

    // Runtime defaults (identical to current stable)
    defaultRounds: 3,
    defaultBacking: 'instrumental',

    // Surface visibility (identical to current stable)
    surface: 'stable',

    // Backward compatibility
    recipeId: 'triple-take',
  },

  generate: (blockId: string, params?: GeneratorParams): Exercise => ({
    id: genExerciseId('triple', blockId),
    recipeId: 'triple-take',
    name: '3-Take Challenge',
    icon: '🔄',
    description: 'Fill all 3 slots and choose the best take',
    scope: { blockId },
    steps: [
      {
        action: 'record',
        backing: (params?.backing as BackingMode) ?? 'instrumental',
        slot: 'next',
        instruction: 'Record your take',
      },
    ],
    repeat: { count: 3, mode: 'until-filled', filledTarget: 3 },
    goal: { type: 'filled', slotCount: 3 },
    defaultBacking: (params?.backing as BackingMode) ?? 'instrumental',
  }),
};
