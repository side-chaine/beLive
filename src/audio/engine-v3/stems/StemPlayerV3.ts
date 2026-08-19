import { DuckGuardV3Native } from '../integration/DuckGuardV3Native';
import type { StemId } from '../core/types';

export interface StemPlayerOptions {
  id: StemId;
  ctx: AudioContext;
  /** Only the designated master-clock stem's natural end escalates to the orchestrator.
   * Every other stem just goes quiet on its own — this is the fix for "shortest stem's
   * onended kills the whole track 5 seconds early". */
  isMasterClock?: boolean;
  onNaturalEnd?: (id: StemId) => void;
}

/**
 * Overlapping source info for GC
 */
interface ActiveSource {
  source: AudioBufferSourceNode;
  gain: GainNode;
}

export class StemPlayerV3 {
  readonly id: StemId;
  private readonly ctx: AudioContext;
  private readonly isMasterClock: boolean;
  private readonly onNaturalEnd?: (id: StemId) => void;

  private _buffer: AudioBuffer | null = null;
  /** Current (most recent) active source */
  private _source: AudioBufferSourceNode | null = null;
  /** Per-source gain for the current source — enables overlapping crossfade */
  private _sourceGain: GainNode | null = null;
  /** Old sources being faded out during overlapping swap */
  private _oldSources: ActiveSource[] = [];
  private _isDisposing = false;


  private readonly _faderGain: GainNode;
  private readonly _duckGain: GainNode;
  private readonly _analyser: AnalyserNode;
  private readonly _duck: DuckGuardV3Native;

  private _loopActive = false;
  private _loopStart = 0;
  private _loopEnd = 0;

  constructor(opts: StemPlayerOptions) {
    this.id = opts.id;
    this.ctx = opts.ctx;
    this.isMasterClock = opts.isMasterClock ?? false;
    this.onNaturalEnd = opts.onNaturalEnd;

    // TC-01 fix: fader and duck live on SEPARATE GainNodes, structurally, not just by
    // convention. A plain .value assignment (fader) never touches AudioParam automation
    // scheduled on a DIFFERENT node, so a user dragging the fader mid-loop can never be
    // silently overridden by a duck-wrap point scheduled up to 120s earlier with the old
    // value baked in — which is exactly what happened when both lived on one node.
    this._faderGain = this.ctx.createGain();
    this._duckGain = this.ctx.createGain();
    this._faderGain.connect(this._duckGain);

    this._analyser = this.ctx.createAnalyser();
    this._analyser.fftSize = 256;
    // Parallel tap (FR-005 style): analyser is a SIDE connection off the FINAL stage,
    // not inline in the signal path. Disconnecting/reconfiguring metering later must
    // never silence output.
    this._duckGain.connect(this._analyser);
    // ⚠️ direct destination удалён в TC-2C. Стемы подключаются через StemOrchestrator → MonitorRouter.
    // outputNode() остаётся _duckGain — внешний контракт не сломан.

    // DuckGuard owns the duck-only node. baseGain is 1.0, never `this.volume` —
    // the fader's contribution is applied on the OTHER node, multiplicatively,
    // and is never part of what duck automation resets to.
    this._duck = new DuckGuardV3Native(this._duckGain.gain);
  }

  /** Connect THIS downstream (to VocalMix/merger/destination/etc). Still the final stage —
   * external contract is unchanged even though there are now two gain stages internally. */
  get outputNode(): GainNode {
    return this._duckGain;
  }
  get analyserNode(): AnalyserNode {
    return this._analyser;
  }
  get duration(): number {
    return this._buffer?.duration ?? 0;
  }
  get volume(): number {
    return this._faderGain.gain.value;
  }
  set volume(v: number) {
    this._faderGain.gain.value = v;
  }

  setBuffer(buffer: AudioBuffer): void {
    this._buffer = buffer;
  }

  getBuffer(): AudioBuffer | null {
    return this._buffer;
  }

  shouldPlayAt(offsetSec: number): boolean {
    return this._buffer !== null && offsetSec < this.duration;
  }

