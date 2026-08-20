// ============================================================
// src/foundation/event-bus/wrappers/takes-events.ts
// CLASS: SIDE-EFFECT
// ORIGINAL: src/bridges/takes.bridge.ts  (49 строк, RETIRED)
// 
// EventBus-wrapper с полной parity.
// Перед активацией: bridgeFacade перехватывает события через Facade.
// После активации: слушает EventBus напрямую.
// ============================================================

import { eventBus } from '../event-bus'
import { EventBusChannel, Subscription } from '../types'
import { useTakesStore } from '../../../takes/takes.store'

export function initTakesEvents(): () => void {
  const subs: Subscription[] = []

  // 1. before-track-change → cleanup takes store
  subs.push(eventBus.subscribe(EventBusChannel.Track, 'before-change', () => {
    useTakesStore.getState().cleanup()
    document.documentElement.removeAttribute('data-takes-recording')
    document.documentElement.removeAttribute('data-recording-active')
  }))

  // 2. playback-state-changed → stop active preview
  subs.push(eventBus.subscribe(EventBusChannel.Audio, 'playback-state-changed', (payload) => {
    if (!payload.isPlaying) {
      document.documentElement.removeAttribute('data-takes-recording')
      // __stopPreviewFn attached to store object, not state
      if ((useTakesStore as any).__stopPreviewFn) {
        (useTakesStore as any).__stopPreviewFn()
      }
    }
  }))

  // 3. isRecording → CSS attr (как в bridge)
  const unsubIsRecording = useTakesStore.subscribe(
    (state) => state.isRecording,
    (isRecording) => {
      if (isRecording) {
        document.documentElement.setAttribute('data-takes-recording', 'true')
        document.documentElement.setAttribute('data-recording-active', 'true')
      } else {
        document.documentElement.removeAttribute('data-takes-recording')
        document.documentElement.removeAttribute('data-recording-active')
      }
    },
  )

  // 4. cleanup
  return () => {
    subs.forEach(s => s.unsubscribe())
    unsubIsRecording()
  }
}
