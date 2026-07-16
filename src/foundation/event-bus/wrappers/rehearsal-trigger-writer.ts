// ============================================================
// src/foundation/event-bus/wrappers/rehearsal-trigger-writer.ts
// CLASS: SIDE-EFFECT
// ORIGINAL: src/Rehearsal/bridge/rehearsal-trigger.bridge.ts ❄️ FROZEN
//
// Замена 17× (window as any).audioEngine на V2Adapter.
// Bridge НЕ ТРОГАЕТСЯ — этот wrapper используется когда Facade отключается.
// ============================================================

import { V2Adapter } from '../../../audio/engine-v3/V2Adapter'
import { eventBus } from '../event-bus'
import { EventBusChannel, Subscription } from '../types'

export interface RehearsalTriggerState {
  currentTime: number
  playbackRate: number
  isPlaying: boolean
  stemVolumes: Record<string, number>
}

export class RehearsalTriggerWriter {
  private _v2: V2Adapter
  private _subs: Subscription[] = []

  constructor() {
    this._v2 = V2Adapter.getInstance()
  }

  /** Получить текущее время (замена ae.getCurrentTime()) */
  getCurrentTime(): number {
    return this._v2.getSync<number>('currentTime') ?? 0
  }

  /** Получить playback rate (замена ae.playbackRate) */
  getPlaybackRate(): number {
    return this._v2.getSync<number>('playbackRate') ?? 1
  }

  /** Play (замена ae.play()) */
  async play(): Promise<void> {
    try { this._v2.delegateSync('play') } catch {}
  }

  /** Pause (замена ae.pause()) */
  pause(): void {
    try { this._v2.delegateSync('pause') } catch {}
  }

  /** Seek (замена ae.seekTo() / ae.setCurrentTime()) */
  seekTo(time: number): void {
    try { this._v2.delegateSync('seekTo', time) } catch {}
    try { this._v2.setProp('currentTime', time) } catch {}
  }

  /** Set stem volume (замена ae.setStemVolume()) */
  setStemVolume(id: string, vol: number): void {
    try { this._v2.delegateSync('setStemVolume', id, vol) } catch {}
  }

  /** Set playback rate (замена ae.setPlaybackRate()) */
  setPlaybackRate(rate: number): void {
    try { this._v2.delegateSync('setPlaybackRate', rate) } catch {}
  }

  /** Получить snapshot состояния (замена sendSnapshot) */
  getSnapshot(): RehearsalTriggerState {
    return {
      currentTime: this.getCurrentTime(),
      playbackRate: this.getPlaybackRate(),
      isPlaying: this._v2.getSync<boolean>('isPlaying') ?? false,
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
