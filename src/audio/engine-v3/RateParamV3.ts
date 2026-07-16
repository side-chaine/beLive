export class RateParamV3 {
  private _currentRate = 1
  private _targetRate = 1
  private _transitionSeconds = 0.1

  get currentRate(): number { return this._currentRate }
  get targetRate(): number { return this._targetRate }

  /** Установить целевой rate */
  setTarget(rate: number): void {
    this._targetRate = rate
  }

  /** Мгновенная установка (для seek/sync) */
  setImmediate(rate: number): void {
    this._currentRate = rate
    this._targetRate = rate
  }

  /** Применить плавный переход через setTargetAtTime */
  apply(param: AudioParam): void {
    if (param && this._targetRate !== this._currentRate) {
      const ctx = param as unknown as { context: AudioContext }
      param.setTargetAtTime(this._targetRate, ctx.context.currentTime, this._transitionSeconds)
      this._currentRate = this._targetRate
    }
  }

  setTransitionDuration(seconds: number): void {
    this._transitionSeconds = seconds
  }
}
