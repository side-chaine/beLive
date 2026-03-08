/* ── Messages: Worklet → Main ────────────────────── */
export type WorkletMessage =
  | {
      type: 'pitch';
      frequency: number;
      confidence: number;
      rms: number;
      midi: number;
      timestamp: number;
      /** Distortion MVP-0 (optional): composite depth 0..1 */
      depth?: number;
      /** Distortion MVP-0 (optional): subharmonic ratio 0..1 */
      subharmonicRatio?: number;
      /** Distortion MVP-0 (optional): subharmonic frequency (Hz) */
      subFrequency?: number | null;
      /** Distortion MVP-0 (optional): subharmonic midi (float) */
      subMidi?: number | null;
      /** SUB score 0..1 (growl/false-cord family) */
      subScore?: number;
      /** NOISE score 0..1 (scream/rasp), works without pitch */
      noiseScore?: number;
    }
  | { type: 'silence'; rms: number }
  | { type: 'no_pitch'; rms: number; noiseScore?: number }
  | { type: 'ready' };

/* ── Messages: Main → Worklet ────────────────────── */
export type EngineToWorkletMessage =
  | {
      type: 'config';
      threshold?: number;
      noiseGate?: number;
      medianWindow?: number;
      rangeLow?: number;
      rangeHigh?: number;
    }
  | { type: 'reset' };

/* ── Ring Buffer entry ───────────────────────────── */
export interface PitchSample {
  frequency: number;
  midi: number;
  confidence: number;
  timestamp: number;
}

/* ── Scoring thresholds (cents) ──────────────────── */
export const SCORE = {
  PERFECT: 10,
  GREAT: 25,
  OK: 50,
} as const;

/* ── Helpers ─────────────────────────────────────── */
const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

export function midiToNote(midi: number): string {
  const r = Math.round(midi);
  return `${NOTES[((r % 12) + 12) % 12]}${Math.floor(r / 12) - 1}`;
}

export function midiToCents(midi: number): number {
  return Math.round((midi - Math.round(midi)) * 100);
}
