/**
 * Performance / Quality System Store
 *
 * Zustand store for performance tier management with persistence.
 * Supports both manual tier selection and auto-detection.
 *
 * @module performance.store
 * @see performance.types for type definitions
 * @see performance.presets for tier configurations
 * @see performance.detect for detection heuristics
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PerformanceTier, VisualBudget } from './performance.types';
import { DEFAULT_PERFORMANCE_TIER, PERFORMANCE_PRESETS } from './performance.presets';
import { detectPerformanceTier } from './performance.detect';

/**
 * Storage key for performance settings in localStorage
 */
const STORAGE_KEY = 'belive-performance';

/**
 * Performance store state and actions
 */
interface PerformanceState {
  /** Manually selected tier (ignored when autoDetect is true) */
  tier: PerformanceTier;

  /** Whether to use auto-detected tier */
  autoDetect: boolean;

  /** Last computed detected tier (recomputed at runtime, not persisted) */
  detectedTier: PerformanceTier;

  /**
   * Set manual tier and disable auto-detect
   * @param tier - The performance tier to use
   */
  setTier: (tier: PerformanceTier) => void;

  /**
   * Enable or disable auto-detection
   * When enabling, refreshes detected tier immediately
   * @param auto - Whether to use auto-detection
   */
  setAutoDetect: (auto: boolean) => void;

  /**
   * Recompute the detected tier from current device capabilities
   * Call this when device conditions may have changed
   */
  refreshDetectedTier: () => void;

  /**
   * Get the effective tier (auto-detected or manual)
   * @returns Current active performance tier
   */
  getEffectiveTier: () => PerformanceTier;

  /**
   * Get the complete visual budget for the effective tier
   * @returns VisualBudget for current tier
   */
  getBudget: () => VisualBudget;
}

/**
 * Persisted portion of the state
 * Only tier and autoDetect are stored; detectedTier is recomputed at runtime
 */
interface PersistedPerformanceState {
  tier: PerformanceTier;
  autoDetect: boolean;
}

/**
 * Performance store with persistence
 *
 * Usage:
 * ```ts
 * const { tier, autoDetect, setTier, getBudget } = usePerformanceStore();
 * const budget = getBudget();
 * ```
 */
export const usePerformanceStore = create<PerformanceState>()(
  persist(
    (set, get) => ({
      // Initial state
      tier: DEFAULT_PERFORMANCE_TIER,
      autoDetect: true,
      detectedTier: detectPerformanceTier(),

      /**
       * Set manual tier and disable auto-detect
       */
      setTier: (tier: PerformanceTier) => {
        set({
          tier,
          autoDetect: false,
        });
      },

      /**
       * Enable/disable auto-detection
       * When enabling, immediately refresh detected tier
       */
      setAutoDetect: (auto: boolean) => {
        const updates: Partial<PerformanceState> = { autoDetect: auto };
        if (auto) {
          updates.detectedTier = detectPerformanceTier();
        }
        set(updates);
      },

      /**
       * Recompute detected tier from device capabilities
       */
      refreshDetectedTier: () => {
        set({ detectedTier: detectPerformanceTier() });
      },

      /**
       * Get effective tier based on autoDetect setting
       */
      getEffectiveTier: () => {
        const { autoDetect, detectedTier, tier } = get();
        return autoDetect ? detectedTier : tier;
      },

      /**
       * Get visual budget for effective tier
       */
      getBudget: () => {
        const effectiveTier = get().getEffectiveTier();
        return PERFORMANCE_PRESETS[effectiveTier];
      },
    }),
    {
      name: STORAGE_KEY,
      /**
       * Only persist user preferences, not runtime-computed values
       */
      partialize: (state): PersistedPerformanceState => ({
        tier: state.tier,
        autoDetect: state.autoDetect,
        // Note: detectedTier is intentionally NOT persisted
        // It is recomputed at runtime to reflect current device state
      }),
      /**
       * Merge persisted state with fresh detected tier on hydration
       */
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Always recompute detected tier on store initialization
          // to reflect current device capabilities
          state.detectedTier = detectPerformanceTier();
        }
      },
    }
  )
);

/**
 * Convenience hook for getting the current visual budget
 * Use this in components that need budget-aware rendering
 *
 * @returns Current VisualBudget for the effective tier
 */
export function useVisualBudget(): VisualBudget {
  return usePerformanceStore((state) => state.getBudget());
}

/**
 * Convenience hook for getting the effective tier
 *
 * @returns Current effective PerformanceTier
 */
export function useEffectiveTier(): PerformanceTier {
  return usePerformanceStore((state) => state.getEffectiveTier());
}
