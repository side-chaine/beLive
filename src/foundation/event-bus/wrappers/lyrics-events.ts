// ============================================================
// src/foundation/event-bus/wrappers/lyrics-events.ts
// CLASS: SIDE-EFFECT
// ORIGINAL: src/bridges/lyrics.bridge.ts
//
// 6 событий: reverse dispatchEvent, DOM
// EventBus-wrapper. Пока не активен — bridges продолжают
// работать через Facade. Активируется когда Facade отключается.
// ============================================================

import { eventBus } from '../event-bus'
import { EventBusChannel, Subscription } from '../types'
import { useLyricsStore } from '../../../stores/lyrics.store'

export function initLyricsEvents(): () => void {
  const subs: Subscription[] = []

  subs.push(eventBus.subscribe(EventBusChannel.Sync, 'active-line-changed', (payload) => {
    useLyricsStore.setState({ activeLineIndex: payload.lineIndex })
    // TODO: reverse dispatchEvent (синхронизация с legacy lyricsDisplay)
  }))

  subs.push(eventBus.subscribe(EventBusChannel.Sync, 'lyrics-rendered', () => {
    // TODO: DOM синхронизация с legacy
  }))

  subs.push(eventBus.subscribe(EventBusChannel.Audio, 'track-loaded', (_payload) => {
    // TODO: синхронизация строк из legacy lyricsDisplay
  }))

  subs.push(eventBus.subscribe(EventBusChannel.UI, 'mode-changed', (_payload) => {
    // TODO: синхронизация при смене режима
  }))

  subs.push(eventBus.subscribe(EventBusChannel.Track, 'before-change', () => {
    useLyricsStore.setState({ lines: [], activeLineIndex: -1 })
  }))

  subs.push(eventBus.subscribe(EventBusChannel.Audio, 'playback-state-changed', (_payload) => {
    // TODO: frame-based line sync через scheduler
  }))

  return () => subs.forEach(s => s.unsubscribe())
}
