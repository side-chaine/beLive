/**
 * Performance / Quality System Presets
 *
 * Defines the concrete visual budget policies for each performance tier.
 * This is a pure data module - no side effects, no runtime code.
 *
 * @module performance.presets
 * @see performance.types for type definitions
 */

import type { PerformanceTier, VisualBudget } from './performance.types';

/**
 * Default performance tier for new sessions
 * Balanced provides the current baseline experience
 */
export const DEFAULT_PERFORMANCE_TIER: PerformanceTier = 'balanced';

/**
 * Complete visual budget presets for all performance tiers
 *
 * Each tier defines a coherent policy across all visual domains:
 * - word: individual word effects and guidance
 * - line: line container and preview behavior
 * - background: ambient and reactive effects
 * - audioReactive: beat-synced visuals
 * - scene: 3D/avatar rendering (future)
 */
export const PERFORMANCE_PRESETS: Record<PerformanceTier, VisualBudget> = {
  /**
   * Lite tier: minimal visuals, maximum compatibility
   * Use for: weak devices, battery-sensitive sessions, stability-first
   */
  lite: {
    tier: 'lite',
    word: {
      allowBounce: false,
      allowHeavyNeon: false,
      allowLookahead: false,
      maxCueWords: 0,
      progressMode: 'simple',
      maxGlowLayers: 0,
      maxTrailDepth: 'off',
    },
    line: {
      allowPreviewGlow: false,
      allowPreviewHandoff: false,
      maxLineGlow: 'off',
      allowBlockAwareColor: false,
    },
    background: {
      blurLevel: 0,
      reactiveIntensity: 'off',
      allowParticles: false,
    },
    audioReactive: {
      enabled: false,
      maxBands: 0,
      allowBeatPulse: false,
      allowSpectral: false,
    },
    scene: {
      allow3D: false,
      allowAvatar: false,
      maxSceneComplexity: 'none',
    },
    visualMixer: {
      enabled: true,       // TC-13-19: Enable for testing
      maxCards: 8,
      cardUpdateFps: 20,
      allowPulsation: true,  // TC-13-19: Enable for testing
      allowCardGlow: true,
      allowHitFlash: true,
      allowWaveform: true,
      maxPulseIntensity: 'off',
      allowScenarios: false,
    },
  },

  /**
   * Balanced tier: current baseline, recommended default
   * Use for: general use, most devices, practical readability
   */
  balanced: {
    tier: 'balanced',
    word: {
      allowBounce: true,
      allowHeavyNeon: false,
      allowLookahead: true,
      maxCueWords: 1,
      progressMode: 'full',
      maxGlowLayers: 1,
      maxTrailDepth: 'line',
    },
    line: {
      allowPreviewGlow: true,
      allowPreviewHandoff: false,
      maxLineGlow: 'soft',
      allowBlockAwareColor: true,
    },
    background: {
      blurLevel: 1,
      reactiveIntensity: 'low',
      allowParticles: false,
    },
    audioReactive: {
      enabled: true,
      maxBands: 3,
      allowBeatPulse: true,
      allowSpectral: false,
    },
    scene: {
      allow3D: false,
      allowAvatar: false,
      maxSceneComplexity: 'none',
    },
    visualMixer: {
      enabled: true,
      maxCards: 6,
      cardUpdateFps: 20,
      allowPulsation: true,
      allowCardGlow: false,
      allowHitFlash: true,
      allowWaveform: true,
      maxPulseIntensity: 'soft',
      allowScenarios: true,
    },
  },

  /**
   * Max tier: richer visuals for stronger devices
   * Use for: desktops, high-end mobile, visual-first sessions
   */
  max: {
    tier: 'max',
    word: {
      allowBounce: true,
      allowHeavyNeon: true,
      allowLookahead: true,
      maxCueWords: 2,
      progressMode: 'full',
      maxGlowLayers: 2,
      maxTrailDepth: 'scene',
    },
    line: {
      allowPreviewGlow: true,
      allowPreviewHandoff: true,
      maxLineGlow: 'full',
      allowBlockAwareColor: true,
    },
    background: {
      blurLevel: 2,
      reactiveIntensity: 'medium',
      allowParticles: true,
    },
    audioReactive: {
      enabled: true,
      maxBands: 6,
      allowBeatPulse: true,
      allowSpectral: true,
    },
    scene: {
      allow3D: true,
      allowAvatar: true,
      maxSceneComplexity: 'basic',
    },
    visualMixer: {
      enabled: true,
      maxCards: 8,
      cardUpdateFps: 30,
      allowPulsation: true,
      allowCardGlow: true,
      allowHitFlash: true,
      allowWaveform: true,
      maxPulseIntensity: 'medium',
      allowScenarios: true,
    },
  },

  /**
   * Ultra tier: showcase quality, opt-in only
   * Use for: demo mode, high-end systems, visual showcase
   */
  ultra: {
    tier: 'ultra',
    word: {
      allowBounce: true,
      allowHeavyNeon: true,
      allowLookahead: true,
      maxCueWords: 3,
      progressMode: 'full',
      maxGlowLayers: 3,
      maxTrailDepth: 'scene',
    },
    line: {
      allowPreviewGlow: true,
      allowPreviewHandoff: true,
      maxLineGlow: 'full',
      allowBlockAwareColor: true,
    },
    background: {
      blurLevel: 3,
      reactiveIntensity: 'high',
      allowParticles: true,
    },
    audioReactive: {
      enabled: true,
      maxBands: 8,
      allowBeatPulse: true,
      allowSpectral: true,
    },
    scene: {
      allow3D: true,
      allowAvatar: true,
      maxSceneComplexity: 'full',
    },
    visualMixer: {
      enabled: true,
      maxCards: 16,
      cardUpdateFps: 30,
      allowPulsation: true,
      allowCardGlow: true,
      allowHitFlash: true,
      allowWaveform: true,
      maxPulseIntensity: 'strong',
      allowScenarios: true,
    },
  },
};
