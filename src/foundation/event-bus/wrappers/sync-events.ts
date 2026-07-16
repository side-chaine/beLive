// ============================================================
// src/foundation/event-bus/wrappers/sync-events.ts
// CLASS: SIDE-EFFECT
// ORIGINAL: src/sync/bridge/sync.bridge.ts (residue)
//
// sync-editor-closed — residue, не подписываться, только заглушка.
// EventBus-wrapper. Пока не активен — bridges продолжают
// работать через Facade. Активируется когда Facade отключается.
// ============================================================

import { Subscription } from '../types'

export function initSyncEvents(): () => void {
  const subs: Subscription[] = []

  // RESIDUE: sync-editor-closed не имеет подписчиков в EventBus.
  // Оставлен как заглушка для будущей миграции.

  return () => subs.forEach(s => s.unsubscribe())
}
