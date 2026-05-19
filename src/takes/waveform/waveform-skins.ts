/**
 * Live Trail Waveform Skins
 * 
 * Defines visual appearance presets for the accumulated waveform trail.
 * Each performance tier has a corresponding skin with appropriate visual properties.
 * 
 * @module waveform-skins
 * @see waveform-tier-config for performance parameters
 */

import type { PerformanceTier } from '../../performance/performance.types';

export interface LiveTrailSkin {
  /** Base color of the trail bars */
  color: string;
  
  /** Opacity level (0.0 - 1.0) */
  opacity: number;
  
  /** Gap between bars in pixels (0 = no gap) */
  barGap: number;
  
  /** Optional glow effect */
  glow: {
    /** Glow color */
    color: string;
    /** Blur radius in pixels */
    blur: number;
  } | null;
}

/**
 * Lite tier skin: minimal visuals, maximum clarity
 * No glow, lower opacity for performance
 */
export const liteLiveTrailSkin: LiveTrailSkin = {
  color: '#ffa500',
  opacity: 0.70,
  barGap: 1,
  glow: null,
};

/**
 * Balanced tier skin: current baseline
 * Moderate opacity, no glow for readability
 */
export const balancedLiveTrailSkin: LiveTrailSkin = {
  color: '#ffa500',
  opacity: 0.85,
  barGap: 0,
  glow: null,
};

/**
 * Max tier skin: richer visuals
 * Slight glow effect for enhanced visibility
 */
export const maxLiveTrailSkin: LiveTrailSkin = {
  color: '#ffa500',
  opacity: 0.90,
  barGap: 0,
  glow: {
    color: '#ff8c00',
    blur: 4,
  },
};

/**
 * Ultra tier skin: showcase quality
 * Stronger glow for visual impact
 */
export const ultraLiveTrailSkin: LiveTrailSkin = {
  color: '#ffa500',
  opacity: 0.95,
  barGap: 0,
  glow: {
    color: '#ff8c00',
    blur: 6,
  },
};

/**
 * Get live trail skin by tier name
 * 
 * @param tier - Performance tier name
 * @returns Corresponding LiveTrailSkin
 */
export function getLiveTrailSkinForTier(tier: PerformanceTier): LiveTrailSkin {
  switch (tier) {
    case 'lite':
      return liteLiveTrailSkin;
    case 'balanced':
      return balancedLiveTrailSkin;
    case 'max':
      return maxLiveTrailSkin;
    case 'ultra':
      return ultraLiveTrailSkin;
    default:
      return balancedLiveTrailSkin;
  }
}
