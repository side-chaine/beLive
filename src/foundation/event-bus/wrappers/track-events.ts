// ============================================================
// src/foundation/event-bus/wrappers/track-events.ts
// CLASS: SIDE-EFFECT
// ORIGINAL: src/bridges/track.bridge.ts
//
// EventBus-wrapper. Пока не активен — bridges продолжают
// работать через Facade. Активируется когда Facade отключается.
// ============================================================

import { eventBus } from '../event-bus'
import { EventBusChannel, Subscription } from '../types'
import { useTrackStore } from '../../../stores/track.store'

export function initTrackEvents(): () => void {
  const subs: Subscription[] = []

  subs.push(eventBus.subscribe(EventBusChannel.Catalog, 'tracks-changed', (_payload) => {
    // useTrackStore — обновить список треков
    // TODO: переписать cover image URL management при миграции track.bridge
  }))

  subs.push(eventBus.subscribe(EventBusChannel.Catalog, 'catalog-cleared', () => {
    (useTrackStore.getState() as any).clearTracks?.()
  }))

  subs.push(eventBus.subscribe(EventBusChannel.Audio, 'track-loaded', (_payload) => {
    // Обновить currentTrack в store
  }))

  subs.push(eventBus.subscribe(EventBusChannel.Sync, 'blocks-applied', (_payload) => {
    // Обновить blocks
  }))

  return () => subs.forEach(s => s.unsubscribe())
}
