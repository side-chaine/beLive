/**
 * Stem Domain Types — N-Stem Architecture Foundation
 *
 * WAVE W0: Type registry, routing contracts, state snapshots, automation data.
 * Zero runtime side effects. Pure type definitions + constants.
 *
 * Architecture decisions (❄️ FROZEN by 3 architects + Operator):
 * - StemRole determines routing automatically via ROLE_ROUTING table
 * - master-bus is SEPARATE from music-bus (master clock invariant)
 * - StemLoadMap is Record (serializable), not Map
 * - StemSnapshot.timestamp reserved for W7 conflict resolution
 * - All functionality available at ALL performance tiers
 */

// ─── StemRole ─────────────────────────────────────────────

/**
 * Semantic role of a stem in the mix.
 * Determines automatic routing via ROLE_ROUTING.
 * NOT configurable at runtime — set at load time.
 */
export type StemRole = 'master' | 'music' | 'vocal' | 'backing' | 'effect';

// ─── Routing ──────────────────────────────────────────────

/**
 * Target bus for stem routing.
 * Derived from StemRole via ROLE_ROUTING — never set manually.
 */
export type RoutingTarget = 'master-bus' | 'music-bus' | 'vocal-bus' | 'fx-bus';

/**
 * ❄️ FROZEN: Automatic routing table.
 * Role → Bus assignment. When a stem is loaded with a given role,
 * it is automatically connected to the corresponding bus.
 *
 * INVARIANT: master-bus is separate from music-bus.
 * Rationale: Muting music-bus must NOT affect master clock (instrumental).
 * getCurrentTime() depends on instrumental.audio always playing.
 */
export const ROLE_ROUTING: Readonly<Record<StemRole, RoutingTarget>> = {
  master:  'master-bus',   // instrumental — always plays (clock invariant)
  music:   'music-bus',    // drums, bass, keys, guitar
  vocal:   'vocal-bus',    // lead vocal
  backing: 'vocal-bus',    // backing vocal (same bus, different role)
  effect:  'fx-bus',       // future: reverb sends, etc.
} as const;

// ─── Reactivity Profiles ──────────────────────────────────

/**
 * Per-instrument reactivity profiles for Visual Mixer pulsation.
 * Different stem roles need different visual behavior:
 * - music stems (drums, guitar): hit detection, fast response
 * - vocal: smooth, no hit flash
 * - backing: gentle, minimal pulsation
 */
export interface ReactivityProfile {
  /** Whether to use hit detection for this role */
  useHit: boolean;
  /** EMA smoothing factor (0-1, higher = smoother) */
  smoothing: number;
  /** Scale multiplier for pulsation intensity */
  scaleMultiplier: number;
  /** Hit decay rate (0 = no decay, 0.85 = fast decay) */
  hitDecay: number;
  /** Waveform smoothing factor for canvas rendering */
  waveSmoothing: number;
  /** Visual gain — amplifies energy for CSS (NOT audio!) */
  gainMultiplier: number;
}

export const REACTIVITY_PROFILES: Record<StemRole, ReactivityProfile> = {
  master: {
    useHit: false,
    smoothing: 0.8,
    scaleMultiplier: 0.02,
    hitDecay: 0,
    waveSmoothing: 0.85,
    gainMultiplier: 1.0,
  },
  music: {
    useHit: true,
    smoothing: 0.4,
    scaleMultiplier: 0.08,
    hitDecay: 0.85,
    waveSmoothing: 0.7,
    gainMultiplier: 2.0,
  },
  vocal: {
    useHit: false,
    smoothing: 0.6,
    scaleMultiplier: 0.05,
    hitDecay: 0,
    waveSmoothing: 0.9,
    gainMultiplier: 3.5,
  },
  backing: {
    useHit: false,
    smoothing: 0.75,
    scaleMultiplier: 0.03,
    hitDecay: 0,
    waveSmoothing: 0.9,
    gainMultiplier: 3.0,
  },
  effect: {
    useHit: true,
    smoothing: 0.5,
    scaleMultiplier: 0.06,
    hitDecay: 0.8,
    waveSmoothing: 0.75,
    gainMultiplier: 2.5,
  },
} as const;

/**
 * Per-stem visual gain overrides — takes priority over profile.gainMultiplier.
 * Allows fine-tuning individual instrument sensitivity without changing role profiles.
 * 
 * Keys are quiet instruments (RMS ~0.04-0.08) → high gain (3.5-4.0)
 * Drums/bass are loud (RMS ~0.20-0.30) → moderate gain (2.0-2.5)
 */
