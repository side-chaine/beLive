// ============================================================
// src/foundation/event-bus/wrappers/track-events.ts
// CLASS: SIDE-EFFECT
// ORIGINAL: src/bridges/track.bridge.ts ❄️ (retired)
//
// EventBus-wrapper. Замена track.bridge.
// - tracks-changed → читает из IDB, обновляет store
// - catalog-cleared → очищает store
// - track-loaded → обновляет currentTrack
// ============================================================

import { eventBus } from '../event-bus'
import { EventBusChannel, Subscription } from '../types'
import { useTrackStore } from '../../../stores/track.store'
import { getAllTracks } from '../../../services/idb.service'

/** Прочитать IDB и обновить store */
async function syncFromIDB(): Promise<void> {
  try {
    const tracks = await getAllTracks()
    if (!Array.isArray(tracks) || tracks.length === 0) return
    const tracksMeta = tracks.map((t: any, i: number) => ({
      id: String(t.id ?? ''),
      title: t.title,
      coverArtUrl: t.coverArtUrl || null,
      coverTheme: t.coverTheme || null,
      index: i,
    }))
    const idx = Number((window as any).trackCatalog?.currentTrackIndex ?? -1)
    useTrackStore.setState({
      tracksMeta,
      currentTrack: tracksMeta[idx] || null,
      currentTrackIndex: idx,
    })
  } catch {}
}

export function initTrackEvents(): () => void {
  const subs: Subscription[] = []

  // Cold-start: читаем из IDB (legacy catalog инициализируется асинхронно,
  // событие tracks-changed могло быть ДО нашей подписки)
  syncFromIDB().catch(() => {})
  // Дубль через 2с — на случай если IDB ещё не готов при старте
  setTimeout(() => syncFromIDB().catch(() => {}), 2000)

  // 1:1 из track.bridge.ts — tracks-changed
  subs.push(eventBus.subscribe(EventBusChannel.Catalog, 'tracks-changed', async () => {
    try {
      const tracks = await getAllTracks()
      const tracksMeta = tracks.map((t: any, i: number) => ({
        id: String(t.id ?? ''),
        title: t.title,
        coverArtUrl: t.coverArtUrl || null,
        coverTheme: t.coverTheme || null,
        index: i,
      }))
      const idx = Number((window as any).trackCatalog?.currentTrackIndex ?? -1)
      useTrackStore.setState({
        tracksMeta,
        currentTrack: tracksMeta[idx] || null,
        currentTrackIndex: idx,
      })
    } catch (e) {
      console.warn('[TrackEvents] tracks-changed failed:', e)
    }
  }))

  // 1:1 из track.bridge.ts — catalog-cleared
  subs.push(eventBus.subscribe(EventBusChannel.Catalog, 'catalog-cleared', () => {
    useTrackStore.setState({ tracksMeta: [], currentTrack: null, currentTrackIndex: -1 })
  }))

  // 1:1 из track.bridge.ts — track-loaded (обновить currentTrack по audioEngine)
  subs.push(eventBus.subscribe(EventBusChannel.Audio, 'track-loaded', () => {
    const idx = useTrackStore.getState().currentTrackIndex
    const meta = useTrackStore.getState().tracksMeta[idx]
    if (meta) useTrackStore.setState({ currentTrack: meta })
  }))

  return () => subs.forEach(s => s.unsubscribe())
}
