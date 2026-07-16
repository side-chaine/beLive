// ============================================================
// src/foundation/event-bus/wrappers/stem-reactive.ts
// CLASS: SIDE-EFFECT
// ORIGINAL: src/bridges/stem-reactive.bridge.ts
//
// before-track-change + playback-state-changed → CSS vars, scheduler
// EventBus-wrapper. Пока не активен — bridges продолжают
// работать через Facade. Активируется когда Facade отключается.
// ============================================================

import { eventBus } from '../event-bus'
import { EventBusChannel, Subscription } from '../types'

export function initStemReactiveEvents(): () => void {
  const subs: Subscription[] = []

  subs.push(eventBus.subscribe(EventBusChannel.Track, 'before-change', () => {
    // TODO: scheduler — сброс энергий и хит-детекции
  }))

  subs.push(eventBus.subscribe(EventBusChannel.Audio, 'playback-state-changed', (_payload) => {
    // TODO: scheduler lifecycle, CSS vars через queueCssVar
  }))

  return () => subs.forEach(s => s.unsubscribe())
}
