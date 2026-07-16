// ============================================================
// src/foundation/event-bus/wrappers/cover-events.ts
// CLASS: SIDE-EFFECT
// ORIGINAL: src/bridges/cover-theme.bridge.ts
//
// EventBus-wrapper. Пока не активен — bridges продолжают
// работать через Facade. Активируется когда Facade отключается.
// ============================================================

import { eventBus } from '../event-bus'
import { EventBusChannel, Subscription } from '../types'

export function initCoverEvents(): () => void {
  const subs: Subscription[] = []

  subs.push(eventBus.subscribe(EventBusChannel.Catalog, 'catalog-cleared', () => {
    // TODO: вызвать applyCoverTheme() при миграции
  }))

  subs.push(eventBus.subscribe(EventBusChannel.Track, 'load-failed', () => {
    // TODO: вызвать applyCoverTheme() fallback
  }))

  return () => subs.forEach(s => s.unsubscribe())
}