  /**
   * Loop points must already be resolved to the CANONICAL (shared-across-all-stems)
   * start/end — compute them once via LoopEngineV3.computeCanonicalLoop() against the
   * master-clock stem's buffer, then call setLoop() with the same numbers on every stem.
   * Do not call a per-stem independent zero-crossing search here.
   */
  setLoop(canonicalStart: number, canonicalEnd: number): void {
    this._loopActive = true;
    this._loopStart = canonicalStart;
    this._loopEnd = canonicalEnd;
    if (this._source) this._applyLoopToSource(this._source);
  }

  clearLoop(): void {
    this._loopActive = false;
    if (this._source) this._source.loop = false;
    this._duck.cancel(this.ctx.currentTime, 1.0);
  }

  private _applyLoopToSource(source: AudioBufferSourceNode): void {
    if (!this._loopActive || !this._buffer) return;
    if (this._buffer.duration < this._loopEnd) return; // loop range past this stem's own audio
    source.loop = true;
    source.loopStart = this._loopStart;
    source.loopEnd = this._loopEnd;
  }

  /** Pre-schedules loop-boundary micro-ducks. Called automatically from startAt() when looping. */
  private _scheduleLoopDucks(startedAtCtxTime: number, startedAtOffset: number, rate: number, coverSeconds = 120): void {
    if (!this._loopActive || !this._buffer || rate <= 0) return;
    const loopPeriodCtx = (this._loopEnd - this._loopStart) / rate;
    if (loopPeriodCtx <= 0) return;

    const distanceToFirstEnd = (this._loopEnd - startedAtOffset) / rate;
    if (distanceToFirstEnd <= 0) return; // started already past the loop's own end point

    const firstWrapAt = startedAtCtxTime + distanceToFirstEnd;
    const wrapCount = Math.max(1, Math.ceil(coverSeconds / loopPeriodCtx));
    this._duck.scheduleLoopWrapDucks({
      baseGain: 1.0,
      ctxNow: this.ctx.currentTime,
      firstWrapAt,
      wrapPeriodSec: loopPeriodCtx,
      wrapCount,
    });
  }

  /**
   * Start stem with instant kill (original behavior).
   * Used by StemOrchestrator.playAllAt() for normal play/restart.
   * Kills previous source immediately — no crossfade.
   */
  startAt(targetStartCtxTime: number, offsetSec: number, rate: number): void {
    if (!this.shouldPlayAt(offsetSec)) return;
    this._killAllSources();

    const source = this.ctx.createBufferSource();
    source.buffer = this._buffer;
    source.playbackRate.value = rate;
    this._applyLoopToSource(source);

    const sourceGain = this.ctx.createGain();
    sourceGain.gain.value = 1.0;
    source.connect(sourceGain);
    sourceGain.connect(this._faderGain);

    // 🔬 RECON-1: аудит gains перед стартом (dev only)
    if (import.meta.env.DEV) console.log(`[RECON-1] Stem:${this.id} | faderGain:${this._faderGain.gain.value.toFixed(4)} | duckGain:${this._duckGain.gain.value.toFixed(4)} | buffer:${!!this._buffer} | rate:${rate} | offset:${offsetSec}`);

    source.onended = () => {
      if (this._isDisposing) return; // intentional stop/pause/seek, not a natural end
      this._source = null;
      this._sourceGain = null;
      if (this.isMasterClock) this.onNaturalEnd?.(this.id);
    };

    source.start(targetStartCtxTime, offsetSec);
    this._source = source;
    this._sourceGain = sourceGain;

    if (this._loopActive) this._scheduleLoopDucks(targetStartCtxTime, offsetSec, rate);
  }

