/**
 * Echo Generator
 * 
 * Extracted from stable Echo Drill recipe.
 * Implements: Listen → Record pattern with fixed rounds.
 * 
 * Family: echo (imitation-based learning)
 * Version: 1.0.0 (initial extraction)
 */

import type { Exercise, BackingMode } from '../exercise.types';
import type { GeneratorDef, GeneratorParams } from './generator.types';
import { genExerciseId } from './gen-id.util';

/**
 * Echo Generator Definition
 * 
 * Stable recipe extracted with identical behavior:
 * - Listen to full backing
 * - Record with instrumental backing (or custom)
 * - Repeat for fixed rounds (default 3)
 */
export const echoGenerator: GeneratorDef = {
  metadata: {
    // Identity
    id: 'echo-drill',
    family: 'echo',
    version: { major: 1, minor: 0, patch: 0 },

    // Recipe-facing display (identical to current stable)
    name: 'Echo Drill',
    icon: '🎧',
    category: 'drill',
    description: 'Listen, then sing it back',

    // Runtime defaults (identical to current stable)
    defaultRounds: 3,
    defaultBacking: 'instrumental',

    // Surface visibility (identical to current stable)
    surface: 'stable',

    // Backward compatibility
    recipeId: 'echo-drill',
  },

  generate: (blockId: string, params?: GeneratorParams): Exercise => ({
    id: genExerciseId('echo', blockId),
    recipeId: 'echo-drill',
    name: 'Echo Drill',
    icon: '🎧',
    description: 'Listen to the original, then sing it back',
    scope: { blockId },
    steps: [
      { action: 'listen', backing: 'full', instruction: 'Listen carefully' },
      {
        action: 'record',
        backing: (params?.backing as BackingMode) ?? 'instrumental',
        slot: 'next',
        instruction: 'Your turn — sing it back',
      },
    ],
    repeat: { count: params?.rounds ?? 3, mode: 'fixed' },
    goal: { type: 'rounds', count: params?.rounds ?? 3 },
    defaultBacking: (params?.backing as BackingMode) ?? 'instrumental',
  }),
};
