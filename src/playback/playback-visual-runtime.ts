/**
 * Playback Visual Runtime
 *
 * Provides one shared scheduler instance for future hot-path migration.
 * This singleton is created lazily and must be explicitly started when needed.
 */

import { PlaybackVisualScheduler } from './playback-visual-scheduler';

let _scheduler: PlaybackVisualScheduler | null = null;

/** Get the shared PlaybackVisualScheduler instance (lazy singleton) */
export function getPlaybackVisualScheduler(): PlaybackVisualScheduler {
  if (!_scheduler) {
    _scheduler = new PlaybackVisualScheduler();
  }
  return _scheduler;
}

/** Dispose the shared scheduler instance if it exists */
export function disposePlaybackVisualScheduler(): void {
  if (_scheduler) {
    _scheduler.dispose();
    _scheduler = null;
  }
}
