/**
 * Playback Visual Scheduler
 *
 * Foundation module for coordinated playback-time visual updates.
 * No side effects — safe to import anywhere.
 */

// Types
export type {
  PlaybackVisualPhase,
  PlaybackVisualFrameContext,
  PlaybackVisualFrameReader,
  PlaybackVisualFrameDetector,
  PlaybackVisualFrameWriter,
  PlaybackVisualSchedulerMetrics,
} from './playback-visual.types';

// Scheduler class
export { PlaybackVisualScheduler } from './playback-visual-scheduler';

// Runtime singleton access
export {
  getPlaybackVisualScheduler,
  disposePlaybackVisualScheduler,
} from './playback-visual-runtime';
