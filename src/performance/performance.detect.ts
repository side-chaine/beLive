/**
 * Performance / Quality System Detection
 *
 * Device capability detection heuristics for automatic tier selection.
 * Safe for SSR - returns balanced if window/navigator unavailable.
 *
 * @module performance.detect
 * @see performance.store for usage
 */

import type { PerformanceTier } from './performance.types';

/**
 * Detect appropriate performance tier based on device capabilities
 *
 * Heuristics:
 * - cores <= 2 or memory <= 2 GB → lite
 * - mobile device → balanced (conservative)
 * - cores >= 8 and not mobile → max
 * - otherwise → balanced
 *
 * Ultra tier is never auto-selected - requires explicit user opt-in.
 *
 * @returns Detected performance tier, or 'balanced' if detection fails
 */
export function detectPerformanceTier(): PerformanceTier {
  // SSR safety: return balanced if window/navigator unavailable
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return 'balanced';
  }

  try {
    // Hardware concurrency (CPU cores)
    const cores = navigator.hardwareConcurrency ?? 2;

    // Device memory in GB (Chrome-only, but widely supported on desktop)
    const memory = (navigator as any).deviceMemory ?? 2;

    // Mobile detection
    const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

    // Tier selection logic
    if (cores <= 2 || memory <= 2) {
      // Low-end device: minimal visuals
      return 'lite';
    }

    if (isMobile) {
      // Mobile: conservative balanced, even if specs look good
      // (thermal throttling, battery concerns)
      return 'balanced';
    }

    if (cores >= 8) {
      // High-end desktop: max tier
      return 'max';
    }

    // Default for mid-range desktop
    return 'balanced';

  } catch {
    // Any detection failure → safe default
    return 'balanced';
  }
}
