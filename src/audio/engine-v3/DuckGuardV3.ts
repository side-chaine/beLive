// ============================================================
// src/audio/engine-v3/DuckGuardV3.ts
// Предсказывает loop jump за 40ms, duck master gain, restore по событию.
// IMPORTS: только V2Adapter. НИКАКИХ import из ../core/.
// ============================================================

import { V2Adapter } from './V2Adapter'

interface StemSnapshot {
  volume: number
  muted: boolean
}

export class DuckGuardV3 {
  private static instance: DuckGuardV3
  static getInstance(): DuckGuardV3 {
    if (!this.instance) this.instance = new DuckGuardV3()
    return this.instance
  }

  // --- Private state (DG-02) ---
  private _ducked = false
  private _savedState = new Map<string, StemSnapshot>()
  private _restoreTimer: ReturnType<typeof setTimeout> | null = null
  private _hotPlugCooldownUntil = 0
  private _playbackStableAt = 0
  private _v2 = V2Adapter.getInstance()

  // --- Hot plug cooldown (DG-03) ---
  onHotPlug(): void {
    this._hotPlugCooldownUntil = Date.now() + 200
  }

  // --- Playback state (DG-03) ---
  onPlaybackState(isPlaying: boolean): void {
    if (isPlaying) {
      this._playbackStableAt = Date.now() + 250
    }
  }

  // --- Safety check (DG-04) ---
  isDuckSafe(): boolean {
    const now = Date.now()
    const isPlaying = this._v2.getSync<boolean>('isPlaying') ?? false
    if (!isPlaying) return false
    if (now < this._hotPlugCooldownUntil) return false
    if (now < this._playbackStableAt) return false
    if (this._ducked) return false
    return true
  }

  // --- Snapshot (DG-05) ---
  private _snapshot(): void {
    this._savedState.clear()
    const stems = this._v2.getSync<string[]>('loadedStems') ?? []
    for (const id of stems) {
      const volume = this._v2.getSync<number>(`stemVolumes.${id}`) ?? 1
      const muted = this._v2.getSync<boolean>(`stemMuted.${id}`) ?? false
      this._savedState.set(id, { volume, muted })
    }
  }

  // --- Duck (DG-06) ---
  duck(targets: string[], ratio: number = 0.3): void {
    if (!this.isDuckSafe()) return

    this._snapshot()

    for (const id of targets) {
      try {
        this._v2.delegateSync('setStemVolume', id, ratio)
      } catch {}
    }

    this._ducked = true
    this._clearRestoreTimer()
  }

  // --- Restore (DG-07) ---
  restore(): void {
    if (!this._ducked) return

    for (const [id, state] of this._savedState) {
      try {
        this._v2.delegateSync('setStemVolume', id, state.volume)
        this._v2.delegateSync('setStemMuted', id, state.muted)
      } catch {}
    }

    this._ducked = false
    this._savedState.clear()
  }

  /** Запланировать restore через N ms */
  scheduleRestore(ms: number = 100): void {
    this._clearRestoreTimer()
    this._restoreTimer = setTimeout(() => this.restore(), ms)
  }

  private _clearRestoreTimer(): void {
    if (this._restoreTimer !== null) {
      clearTimeout(this._restoreTimer)
      this._restoreTimer = null
    }
  }
}
