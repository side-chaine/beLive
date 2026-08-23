import { eventBus, EventBusChannel } from '../../../foundation/event-bus';
import { useAudioStore } from '../../../stores/audio.store';
import type { TransportV3, TransportStateChangeDetail, PlaybackRateChangeDetail } from '../core/TransportV3';

// Import paths above are computed by counting directories from
// src/audio/engine-v3/integration/ back to src/, then into foundation/event-bus
// and stores/. Verify against your real tsconfig — if the project uses path
// aliases (e.g. "@/foundation/event-bus") swap these for that instead.

const TICK_EPSILON_SEC = 0.05;
const BACKGROUND_FALLBACK_MS = 250;

/**
 * NOTE on 'time-update': the task description asked for publishing a 'time-update'
 * event via setTime() — neither exists in the real AudioEvents map or audio.store
 * you sent (the real names are 'seek-position-changed' and setCurrentTime()). Two
 * separate paths instead, on purpose, not just a rename:
 *
 *  - Continuous 60Hz ticking -> useAudioStore.setCurrentTime() DIRECTLY, no EventBus.
 *    'seek-position-changed' reads as "a jump just happened" to any real listener;
 *    firing it 60x/sec for ordinary playback would misfire anything that reacts to
 *    an actual seek (resetting a visual transient, resyncing something, etc).
 *  - Discrete seeks -> publishSeek() below, which DOES go through the EventBus,
 *    exactly once per actual seek.
 */
export class V3StatePublisher {
  private _lastPublishedTime = -1;
  private _rafHandle: number | null = null;
  private _fallbackInterval: ReturnType<typeof setInterval> | null = null;
  private _visibilityHandler: (() => void) | null = null;
  private _started = false;

  /** 369: last-seen time для детекции loop-wrap (loopcompleted) */
  private _lastTickTimeForLoop = -1;
  constructor(private readonly transport: TransportV3) {
    // Subscribed eagerly, not inside start(): this is cheap, event-driven, and has
    // no environment dependency — unlike the tick loop below, there's no reason to
    // gate it behind start(). Splitting these was found by trying to unit-test
    // statechange publishing without a rAF/document available; the split turned
    // out to be the correct design anyway, not just a testing workaround.
    this.transport.addEventListener('statechange', this._onStateChange as EventListener);
    // 🆕 EventBus rate integration: publish rate change
    this.transport.addEventListener('ratechange', this._onRateChange as EventListener);
    // №17-E (457): дискретные seeks транспорта → publishSeek (кэш + EventBus + store)
    this.transport.addEventListener('seek', this._onSeek as EventListener);
  }

  /** Starts the continuous 60Hz tick loop + background visibility fallback. Requires
   * a real rAF/document — statechange publishing above works without calling this. */
  start(): void {
    if (this._started) return;
    this._started = true;
    this._rafHandle = requestAnimationFrame(this._tickLoop);
    if (typeof document !== 'undefined') {
      this._visibilityHandler = () => this._onVisibilityChange();
      document.addEventListener('visibilitychange', this._visibilityHandler);
    }
  }

