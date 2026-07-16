// ============================================================
// src/foundation/event-bus/wrappers/block-editor-events.ts
// CLASS: SIDE-EFFECT
// ORIGINAL: src/blocks/bridge/blockEditor.bridge.ts
//
// blocks-applied → IDB
// EventBus-wrapper. Пока не активен — bridges продолжают
// работать через Facade. Активируется когда Facade отключается.
// ============================================================

import { eventBus } from '../event-bus'
import { EventBusChannel, Subscription } from '../types'

export function initBlockEditorEvents(): () => void {
  const subs: Subscription[] = []

  subs.push(eventBus.subscribe(EventBusChannel.Sync, 'blocks-applied', (_payload) => {
    // TODO: IDB write, global constructor ModalBlockEditor
  }))

  return () => subs.forEach(s => s.unsubscribe())
}