export const STEM_SENSITIVITY: Readonly<Record<string, { gain: number }>> = {
  drums:   { gain: 2.0 },
  bass:    { gain: 2.5 },
  guitar:  { gain: 2.0 },
  keys:    { gain: 4.0 },   // Quietest — max amplification
  vocals:  { gain: 3.5 },
  backing: { gain: 3.0 },
  other:   { gain: 4.0 },   // Unknown — strong amplification
};

// ─── Stem Definition ──────────────────────────────────────

/**
 * Static definition of a stem slot.
 * Used in registry, UI labels, and persistence.
 */
export interface StemDefinition {
  /** Unique stem identifier: 'instrumental', 'vocals', 'drums', 'bass', etc. */
  id: string;
  /** Semantic role — determines routing and V-Mix behavior */
  role: StemRole;
  /** Human-readable label for UI: 'Drums', 'Bass', 'Lead Vocal', etc. */
  label: string;
  /** Short label for compact UI: 'Drm', 'Bas', 'Vox', etc. */
  shortLabel?: string;
  /** CSS color for channel strip accent */
  color?: string;
  /** Icon name (future — reserved) */
  icon?: string;
}

/**
 * Built-in stem definitions.
 * Standard 4-stem set (inst + voc) + extended 6-8 stem slots.
 */
export const BUILTIN_STEMS: Readonly<Record<string, StemDefinition>> = {
  instrumental: {
    id: 'instrumental',
    role: 'master',
    label: 'Instrumental',
    shortLabel: 'Inst',
    color: '#e06060',
  },
  vocals: {
    id: 'vocals',
    role: 'vocal',
    label: 'Vocal',
    shortLabel: 'Vox',
    color: '#4f8bff',
  },
  drums: {
    id: 'drums',
    role: 'music',
    label: 'Drums',
    shortLabel: 'Drm',
    color: '#ff9f43',
  },
  bass: {
    id: 'bass',
    role: 'music',
    label: 'Bass',
    shortLabel: 'Bas',
    color: '#ee5a24',
  },
  keys: {
    id: 'keys',
    role: 'music',
    label: 'Keys',
    shortLabel: 'Key',
    color: '#a29bfe',
  },
  guitar: {
    id: 'guitar',
    role: 'music',
    label: 'Guitar',
    shortLabel: 'Gtr',
    color: '#fdcb6e',
  },
  backing: {
    id: 'backing',
    role: 'backing',
    label: 'Back Vocal',
    shortLabel: 'BVox',
    color: '#81ecec',
  },
  other: {
    id: 'other',
    role: 'music',
    label: 'Other',
    shortLabel: 'Oth',
    color: '#b2bec3',
  },
} as const;

// ─── Stem Load Map ────────────────────────────────────────

/**
 * Serializable entry for loading an additional stem.
 * Used in loadTrack() 3rd parameter.
 *
 * MUST be Record (not Map) for:
 * - IDB storage compatibility
 * - postMessage serialization
 * - JSON logging
 */
export interface StemLoadEntry {
  /** If provided, use URL-based load (stem.load) */
  url?: string;
  /** If provided, use loadFromArrayBuffer (progressive loading) */
  data?: ArrayBuffer;
  /** MIME type (required if data provided) */
  type?: string;
  /** Semantic role — determines routing */
  role: StemRole;
  /** Override label (if different from BUILTIN_STEMS) */
  label?: string;
}

/**
 * Additional stems to load alongside instrumental + vocals.
 * Key = stem ID (must match BUILTIN_STEMS key or be custom).
 */
export type StemLoadMap = Record<string, StemLoadEntry>;

// ─── Display Order ────────────────────────────────────────

/**
 * UI display order for stems in the mixer panel.
 * Map<string, StemPlayer> has no guaranteed iteration order,
 * so explicit ordering is required.
 *
 * If stemDisplayOrder is not set in TrackRecord, sort by DEFAULT_ROLE_ORDER.
 * If set, user has manually reordered via drag-n-drop.
 */
export interface StemDisplayOrder {
  stemId: string;
  position: number;
}

/**
 * Default display order by role.
 * Lower number = further left in mixer.
 * Same-role stems sort by load order.
 */
