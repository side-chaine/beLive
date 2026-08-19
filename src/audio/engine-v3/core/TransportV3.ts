import { HybridClock } from './HybridClock';
import { StemOrchestrator } from './StemOrchestrator';
import { RateThrottler } from '../services/RateThrottler';
import type { TransportState } from './types';
import type { IPipelineController } from '../pipeline/IPipelineController';

export interface TransportStateChangeDetail {
  state: TransportState;
}

/**
 * Public event surface. Extends EventTarget (native, works directly with React's
 * addEventListener/removeEventListener in useEffect, no custom pub-sub needed) because
 * this now has MULTIPLE independent consumers — V3StatePublisher wants every state
 * change and tick, a React health hook wants only 'audioglitch'. A single fixed
 * constructor-time callback (last revision) can't serve more than one listener; this
 * replaces that.
 *
 * Events dispatched:
 *  - 'statechange'  CustomEvent<TransportStateChangeDetail>
 *  - 'audioglitch'  Event  — AudioContext could not be recovered after an interruption.
 *                             There is no V2 to fall back to anymore; surface this to
 *                             UI as a real recovery affordance, do not go silent.
 */
const RENDER_QUANTUM_SAMPLES = 128;
const START_SAFETY_MARGIN_MS = 5;

export interface PlaybackRateChangeDetail {
  rate: number;
}

export class TransportV3 extends EventTarget {
  private readonly ctx: AudioContext;
  private readonly clock: HybridClock;
  private readonly stems: StemOrchestrator;

  private _state: TransportState = 'idle';
  private _seekGeneration = 0;
  private _pipelineController: IPipelineController | null = null;
  private readonly _rateThrottler: RateThrottler;
  /** 🎯 Sonnet: last rate that the throttler callback ACTUALLY applied.
   *  NOT clock.playbackRate (which updates synchronously on every setPlaybackRate call).
   *  Used for guard comparison in the throttler callback. */
  private _appliedRate = 1.0;
  /** 🆕 кэш — защита от duration=0 при переключении треков */
  private _lastTrackDuration = 0;

  constructor(ctx: AudioContext, masterClockStemId: string) {
    super();
    this.ctx = ctx;
    this.clock = new HybridClock(ctx, {
      onResumeFailed: () => this.dispatchEvent(new Event('audioglitch')),
    });
    this.stems = new StemOrchestrator({
      ctx,
      masterClockStemId,
      onTrackEnded: () => this._handleTrackEnded(),
    });

    // RateThrottler — 20Hz защита WASM от 60Hz спама слайдером
    this._rateThrottler = new RateThrottler((rate: number) => {
      // 🔥 Sonnet guard: сравниваем с тем, что САМИ применили в прошлый раз
      // clock.playbackRate обновляется синхронно ДО throttled-коллбэка — всегда совпадает,
      // сравнивать с ним бессмысленно (баг #1 из VERDICT-6)
      if (this._appliedRate === rate) return
      this._appliedRate = rate
      this._pipelineController?.setPlaybackRate(rate)
      // _restartStemsAt() удалён — REGIME 3 (WASM stretch) читает rate на лету
      // через scheduleRateAll(). Bus B varispeed обновляется через stem.setLiveRate()
      // в HybridPipelineService.setPlaybackRate(). Никакого пересоздания источников.
    }, 50 /* ms = 20Hz */)
  }

  get state(): TransportState {
    return this._state;
  }
  get currentTime(): number {
    return this.clock.getCurrentTime();
  }
  get duration(): number {
    const d = this._pipelineController?.duration ?? this.stems.duration;
    if (d > 0) this._lastTrackDuration = d;
    return d > 0 ? d : this._lastTrackDuration;
  }
  get orchestrator(): StemOrchestrator {
    return this.stems;
  }
  /** Публичный доступ к состоянию AudioContext */
  get isAudioContextRunning(): boolean {
    return this.ctx.state === 'running' || this.ctx.state === 'suspended';
  }
  /** 009: публичный getter вместо 7 копий orchestrator.all().length > 0 */
  get isV3Active(): boolean {
    return this._pipelineController !== null
  }

