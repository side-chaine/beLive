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

const MM_EVENTS = ['markerAdded', 'markerUpdated', 'markerDeleted', 'markersReset'] as const

export function initMarkersEvents(): () => void {
  const subs: Subscription[] = []
  let pendingTimer: ReturnType<typeof setTimeout> | null = null
  let settleTimer: ReturnType<typeof setInterval> | null = null
  const mmUnsubs: Array<() => void> = []
  let retryTimer: ReturnType<typeof setInterval> | null = null
  let retryDeadline: ReturnType<typeof setTimeout> | null = null
  let bound = false

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

  const stopRetry = () => {
    if (retryTimer) { clearInterval(retryTimer); retryTimer = null }
    if (retryDeadline) { clearTimeout(retryDeadline); retryDeadline = null }
  }

  const bindRealtime = () => {
    if (bound) return
    const mm = (window as any).markerManager
    if (typeof mm?.subscribe !== 'function') return
    if (!MM_EVENTS.every((ev) => Array.isArray(mm.subscribers?.[ev]))) return
    for (const ev of MM_EVENTS) mmUnsubs.push(mm.subscribe(ev, syncMarkers))
    bound = true
    stopRetry()
    syncMarkers()
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

  retryTimer = setInterval(bindRealtime, 100)
  retryDeadline = setTimeout(() => {
    if (bound) return
    console.error('[MARKERS] B08 realtime bind timeout (5000ms): mm.subscribe unavailable — live markers disabled')
    stopRetry()
  }, 5000)
  bindRealtime()

  subs.push(eventBus.subscribe(EventBusChannel.Audio, 'track-loaded', (p) => scheduleSyncForTrack(p)))
  subs.push(eventBus.subscribe(EventBusChannel.Sync, 'sections-updated', () => { clearPending(); syncMarkers() }))

  return () => {
    stopRetry()
    clearPending()
    subs.forEach(s => s.unsubscribe())
    mmUnsubs.splice(0).forEach(u => u())
  }
}
