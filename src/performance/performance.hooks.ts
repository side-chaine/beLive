/**
 * Performance / Quality System Hooks
 *
 * React hooks for consuming performance tier and visual budget.
 * These are thin wrappers over the performance store for component consumption.
 *
 * @module performance.hooks
 * @see performance.store for store implementation
 * @see performance.types for type definitions
 */

import { usePerformanceStore, useVisualBudget as useStoreVisualBudget, useEffectiveTier } from './performance.store';
import type { PerformanceTier, VisualBudget } from './performance.types';
import type { WordTrailDepth } from '../types/textStyle.types';
import { useTextStyleStore } from '../stores/textStyle.store';
import { useRecordingStore } from '../stores/recording.store';
import { applyRecordingSafeClamp } from './performance.clamp';

/**
 * Performance tier hook return type
 */
interface UsePerformanceTierReturn {
  /** Effective tier (auto-detected or manual) */
  tier: PerformanceTier;

  /** Whether auto-detection is enabled */
  autoDetect: boolean;

  /** Manually selected tier (may differ from effective if autoDetect is true) */
  manualTier: PerformanceTier;

  /** Last detected tier from device capabilities */
  detectedTier: PerformanceTier;
}

/**
 * Hook for accessing performance tier state
 *
 * Returns both effective tier and configuration details.
 * Use this when you need to know the tier and how it was determined.
 *
 * @example
 * ```tsx
 * const { tier, autoDetect } = usePerformanceTier();
 * return <div data-tier={tier}>Content</div>;
 * ```
 */
export function usePerformanceTier(): UsePerformanceTierReturn {
  const tier = useEffectiveTier();
  const autoDetect = usePerformanceStore((state) => state.autoDetect);
  const manualTier = usePerformanceStore((state) => state.tier);
  const detectedTier = usePerformanceStore((state) => state.detectedTier);

  return {
    tier,
    autoDetect,
    manualTier,
    detectedTier,
  };
}

/**
 * Hook for accessing the complete visual budget
 *
 * Returns the resolved VisualBudget for the current effective tier.
 * Use this when you need budget-aware rendering decisions.
 *
 * @example
 * ```tsx
 * const budget = useVisualBudget();
 * if (budget.word.allowBounce) {
 *   return <BounceEffect />;
 * }
 * ```
 */
export function useVisualBudget(): VisualBudget {
  return useStoreVisualBudget();
}

/**
 * Hook for accessing the resolved visual budget with recording-safe clamp
 *
 * Returns a VisualBudget that accounts for:
 * - Current performance tier (base budget)
 * - Recording state (applies clamp when recording is active)
 *
 * Use this in components that need budget-aware rendering during recording.
 *
 * @example
 * ```tsx
 * const budget = useResolvedVisualBudget();
 * // During recording: expensive effects clamped for capture stability
 * // During normal playback: full tier-based budget
 * ```
 */
export function useResolvedVisualBudget(): VisualBudget {
  const baseBudget = useStoreVisualBudget();
  const isRecording = useRecordingStore((state) => state.isRecording);

  if (isRecording) {
    return applyRecordingSafeClamp(baseBudget);
  }

  return baseBudget;
}

/**
 * Hook for checking if a specific word effect is allowed
 *
 * @param effect - The effect to check
 * @returns Whether the effect is allowed in current budget
 */
export function useWordEffectAllowed(
  effect: 'bounce' | 'heavyNeon' | 'lookahead'
): boolean {
  const budget = useResolvedVisualBudget();

  switch (effect) {
    case 'bounce':
      return budget.word.allowBounce;
    case 'heavyNeon':
      return budget.word.allowHeavyNeon;
    case 'lookahead':
      return budget.word.allowLookahead;
    default:
      return false;
  }
}

/**
 * Hook for getting the max cue words count
 *
 * @returns Maximum allowed cue words (0 if disabled)
 */
export function useMaxCueWords(): number {
  return useResolvedVisualBudget().word.maxCueWords;
}

/**
 * Clamp trail depth by performance tier budget
 * Maps user-selected depth to effective depth based on tier constraints
 */
function clampTrailDepth(
  selected: WordTrailDepth,
  maxAllowed: WordTrailDepth
): WordTrailDepth {
  const depthOrder: WordTrailDepth[] = ['off', 'line', 'scene'];
  const selectedIndex = depthOrder.indexOf(selected);
  const maxIndex = depthOrder.indexOf(maxAllowed);

  // If selected exceeds max allowed, clamp to max
  if (selectedIndex > maxIndex) {
    return maxAllowed;
  }

  return selected;
}

/**
 * Hook for getting the resolved trail depth
 *
 * Reads user-selected trail depth from textStyle store and clamps it
 * by the current performance tier's maxTrailDepth budget.
 *
 * @returns Effective trail depth after tier clamping
 *
 * @example
 * ```tsx
 * const trailDepth = useResolvedTrailDepth();
 * // Lite tier: always returns 'off'
 * // Balanced tier: returns 'line' or 'off'
 * // Max/Ultra tier: returns 'scene', 'line', or 'off'
 * ```
 */
export function useResolvedTrailDepth(): WordTrailDepth {
  const selectedDepth = useTextStyleStore((state) => state.wordTrailDepth);
  const maxAllowed = useResolvedVisualBudget().word.maxTrailDepth;

  return clampTrailDepth(selectedDepth, maxAllowed);
}

/**
 * Hook for checking if a specific line feature is allowed
 *
 * @param feature - The line feature to check
 * @returns Whether the feature is allowed in current budget
 */
export function useLineFeatureAllowed(
  feature: 'previewGlow' | 'previewHandoff' | 'blockAwareColor'
): boolean {
  const budget = useResolvedVisualBudget();

  switch (feature) {
    case 'previewGlow':
      return budget.line.allowPreviewGlow;
    case 'previewHandoff':
      return budget.line.allowPreviewHandoff;
    case 'blockAwareColor':
      return budget.line.allowBlockAwareColor;
    default:
      return false;
  }
}

// Re-export store hooks for convenience
export { usePerformanceStore, useEffectiveTier } from './performance.store';
