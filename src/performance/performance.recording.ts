/**
 * Recording Capture Profile
 *
 * Pure helpers for selecting optimal capture settings based on performance tier.
 * Profile prioritizes stable capture over visual luxury, especially on weaker systems.
 *
 * @module performance.recording
 * @see performance.types for PerformanceTier definition
 */

import type { PerformanceTier } from './performance.types';

/**
 * Capture profile configuration for MediaRecorder
 */
export interface RecordingCaptureProfile {
  /** Target frame rate for video capture */
  frameRate: number;

  /** Video bitrate in bits per second */
  videoBitsPerSecond: number;

  /** Audio bitrate in bits per second */
  audioBitsPerSecond: number;
}

/**
 * Get the optimal capture profile for a given performance tier.
 *
 * Lower tiers use reduced bitrates and frame rates to ensure stable
 * capture on weaker systems. Higher tiers can afford richer capture
 * settings while maintaining stability.
 *
 * @param tier - The performance tier to get profile for
 * @returns RecordingCaptureProfile optimized for the tier
 */
export function getRecordingCaptureProfile(tier: PerformanceTier): RecordingCaptureProfile {
  switch (tier) {
    case 'lite':
      return {
        frameRate: 18,
        videoBitsPerSecond: 2000000, // 2 Mbps
        audioBitsPerSecond: 128000,   // 128 kbps
      };

    case 'balanced':
      return {
        frameRate: 20,
        videoBitsPerSecond: 2400000, // 2.4 Mbps
        audioBitsPerSecond: 160000,   // 160 kbps
      };

    case 'max':
      return {
        frameRate: 24,
        videoBitsPerSecond: 3000000, // 3 Mbps
        audioBitsPerSecond: 192000,   // 192 kbps
      };

    case 'ultra':
      return {
        frameRate: 25,
        videoBitsPerSecond: 3500000, // 3.5 Mbps
        audioBitsPerSecond: 256000,   // 256 kbps
      };

    default:
      // Fallback to balanced for unknown tiers
      return {
        frameRate: 20,
        videoBitsPerSecond: 2400000,
        audioBitsPerSecond: 160000,
      };
  }
}
