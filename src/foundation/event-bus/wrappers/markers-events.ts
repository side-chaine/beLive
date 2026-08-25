// ============================================================
// src/foundation/event-bus/wrappers/markers-events.ts
// CLASS: SIDE-EFFECT
// ORIGINAL: src/bridges/markers.bridge.ts
//
// track-loaded + sections-updated → polling
// EventBus-wrapper. Пока не активен — bridges продолжают
// работать через Facade. Активируется когда Facade отключается.
// ============================================================

import { eventBus } from '../event-bus'
import { EventBusChannel, Subscription } from '../types'
import { useMarkersStore } from '../../../stores/markers.store'
import { useLyricsStore } from '../../../stores/lyrics.store'

export function initMarkersEvents(): () => void {
  const subs: Subscription[] = []
  let pendingTimer: ReturnType<typeof setTimeout> | null = null
  let settleTimer: ReturnType<typeof setInterval> | null = null

  const clearPending = () => {
    if (pendingTimer) { clearTimeout(pendingTimer); pendingTimer = null }
    if (settleTimer) { clearInterval(settleTimer); settleTimer = null }
  }

  const syncMarkers = () => {
    const mm = (window as any).markerManager
    if (mm?.markers) {
      const linesCount = useLyricsStore.getState().lines.length
      let validMarkers = mm.markers
      if (linesCount > 0) {
        validMarkers = mm.markers.filter((m: any) =>
          m.markerType === 'M2' || (m.lineIndex >= 0 && m.lineIndex < linesCount))
      }
      useMarkersStore.setState({
        markers: validMarkers,
        sections: mm.sections ? [...mm.sections] : [],
        trackDuration: mm.trackDuration || 0,
      })
    }
  }

  const scheduleSyncForTrack = (_detail?: any) => {
    clearPending()                                   // сброс таймеров ПРЕДЫДУЩЕГО трека
    // (А) немедленно гасим stale-маркеры предыдущего трека — не ждём 500мс
    useMarkersStore.setState({ markers: [], sections: [], trackDuration: 0 })
    // bounded settle-poll: ловим позднюю populate markers.bridge + VOC-runtime-correct
    let last = useMarkersStore.getState().markers
    const settle = () => {
      syncMarkers()
      const now = useMarkersStore.getState().markers
      if (now !== last) { last = now; return }       // ещё меняются — продолжаем
      clearPending()                                  // стабилизировалось
    }
    pendingTimer = setTimeout(() => { settle(); settleTimer = setInterval(settle, 120) }, 0)
    setTimeout(() => clearPending(), 2000)           // жёсткий предел poll
    // (Б) ресинк ПОСЛЕ VOC-коррекции (гейт = awaitStemReady, тот же что у оркестратора)
    const ae = (window as any).audioEngine
    if (typeof ae?.awaitStemReady === 'function') {
      ae.awaitStemReady('vocals', 15000).then(() => syncMarkers()).catch(() => {})
    } else {
      console.warn('[MARKERS] ae.awaitStemReady отсутствует — VOC-коррекция не дождётся ресинка store (dataVersion<4 могут поехать)')
    }
  }

  subs.push(eventBus.subscribe(EventBusChannel.Audio, 'track-loaded', (p) => scheduleSyncForTrack(p)))
  subs.push(eventBus.subscribe(EventBusChannel.Sync, 'sections-updated', () => { clearPending(); syncMarkers() }))

  return () => { clearPending(); subs.forEach(s => s.unsubscribe()) }
}
