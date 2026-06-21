/**
 * Call & Response Generator
 *
 * Implements: Alternating listen/record with roundCapture.
 * Architecture mirrors Trade Generator exactly (shared alternation pattern):
 * - roundCaptureMode: true → ONE recorder session per round
 * - captureMode: 'in-flight' → listen does NOT pause at line boundary
 * - responseWindowIndex / totalResponseWindows → multi-window management
 *
 * Key differences from Trade v1:
 * - NO initial wait step (starts immediately)
 * - NO takeKind on record steps
 * - surface: 'special' (not 'smoke')
 * - requiresVocalStem + requiresWordSync capabilities
 *
 * Family: alternation (shared pattern with trade)
 * Version: 1.0.0 (extracted from inline recipe)
 */

import type { Exercise, ExerciseStep, BackingMode } from '../exercise.types';
import type { GeneratorDef, GeneratorParams } from './generator.types';
import { genExerciseId } from './gen-id.util';

export const callResponseGenerator: GeneratorDef = {
  metadata: {
    id: 'call-response',
    family: 'alternation',
    version: { major: 1, minor: 0, patch: 0 },

    name: 'Call & Response',
    icon: '🔀',
    category: 'drill',
    description: 'Original sings one line, you sing the next',

    defaultRounds: 1,
    defaultBacking: 'instrumental',

    surface: 'special',

    recipeId: 'call-response',

    capabilities: {
      requiresVocalStem: true,
      requiresWordSync: true,
    },
  },

  generate: (blockId: string, params?: GeneratorParams): Exercise => {
    const lineCount = Math.max(2, params?.lineCount ?? 2);
    const totalWindows = Math.floor(lineCount / 2);
    const steps: ExerciseStep[] = [];

    for (let i = 0, windowIndex = 0; i + 1 < lineCount; i += 2, windowIndex++) {
      steps.push({
        action: 'listen',
        scope: { blockId, lineRange: [i, i] },
        backing: 'full',
        instruction: 'Listen to this line',
      });

      steps.push({
        action: 'record',
        scope: { blockId, lineRange: [i + 1, i + 1] },
        backing: (params?.backing as BackingMode) ?? 'instrumental',
        slot: 'next',
        captureMode: 'in-flight',
        roundCaptureMode: true,
        responseWindowIndex: windowIndex,
        totalResponseWindows: totalWindows,
        instruction: 'Now sing the next line',
      });
    }
    // Odd line counts intentionally skip the final unmatched line in CR-WAVE A

    return {
      id: genExerciseId('callresp', blockId),
      recipeId: 'call-response',
      name: 'Call & Response',
      icon: '🔀',
      description: 'Alternate with the original by line',
      scope: { blockId },
      steps,
      repeat: { count: params?.rounds ?? 1, mode: 'fixed' },
      goal: { type: 'rounds', count: params?.rounds ?? 1 },
      defaultBacking: (params?.backing as BackingMode) ?? 'instrumental',
    };
  },
};
