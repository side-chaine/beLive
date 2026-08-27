// ============================================================
// src/foundation/event-bus/wrappers/rehearsal-trigger-writer.ts
// CLASS: SIDE-EFFECT
// ORIGINAL: src/Rehearsal/bridge/rehearsal-trigger.bridge.ts ❄️ FROZEN
//
// Замена 17× (window as any).audioEngine на V2Adapter.
// Bridge НЕ ТРОГАЕТСЯ — этот wrapper используется когда Facade отключается.
// ============================================================

import { getTransport } from '../../../audio/engine-v3'
import { useStemStore } from '../../../stem/stem.store'
import { eventBus } from '../event-bus'
import { EventBusChannel, Subscription } from '../types'

export interface RehearsalTriggerState {
  currentTime: number
  playbackRate: number
  isPlaying: boolean
  stemVolumes: Record<string, number>
}

export class RehearsalTriggerWriter {
  private _subs: Subscription[] = []

  constructor() {
  }

  /** Получить текущее время (замена ae.getCurrentTime()) */
  getCurrentTime(): number {
    return getTransport()?.currentTime ?? 0
  }

  /** Получить playback rate (замена ae.playbackRate) */
  getPlaybackRate(): number {
    return getTransport()?.playbackRate ?? 1
  }

  /** Play (замена ae.play()) */
  async play(): Promise<void> {
    try { getTransport()?.play() } catch {}
  }

  /** Pause (замена ae.pause()) */
  pause(): void {
    try { getTransport()?.pause() } catch {}
  }

  /** Seek (замена ae.seekTo() / ae.setCurrentTime()) */
  seekTo(time: number): void {
    try { getTransport()?.seek(time) } catch {}
    try { getTransport()?.seek(time) } catch {}
  }

  /** Set stem volume (замена ae.setStemVolume()) */
  setStemVolume(id: string, vol: number): void {
    try { useStemStore.getState().setStemVolume(id, vol) } catch {}
  }

  /** Set playback rate (замена ae.setPlaybackRate()) */
  setPlaybackRate(rate: number): void {
    try { getTransport()?.setPlaybackRate(rate) } catch {}
  }

  /** Получить snapshot состояния (замена sendSnapshot) */
  getSnapshot(): RehearsalTriggerState {
    return {
      currentTime: this.getCurrentTime(),
      playbackRate: this.getPlaybackRate(),
      isPlaying: getTransport()?.state === 'playing',
      stemVolumes: {},
    }
  }

  /** Подписаться на time-update для rAF замены */
  onTimeUpdate(cb: (time: number) => void): () => void {
    const sub = eventBus.subscribe(EventBusChannel.Audio, 'playback-state-changed', () => {
      cb(this.getCurrentTime())
    })
    return () => sub.unsubscribe()
  }

  init(): void {
    // При инициализации подписываемся на EventBus
  }

  destroy(): void {
    this._subs.forEach(s => s.unsubscribe())
    this._subs = []
  }
}
