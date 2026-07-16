// ============================================================
// src/foundation/event-bus/event-bus.ts
// ============================================================

import {
  EventBusChannel,
  EventCallback,
  EventName,
  EventPayload,
  Subscription,
} from './types'

export class EventBus {
  private _listeners: Map<string, Map<string, Array<(payload: unknown) => void>>> = new Map()
  private _channelListeners: Map<string, Array<(payload: unknown) => void>> = new Map()
  _globalListeners: Set<(channel: EventBusChannel, event: string, payload: unknown) => void> = new Set()

  publish<C extends EventBusChannel, E extends EventName<C>>(
    channel: C,
    event: E,
    payload: EventPayload<C, E>,
  ): void {
    // Notify global listeners
    const globalSnapshot = Array.from(this._globalListeners)
    for (const fn of globalSnapshot) {
      if (this._globalListeners.has(fn)) fn(channel, event, payload)
    }

    // Notify channel-wide listeners (subscribeChannel)
    const channelWideListeners = this._channelListeners.get(channel)
    if (channelWideListeners) {
      const channelSnapshot = Array.from(channelWideListeners)
      for (const cb of channelSnapshot) {
        if (channelWideListeners.includes(cb)) cb(payload)
      }
    }

    // Notify event-specific listeners
    const channelListeners = this._listeners.get(channel)
    if (!channelListeners) return

    const eventListeners = channelListeners.get(event)
    if (!eventListeners) return

    // Snapshot before iteration — защита от recursion
    const snapshot = Array.from(eventListeners)
    for (const callback of snapshot) {
      if (eventListeners.includes(callback)) callback(payload)
    }
  }

  subscribe<C extends EventBusChannel, E extends EventName<C>>(
    channel: C,
    event: E,
    callback: EventCallback<C, E>,
  ): Subscription {
    if (!this._listeners.has(channel)) {
      this._listeners.set(channel, new Map())
    }

    const channelListeners = this._listeners.get(channel)!
    if (!channelListeners.has(event)) {
      channelListeners.set(event, [])
    }

    const eventListeners = channelListeners.get(event)!
    eventListeners.push(callback as (payload: unknown) => void)

    return {
      unsubscribe: (): void => {
        const ch = this._listeners.get(channel)
        if (!ch) return
        const ev = ch.get(event)
        if (!ev) return
        const idx = ev.indexOf(callback as (payload: unknown) => void)
        if (idx !== -1) ev.splice(idx, 1)
        if (ev.length === 0) {
          ch.delete(event)
        }
      },
      channel,
      event,
    }
  }

  subscribeChannel<C extends EventBusChannel>(
    channel: C,
    callback: (payload: EventPayload<C, EventName<C>>) => void,
  ): Subscription {
    if (!this._channelListeners.has(channel)) {
      this._channelListeners.set(channel, [])
    }

    const listeners = this._channelListeners.get(channel)!
    listeners.push(callback as (payload: unknown) => void)

    return {
      unsubscribe: (): void => {
        const ch = this._channelListeners.get(channel)
        if (!ch) return
        const idx = ch.indexOf(callback as (payload: unknown) => void)
        if (idx !== -1) ch.splice(idx, 1)
        if (ch.length === 0) {
          this._channelListeners.delete(channel)
        }
      },
      channel,
      event: '*',
    }
  }

  clearChannel(channel: EventBusChannel): void {
    this._listeners.delete(channel)
    this._channelListeners.delete(channel)
  }

  clear(): void {
    this._listeners.clear()
    this._channelListeners.clear()
    this._globalListeners.clear()
  }
}

export const eventBus = new EventBus()
