// ============================================================
// src/audio/engine-v3/TransportV3.ts
// V3-04b + A4: error-state propagation, recover()
//
// A6 fix: _state/_emit only AFTER delegateSync success.
// A4 fix: pause()/stop() guard in error state, recover() API.
// ============================================================

import { V2Adapter } from './V2Adapter'
import type { TransportState, V3Event, V3EventPayload } from './types'
import { AudioBus } from '../../foundation/event-bus/channels/audio'

type TransportCallback<E extends V3Event> = (payload: V3EventPayload[E]) => void

export class TransportV3 {
  private _state: TransportState = 'idle'
  private _listeners = new Map<V3Event, Set<TransportCallback<any>>>()
  private _lastError: { message: string; code?: number } | null = null

  get state(): TransportState { return this._state }
  get currentTime(): number { return V2Adapter.getInstance().getSync<number>('currentTime') ?? 0 }
  get duration(): number { return V2Adapter.getInstance().getSync<number>('_duration') ?? 0 }
  get isPlaying(): boolean { return this._state === 'playing' }

  on<E extends V3Event>(event: E, cb: TransportCallback<E>): () => void {
    if (!this._listeners.has(event)) this._listeners.set(event, new Set())
    this._listeners.get(event)!.add(cb)
    return () => this._listeners.get(event)?.delete(cb)
  }

  private _emit<E extends V3Event>(event: E, payload: V3EventPayload[E]): void {
    this._listeners.get(event)?.forEach(cb => {
      try { cb(payload) } catch (e) { console.error('[TransportV3] listener error', e) }
    })
  }

  /** Emit state-change with optional prevError from error-state. */
  private _emitState(state: TransportState): void {
    if (this._lastError) {
      this._emit('state-change', { state, prevError: { ...this._lastError } })
      this._lastError = null
    } else {
      this._emit('state-change', { state })
    }
  }

  /** Single point for error-state propagation. */
  private _fail(message: string, code?: number): void {
    this._lastError = { message, code }
    this._state = 'error'
    this._emit('state-change', { state: 'error', prevError: { message, code } })
    this._emit('error', { message, code })
  }

  /** Recover from error state — reset to idle. */
  recover(): void {
    if (this._state !== 'error') return
    const err = this._lastError
    this._state = 'idle'
    this._lastError = null
    this._emit('state-change', { state: 'idle', prevError: err ?? undefined })
  }

  async play(): Promise<void> {
    if (this._state === 'error') { this._fail('cannot play in error state — call recover() first'); return }
    const v2 = V2Adapter.getInstance()
    if (!v2.getV2Engine()) { this._fail('V2 engine unavailable — play ignored'); return }
    try {
      await v2.delegateAsync('play')
      if (!v2.getSync<boolean>('_isPlaying')) {
        this._fail('play resolved but engine reports not playing'); return
      }
    } catch (e) { this._fail(`play failed: ${String(e)}`); return }
    this._state = 'playing'
    this._emitState('playing')
  }

  pause(): void {
    if (this._state === 'error') { this._fail('cannot pause in error state — call recover() first'); return }
    const v2 = V2Adapter.getInstance()
    if (!v2.getV2Engine()) { this._fail('V2 engine unavailable — pause ignored'); return }
    try {
      v2.delegateSync('pause')
    } catch (e) { this._fail(`pause failed: ${String(e)}`); return }
    this._state = 'paused'
    this._emitState('paused')
  }

  async seek(time: number): Promise<void> {
    if (this._state === 'error') { this._fail('cannot seek in error state — call recover() first'); return }
    const v2 = V2Adapter.getInstance()
    if (!v2.getV2Engine()) { this._fail('V2 engine unavailable — seek ignored'); return }
    try {
      v2.delegateSync('seekTo', time)
    } catch (e) { this._fail(`seek failed: ${String(e)}`); return }
    this._emit('time-update', { currentTime: time, duration: this.duration })
    AudioBus.seekPositionChanged({ currentTime: time, duration: this.duration })
  }

  stop(): void {
    if (this._state === 'error') { this._fail('cannot stop in error state — call recover() first'); return }
    const v2 = V2Adapter.getInstance()
    if (!v2.getV2Engine()) { this._fail('V2 engine unavailable — stop ignored'); return }
    try {
      v2.delegateSync('stop')
    } catch (e) { this._fail(`stop failed: ${String(e)}`); return }
    this._state = 'idle'
    this._emitState('idle')
  }

  setPlaybackRate(rate: number): void {
    if (this._state === 'error') { this._fail('cannot setPlaybackRate in error state — call recover() first'); return }
    const v2 = V2Adapter.getInstance()
    if (!v2.getV2Engine()) { this._fail('V2 engine unavailable — setPlaybackRate ignored'); return }
    try {
      v2.delegateSync('setPlaybackRate', rate)
    } catch (e) { this._fail(`setPlaybackRate failed: ${String(e)}`); return }
  }

  async init(): Promise<void> {
    // V3 native AudioContext pending
  }
}
