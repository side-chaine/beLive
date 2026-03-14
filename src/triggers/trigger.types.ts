// ============================================================
// Trigger Layer — Type Definitions
// ============================================================

/**
 * Classification of trigger signals.
 * - discrete: one-shot event (word-start, beat)
 * - gate: binary on/off state (word-active, line-active)
 * - envelope: shaped 0..1 curve (ADSR)
 * - continuous: smooth 0..1 value (progress, energy)
 */
export type TriggerType = 'discrete' | 'gate' | 'envelope' | 'continuous';

/**
 * Origin of the trigger signal.
 * Extensible for future sources.
 */
export type TriggerSource =
  | 'word-sync'
  | 'line-sync'
  | 'section'
  | 'audio'
  | 'loop'
  | 'custom';

/**
 * Trigger signal IDs — first generation (word + line).
 * Future: section/audio/stem triggers later.
 */
export type TriggerSignalId =
  | 'word-start'
  | 'word-end'
  | 'word-active'
  | 'word-progress'
  | 'word-envelope'
  | 'line-start'
  | 'line-end'
  | 'line-active'
  | 'trigger-reset';

/**
 * Core trigger event — universal contract for all trigger signals.
 */
export interface TriggerEvent {
  id: TriggerSignalId;
  type: TriggerType;
  source: TriggerSource;
  value: number;
  time: number;
  metadata: TriggerMetadata;
}

/**
 * Metadata attached to trigger events.
 */
export interface TriggerMetadata {
  wordId?: string;
  wordText?: string;
  wordIndex?: number;
  lineIndex?: number;
  confidence?: number;
  duration?: number;
  progress?: number;
  intensity?: number;
}

/**
 * Trigger detector interface.
 */
export interface TriggerDetector {
  id: string;
  tick(time: number): TriggerEvent[];
  reset(): void;
}

/**
 * Callback type for trigger bus subscribers.
 */
export type TriggerCallback = (event: TriggerEvent) => void;
