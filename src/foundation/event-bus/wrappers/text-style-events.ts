// ============================================================
// src/foundation/event-bus/wrappers/text-style-events.ts
// CLASS: SIDE-EFFECT
// ORIGINAL: src/bridges/textStyle.bridge.ts
//
// track-loaded → MutationObserver
// EventBus-wrapper. Пока не активен — bridges продолжают
// работать через Facade. Активируется когда Facade отключается.
// ============================================================

import { eventBus } from '../event-bus'
import { EventBusChannel, Subscription } from '../types'

export function initTextStyleEvents(): () => void {
  const subs: Subscription[] = []

  subs.push(eventBus.subscribe(EventBusChannel.Audio, 'track-loaded', () => {
    // TODO: MutationObserver на lyrics контейнер, re-apply font
  }))

  return () => subs.forEach(s => s.unsubscribe())
}
