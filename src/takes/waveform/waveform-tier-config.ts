/**
 * Waveform Tier Configuration
 * 
 * Performance parameters for live waveform rendering.
 * Waveform fidelity is now fixed across tiers (384 bars, no frame skipping, 2048 FFT).
 * Tier differences affect only style richness, not bar density or waveform fidelity.
 * 
 * @module waveform-tier-config
 * @see waveform-skins for visual appearance presets
 */

import type { PerformanceTier } from '../../performance/performance.types';
import type { LiveTrailSkin } from './waveform-skins';
import { getLiveTrailSkinForTier } from './waveform-skins';

export interface WaveformTierConfig {
  /** Number of bars for accumulated waveform display */
  barCount: number;
  
  /** Frame skip interval (0 = every frame, 1 = every other frame) */
  skipFrames: number;
  
  /** Analyser FFT size (512, 1024, 2048, etc.) */
  analyserFFT: number;
}

/**
 * Lite tier config: fixed waveform fidelity with cheapest styling
 * Same geometry as all tiers: 384 bars, no frame skipping, 2048 FFT
 * Style richness: minimal (no glow, lower opacity)
 */
const liteConfig: WaveformTierConfig = {
  barCount: 384,
  skipFrames: 0,
  analyserFFT: 2048,
};

/**
 * Balanced tier config: fixed waveform fidelity with baseline styling
 * Same geometry as all tiers: 384 bars, no frame skipping, 2048 FFT
 * Style richness: standard (moderate glow, standard opacity)
 */
const balancedConfig: WaveformTierConfig = {
  barCount: 384,
  skipFrames: 0,
  analyserFFT: 2048,
};

/**
 * Max tier config: fixed waveform fidelity with enhanced styling
 * Same geometry as all tiers: 384 bars, no frame skipping, 2048 FFT
 * Style richness: enhanced (stronger glow, higher opacity)
 */
const maxConfig: WaveformTierConfig = {
  barCount: 384,
  skipFrames: 0,
  analyserFFT: 2048,
};

/**
 * Ultra tier config: fixed waveform fidelity with richest styling
 * Same geometry as all tiers: 384 bars, no frame skipping, 2048 FFT
 * Style richness: maximum (enhanced glow, premium styling)
 */
const ultraConfig: WaveformTierConfig = {
  barCount: 384,
  skipFrames: 0,
  analyserFFT: 2048,
};

/**
 * Get waveform tier configuration by tier name
 * 
 * @param tier - Performance tier name
 * @returns WaveformTierConfig for the specified tier
 */
export function getWaveformTierConfig(tier: PerformanceTier): WaveformTierConfig {
  switch (tier) {
    case 'lite':
      return liteConfig;
    case 'balanced':
      return balancedConfig;
    case 'max':
      return maxConfig;
    case 'ultra':
      return ultraConfig;
    default:
      return balancedConfig;
  }
}

/**
 * Get combined tier config with skin
 * Convenience function that returns both performance and visual settings
 * 
 * @param tier - Performance tier name
 * @returns Object with both config and skin for the tier
 */
export function getWaveformTierConfigWithSkin(
  tier: PerformanceTier
): {
  config: WaveformTierConfig;
  skin: LiveTrailSkin;
} {
  return {
    config: getWaveformTierConfig(tier),
    skin: getLiveTrailSkinForTier(tier),
  };
}

// Re-export skin functions for convenience
export { getLiveTrailSkinForTier } from './waveform-skins';
