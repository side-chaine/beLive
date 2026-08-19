// src/audio/engine-v3/services/RateThrottler.ts
// Debounce 50ms (20Hz) для защиты WASM от 60Hz спама слайдером.
//
// - set(rate): сохраняет rate, запускает rAF цикл.
//   Если rAF уже идёт — просто перезаписывает pending rate.
// - flush(): мгновенно применяет последний rate (отменяя rAF).
//   Вызывается в pause()/seek() перед остановкой источников.
//
// Agent_202 killshot: requestAnimationFrame + performance.now()
// вместо setTimeout — чистое Web API, никаких таймеров.

export class RateThrottler {
  private _rafId: number | null = null
  private _lastApplyTime = 0
  private _pendingRate: number | null = null
  private readonly _onApply: (rate: number) => void
  private readonly _minIntervalMs: number

  constructor(onApply: (rate: number) => void, minIntervalMs: number = 50) {
    this._onApply = onApply
    this._minIntervalMs = minIntervalMs
  }

  /** Сохранить rate. Если rAF уже идёт — просто перезаписывает. */
  set(rate: number): void {
    this._pendingRate = rate
    if (this._rafId === null) {
      this._rafId = requestAnimationFrame(() => this._tick())
    }
  }

  /** Мгновенно применить последний rate. */
  flush(): void {
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId)
      this._rafId = null
    }
    if (this._pendingRate !== null) {
      const rate = this._pendingRate
      this._pendingRate = null
      this._lastApplyTime = performance.now()
      this._onApply(rate)
    }
  }

  private _tick(): void {
    this._rafId = null
    if (this._pendingRate === null) return

    const now = performance.now()
    if (now - this._lastApplyTime >= this._minIntervalMs) {
      const rate = this._pendingRate
      this._pendingRate = null
      this._lastApplyTime = now
      this._onApply(rate)
    } else {
      // Ещё не прошло 50ms — ждём следующего кадра
      this._rafId = requestAnimationFrame(() => this._tick())
    }
  }

  dispose(): void {
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId)
      this._rafId = null
    }
    this._pendingRate = null
  }
}