  /**
   * 🔥 AGENT_202 KILLSHOT #1 + #2: Overlapping Source Swap
   *
   * Creates a new source with per-source GainNode while the old source
   * is still playing. Schedules a 20ms crossfade:
   *   - Old source: gain 1→0 (fade out)
   *   - New source: gain 0→1 (fade in)
   *
   * Topology:
   *   source (new) → sourceGain → faderGain → duckGain → outputNode
   *   source (old) → sourceGain (fading out) → faderGain
   *
   * No _killSourceSafe(). No setTimeout(). Pure Web Audio Native Scheduling.
   */
  startAtOverlap(
    targetStartCtxTime: number,
    offsetSec: number,
    rate: number,
    fadeMs: number = 20
  ): void {
    if (!this.shouldPlayAt(offsetSec)) return;

    const now = this.ctx.currentTime;
    const switchTime = Math.max(targetStartCtxTime, now);
    const fadeSec = fadeMs / 1000;

    // 1. Move current source to _oldSources (will be faded out)
    if (this._source && this._sourceGain) {
      // Schedule fade-out on old source
      this._sourceGain.gain.cancelScheduledValues(now);
      this._sourceGain.gain.setValueAtTime(this._sourceGain.gain.value, switchTime);
      this._sourceGain.gain.linearRampToValueAtTime(0, switchTime + fadeSec);

      // Schedule stop after crossfade completes
      try {
        this._source.onended = null; // detach master-clock handler
        this._source.stop(switchTime + fadeSec + 0.005);
      } catch { /* already stopped */ }

      this._oldSources.push({ source: this._source, gain: this._sourceGain });
      this._source = null;
      this._sourceGain = null;

      // 🟢 E.3: Clear old DuckGuard schedules — они принадлежали старому source
      this._duck.cancel(now, 1.0)
    }

    // 2. Create new source + per-source gain
    const source = this.ctx.createBufferSource();
    source.buffer = this._buffer;
    source.playbackRate.value = rate;
    this._applyLoopToSource(source);

    const sourceGain = this.ctx.createGain();
    sourceGain.gain.setValueAtTime(0, switchTime);
    sourceGain.gain.linearRampToValueAtTime(1, switchTime + fadeSec); // fade in

    source.connect(sourceGain);
    sourceGain.connect(this._faderGain);

    // 🔬 RECON-1: аудит gains перед стартом (dev only)
    if (import.meta.env.DEV) console.log(`[RECON-1] Stem:${this.id} OVERLAP | rate:${rate} | offset:${offsetSec} | fade:${fadeMs}ms`);

    source.onended = () => {
      // Clean up from _oldSources
      this._oldSources = this._oldSources.filter(s => s.source !== source);
      try { sourceGain.disconnect(); } catch {}

      if (this._source === source) {
        this._source = null;
        this._sourceGain = null;
      }
      if (!this._isDisposing && this.isMasterClock) {
        this.onNaturalEnd?.(this.id);
      }
    };

    source.start(switchTime, offsetSec);
    this._source = source;
    this._sourceGain = sourceGain;

    if (this._loopActive) this._scheduleLoopDucks(switchTime, offsetSec, rate);
  }

  /**
   * 🎯 Sonnet: Live rate update for Bus B varispeed stems.
   *
   * Устанавливает playbackRate.value на активном AudioBufferSourceNode
   * через AudioParam — мгновенно, без пересоздания источника.
   * Вызывается из HybridPipelineService.setPlaybackRate() при смене темпа.
   *
   * Без этого метода стемы на Bus B навсегда застряли бы на старом rate
   * после того как мы убрали _restartStemsAt() из RateThrottler (баг #2).
   */
  setLiveRate(rate: number): void {
    if (!this._source) return
    const now = this.ctx.currentTime
    this._source.playbackRate.cancelScheduledValues(now)
    this._source.playbackRate.setValueAtTime(rate, now)
  }

  /** Stops audio, leaves loop config and buffer intact. Safe to call redundantly. */
  pause(): void {
    this._killAllSources();
  }

  /**
   * 🔥 AGENT_202 KILLSHOT: Мгновенный стоп ВСЕХ источников (старых + текущего).
   * Используется в pause() и dispose() — где нужен instant kill, не crossfade.
   */
  private _killAllSources(): void {
    this._isDisposing = true;

    // Kill current source
    if (this._source) {
      const s = this._source;
      s.onended = null;
      try { s.stop(); } catch { /* Safari: InvalidStateError — harmless */ }
      try { s.disconnect(); } catch { /* already disconnected */ }
      this._source = null;
      this._sourceGain = null;
    }

    // Kill old overlapping sources
    for (const s of this._oldSources) {
      try { s.source.onended = null; } catch {}
      try { s.source.stop(); } catch {}
      try { s.source.disconnect(); } catch {}
      try { s.gain.disconnect(); } catch {}
    }
    this._oldSources = [];

    this._isDisposing = false;
  }

  dispose(): void {
    this._killAllSources();
    try {
      this._faderGain.disconnect();
    } catch {
      /* noop */
    }
    try {
      this._analyser.disconnect();
    } catch {
      /* noop */
    }
    try {
      this._duckGain.disconnect();
    } catch {
      /* noop */
    }
    this._buffer = null;
  }
}
