// ============================================================
// src/foundation/event-bus/wrappers/lyrics-events.ts
// CLASS: SIDE-EFFECT
// ORIGINAL: src/bridges/lyrics.bridge.ts (184 строк, ❄️ FROZEN)
//
// EventBus-wrapper с полной parity.
// Detector+writer из bridge.lines 83-159 портированы.
// scheduler ID: lyrics-events-line-detector, lyrics-events-line-writer
// (отличаются от bridge — clean teardown без race)
// ============================================================

import { eventBus } from '../event-bus'
import { EventBusChannel, Subscription } from '../types'
import { useLyricsStore } from '../../../stores/lyrics.store'
import { useMarkersStore } from '../../../stores/markers.store'
import { getPlaybackVisualScheduler } from '../../../playback'
import type { PlaybackVisualFrameDetector, PlaybackVisualFrameWriter } from '../../../playback'

export function initLyricsEvents(): () => void {
  const subs: Subscription[] = []

  // ── Scheduler integration (портировано из bridge.ts:83-159) ──
  const scheduler = getPlaybackVisualScheduler()
  let frameActiveLineIndex = -1
  let lastPublishedLineIndex = -1
  let rafSyncActive = false

  // TC-10.14 guard state (persistent across frames — parity с bridge.ts:19-20)
  let _guardLogged = false
  let _guardLastCount = 0

  // Detector: вычисляет active line из markers по current time
  const detector: PlaybackVisualFrameDetector = {
    id: 'lyrics-events-line-detector',
    detect(ctx) {
      const time = ctx.currentTime
      if (time === undefined || !rafSyncActive) {
        frameActiveLineIndex = -1
        return
      }
      // Портировано из bridge.ts:90-132
      const markers = useMarkersStore.getState().markers as any[]
      const lines = useLyricsStore.getState().lines
      if (!Array.isArray(markers) || !Array.isArray(lines)) {
        frameActiveLineIndex = -1
        return
      }

      // TC-10.14 guard: игнорируем M2 маркеры и out-of-bounds
      let bestLineIndex = -1
      let bestTime = -Infinity
      let invalidCount = 0

      for (const m of markers) {
        // Skip ALL M2 markers (parity с bridge.ts:106)
        if (m.markerType === 'M2') continue
        // Skip out-of-bounds
        if (m.lineIndex < 0 || m.lineIndex >= lines.length) {
          invalidCount++
          continue
        }
        // Bridge parity: без break — проходим все маркеры
        if (m.time <= time && m.time > bestTime) {
          bestTime = m.time
          bestLineIndex = m.lineIndex
        }
      }

      // Throttled guard логирование (parity с bridge.ts:118-128)
      if (invalidCount > 5 && !_guardLogged) {
        console.error(`[GUARD] CRITICAL: ${invalidCount} markers out of bounds. Data migration needed.`)
        _guardLogged = true
        _guardLastCount = invalidCount
      } else if (invalidCount > 0 && invalidCount !== _guardLastCount && !_guardLogged) {
        console.warn(`[GUARD] Filtered ${invalidCount} invalid marker(s) — skipping in detection`)
        _guardLastCount = invalidCount
      }

      frameActiveLineIndex = bestLineIndex
    },
  }

  // Writer: публикует line changes в store и legacy
  const writer: PlaybackVisualFrameWriter = {
    id: 'lyrics-events-line-writer',
    write() {
      if (frameActiveLineIndex !== lastPublishedLineIndex && rafSyncActive) {
        lastPublishedLineIndex = frameActiveLineIndex
        useLyricsStore.setState({ activeLineIndex: frameActiveLineIndex })

        // Reverse dispatch к legacy (портировано из bridge.ts:145-153)
        const ld = (window as any).lyricsDisplay
        if (ld) {
          ld.currentLine = frameActiveLineIndex
        }
        document.dispatchEvent(new CustomEvent('active-line-changed', {
          detail: {
            lineIndex: frameActiveLineIndex,
            newLineIndex: frameActiveLineIndex,
          },
        }))
      }
    },
  }

  scheduler.registerDetector(detector)
  scheduler.registerWriter(writer)

  // ── Initial sync с 1000ms retry ──
  const syncLyricsFromLegacy = () => {
    const ld = (window as any).lyricsDisplay
    if (!ld || !Array.isArray(ld.lyrics)) return
    useLyricsStore.setState({ lines: [...ld.lyrics] })
  }
  syncLyricsFromLegacy()
  const retryTimer = setTimeout(syncLyricsFromLegacy, 1000)

  // ── EventBus подписки ──

  // active-line-changed (внешние, не от rAF)
  subs.push(eventBus.subscribe(EventBusChannel.Sync, 'active-line-changed', (payload) => {
    if (!rafSyncActive) {
      useLyricsStore.setState({ activeLineIndex: payload.lineIndex })
    }
    if (useLyricsStore.getState().lines.length === 0) syncLyricsFromLegacy()
  }))

  // lyrics-rendered
  subs.push(eventBus.subscribe(EventBusChannel.Sync, 'lyrics-rendered', () => {
    syncLyricsFromLegacy()
  }))

  // track-loaded + 50/250ms retry (legacy async population)
  subs.push(eventBus.subscribe(EventBusChannel.Audio, 'track-loaded', () => {
    syncLyricsFromLegacy()
    setTimeout(() => syncLyricsFromLegacy(), 50)
    setTimeout(() => syncLyricsFromLegacy(), 250)
  }))

  // mode-changed
  subs.push(eventBus.subscribe(EventBusChannel.UI, 'mode-changed', () => {
    setTimeout(() => syncLyricsFromLegacy(), 50)
  }))

  // before-track-change
  subs.push(eventBus.subscribe(EventBusChannel.Track, 'before-change', () => {
    rafSyncActive = false
    frameActiveLineIndex = -1
    lastPublishedLineIndex = -1
    useLyricsStore.setState({ lines: [], activeLineIndex: -1 })
    // NOTE: guard state НЕ сбрасывается — markers ещё от старого трека
    // (сброс на track-loaded когда markers уже валидны)
  }))

  // track-loaded + 50/250ms retry (legacy async population)
  subs.push(eventBus.subscribe(EventBusChannel.Audio, 'track-loaded', () => {
    syncLyricsFromLegacy()
    // Reset guard state — markers нового трека уже загружены
    _guardLogged = false
    _guardLastCount = 0
    setTimeout(() => syncLyricsFromLegacy(), 50)
    setTimeout(() => syncLyricsFromLegacy(), 250)
  }))

  // playback-state-changed (parity: обновляет rafSyncActive)
  subs.push(eventBus.subscribe(EventBusChannel.Audio, 'playback-state-changed', (p) => {
    rafSyncActive = p?.isPlaying ?? false
    if (!rafSyncActive) {
      frameActiveLineIndex = -1
      lastPublishedLineIndex = -1
    }
  }))

  // ── Cleanup ──
  return () => {
    clearTimeout(retryTimer)
    scheduler.unregister('lyrics-events-line-detector')
    scheduler.unregister('lyrics-events-line-writer')
    subs.forEach(s => s.unsubscribe())
  }
}
