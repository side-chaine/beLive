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
import { useLyricsStore } from '../../../stores/lyrics.store'
import { getTransport } from '../../../audio/engine-v3'

const POLL_INTERVAL_MS = 100 // 10Hz

/** По времени трека определить активную строку (1:1 из audio.bridge.ts computeLineIndex) */
function resolveLineByTime(t: number): number {
  // M1-2 (342): getMarkers() не существует в marker-manager.js — маркеры в свойстве .markers.
  // Исправляем pre-existing баг: клик по блоку (seek) теперь обновит activeLineIndex.
  const mm = (window as any).markerManager
  const markers = (mm?.getMarkers?.() ?? mm?.markers ?? []) as any[]
  let bestLine = -1
  let bestTime = -Infinity
  for (const m of markers) {
    if (m.time <= t && m.time > bestTime) {
      bestTime = m.time
      bestLine = m.lineIndex
    }
  }
  return bestLine
}

export function initPositionSync(): () => void {
  let intervalId: ReturnType<typeof setInterval> | null = null

  /** Обновить currentTime из legacy-движка (AudioEngineV2 имеет getCurrentTime(), НЕ свойство currentTime) */
  const syncCurrentTime = () => {
    // Double guard: И state !== 'idle' И стемы есть. Одного условия мало —
    // V3DataInterceptor грузит стемы до авто-старта V3, state остаётся 'idle'.
    // Без state-проверки V2 polling сломается для всех V2-пользователей.
    const t3 = getTransport()
    if (t3 && ((window as any).__v3Active || (t3.state !== 'idle' && t3.orchestrator.all().length > 0))) return
    const t = getTransport()?.currentTime ?? -1
    if (t >= 0) {
      useAudioStore.setState({ currentTime: t })
    }
  }

  const sub = eventBus.subscribe(EventBusChannel.Audio, 'playback-state-changed', (payload) => {
    // syncCurrentTime уже имеет guard: при V3 (есть стемы) — выходит без чтения V2
    syncCurrentTime()
    if (payload.isPlaying) {
      if (!intervalId) {
        intervalId = setInterval(() => {
          syncCurrentTime()
        }, POLL_INTERVAL_MS)
      }
    } else {
      if (intervalId) {
        clearInterval(intervalId)
        intervalId = null
      }
    }
  })

  // Seek: обновляем currentTime + activeLineIndex при seek
  // Заменяет monkey-patch из audio.bridge.ts:254-274
  const seekSub = eventBus.subscribe(EventBusChannel.Audio, 'seek-position-changed', (p) => {
    useAudioStore.setState({ currentTime: p.currentTime })
    const lineIndex = resolveLineByTime(p.currentTime)
    if (lineIndex >= 0) {
      useLyricsStore.setState({ activeLineIndex: lineIndex })
    }
  })

  return () => {
    sub.unsubscribe()
    seekSub.unsubscribe()
    if (intervalId) clearInterval(intervalId)
  }
}
