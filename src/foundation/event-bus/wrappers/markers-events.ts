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

  const syncMarkers = () => {
    const mm = (window as any).markerManager
    if (mm?.markers) {
      const linesCount = useLyricsStore.getState().lines.length
      let validMarkers = mm.markers
      if (linesCount > 0) {
        validMarkers = mm.markers.filter((m: any) =>
          m.markerType === 'M2' || (m.lineIndex >= 0 && m.lineIndex < linesCount)
        )
      }
      useMarkersStore.setState({
        markers: validMarkers,
        sections: mm.sections ? [...mm.sections] : [],
        trackDuration: mm.trackDuration || 0,
      })
    }
  }

  subs.push(eventBus.subscribe(EventBusChannel.Audio, 'track-loaded', () => {
    // TODO: polling — syncMarkers с задержкой
    setTimeout(syncMarkers, 500)
  }))

  subs.push(eventBus.subscribe(EventBusChannel.Sync, 'sections-updated', () => {
    syncMarkers()
  }))

  return () => subs.forEach(s => s.unsubscribe())
}
