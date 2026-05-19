/**
 * Backing Ladder Generator Family
 * 
 * Extracted from hidden backing-related challenge recipes.
 * Implements: Progressive backing difficulty challenges.
 * 
 * Family: backing-ladder (backing difficulty progression)
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
 * Backing Ladder Generator — No Training Wheels Preset
 * 
 * Stable recipe extracted with identical behavior:
 * - Record with instrumental backing only
 * - Single step challenge
 * - Repeat for fixed rounds (default 3)
 */
export const backingOnlyGenerator: GeneratorDef = {
  metadata: {
    // Identity
    id: 'backing-only',
    family: 'backing-ladder',
    version: { major: 1, minor: 0, patch: 0 },

    // Recipe-facing display (identical to current stable)
    name: 'No Training Wheels',
    icon: '🎵',
    category: 'challenge',
    description: 'Sing with instrumental only',

    // Runtime defaults (identical to current stable)
    defaultRounds: 3,
    defaultBacking: 'instrumental',

    // Surface visibility (identical to current stable)
    surface: 'smoke',

    // Backward compatibility
    recipeId: 'backing-only',

    // Capability metadata
    capabilities: {},
  },

  generate: (blockId: string, params?: GeneratorParams): Exercise => ({
    id: genExerciseId('notw', blockId),
    recipeId: 'backing-only',
    name: 'No Training Wheels',
    icon: '🎵',
    description: 'Sing with just the music',
    scope: { blockId },
    steps: [
      {
        action: 'record',
        backing: 'instrumental',
        slot: 'next',
        instruction: 'Sing with just the music',
      },
    ],
    repeat: { count: params?.rounds ?? 3, mode: 'fixed' },
    goal: { type: 'rounds', count: params?.rounds ?? 3 },
    defaultBacking: 'instrumental',
  }),
};

/**
 * Backing Ladder Generator — A Cappella Boss Preset
 * 
 * Stable recipe extracted with identical behavior:
 * - Progressive difficulty: full → instrumental → vocals-only
 * - Three recording slots with increasing difficulty
 * - Single round challenge
 */
export const acappellaBossGenerator: GeneratorDef = {
  metadata: {
    // Identity
    id: 'acappella-boss',
    family: 'backing-ladder',
    version: { major: 1, minor: 0, patch: 0 },

    // Recipe-facing display (identical to current stable)
    name: 'A Cappella Boss',
    icon: '⚡',
    category: 'challenge',
    description: 'Progressive full → instrumental → vocal-only',

    // Runtime defaults (identical to current stable)
    defaultRounds: 1,
    defaultBacking: 'full',

    // Surface visibility (identical to current stable)
    surface: 'smoke',

    // Backward compatibility
    recipeId: 'acappella-boss',

    // Capability metadata
    capabilities: {
      requiresVocalStem: true,
    },
  },

  generate: (blockId: string, params?: GeneratorParams): Exercise => ({
    id: genExerciseId('boss', blockId),
    recipeId: 'acappella-boss',
    name: 'A Cappella Boss',
    icon: '⚡',
    description: 'Progressive difficulty challenge',
    scope: { blockId },
    steps: [
      { action: 'listen', backing: 'full', instruction: 'Listen first' },
      {
        action: 'record',
        backing: 'full',
        slot: 0,
        instruction: 'With full backing',
      },
      {
        action: 'record',
        backing: 'instrumental',
        slot: 1,
        instruction: 'No vocals — just the music',
      },
      {
        action: 'record',
        backing: 'vocals-only',
        slot: 2,
        instruction: 'Sing with the vocal guide only',
      },
    ],
    repeat: { count: 1, mode: 'fixed' },
    goal: { type: 'filled', slotCount: 3 },
    defaultBacking: 'full',
    difficulty: 'advanced',
  }),
};
