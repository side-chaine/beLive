export type ClockState = 'idle' | 'playing' | 'paused';

export interface HybridClockEvents {
  /** AudioContext just went suspended/interrupted while we were playing. */
  onInterrupted?: () => void;
  /** Came back to running; arg is how many wall-clock seconds were compensated. */
  onResumed?: (compensatedSeconds: number) => void;
  /** ensureResumed() gave up — surface this to UI, don't fail silently. */
  onResumeFailed?: () => void;
}

/**
 * Master clock for AETHER. Pure performance.now()-anchored, zero HTMLAudioElement
 * dependency — this is the whole point of retiring the old FR-004 "instrumental.audio
 * .currentTime is the master clock" constraint.
 *
 * iOS Safari note (verified against MDN + WebKit bug reports, mid-2026): backgrounding
 * or screen-locking a PWA/tab produces AudioContext.state === 'interrupted', a state
 * that does not exist on desktop browsers and is NOT the same as 'suspended'. A clock
 * that only listens for 'suspended' will silently fail to compensate on iOS — this is
 * the most likely explanation if drift only shows up on iPhone and never on a macOS
 * Safari test. Both states are handled identically here.
 *
 * Also: WebKit does not reliably re-fire statechange when a tab returns to the
 * foreground after a long interruption, so recovery is ALSO attempted proactively
 * on visibilitychange rather than purely reactively. Auto-resume can still fail
 * (e.g. genuine platform bug, or a resume that silently needs a fresh user gesture)
 * — that failure is surfaced via onResumeFailed, it is not swallowed.
 */
export class HybridClock {
  private readonly ctx: AudioContext;
  private readonly events: HybridClockEvents;

  private _state: ClockState = 'idle';
  private _startPerfTime = 0;
  private _startOffset = 0;
  private _playbackRate = 1.0;
  private _totalSuspendDuration = 0;
  private _suspendedAtPerf = 0;
  private _visibilityHandler: (() => void) | null = null;
  // M2 (2b): loop-aware — если loop активен, currentTime сворачивается на loopStart
  private _loopStart = 0;
  private _loopEnd = 0;
  private _loopEnabled = false;

  constructor(ctx: AudioContext, events: HybridClockEvents = {}) {
    this.ctx = ctx;
    this.events = events;
    this.ctx.addEventListener('statechange', this._onStateChange);

    if (typeof document !== 'undefined') {
      this._visibilityHandler = () => {
        if (!document.hidden && this._state === 'playing' && this.ctx.state !== 'running') {
          void this.ensureResumed();
        }
      };
      document.addEventListener('visibilitychange', this._visibilityHandler);
    }
  }

  private _onStateChange = (): void => {
    // 'interrupted' is a real iOS Safari value not present in the TS lib.dom typings.
    const s = this.ctx.state as AudioContextState | 'interrupted';
    if ((s === 'suspended' || s === 'interrupted') && this._state === 'playing' && this._suspendedAtPerf === 0) {
      this._suspendedAtPerf = performance.now();
      this.events.onInterrupted?.();
    } else if (s === 'running' && this._suspendedAtPerf > 0) {
      const sleepSec = (performance.now() - this._suspendedAtPerf) / 1000;
      this._totalSuspendDuration += sleepSec;
      this._suspendedAtPerf = 0;
      this.events.onResumed?.(sleepSec);
    }
  };

  start(offset: number): void {
    this._startOffset = Math.max(0, offset);
    this._startPerfTime = performance.now();
    this._totalSuspendDuration = 0;
    this._suspendedAtPerf = 0;
    this._state = 'playing';
  }

  pause(): void {
    if (this._state === 'playing') this._startOffset = this.getCurrentTime();
    this._state = 'paused';
  }

  /** Repositions only — does not itself start or stop audio. Caller (TransportV3) decides that. */
  seek(time: number): void {
    this._startOffset = Math.max(0, time);
    if (this._state === 'playing') {
      this._startPerfTime = performance.now();
      this._totalSuspendDuration = 0;
      this._suspendedAtPerf = 0;
    }
  }

  stop(): void {
    this._startOffset = 0;
    this._state = 'idle';
    this._suspendedAtPerf = 0;
  }

  getCurrentTime(): number {
    if (this._state !== 'playing') return this._startOffset;
    const perfElapsedSec = (performance.now() - this._startPerfTime) / 1000;
    // Suspend time is subtracted BEFORE scaling by rate: it's wall-clock time that
    // never happened for playback purposes, regardless of what rate was set.
    const adjustedSec = Math.max(0, perfElapsedSec - this._totalSuspendDuration);
    const raw = this._startOffset + adjustedSec * this._playbackRate;
    // M2 (2b): loop-aware — если loop активен, currentTime сворачивается на loopStart
    if (this._loopEnabled && this._loopEnd > this._loopStart) {
      const span = this._loopEnd - this._loopStart;
      if (raw >= this._loopEnd) {
        return this._loopStart + ((raw - this._loopStart) % span);
      }
    }
    return raw;
  }

  setLoop(start: number, end: number): void {
    this._loopStart = start;
    this._loopEnd = end;
    this._loopEnabled = end > start;
  }
  clearLoop(): void { this._loopEnabled = false; }

  setPlaybackRate(rate: number): void {
    if (rate <= 0) throw new Error('playbackRate must be > 0');
    if (this._state === 'playing') {
      this._startOffset = this.getCurrentTime();
      this._startPerfTime = performance.now();
      this._totalSuspendDuration = 0;
      this._suspendedAtPerf = 0;
    }
    this._playbackRate = rate;
  }

  /** Idempotent — safe to call redundantly (e.g. from both play() and a visibility check). */
  async ensureResumed(timeoutMs = 3000): Promise<boolean> {
    if (this.ctx.state === 'running') return true;
    try {
      const TIMED_OUT = Symbol('timeout');
      const result = await Promise.race([
        this.ctx.resume().then((): 'resumed' => 'resumed'),
        new Promise<typeof TIMED_OUT>((resolve) => setTimeout(() => resolve(TIMED_OUT), timeoutMs)),
      ]);
      const ok = result !== TIMED_OUT && (this.ctx.state as string) === 'running';
      if (!ok) this.events.onResumeFailed?.();
      return ok;
    } catch {
      this.events.onResumeFailed?.();
      return false;
    }
  }

  dispose(): void {
    this.ctx.removeEventListener('statechange', this._onStateChange);
    if (this._visibilityHandler && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this._visibilityHandler);
    }
  }

  get state(): ClockState {
    return this._state;
  }

  get playbackRate(): number {
    return this._playbackRate;
  }
}
