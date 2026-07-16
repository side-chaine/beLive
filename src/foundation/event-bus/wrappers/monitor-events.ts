// ============================================================
// src/foundation/event-bus/wrappers/monitor-events.ts
// CLASS: SIDE-EFFECT
// ORIGINAL: src/bridges/monitor.bridge.ts
//
// monitor-state-changed, monitor-route-changed — НЕ frozen!
// Можно агрессивнее.
// EventBus-wrapper. Пока не активен — bridges продолжают
// работать через Facade. Активируется когда Facade отключается.
// ============================================================

import { eventBus } from '../event-bus'
import { EventBusChannel, Subscription } from '../types'
import { useMonitorStore } from '../../../stores/monitor.store'

export function initMonitorEvents(): () => void {
  const subs: Subscription[] = []

  subs.push(eventBus.subscribe(EventBusChannel.Audio, 'monitor-state-changed', () => {
    // TODO: гидрация monitor store из legacy monitorMix
    useMonitorStore.getState().refreshDevices?.()
  }))

  subs.push(eventBus.subscribe(EventBusChannel.Audio, 'monitor-route-changed', () => {
    // TODO: обновление маршрутизации монитора
  }))

  return () => subs.forEach(s => s.unsubscribe())
}