export const DEFAULT_ROLE_ORDER: Readonly<Record<StemRole, number>> = {
  master:  0,    // instrumental — always first
  music:   1,    // drums, bass, keys, guitar — by load order
  vocal:   100,  // lead vocal — after all music
  backing: 101,  // backing vocal — immediately after lead
  effect:  200,  // future
} as const;

/**
 * TC-14-01E: Visual Mixer display order (center-focused layout).
 * Vocals in center, rhythm section left, melodic right.
 */
export const VISUAL_MIXER_DISPLAY_ORDER: Readonly<Record<string, number>> = {
  drums:  0,
  bass:   1,
  guitar: 2,
  vocals: 3,   // CENTER — lead vocal
  keys:   4,
  other:  5,
  backing: 6,
} as const;

/**
 * Sort stems for display in mixer panel.
 * Uses DEFAULT_ROLE_ORDER as primary sort, then stemId as tiebreaker.
 */
export function sortStemsForDisplay(stemIds: string[]): string[] {
  return [...stemIds].sort((a, b) => {
    const defA = BUILTIN_STEMS[a];
    const defB = BUILTIN_STEMS[b];
    const orderA = defA ? DEFAULT_ROLE_ORDER[defA.role] : 999;
    const orderB = defB ? DEFAULT_ROLE_ORDER[defB.role] : 999;
    if (orderA !== orderB) return orderA - orderB;
    return a.localeCompare(b);
  });
}

// ─── Stem Snapshot ────────────────────────────────────────

/**
 * Captured state of all stem controls.
 * Used for:
 * - Exercise entry/exit (save/restore volumes)
 * - Solo toggle (save/restore non-soloed volumes)
 * - Mode switch (save/restore rehearsal volumes)
 *
 * timestamp: Reserved for W7 conflict resolution.
 * If snapshot is older than last manual change, affected stems are not restored.
 * For MVP: capture and restore unconditionally (EXLOCK prevents conflicts).
 */
export interface StemSnapshot {
  volumes: Record<string, number>;
  mutes: Record<string, boolean>;
  solos: Record<string, boolean>;
  pans: Record<string, number>;
  /** Capture timestamp (performance.now()). Reserved for W7. */
  timestamp: number;
}

// ─── Automation Data ──────────────────────────────────────

/**
 * Automation data stored in TrackRecord (IDB).
 * Minimal schema for W0 — reserves space for W8 implementation.
 *
 * Stored in TrackRecord.stemAutomation (optional field).
 * Backward compatible: old records without this field = no automation.
 */
export interface StemAutomationData {
  version: 1;
  lanes: StemAutomationLane[];
}

export interface StemAutomationLane {
  stemId: string;
  param: 'volume' | 'pan';
  points: AutomationPoint[];
  enabled: boolean;
}

export interface AutomationPoint {
  /** Time in seconds (absolute, from track start) */
  time: number;
  /** Parameter value: 0-1 for volume, -1 to 1 for pan */
  value: number;
  /** Interpolation curve to next point */
  curve: 'linear' | 'step' | 'smooth';
}

// ─── Mode Volume Policy ───────────────────────────────────

/**
 * Per-mode stem volume policy.
 * Applied when switching modes (Karaoke, Concert, Rehearsal, Live).
 *
 * ❄️ FROZEN table:
 *   Karaoke:  music=100%, vocal=0%,   backing=0%, mic=off, vmix=off
 *   Concert:  music=100%, vocal=0%,   backing=0%, mic=off, vmix=off
 *   Rehearsal: restored from snapshot (user's last mix)
 *   Live:     music=100%, vocal=0%,   backing=0%, mic=on,  vmix=on
 */
export interface ModeStemPolicy {
  /** Music group volume (drums, bass, keys, guitar, other) */
  musicGroup: number;
  /** Lead vocal volume */
  leadVocal: number;
  /** Backing vocal volume */
  backingVocal: number;
  /** Microphone state */
  mic: 'on' | 'off' | 'user';
  /** V-Mix state */
  vMix: 'on' | 'off' | 'user';
}

/**
 * Built-in mode policies.
 * 'user' means: preserve current user setting (don't override).
 */
export const MODE_STEM_POLICIES: Readonly<Record<string, ModeStemPolicy>> = {
  karaoke: {
    musicGroup: 1,
    leadVocal: 0,
    backingVocal: 0,
    mic: 'off',
    vMix: 'off',
  },
  concert: {
    musicGroup: 1,
    leadVocal: 0,
    backingVocal: 0,
    mic: 'off',
    vMix: 'off',
  },
  rehearsal: {
    musicGroup: 1,  // restored from snapshot — these are fallback defaults
    leadVocal: 1,
    backingVocal: 1,
    mic: 'on',
    vMix: 'user',
  },
  live: {
    musicGroup: 1,
    leadVocal: 0,
    backingVocal: 0,
    mic: 'on',
    vMix: 'on',
  },
} as const;

