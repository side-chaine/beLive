// ============================================================
// src/foundation/event-bus/wrappers/blocks-events.ts
// CLASS: SIDE-EFFECT
// ORIGINAL: src/bridges/blocks.bridge.ts
//
// 4 события: setTimeout
// EventBus-wrapper. Пока не активен — bridges продолжают
// работать через Facade. Активируется когда Facade отключается.
// ============================================================

import { eventBus } from '../event-bus'
import { EventBusChannel, Subscription } from '../types'
import { useBlocksStore } from '../../../stores/blocks.store'

export function initBlocksEvents(): () => void {
  const subs: Subscription[] = []

  const syncBlocksFromLegacy = () => {
    const ld = (window as any).lyricsDisplay
    if (!ld || !ld.textBlocks) {
      useBlocksStore.getState().clearBlocks()
      return
    }
    const raw = ld.textBlocks
    const blocks = raw
      .filter((b: any) => Array.isArray(b.lineIndices) && b.lineIndices.length > 0)
      .map((b: any, i: number) => ({
        id: b.id || `legacy-block-${i}`,
        name: b.name || `Block ${i + 1}`,
        type: b.type || b.blockType || 'unknown',
        lineIndices: b.lineIndices!,
      }))
    useBlocksStore.getState().setBlocks(blocks)
  }

  subs.push(eventBus.subscribe(EventBusChannel.Track, 'before-change', () => {
    useBlocksStore.getState().clearBlocks()
  }))

  subs.push(eventBus.subscribe(EventBusChannel.Sync, 'blocks-applied', () => {
    // TODO: syncBlocksFromLegacy
  }))

  subs.push(eventBus.subscribe(EventBusChannel.Audio, 'track-loaded', () => {
    setTimeout(() => {
      syncBlocksFromLegacy()
    }, 300)
  }))

  subs.push(eventBus.subscribe(EventBusChannel.Sync, 'lyrics-rendered', () => {
    syncBlocksFromLegacy()
  }))

  return () => subs.forEach(s => s.unsubscribe())
}
