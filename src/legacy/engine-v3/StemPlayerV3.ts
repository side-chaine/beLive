// ============================================================
// src/audio/engine-v3/StemPlayerV3.ts
// V3-02: StemPlayerV3 — хранит стемы в Map, V2 fallback
// ============================================================

import { V2Adapter } from './V2Adapter'
import type { StemData } from './types'

export class StemPlayerV3 {
  private _stems = new Map<string, StemData>()
  /** @internal будет использован при интеграции с V3 AudioContext */
  private _onStateChange?: (id: string, state: string) => void

  setOnStateChange(cb: (id: string, state: string) => void): void {
    this._onStateChange = cb
    void this._onStateChange // acknowledged for future V3 native integration
  }

  addStem(data: StemData): void {
    this._stems.set(data.id, data)
    // V2 fallback через V2Adapter если V3 не может обработать
    try {
      V2Adapter.getInstance().delegateSync('addStem', data.id, data.url)
    } catch {
      console.warn('[StemPlayerV3] V2 fallback for addStem')
    }
  }

  removeStem(id: string): void {
    this._stems.delete(id)
  }

  setVolume(id: string, vol: number): void {
    const stem = this._stems.get(id)
    if (stem) stem.volume = vol
    // V2 fallback
    V2Adapter.getInstance().getV2Engine()?.setStemVolume?.(id, vol)
  }

  getStem(id: string): StemData | undefined {
    return this._stems.get(id)
  }

  getAllStems(): StemData[] {
    return Array.from(this._stems.values())
  }

  clear(): void {
    this._stems.clear()
  }
}
