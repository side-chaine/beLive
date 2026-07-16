// ============================================================
// src/foundation/event-bus/wrappers/loop-events.ts
// CLASS: SIDE-EFFECT
// ORIGINAL: src/bridges/loop.bridge.ts
//
// before-track-change + mode-changed → rAF
// EventBus-wrapper. Пока не активен — bridges продолжают
// работать через Facade. Активируется когда Facade отключается.
// ============================================================

import { eventBus } from '../event-bus'
import { EventBusChannel, Subscription } from '../types'

export function initLoopEvents(): () => void {
  const subs: Subscription[] = []

  subs.push(eventBus.subscribe(EventBusChannel.Track, 'before-change', () => {
    // TODO: engine.setLoop / clearLoop, остановка rAF
  }))

  subs.push(eventBus.subscribe(EventBusChannel.UI, 'mode-changed', () => {
    // TODO: loop cleanup при смене режима
  }))

  return () => subs.forEach(s => s.unsubscribe())
}
