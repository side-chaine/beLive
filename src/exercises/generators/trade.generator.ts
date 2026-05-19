/**
 * Trade Generator v2
 * 
 * Implements: Line-pattern trading with continuous in-flight capture.
 * Architecture mirrors Call & Response exactly:
 * - roundCaptureMode: true → ONE recorder session per round (fixes race condition)
 * - responseWindowIndex / totalResponseWindows → multi-window management
 * - captureMode: 'in-flight' → listen executor does NOT pause at line boundary
 * 
 * Family: trade (line-pattern trading)
 * Version: 2.0.0 (in-flight capture + roundCapture)
 */

import type { Exercise, ExerciseStep, BackingMode } from '../exercise.types';
import type { GeneratorDef, GeneratorParams } from './generator.types';

/**
 * Generate unique exercise id
 */
function genExerciseId(prefix: string, blockId: string): string {
  return `ex-${prefix}-${blockId}-${Date.now()}`;
}

/**
 * Trade Generator Definition v2
 * 
 * Builds line-pair sequence EXACTLY matching Call & Response architecture:
 * - Line pairs: listen (reference) → record (user, in-flight + roundCapture)
 * - Continuous playback via shouldContinuousHandoff in listen executor
 * - Single recorder session per round (roundCaptureMode) → no race condition
 * - Wait step at start for initial countdown
 * 
 * Example (4-line block):
 *   Step 0: wait 3sec (initial countdown)
 *   Step 1: listen L1 (full) → continuous handoff to Step 2
 *   Step 2: record L2 (in-flight, roundCapture, window 0/2)
 *   Step 3: listen L3 (full) → continuous handoff to Step 4
 *   Step 4: record L4 (in-flight, roundCapture, window 1/2) ← FINALIZE
 */
export const tradeGenerator: GeneratorDef = {
  metadata: {
    id: 'trade-v1',
    family: 'trade',
    version: { major: 2, minor: 0, patch: 0 },

    name: 'Trade v1',
    icon: '🔄',
    category: 'drill',
    description: 'Alternate lines with reference (in-flight capture)',

    defaultRounds: 1,
    defaultBacking: 'instrumental',

    surface: 'smoke',
    recipeId: 'trade-v1',
  },

  generate: (blockId: string, params?: GeneratorParams): Exercise => {
    const lineCount = params?.lineCount ?? 0;
    const steps: ExerciseStep[] = [];
    const totalWindows = Math.floor(lineCount / 2);  // e.g. 4 lines = 2 user windows

    // Step 0: Initial countdown (wait step)
    // Tempo Ladder uses the same pattern: wait before round starts
    steps.push({
      action: 'wait' as const,
      waitSec: 3,
      instruction: 'Get ready...',
    });

    // Build line-pair sequence (matching Call & Response architecture)
    // Odd lines (1, 3, ...) = reference listen (full mix: inst + vocals)
    // Even lines (2, 4, ...) = user record (in-flight + roundCapture, instrumental)
    for (let i = 0, windowIndex = 0; i + 1 < lineCount; i += 2, windowIndex++) {
      // Reference listen stage
      steps.push({
        action: 'listen' as const,
        scope: { blockId, lineRange: [i, i] as [number, number] },
        backing: 'full' as BackingMode,
        instruction: `Listen to line ${i + 1}`,
      });

      // User record stage (in-flight capture + round capture mode)
      // roundCaptureMode: true → ONE recorder per round, continuation branch reuses it
      // responseWindowIndex: which window we're in (0-based)
      // totalResponseWindows: total user windows in this round
      steps.push({
        action: 'record' as const,
        scope: { blockId, lineRange: [i + 1, i + 1] as [number, number] },
        backing: (params?.backing as BackingMode) ?? 'instrumental',
        slot: 'next' as const,
        captureMode: 'in-flight' as const,
        roundCaptureMode: true,
        responseWindowIndex: windowIndex,
        totalResponseWindows: totalWindows,
        takeKind: 'training' as const,
        instruction: `Sing line ${i + 2}`,
      });
    }
    // Odd line counts: skip final unmatched line (same as Call & Response)

    return {
      id: genExerciseId('trade', blockId),
      recipeId: 'trade-v1',
      name: 'Trade v1',
      icon: '🔄',
      description: 'Alternate lines with reference (in-flight capture)',
      scope: { blockId },
      steps,
      repeat: { count: params?.rounds ?? 1, mode: 'fixed' },
      goal: { type: 'rounds', count: params?.rounds ?? 1 },
      defaultBacking: (params?.backing as BackingMode) ?? 'instrumental',
    };
  },
};
