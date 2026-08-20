// ============================================================
// src/foundation/event-bus/wrappers/exercise-events.ts
// CLASS: PURE-STATE
// ORIGINAL: src/bridges/exercise.bridge.ts
//
// EventBus-wrapper. Пока не активен — bridges продолжают
// работать через Facade. Активируется когда Facade отключается.
// ============================================================

import { eventBus } from '../event-bus'
import { EventBusChannel, Subscription } from '../types'
import { useExerciseStore } from '../../../exercises/exercise.store'
import { useTakesStore } from '../../../takes/takes.store'

export function initExerciseEvents(): () => void {
  const subs: Subscription[] = []

  // 1:1 из exercise.bridge.ts — before-track-change → EventBus
  subs.push(eventBus.subscribe(EventBusChannel.Track, 'before-change', () => {
    const store = useExerciseStore.getState()
    store.cancelExercise?.()
    store.setPhase?.('idle')
    store.onStepCompleted?.()
  }))

  // 1:1 из exercise.bridge.ts — подписка на isRecording для перехода pre-recording → recording → completed
  let prevIsRecording = useTakesStore.getState().isRecording
  const unsubTakes = useTakesStore.subscribe((state) => {
    const isRecording = state.isRecording
    const exercise = useExerciseStore.getState()

    // pre-recording → recording
    if (!prevIsRecording && isRecording && exercise.phase === 'pre-recording') {
      exercise.setPhase('recording')
    }

    // recording → completed step
    if (prevIsRecording && !isRecording && exercise.phase === 'recording') {
      exercise.onStepCompleted()
    }

    prevIsRecording = isRecording
  })

  return () => {
    subs.forEach(s => s.unsubscribe())
    unsubTakes()
  }
}
