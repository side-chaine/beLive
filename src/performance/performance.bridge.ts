/**
 * Performance / Quality System Bridge
 *
 * Publishes performance tier state to the DOM for CSS and legacy consumers.
 * Mirrors the pattern used by the theme engine (document.documentElement).
 *
 * @module performance.bridge
 * @see performance.store for state management
 * @see performance.hooks for React consumption
 */

import { usePerformanceStore } from './performance.store';
import { useRecordingStore } from '../stores/recording.store';
import { useTakesStore } from '../takes/takes.store';
import { applyRecordingSafeClamp } from './performance.clamp';
import type { PerformanceTier, VisualBudget } from './performance.types';

/**
 * CSS custom property names for performance budget values
 */
const CSS_VARS = {
  maxCueWords: '--bl-perf-max-cue-words',
  allowBounce: '--bl-perf-allow-bounce',
  allowHeavyNeon: '--bl-perf-allow-heavy-neon',
  allowPreviewHandoff: '--bl-perf-allow-preview-handoff',
  allowBlockAwareColor: '--bl-perf-allow-block-aware-color',
} as const;

/**
 * HTML attribute name for visual tier
 */
const TIER_ATTR = 'data-visual-tier';

/**
 * HTML attribute name for recording state
 */
const RECORDING_ATTR = 'data-recording-active';

/**
 * Unsubscribe function type
 */
type Unsubscribe = () => void;

/**
 * Apply performance tier to DOM
 *
 * Sets data-visual-tier attribute on documentElement
 */
function applyTierToDOM(tier: PerformanceTier): void {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute(TIER_ATTR, tier);
  }
}

/**
 * Remove tier attribute from DOM
 */
function removeTierFromDOM(): void {
  if (typeof document !== 'undefined') {
    document.documentElement.removeAttribute(TIER_ATTR);
  }
}

/**
 * Apply recording state to DOM
 */
function applyRecordingToDOM(isRecording: boolean): void {
  if (typeof document !== 'undefined') {
    if (isRecording) {
      document.documentElement.setAttribute(RECORDING_ATTR, 'true');
    } else {
      document.documentElement.removeAttribute(RECORDING_ATTR);
    }
  }
}

/**
 * Remove recording attribute from DOM
 */
function removeRecordingFromDOM(): void {
  if (typeof document !== 'undefined') {
    document.documentElement.removeAttribute(RECORDING_ATTR);
  }
}

/**
 * Apply CSS variables for budget values
 */
function applyBudgetCSSVars(budget: VisualBudget): void {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;

  // Numeric values
  root.style.setProperty(CSS_VARS.maxCueWords, String(budget.word.maxCueWords));

  // Boolean flags as 0/1 for CSS consumption
  root.style.setProperty(
    CSS_VARS.allowBounce,
    budget.word.allowBounce ? '1' : '0'
  );
  root.style.setProperty(
    CSS_VARS.allowHeavyNeon,
    budget.word.allowHeavyNeon ? '1' : '0'
  );
  root.style.setProperty(
    CSS_VARS.allowPreviewHandoff,
    budget.line.allowPreviewHandoff ? '1' : '0'
  );
  root.style.setProperty(
    CSS_VARS.allowBlockAwareColor,
    budget.line.allowBlockAwareColor ? '1' : '0'
  );
}

/**
 * Remove all performance CSS variables from DOM
 */
function removeBudgetCSSVars(): void {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;

  Object.values(CSS_VARS).forEach((varName) => {
    root.style.removeProperty(varName);
  });
}

/**
 * Initialize the performance bridge
 *
 * Publishes performance tier to DOM and sets up reactive updates.
 * Call this once during app initialization (e.g., in App.tsx useEffect).
 *
 * @returns Cleanup function to unsubscribe and remove DOM attributes
 *
 * @example
 * ```tsx
 * useEffect(() => {
 *   const cleanup = initPerformanceBridge();
 *   return cleanup;
 * }, []);
 * ```
 */
