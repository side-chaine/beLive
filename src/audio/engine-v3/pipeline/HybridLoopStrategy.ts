// src/audio/engine-v3/pipeline/HybridLoopStrategy.ts
// Loop strategy для Hybrid Mode.
// Bus A: native signalsmith loop (schedule({ loopStart, loopEnd })) — sample-accurate
// Bus B: native source.loop + DuckGuard (существующий)

import { StretchInstancePool } from './StretchInstancePool'

export class HybridLoopStrategy {
  private readonly _stretchPool: StretchInstancePool
  private _loopActive = false
  private _loopStart = 0
  private _loopEnd = 0

  constructor(stretchPool: StretchInstancePool) {
    this._stretchPool = stretchPool
  }

  async setLoop(start: number, end: number): Promise<void> {
    this._loopActive = true
    this._loopStart = start
    this._loopEnd = end
    // Bus A: native signalsmith loop (fire-and-forget)
    await this._stretchPool.scheduleLoopAll(start, end)
  }

  clearLoop(): void {
    this._loopActive = false
    // M2 (Корень B): нативный signalsmith loop тоже снимаем — иначе звук зациклен после clear
    this._stretchPool.scheduleLoopNoneAll()
  }

  get isActive(): boolean { return this._loopActive }
  get start(): number { return this._loopStart }
  get end(): number { return this._loopEnd }

  dispose(): void {
    this.clearLoop()
  }
}