// ─── Soft Resync Limits ───────────────────────────────────

/**
 * Maximum concurrent soft resync operations per group bus.
 * Prevents inter-stem phasing when two stems in same group
 * are corrected simultaneously in different directions.
 *
 * Tier-dependent: higher tiers allow more concurrent corrections.
 */
export interface SoftResyncBudget {
  maxConcurrentPerGroup: number;
  /** playbackRate deviation: ±rateDelta (e.g., 0.002 = ±0.2%) */
  rateDelta: number;
  /** Drift threshold in seconds to trigger soft resync */
  softThreshold: number;
  /** Drift threshold in seconds to trigger hard resync */
  hardThreshold: number;
}

export const SOFT_RESYNC_DEFAULTS: Readonly<SoftResyncBudget> = {
  maxConcurrentPerGroup: 1,
  rateDelta: 0.005,       // W9-DRIFT-003: ±0.5% — faster soft correction (was ±0.2%)
  softThreshold: 0.020,   // 20ms — start soft correction (unchanged)
  hardThreshold: 0.080,   // W9-DRIFT-003: 80ms — reduce hard resync frequency (was 40ms)
} as const;

// ─── Stem Capacity by Tier ────────────────────────────────

/**
 * Maximum stems and features per performance tier.
 * All functionality available at ALL tiers — only visual quality varies.
 */
export interface StemCapacityBudget {
  maxStems: number;
  maxConcurrentSoftResync: number;
  meterFps: number;
  meterStyle: 'solid' | 'gradient' | 'gradient-peak';
}

export const STEM_CAPACITY_BY_TIER: Readonly<Record<string, StemCapacityBudget>> = {
  lite: {
    maxStems: 4,
    maxConcurrentSoftResync: 1,
    meterFps: 10,
    meterStyle: 'solid',
  },
  balanced: {
    maxStems: 6,
    maxConcurrentSoftResync: 2,
    meterFps: 20,
    meterStyle: 'solid',
  },
  max: {
    maxStems: 8,
    maxConcurrentSoftResync: 4,
    meterFps: 30,
    meterStyle: 'gradient',
  },
  ultra: {
    maxStems: 16,
    maxConcurrentSoftResync: 8,
    meterFps: 60,
    meterStyle: 'gradient-peak',
  },
} as const;

// ─── Loop Pre-Seek ────────────────────────────────────────

/**
 * Two-phase loop architecture constants.
 *
 * Phase 1: Pre-seek followers to loopStart BEFORE master reaches loopEnd.
 *   - Covers Safari seek latency (50-200ms)
 *   - Followers are ready (seeked event received) before jump
 *
 * Phase 2: When master >= loopEnd, seek master + play ALL atomically.
 *   - If followers preloaded: zero-glitch transition
 *   - If not preloaded (timeout): fall back to hard resync
 *
 * Short-loop guard: PRE_SEEK_AHEAD_MS = Math.min(500, loopDuration * 0.3)
 * Prevents pre-seek overlap on short exercise blocks.
 */
export const LOOP_PRE_SEEK_MAX_MS = 500;
export const LOOP_PRE_SEEK_DURATION_RATIO = 0.3;  // 30% of loop duration
export const LOOP_PRE_SEEK_TIMEOUT_MS = 400;       // if seeked not received in 400ms, fallback

// ─── Master Mute Invariant ────────────────────────────────

/**
 * ❄️ FROZEN INVARIANT (A2.25, 🔴 P0):
 *
 * The master stem (instrumental) MUST NEVER be paused or stopped
 * for muting purposes. Mute = only masterVolumeGainNode.gain = 0.
 *
 * Reason: getCurrentTime() reads instrumental.audio.currentTime.
 * If audio element is paused, currentTime freezes → transport breaks.
 *
 * Audio graph for master stem:
 *   instrumental.audio
 *     → sourceNode
 *     → gainNode (clock tap, gain = 1 ALWAYS)
 *     → masterVolumeGainNode (gain = user volume, 0 when muted)
 *     → master-bus
 *
 * This invariant is enforced in AudioEngineV2.setStemMute().
 */