  stop(): void {
    this._started = false;
    if (this._rafHandle !== null) cancelAnimationFrame(this._rafHandle);
    this._rafHandle = null;
    if (this._fallbackInterval !== null) clearInterval(this._fallbackInterval);
    this._fallbackInterval = null;
    if (this._visibilityHandler && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this._visibilityHandler);
    }
  }

  /** Full teardown, including the statechange subscription from the constructor. */
  dispose(): void {
    this.stop();
    this.transport.removeEventListener('statechange', this._onStateChange as EventListener);
    this.transport.removeEventListener('ratechange', this._onRateChange as EventListener);
    this.transport.removeEventListener('seek', this._onSeek as EventListener);
  }

  /** Call from wherever an ACTUAL seek happens (scrub, block-jump, loop restart) — not every tick. */
  publishSeek(currentTime: number, duration: number): void {
    eventBus.publish(EventBusChannel.Audio, 'seek-position-changed', { currentTime, duration });
    useAudioStore.getState().setCurrentTime(currentTime);
    this._lastPublishedTime = currentTime;
    // №17-E (457): ОБЯЗАТЕЛЬНАЯ запись кэша (006/TASK-010 §3) — иначе кэш остаётся
    // протухшим до следующего тика, а на паузе тиков нет вообще.
    try {
      if (typeof window !== 'undefined') {
        (window as any).__belive = (window as any).__belive || {};
        (window as any).__belive.currentTime = currentTime;
      }
    } catch {}
  }

  publishRateChange(rate: number): void {
    eventBus.publish(EventBusChannel.Audio, 'playback-rate-changed', { rate });
    useAudioStore.getState().setPlaybackRate(rate);
  }

  private _onStateChange = (e: Event): void => {
    const detail = (e as CustomEvent<TransportStateChangeDetail>).detail;
    // 369: при остановке сбрасываем базу детекции loop-wrap
    if (detail.state !== 'playing') this._lastTickTimeForLoop = -1;
    const isPlaying = detail.state === 'playing';
    const currentTime = this.transport.currentTime;
    const duration = this.transport.duration;

    // State transitions are discrete and rare — publish immediately, no throttle,
    // unlike the tick loop below.
    eventBus.publish(EventBusChannel.Audio, 'playback-state-changed', { isPlaying, currentTime, duration });
    const store = useAudioStore.getState();
    store.setPlaying(isPlaying);
    store.setCurrentTime(currentTime);
    store.setDuration(duration);
    // №17-E AMEND-1 (001/006): кэш обновляется и на сменах состояния — иначе пауза
    // без seek (natural-end превью, useTakesPlayback:107-109) замораживает его навсегда,
    // а idle→play (TransportV3.ts:132) обходит событие seek. Побочка A7: после stop()
    // кэш станет 0 вместо замороженного — fallback-читатели переваривают
    // (getPlaybackTime() || startTime).
    try {
      if (typeof window !== 'undefined') {
        (window as any).__belive = (window as any).__belive || {};
        (window as any).__belive.currentTime = currentTime;
      }
    } catch {}

    // Legacy bridge for wrapper code not yet migrated onto the EventBus. Event NAME
    // here is a placeholder — I don't know what old wrapper code actually listens
    // for on window; grep for existing `window.addEventListener` calls related to
    // playback before relying on this, otherwise nothing is actually listening.
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('playback-state-changed', { detail: { isPlaying, currentTime, duration } }));
    }
  };

  private _onRateChange = (e: Event): void => {
    const { rate } = (e as CustomEvent<PlaybackRateChangeDetail>).detail;
    this.publishRateChange(rate);
  };

  // №17-E (457): транспорт просекекся — синхронизируем кэш/store даже на паузе
  private _onSeek = (e: Event): void => {
    const detail = (e as CustomEvent<{ time?: number }>).detail;
    const t = typeof detail?.time === 'number' ? detail.time : this.transport.currentTime;
    this.publishSeek(t, this.transport.duration);
  };

  private _lastTickAt = 0
  private _tickLoop = (): void => {
    this._rafHandle = requestAnimationFrame(this._tickLoop)
    if (this.transport.state !== 'playing') return
    const now = performance.now()
    if (now - this._lastTickAt < 50) return
    this._lastTickAt = now
    const t = this.transport.currentTime
    // 369: V2→V3 parity — loopcompleted при wrap (V2: AudioEngineV2.ts:1509)
    if (this.transport.loopEnabled && this._lastTickTimeForLoop >= 0) {
      if (t < this._lastTickTimeForLoop - 0.25) {
        if (typeof document !== 'undefined') {
          document.dispatchEvent(new CustomEvent('loopcompleted', {
            detail: {
              previousTime: this._lastTickTimeForLoop,
              newTime: t,
              loopStart: this.transport.loopStart,
              loopEnd: this.transport.loopEnd,
            },
          }));
        }
      }
    }
    this._lastTickTimeForLoop = t
    this._publishTickIfChanged(t)
  }

  private _publishTickIfChanged(currentTime: number): void {
    if (Math.abs(currentTime - this._lastPublishedTime) < TICK_EPSILON_SEC) return;
    this._lastPublishedTime = currentTime;
    useAudioStore.getState().setCurrentTime(currentTime);
    // M1 (342): публикация V3-времени для классического фасада (js/audio-facade-v3.js)
    // Фасад (getCurrentTime) читает реальное время движка, а не stub-zero.
    try {
      if (typeof window !== 'undefined') {
        (window as any).__belive = (window as any).__belive || {};
        (window as any).__belive.currentTime = currentTime;
      }
    } catch {}
  }

  private _onVisibilityChange(): void {
    if (typeof document === 'undefined') return;
    if (document.hidden) {
      // rAF is throttled/fully stopped in background tabs in most browsers — fall
      // back to a coarse interval so the store doesn't go stale while hidden.
      if (this._fallbackInterval === null) {
        this._fallbackInterval = setInterval(() => {
          if (this.transport.state === 'playing') this._publishTickIfChanged(this.transport.currentTime);
        }, BACKGROUND_FALLBACK_MS);
      }
    } else if (this._fallbackInterval !== null) {
      clearInterval(this._fallbackInterval);
      this._fallbackInterval = null;
    }
  }
}
