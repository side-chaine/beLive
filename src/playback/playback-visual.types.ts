/**
 * Playback Visual Scheduler Types
 *
 * The scheduler coordinates playback-time visual publication.
 * It does NOT own timing truth — timing comes from the audio/sync layer.
 * It does NOT replace trigger or sync truth — it consumes them for visual output.
 */

/** Phase of the visual frame processing pipeline */
export type PlaybackVisualPhase = 'read' | 'detect' | 'write';

/** Context passed through each phase of the visual frame pipeline */
export interface PlaybackVisualFrameContext {
  /** High-resolution timestamp (performance.now()) */
  timestamp: number;

  /** Current playback time in seconds (if available) */
  currentTime?: number;

  /** Whether playback is currently active */
  isPlaying?: boolean;

  /** Current playback rate (1.0 = normal speed) */
  playbackRate?: number;

  /** Index of the currently active lyrics line */
  activeLineIndex?: number;

  /** ID of the currently active word (if word-level sync exists) */
  activeWordId?: string | null;

  /** Index of the currently active word within the line */
  activeWordIndex?: number;

  /** Progress through the current word (0.0 to 1.0) */
  wordProgress?: number;

  /** True if the active line changed this frame */
  lineChanged?: boolean;

  /** True if the active word changed this frame */
  wordChanged?: boolean;
}

/** Reads state from stores/sources into the frame context */
export interface PlaybackVisualFrameReader {
  id: string;
  read(ctx: PlaybackVisualFrameContext): void;
}

/** Detects changes and computes visual state deltas */
export interface PlaybackVisualFrameDetector {
  id: string;
  detect(ctx: PlaybackVisualFrameContext): void;
}

/** Writes computed visual state to DOM/CSS/Canvas */
export interface PlaybackVisualFrameWriter {
  id: string;
  write(ctx: PlaybackVisualFrameContext): void;
}

/** Runtime metrics for scheduler performance monitoring */
export interface PlaybackVisualSchedulerMetrics {
  /** Total number of frames processed */
  frameCount: number;

  /** Duration of the last frame in milliseconds */
  lastFrameMs: number;

  /** Average frame duration over a sliding window */
  avgFrameMs: number;

  /** Number of CSS variables queued for write in the last frame */
  queuedCssVarCount: number;
}
