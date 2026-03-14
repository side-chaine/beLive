/**
 * Playback Visual Scheduler
 *
 * A publish-plane coordinator for playback-time visual updates.
 * It is intentionally truth-blind — it does not own timing, sync, or trigger truth.
 * Readers, detectors, and writers own their own domain logic.
 */

import type {
  PlaybackVisualFrameContext,
  PlaybackVisualFrameReader,
  PlaybackVisualFrameDetector,
  PlaybackVisualFrameWriter,
  PlaybackVisualSchedulerMetrics,
} from './playback-visual.types';
import {
  flushQueuedCssVars,
  getQueuedCssVarCount,
} from '../runtime/visual/css-var-batch';

export class PlaybackVisualScheduler {
  private _rafId: number | null = null;
  private _running = false;

  private _readers: PlaybackVisualFrameReader[] = [];
  private _detectors: PlaybackVisualFrameDetector[] = [];
  private _writers: PlaybackVisualFrameWriter[] = [];

  private _frameCount = 0;
  private _lastFrameMs = 0;
  private _avgFrameMs = 0;
  private _queuedCssVarCount = 0;

  /** Register a reader for the 'read' phase */
  registerReader(reader: PlaybackVisualFrameReader): void {
    this._readers.push(reader);
  }

  /** Register a detector for the 'detect' phase */
  registerDetector(detector: PlaybackVisualFrameDetector): void {
    this._detectors.push(detector);
  }

  /** Register a writer for the 'write' phase */
  registerWriter(writer: PlaybackVisualFrameWriter): void {
    this._writers.push(writer);
  }

  /** Unregister any reader, detector, or writer by id */
  unregister(id: string): void {
    this._readers = this._readers.filter((r) => r.id !== id);
    this._detectors = this._detectors.filter((d) => d.id !== id);
    this._writers = this._writers.filter((w) => w.id !== id);
  }

  /** Start the scheduler loop */
  start(): void {
    if (this._running) return;
    this._running = true;
    this._scheduleTick();
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.log('[PlaybackVisualScheduler] started');
    }
  }

  /** Stop the scheduler loop (keeps registered handlers) */
  stop(): void {
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    this._running = false;
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.log('[PlaybackVisualScheduler] stopped');
    }
  }

  /** Check if the scheduler is currently running */
  isRunning(): boolean {
    return this._running;
  }

  /** Get current performance metrics */
  getMetrics(): PlaybackVisualSchedulerMetrics {
    return {
      frameCount: this._frameCount,
      lastFrameMs: this._lastFrameMs,
      avgFrameMs: this._avgFrameMs,
      queuedCssVarCount: this._queuedCssVarCount,
    };
  }

  /** Stop and clear all registered handlers */
  dispose(): void {
    this.stop();
    this._readers = [];
    this._detectors = [];
    this._writers = [];
  }

  /** Internal tick — runs read → detect → write pipeline */
  private _tick = (): void => {
    if (!this._running) return;

    const startMs = performance.now();

    const ctx: PlaybackVisualFrameContext = {
      timestamp: startMs,
    };

    // Phase 1: Read — gather state from stores/sources
    for (const reader of this._readers) {
      reader.read(ctx);
    }

    // Phase 2: Detect — compute changes and deltas
    for (const detector of this._detectors) {
      detector.detect(ctx);
    }

    // Phase 3: Write — publish visual updates
    for (const writer of this._writers) {
      writer.write(ctx);
    }

    // Phase 4: Flush — single batched CSS var write (scheduler owns final publication)
    this._queuedCssVarCount = getQueuedCssVarCount();
    flushQueuedCssVars();

    const endMs = performance.now();
    this._lastFrameMs = endMs - startMs;

    // Simple running average (exponential moving average with alpha=0.1)
    if (this._frameCount === 0) {
      this._avgFrameMs = this._lastFrameMs;
    } else {
      this._avgFrameMs = this._avgFrameMs * 0.9 + this._lastFrameMs * 0.1;
    }

    this._frameCount++;
    this._scheduleTick();
  };

  private _scheduleTick(): void {
    this._rafId = requestAnimationFrame(this._tick);
  }
}
