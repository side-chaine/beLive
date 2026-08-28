// ============================================================
// src/foundation/event-bus/wrappers/block-editor-events.ts
// CLASS: SIDE-EFFECT
// ORIGINAL: src/blocks/bridge/blockEditor.service.ts (ex-bridge)
//
// blocks-applied → IDB
// EventBus-wrapper. Активен (blocks-events в main.tsx:61).
// bridge продолжает работать параллельно (Dual-fire).
// ============================================================

import { eventBus } from '../event-bus'
import { EventBusChannel, Subscription } from '../types'

export function initBlockEditorEvents(): () => void {
  const subs: Subscription[] = []

  subs.push(eventBus.subscribe(EventBusChannel.Sync, 'blocks-applied', (_payload) => {
    // no-op placeholder: IDB-запись идёт через saveLyricsBlocks/blockEditor.service; ModalBlockEditor удалён в W5
  }))

  return () => subs.forEach(s => s.unsubscribe())
}
