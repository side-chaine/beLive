/**
 * Takes domain types.
 * Session-only vocal recording system for per-block takes.
 */

/** Take lifecycle status */
export type TakeStatus = 'recording' | 'processing' | 'ready' | 'error';

/** Lightweight take metadata — lives in Zustand store */
export interface TakeMeta {
  /** Unique identifier: `take-${blockId}-${slot}` */
  id: string;
  /** Block this take belongs to */
  blockId: string;
  /** Slot index: 0 | 1 | 2 */
  slot: number;
  /** MIME type of recorded audio */
  mimeType: string;
  /** Duration in seconds (null while recording) */
  duration: number | null;
  /** Recording timestamp */
  recordedAt: number;
  /** Current lifecycle status */
  status: TakeStatus;
  /** Whether peaks have been computed */
  peaksReady: boolean;
  /** Seconds to trim from start of recording to align with engine playback */
  trimStartSec: number;
  /** Error message if status === 'error' */
  error?: string;
  /** Telemetry: seconds late from target start (truth capture only, not used for playback/overlay correction yet) */
  lateStartOffsetSec?: number;
  /** Tempo rate for training context (e.g., 0.8 = 80% speed) */
  tempoRate?: number;
  /** Take classification: training or final */
  takeKind?: 'training' | 'final';
}

/** Per-block takes container */
export interface BlockTakes {
  blockId: string;
  /** Fixed 3 slots: null = empty */
  takes: [TakeMeta | null, TakeMeta | null, TakeMeta | null];
  /** Selected take slot for bounce (null = none selected) */
  selectedSlot: number | null;
}

/** Preview mode for take playback */
export type PreviewMode = 'context' | 'solo';

/** View mode for visual source switching (I/V/M) */
export type ViewMode = 'inst' | 'voc' | 'mix';

/** Generate a take ID from block and slot */
export function createTakeId(blockId: string, slot: number): string {
  return `take-${blockId}-${slot}`;
}

/** Create empty BlockTakes for a block */
export function emptyBlockTakes(blockId: string): BlockTakes {
  return {
    blockId,
    takes: [null, null, null],
    selectedSlot: null,
  };
}
