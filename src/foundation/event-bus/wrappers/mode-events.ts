// ============================================================
// src/foundation/event-bus/wrappers/mode-events.ts
// CLASS: SIDE-EFFECT
// ORIGINAL: src/bridges/mode.bridge.ts
//
// EventBus-wrapper. Пока не активен — bridges продолжают
// работать через Facade. Активируется когда Facade отключается.
// ============================================================

import { eventBus } from '../event-bus'
import { EventBusChannel, Subscription } from '../types'
import { useModeStore } from '../../../stores/mode.store'

export function initModeEvents(): () => void {
  const subs: Subscription[] = []

  subs.push(eventBus.subscribe(EventBusChannel.UI, 'mode-changed', (payload) => {
    useModeStore.getState().setMode(payload.to as any)
    document.body.className = document.body.className
      .replace(/mode-\w+/g, '')
      .trim() + ` mode-${payload.to}`
  }))

  return () => subs.forEach(s => s.unsubscribe())
}
