// ============================================================
// src/foundation/event-bus/wrappers/audio-reactive.ts
// CLASS: SIDE-EFFECT
// ORIGINAL: src/bridges/audio-reactive.bridge.ts
//
// playback-state-changed → CSS vars, analyser connect
// EventBus-wrapper. Пока не активен — bridges продолжают
// работать через Facade. Активируется когда Facade отключается.
// ============================================================

import { eventBus } from '../event-bus'
import { EventBusChannel, Subscription } from '../types'
// queueCssVar will be imported when scheduler integration is implemented

export function initAudioReactiveEvents(): () => void {
  const subs: Subscription[] = []

  const resetCssVars = () => {
    const root = document.documentElement
    root.style.setProperty('--bl-audio-energy', '0')
    root.style.setProperty('--bl-audio-bass', '0')
    root.style.setProperty('--bl-audio-mid', '0')
    root.style.setProperty('--bl-audio-high', '0')
    root.style.setProperty('--bl-audio-beat', '0')
  }

  subs.push(eventBus.subscribe(EventBusChannel.Audio, 'playback-state-changed', (payload) => {
    if (payload.isPlaying) {
      // TODO: scheduler lifecycle — анализатор подключение
    } else {
      resetCssVars()
    }
  }))

  return () => {
    resetCssVars()
    subs.forEach(s => s.unsubscribe())
  }
}
