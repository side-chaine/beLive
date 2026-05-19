/**
 * Performance Budget Recording-Safe Clamp
 *
 * Pure helper that applies recording-safe clamping to an existing VisualBudget.
 * Recording-safe clamp prioritizes capture stability and active-word clarity.
 *
 * @module performance.clamp
 * @see performance.types for VisualBudget definition
 * @see performance.hooks for integration point
 */

import type { VisualBudget } from './performance.types';

/**
 * Apply recording-safe clamp to a visual budget.
 *
 * Returns a new budget object with expensive visual features disabled
 * to ensure stable screen capture during recording.
 *
 * @param budget - The original visual budget to clamp
 * @returns A new VisualBudget with recording-safe constraints applied
 */
export function applyRecordingSafeClamp(budget: VisualBudget): VisualBudget {
  return {
    ...budget,
    word: {
      ...budget.word,
      maxTrailDepth: 'off',
      allowBounce: false,
      allowHeavyNeon: false,
      maxCueWords: 0,
    },
    line: {
      ...budget.line,
      allowPreviewHandoff: false,
      // allowBlockAwareColor preserved as-is
      // allowPreviewGlow preserved as-is
    },
    visualMixer: budget.visualMixer ? {
      ...budget.visualMixer,
      allowPulsation: false,
      allowCardGlow: false,
      allowHitFlash: false,
      allowWaveform: false,
      maxPulseIntensity: 'off',
      allowScenarios: false,
      cardUpdateFps: Math.min(budget.visualMixer.cardUpdateFps, 10),
    } : {
      enabled: false,
      maxCards: 0,
      cardUpdateFps: 0,
      allowPulsation: false,
      allowCardGlow: false,
      allowHitFlash: false,
      allowWaveform: false,
      maxPulseIntensity: 'off',
      allowScenarios: false,
    },
  };
}
