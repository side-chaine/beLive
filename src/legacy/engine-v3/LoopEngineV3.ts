import { V2Adapter } from './V2Adapter'

export type LoopState = 'inactive' | 'active' | 'jumping'

export class LoopEngineV3 {
  private _start = 0
  private _end = 0
  private _active = false
  private _generation = 0

  get isLooping(): boolean { return this._active }
  get startTime(): number { return this._start }
  get endTime(): number { return this._end }

  setLoop(start: number, end: number): void {
    this._start = start
    this._end = end
    this._active = true
    this._generation++
    // V2 fallback
    try { V2Adapter.getInstance().delegateSync('setLoop', start, end) } catch {}
  }

  clearLoop(): void {
    this._active = false
    this._generation++
    try { V2Adapter.getInstance().delegateSync('clearLoop') } catch {}
  }

  /** Проверка: нужно ли прыгнуть на start (pre-seek guard) */
  checkJump(currentTime: number): number | null {
    if (!this._active) return null
    if (currentTime >= this._end) {
      this._generation++
      return this._start
    }
    return null
  }

  /** Generation guard — защита от race conditions при быстрых seek */
  getGeneration(): number { return this._generation }
  isGenerationValid(gen: number): boolean { return gen === this._generation }
}
