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

  const mapLegacyMonitorState = (mm: any) => ({
    enabled: mm.enabled || false,
    delayMs: mm.delayMs ?? 150,
    includeMusic: mm.includeMusic ?? true,
    musicLevel: mm.musicLevel ?? 0.7,
    outputDeviceId: mm.outputDeviceId || '',
    mainDeviceId: mm.mainDeviceId || '',
    routeMainEnabled: mm.routeMainEnabled ?? true,
    compensateOn: (mm.compensateOn === 'monitor' || mm.compensateOn === 'main') 
      ? mm.compensateOn : 'main',
    vocalToMain: mm.vocalToMain ?? true,
    vocalHallLevel: mm.vocalHallLevel ?? 0.5,
    devices: Array.isArray(mm.devices) ? mm.devices : [],
  })

  const syncMonitorFromLegacy = () => {
    const mm = (window as any).monitorMix
    if (!mm) return
    useMonitorStore.setState(mapLegacyMonitorState(mm))
  }

  subs.push(eventBus.subscribe(EventBusChannel.Audio, 'monitor-state-changed', () => {
    syncMonitorFromLegacy()
    useMonitorStore.getState().refreshDevices?.()
  }))

  subs.push(eventBus.subscribe(EventBusChannel.Audio, 'monitor-route-changed', () => {
    syncMonitorFromLegacy()
  }))

  return () => subs.forEach(s => s.unsubscribe())
}
