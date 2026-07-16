// ============================================================
// src/foundation/event-bus/wrappers/billy-events.ts
// CLASS: SIDE-EFFECT
// ORIGINAL: src/bridges/billy.bridge.ts
//
// EventBus-wrapper. Пока не активен — bridges продолжают
// работать через Facade. Активируется когда Facade отключается.
// ============================================================

import { eventBus } from '../event-bus'
import { EventBusChannel, Subscription } from '../types'
import { useBillyRuntimeStore } from '../../../billy/billy-runtime.store'

export function initBillyEvents(): () => void {
  const subs: Subscription[] = []

  subs.push(eventBus.subscribe(EventBusChannel.Track, 'before-change', () => {
    useBillyRuntimeStore.getState().setMode('sleep')
    // TODO: scheduler.stop(), clear CSS vars при миграции
  }))

  return () => subs.forEach(s => s.unsubscribe())
}
