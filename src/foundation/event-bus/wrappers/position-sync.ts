// ============================================================
// src/foundation/event-bus/wrappers/position-sync.ts
// CLASS: SIDE-EFFECT
// ORIGINAL: src/bridges/time-sync.ts
//
// EventBus-wrapper. Пока не активен — bridges продолжают
// работать через Facade. Активируется когда Facade отключается.
// ============================================================

import { eventBus } from '../event-bus'
import { EventBusChannel } from '../types'
import { useAudioStore } from '../../../stores/audio.store'
import { V2Adapter } from '../../../audio/engine-v3/V2Adapter'

const POLL_INTERVAL_MS = 100 // 10Hz

export function initPositionSync(): () => void {
  let intervalId: ReturnType<typeof setInterval> | null = null
  const v2 = V2Adapter.getInstance()

  const sub = eventBus.subscribe(EventBusChannel.Audio, 'playback-state-changed', (payload) => {
    if (payload.isPlaying) {
      if (!intervalId) {
        intervalId = setInterval(() => {
          // 1:1 из time-sync.ts — читаем currentTime через V2Adapter
          const t = v2.getSync<number>('currentTime')
          if (typeof t === 'number' && t >= 0) {
            useAudioStore.setState({ currentTime: t })
          }
        }, POLL_INTERVAL_MS)
      }
    } else {
      if (intervalId) {
        clearInterval(intervalId)
        intervalId = null
      }
    }
  })

  return () => {
    sub.unsubscribe()
    if (intervalId) clearInterval(intervalId)
  }
}