export function initPerformanceBridge(): () => void {
  // SSR safety check
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return () => {
      // No-op cleanup for SSR
    };
  }

  // Get store instances
  const perfStore = usePerformanceStore.getState();
  const recordingStore = useRecordingStore.getState();

  // Initialize: refresh detection and apply current state
  perfStore.refreshDetectedTier();

  const effectiveTier = perfStore.getEffectiveTier();
  const baseBudget = perfStore.getBudget();
  const isRecording = recordingStore.isRecording || useTakesStore.getState().isRecording;

  // Apply resolved budget (with recording clamp if active)
  const resolvedBudget = isRecording
    ? applyRecordingSafeClamp(baseBudget)
    : baseBudget;

  // Apply to DOM
  applyTierToDOM(effectiveTier);
  applyRecordingToDOM(isRecording);
  applyBudgetCSSVars(resolvedBudget);

  // eslint-disable-next-line no-console
  if (import.meta.env.DEV) console.log('[PerformanceBridge] initialized');

  // Subscribe to performance store changes
  const unsubscribePerf: Unsubscribe = usePerformanceStore.subscribe((state) => {
    const newTier = state.getEffectiveTier();
    const newBaseBudget = state.getBudget();
    const currentIsRecording = useRecordingStore.getState().isRecording || useTakesStore.getState().isRecording;

    // Apply resolved budget (with recording clamp if active)
    const newResolvedBudget = currentIsRecording
      ? applyRecordingSafeClamp(newBaseBudget)
      : newBaseBudget;

    applyTierToDOM(newTier);
    applyBudgetCSSVars(newResolvedBudget);
  });

  // Subscribe to recording store changes
  const unsubscribeRecording: Unsubscribe = useRecordingStore.subscribe((state) => {
    const isRec = state.isRecording || useTakesStore.getState().isRecording;
    const currentTier = usePerformanceStore.getState().getEffectiveTier();
    const currentBaseBudget = usePerformanceStore.getState().getBudget();

    // Apply resolved budget (with recording clamp if active)
    const resolvedBudget = isRec
      ? applyRecordingSafeClamp(currentBaseBudget)
      : currentBaseBudget;

    applyRecordingToDOM(isRec);
    applyTierToDOM(currentTier);
    applyBudgetCSSVars(resolvedBudget);
  });

  // Subscribe to takes store recording changes
  const unsubscribeTakes: Unsubscribe = useTakesStore.subscribe(
    (state) => state.isRecording,
    () => {
      const isRec = useRecordingStore.getState().isRecording || useTakesStore.getState().isRecording;
      const perfState = usePerformanceStore.getState();
      const baseBudget = perfState.getBudget();
      const resolvedBudget = isRec
        ? applyRecordingSafeClamp(baseBudget)
        : baseBudget;
      applyRecordingToDOM(isRec);
      applyTierToDOM(perfState.getEffectiveTier());
      applyBudgetCSSVars(resolvedBudget);
    },
  );

  // Return cleanup function
  return () => {
    unsubscribePerf();
    unsubscribeRecording();
    unsubscribeTakes();
    removeTierFromDOM();
    removeRecordingFromDOM();
    removeBudgetCSSVars();

    // eslint-disable-next-line no-console
    if (import.meta.env.DEV) console.log('[PerformanceBridge] disposed');
  };
}

/**
 * Get current visual tier from DOM
 *
 * Useful for non-React code that needs to read the current tier
 *
 * @returns Current tier from DOM, or 'balanced' if not set
 */
export function getTierFromDOM(): PerformanceTier {
  if (typeof document === 'undefined') {
    return 'balanced';
  }

  const tier = document.documentElement.getAttribute(TIER_ATTR);

  if (
    tier === 'lite' ||
    tier === 'balanced' ||
    tier === 'max' ||
    tier === 'ultra'
  ) {
    return tier;
  }

  return 'balanced';
}

/**
 * Check if a feature is allowed by reading CSS vars
 *
 * Useful for legacy JS code that can't import the store
 *
 * @param varName - CSS variable name (without -- prefix)
 * @returns Boolean value from CSS var (0 = false, anything else = true)
 */
export function isFeatureAllowedFromCSS(varName: keyof typeof CSS_VARS): boolean {
  if (typeof document === 'undefined') {
    return false;
  }

  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(CSS_VARS[varName])
    .trim();

  return value === '1' || value === 'true';
}
