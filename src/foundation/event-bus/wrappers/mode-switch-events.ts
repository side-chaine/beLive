// ============================================================
// src/foundation/event-bus/wrappers/mode-switch-events.ts
// CLASS: SIDE-EFFECT
// ORIGINAL: src/bridges/mode-switch.bridge.ts (partial)
//
// mode-changed → DOM classList (классList красит живой mode-switch.service:247 + mode-events:81 — этот wrapper их дубль)
// Wrapper = dead code: вне бута (registerInit нет), кандидат retire Волной D.
// Волна C 01.09: мост mode-switch.bridge.ts снесён (graveyard пуст).
// ============================================================

import { eventBus } from '../event-bus'
import { EventBusChannel, Subscription } from '../types'

export function initModeSwitchEvents(): () => void {
  const subs: Subscription[] = []

  subs.push(eventBus.subscribe(EventBusChannel.UI, 'mode-changed', (payload) => {
    const cl = document.body.classList
    cl.remove('mode-concert', 'mode-karaoke', 'mode-rehearsal', 'mode-live')
    cl.add(`mode-${payload.to}`)
    // TODO: localStorage сохранение режима
  }))

  return () => subs.forEach(s => s.unsubscribe())
}
