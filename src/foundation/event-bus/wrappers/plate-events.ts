// ============================================================
// src/foundation/event-bus/wrappers/plate-events.ts
// CLASS: SIDE-EFFECT
// ORIGINAL: src/bridges/plate.bridge.ts
//
// EventBus-wrapper. Пока не активен — bridges продолжают
// работать через Facade. Активируется когда Facade отключается.
// ============================================================

import { Subscription } from '../types'

export function initPlateEvents(): () => void {
  const subs: Subscription[] = []
  // Plate отслеживает изменения transitionPreset в store и сохраняет в IDB
  // TODO: перенести IDB write логику при миграции

  return () => subs.forEach(s => s.unsubscribe())
}
