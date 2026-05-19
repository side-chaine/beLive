/**
 * Performance / Quality System Types
 *
 * Defines the type system for visual budget policies across all domains.
 * This is a pure types module - no side effects, no runtime code.
 *
 * @module performance.types
 * @see performance.presets for tier configurations
 */

/**
 * Performance tier levels
 * - lite: minimal visuals, maximum compatibility
 * - balanced: current baseline, recommended default
 * - max: richer visuals for stronger devices
 * - ultra: showcase tier, opt-in only
 */
export type PerformanceTier = 'lite' | 'balanced' | 'max' | 'ultra';

/**
 * Word-level visual budget
 * Controls individual word rendering richness
 */
export interface PerformanceWordBudget {
  /** Allow bounce/grow effects on active words */
  allowBounce: boolean;

  /** Allow heavy neon glow effects (expensive) */
  allowHeavyNeon: boolean;

  /** Allow lookahead/cue word guidance */
  allowLookahead: boolean;

  /** Maximum number of cue words to show (0 = disabled) */
  maxCueWords: 0 | 1 | 2 | 3;

  /** Progress indicator mode */
  progressMode: 'simple' | 'full';

  /** Maximum glow effect layers per word */
  maxGlowLayers: 0 | 1 | 2 | 3;

  /** Maximum trail depth allowed by this tier */
  maxTrailDepth: 'off' | 'line' | 'scene';
}

/**
 * Line-level visual budget
 * Controls line container and preview rendering
 */
export interface PerformanceLineBudget {
  /** Allow glow effects on preview line */
  allowPreviewGlow: boolean;

  /** Allow preview handoff animations */
  allowPreviewHandoff: boolean;

  /** Maximum glow intensity for active line */
  maxLineGlow: 'off' | 'soft' | 'full';

  /** Allow block-aware color routing */
  allowBlockAwareColor: boolean;
}

/**
 * Background visual budget
 * Controls ambient and reactive background effects
 */
export interface PerformanceBackgroundBudget {
  /** Background blur intensity level */
  blurLevel: 0 | 1 | 2 | 3;

  /** Audio-reactive background intensity */
  reactiveIntensity: 'off' | 'low' | 'medium' | 'high';

  /** Allow particle effects */
  allowParticles: boolean;
}

/**
 * Audio-reactive visual budget
 * Controls beat-synced and spectral visual effects
 */
export interface PerformanceAudioReactiveBudget {
  /** Enable audio-reactive visuals */
  enabled: boolean;

  /** Maximum frequency bands to analyze */
  maxBands: number;

  /** Allow beat pulse effects */
  allowBeatPulse: boolean;

  /** Allow full spectral analysis */
  allowSpectral: boolean;
}

/**
 * Scene/avatar visual budget
 * Controls 3D scene and avatar rendering (future)
 */
export interface PerformanceSceneBudget {
  /** Allow 3D scene rendering */
  allow3D: boolean;

  /** Allow avatar rendering */
  allowAvatar: boolean;

  /** Maximum scene complexity level */
  maxSceneComplexity: 'none' | 'basic' | 'full';
}

/**
 * Visual Mixer budget
 * Controls instrument card pulsation, waveforms, and scenarios
 */
export interface PerformanceVisualMixerBudget {
  /** Enable Visual Mixer */
  enabled: boolean;

  /** Maximum number of instrument cards to render */
  maxCards: number;

  /** Card update frequency (frames per second) */
  cardUpdateFps: number;

  /** Allow pulsation animation */
  allowPulsation: boolean;

  /** Allow card glow effects */
  allowCardGlow: boolean;

  /** Allow hit flash effects */
  allowHitFlash: boolean;

  /** Allow waveform canvas rendering */
  allowWaveform: boolean;

  /** Maximum pulsation intensity level */
  maxPulseIntensity: 'off' | 'soft' | 'medium' | 'strong';

  /** Allow quick scenarios */
  allowScenarios: boolean;
}

/**
 * Complete visual budget for a performance tier
 * Aggregates all domain budgets into a single policy object
 */
export interface VisualBudget {
  /** The performance tier this budget represents */
  tier: PerformanceTier;

  /** Word-level visual budget */
  word: PerformanceWordBudget;

  /** Line-level visual budget */
  line: PerformanceLineBudget;

  /** Background visual budget */
  background: PerformanceBackgroundBudget;

  /** Audio-reactive visual budget */
  audioReactive: PerformanceAudioReactiveBudget;

  /** Scene/avatar visual budget */
  scene: PerformanceSceneBudget;

  /** Visual Mixer budget */
  visualMixer: PerformanceVisualMixerBudget;
}