  /** Expose current playback rate for test diagnostics (🟡 #3 fix) */
  get playbackRate(): number {
    return this.clock.playbackRate;
  }

  private _setState(s: TransportState): void {
    this._state = s;
    this.dispatchEvent(new CustomEvent<TransportStateChangeDetail>('statechange', { detail: { state: s } }));
  }

  private _dispatchRateChange(rate: number): void {
    this.dispatchEvent(new CustomEvent<PlaybackRateChangeDetail>('ratechange', { detail: { rate } }));
  }

  private _nextRenderQuantumTime(marginMs = START_SAFETY_MARGIN_MS): number {
    const quantumSec = RENDER_QUANTUM_SAMPLES / this.ctx.sampleRate;
    return Math.ceil((this.ctx.currentTime + marginMs / 1000) / quantumSec) * quantumSec;
  }

  /**
   * `initialOffset` only applies when starting fresh from 'idle'/'ended' — a plain
   * resume from 'paused' always continues from wherever it was paused, regardless
   * of what's passed here. This exists specifically so a first-activation caller
   * (e.g. __switchToV3) can start-at-position in one call instead of playing from
   * 0 and immediately reseeking — the reseek dance technically worked (StemPlayerV3's
   * kill-safe already tolerates stopping a not-yet-audible scheduled source), but it
   * was a wasted schedule-then-cancel round trip for something that has a direct fix.
   */
  async play(initialOffset?: number): Promise<void> {
    console.trace('[TRACE-PLAY]')
    if (this._state === 'idle' || this._state === 'ended') {
      this.clock.seek(initialOffset ?? 0);
      this._setState('ready');
    }
    if (this._state !== 'ready' && this._state !== 'paused') {
      console.log('[TRACE] play() return: state not ready/paused', { state: this._state })
      return;
    }

    const resumed = await this.clock.ensureResumed();
    if (!resumed) {
      console.log('[TRACE] play() return: ensureResumed failed')
      this.dispatchEvent(new Event('audioglitch'));
      return;
    }

    // 🔥 Agent_202 Hard Guard: прямой ctx.resume() + state check
    if (this.ctx.state !== 'running') {
      try { await this.ctx.resume() } catch { /* ignore */ }
    }
    if (this.ctx.state !== 'running') {
      console.log('[TRACE] play() return: ctx not running after resume')
      this.dispatchEvent(new Event('audioglitch'))
      return
    }

    const offset = this.clock.getCurrentTime();
    const rate = this.clock.playbackRate;
    const targetStart = this._nextRenderQuantumTime();

    // 🛡️ 202: sync _appliedRate before play — если rate меняли на паузе, throttler
    // не сработал (state !== 'playing'), и _appliedRate остался старым.
    // Без этого guard в throttler'e пропустит первое легитимное изменение после play.
    this._appliedRate = rate
    await this._restartStemsAt(targetStart, offset, rate);
    this.clock.start(offset);
    this._setState('playing');
    console.log('[TRACE] ✅ play() success', { offset, rate, state: this._state })
  }

  async pause(): Promise<void> {
    console.trace('[TRACE-PAUSE]')
    if (this._state !== 'playing') return;
    // 🔥 Flush Guard: применяем зависший rate ДО остановки источников
    this._rateThrottler.flush()
    this.clock.pause();
    if (this._pipelineController) {
      await this._pipelineController.pause()
    } else {
      this.stems.pauseAll()
    }
    this._setState('paused');
  }

  stop(): void {
    if (this._state === 'idle') return;
    if (this._pipelineController) {
      this._pipelineController.stop()
    } else {
      this.stems.pauseAll()
    }
    this.clock.stop();
    this._setState('idle');
  }

