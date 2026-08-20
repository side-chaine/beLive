// ============================================================
// src/foundation/event-bus/wrappers/text-style-events.ts
// CLASS: SIDE-EFFECT
// ORIGINAL: src/bridges/textStyle.bridge.ts
//
// track-loaded → MutationObserver
// EventBus-wrapper. Пока не активен — bridges продолжают
// работать через Facade. Активируется когда Facade отключается.
// ============================================================

import { eventBus } from '../event-bus'
import { EventBusChannel, Subscription } from '../types'
import '../../../data/textStylePresets' // гарантирует window.__TEXT_STYLE_PRESETS

export function initTextStyleEvents(): () => void {
  const subs: Subscription[] = []

  let _observer: MutationObserver | null = null

  const startObserver = () => {
    _observer?.disconnect()
    const container = document.getElementById('lyrics-container')
    if (!container) return
    _observer = new MutationObserver(() => {
      const txtStyle = (window as any).__TEXT_STYLE_PRESETS
      if (!txtStyle) return
      const root = document.documentElement
      root.style.setProperty('--bl-lyrics-font-family', txtStyle.fontFamily || 'inherit')
      root.style.setProperty('--bl-lyrics-font-size', txtStyle.fontSize || 'inherit')
    })
    _observer.observe(container, { childList: true, subtree: true, attributes: true })
  }

  subs.push(eventBus.subscribe(EventBusChannel.Audio, 'track-loaded', () => {
    startObserver()
  }))

  return () => {
    _observer?.disconnect()
    _observer = null
    subs.forEach(s => s.unsubscribe())
  }
}
