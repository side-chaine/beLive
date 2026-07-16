// ============================================================
// src/foundation/event-bus/wrappers/takes-events.ts
// CLASS: SIDE-EFFECT
// ORIGINAL: src/bridges/takes.bridge.ts
//
// EventBus-wrapper. Пока не активен — bridges продолжают
// работать через Facade. Активируется когда Facade отключается.
// ============================================================

import { eventBus } from '../event-bus'
import { EventBusChannel, Subscription } from '../types'

export function initTakesEvents(): () => void {
  const subs: Subscription[] = []

  subs.push(eventBus.subscribe(EventBusChannel.Track, 'before-change', () => {
    document.documentElement.removeAttribute('data-takes-recording')
  }))

  subs.push(eventBus.subscribe(EventBusChannel.Audio, 'playback-state-changed', (payload) => {
    if (!payload.isPlaying) {
      document.documentElement.removeAttribute('data-takes-recording')
    }
  }))

  return () => subs.forEach(s => s.unsubscribe())
}
