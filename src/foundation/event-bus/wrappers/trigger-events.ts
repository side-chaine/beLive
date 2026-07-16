// ============================================================
// src/foundation/event-bus/wrappers/trigger-events.ts
// CLASS: SIDE-EFFECT
// ORIGINAL: src/triggers/trigger.bridge.ts
//
// before-track-change + playback-state-changed → CSS vars, scheduler
// EventBus-wrapper. Пока не активен — bridges продолжают
// работать через Facade. Активируется когда Facade отключается.
// ============================================================

import { eventBus } from '../event-bus'
import { EventBusChannel, Subscription } from '../types'

export function initTriggerEvents(): () => void {
  const subs: Subscription[] = []

  subs.push(eventBus.subscribe(EventBusChannel.Track, 'before-change', () => {
    // TODO: scheduler lifecycle — сброс CSS vars и триггеров
  }))

  subs.push(eventBus.subscribe(EventBusChannel.Audio, 'playback-state-changed', (_payload) => {
    // TODO: scheduler start/stop, CSS vars через queueCssVar
  }))

  return () => subs.forEach(s => s.unsubscribe())
}