  /**
   * Seeking while PAUSED repositions silently and stays paused — it must never start
   * audio on its own (that would be a surprising autoplay-on-scrub regression). Seeking
   * while PLAYING restarts every qualifying stem at the new offset. A generation counter
   * guards the async gap (ensureResumed) against a second seek racing in before the
   * first one finishes — rapid scrubbing should only ever result in the LAST seek
   * actually taking effect.
   */
  async seek(time: number): Promise<void> {
    if (this._state !== 'playing' && this._state !== 'paused') return;
    // 🔥 Flush Guard: применяем зависший rate ДО seek
    this._rateThrottler.flush()
    const wasPlaying = this._state === 'playing';
    const myGeneration = ++this._seekGeneration;

    this.stems.pauseAll();
    this.clock.seek(time);

    if (!wasPlaying) {
      this._setState('paused');
      return;
    }

    const resumed = await this.clock.ensureResumed();
    if (myGeneration !== this._seekGeneration) return;
    if (!resumed) {
      this.dispatchEvent(new Event('audioglitch'));
      return;
    }

    const rate = this.clock.playbackRate;
    // 🎯 Sonnet: когда wasPlaying === true, вызываем ТОЛЬКО pipelineController.seek()
    // _restartStemsAt() + clock.start() — жёсткий start(), нужен только для play() из паузы/idle
    // pipelineController.seek() — мягкий overlap crossfade, правильный для live seek
    if (this._pipelineController) {
      this._pipelineController.seek(time, rate)
    } else {
      const targetStart = this._nextRenderQuantumTime();
      this._restartStemsAt(targetStart, time, rate);
      this.clock.start(time);
    }
    this._setState('playing');
  }

  setPlaybackRate(rate: number): void {
    // Немедленно: clock + dispatch (дёшево, UI feedback)
    this.clock.setPlaybackRate(rate);
    this._dispatchRateChange(rate)

    // Throttled: pipeline + stem restart (дорого, WASM)
    // RateThrottler сам вызовет _pipelineController.setPlaybackRate()
    // и restart стемов при необходимости
    this._rateThrottler.set(rate)
  }

  /** Applies one shared loop length to every stem; re-seeks in place if currently playing
   * so the native loop + scheduled ducks actually take effect immediately. */
  async setLoop(start: number, end: number): Promise<void> {
    this.stems.setLoopOnAllStems(start, end);
    if (this._pipelineController) this._pipelineController.setLoop(start, end)
    // M2 (2b): clock тоже знает loop-границы — плейхэд заворачивается (а не растёт мимо loopEnd)
    this.clock.setLoop(start, end)
    if (this._state === 'playing') await this.seek(this.clock.getCurrentTime());
  }

  clearLoop(): void {
    this.stems.clearLoopOnAllStems();
    if (this._pipelineController) this._pipelineController.clearLoop()
    // Sonnet (loop-desync): берём завёрнутое значение ДО отключения wrap,
    // иначе getCurrentTime() после clearLoop прыгнет вперёд на накопленные круги лупа.
    const resyncTime = this.clock.getCurrentTime()
    // M2 (2b): сброс wrap-логики в clock
    this.clock.clearLoop()
    if (this._state === 'playing') void this.seek(resyncTime)
  }

  private _handleTrackEnded(): void {
    this.stems.pauseAll();
    this.clock.pause();
    this._setState('ended');
  }

  attachPipeline(controller: IPipelineController): void {
    this._pipelineController = controller
    console.log('[TransportV3] ✅ PipelineController attached')
  }

  /**
   * Single entry point for ALL stem restarts.
   * Если Pipeline активен — делегируем ему (REGIME 3: per-stem stretch).
   * Если Pipeline отсутствует — fallback на varispeed (StemOrchestrator).
   * Никогда не вызываем оба — это double-play баг.
   */
  private async _restartStemsAt(targetStart: number, offset: number, rate: number): Promise<void> {
    if (this._pipelineController) {
      await this._pipelineController.play(offset, rate)
    } else {
      this.stems.playAllAt(targetStart, offset, rate)
    }
  }

  dispose(): void {
    this._rateThrottler.dispose()
    this.stems.disposeAll();
    this.clock.dispose();
  }
}
