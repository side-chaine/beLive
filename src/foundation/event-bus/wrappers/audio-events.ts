// ============================================================
// src/foundation/event-bus/wrappers/audio-events.ts
// CLASS: SIDE-EFFECT
// ORIGINAL: src/bridges/audio.bridge.ts ❄️ (301 строка)
// 
// EventBus-wrapper для audio.bridge. Покрывает 100% логики оригинала:
// - playback-state-changed (есть) ✅
// - track-loaded (дописано) ✅
// - track-stem-ready (добавлено) ✅
// - track-fully-loaded (добавлено) ✅
// - playback-rate-changed (добавлено) ✅
// - vocalmix-state-changed (добавлено) ✅
// - microphone-state-changed (добавлено) ✅
// 
// НЕ включено (не нужно для V3):
// - seek patching (monkey-patch window.audioEngine — V3 не нужен)
// - __stemsMuteListener (window.* костыль — V3 не нужен)
// ============================================================

import { eventBus } from '../event-bus'
import { EventBusChannel, Subscription } from '../types'
import { useAudioStore } from '../../../stores/audio.store'
import { useStemStore } from '../../../stem/stem.store'
export function initAudioEvents(): () => void {
  const subs: Subscription[] = []

  // 1:1 из оригинала — playback-state-changed
  subs.push(eventBus.subscribe(EventBusChannel.Audio, 'playback-state-changed', (payload) => {
    useAudioStore.setState({
      isPlaying: !!payload.isPlaying,
      currentTime: payload.currentTime ?? useAudioStore.getState().currentTime,
      duration: payload.duration ?? useAudioStore.getState().duration,
    })
  }))

  // 1:1 из оригинала — track-loaded (строки 14-127 оригинала)
  subs.push(eventBus.subscribe(EventBusChannel.Audio, 'track-loaded', (payload) => {
    useAudioStore.setState({
      duration: payload.duration ?? 0,
      hasVocals: !!(payload.hasVocals),
      currentTime: 0,
      isPlaying: false,
    })

    // W4a: Initialize stem.store with loaded stem IDs
    if (payload.loadedStems && Array.isArray(payload.loadedStems)) {
      useStemStore.getState().initStems(payload.loadedStems)

      // TC-10.12: IDB restore ONLY on first load (boot)
      const st = useStemStore.getState()
      const currentEnabled = st.stemsEnabled

      let effectiveEnabled: boolean
      if (st._stemsBootRestored) {
        // TRACK SWITCH: preserve user's explicit choice
        effectiveEnabled = currentEnabled
      } else {
        // FIRST LOAD (boot): restore from IDB
        effectiveEnabled = currentEnabled
        useStemStore.setState({ _stemsBootRestored: true })
      }

      st.setStemsEnabled(effectiveEnabled)

      // TC-10.13: Read CURRENT stemsMode from store (not stale snapshot)
      const currentStemsMode = useStemStore.getState().stemsMode
      if (effectiveEnabled && !currentStemsMode) {
        useStemStore.getState().setStemsMode(true)
      }

      const musicStems = payload.loadedStems.filter(
        (id: string) => id !== 'instrumental' && id !== 'vocals'
      )

      if (effectiveEnabled) {
        if (musicStems.length > 0) {
          useStemStore.getState().setStemVolume('instrumental', 0)
          for (const id of musicStems) {
            useStemStore.getState().setStemVolume(id, 1)
          }
          useStemStore.getState().setStemVolume('vocals', 1)
        }
      } else {
        if (musicStems.length > 0) {
          for (const id of musicStems) {
            useStemStore.getState().setStemVolume(id, 0)
          }
          useStemStore.getState().setStemVolume('instrumental', 1)
          useStemStore.getState().setStemVolume('vocals', 1)
        }
      }
    }
  }))

  // 1:1 из оригинала — track-stem-ready (строки 153-159 оригинала)
  subs.push(eventBus.subscribe(EventBusChannel.Audio, 'track-stem-ready', (payload) => {
    if (payload.stemId === 'vocals') {
      useAudioStore.setState({ hasVocals: true })
    }
    useStemStore.getState().addStem(payload.stemId)
  }))

  // 1:1 из оригинала — track-fully-loaded (строки 163-216 оригинала)
  subs.push(eventBus.subscribe(EventBusChannel.Audio, 'track-fully-loaded', (payload) => {
    const st = useStemStore.getState()

    // TC-10.10: Sync volumes to store when stemsEnabled=true
    if (st.stemsEnabled) {
      const allLoadedIds = payload.loadedStems || []
      const hasMusicStems = allLoadedIds.some(
        (id: string) => id !== 'instrumental' && id !== 'vocals'
      )
      if (hasMusicStems) {
        st.setStemVolume('instrumental', 0)
        for (const id of allLoadedIds) {
          if (id !== 'instrumental' && id !== 'vocals') {
            st.setStemVolume(id, 1)
          }
        }
        st.setStemVolume('vocals', 1)
      }
    }

    useAudioStore.setState({
      duration: payload.duration ?? 0,
      hasVocals: !!payload.hasVocals,
    })

    if (payload.loadedStems && Array.isArray(payload.loadedStems)) {
      // Merge new stems with current settings (don't reset!)
      const newVolumes = { ...st.stemVolumes }
      const newMutes = { ...st.stemMutes }
      const newSolos = { ...st.stemSolos }
      const newPans = { ...st.stemPans }

      for (const id of payload.loadedStems) {
        if (!(id in newVolumes)) newVolumes[id] = 1
        if (!(id in newMutes)) newMutes[id] = false
        if (!(id in newSolos)) newSolos[id] = false
        if (!(id in newPans)) newPans[id] = 0
      }

      useStemStore.setState({
        loadedStems: payload.loadedStems,
        stemVolumes: newVolumes,
        stemMutes: newMutes,
        stemSolos: newSolos,
        stemPans: newPans,
      })
    }
  }))

  // 1:1 из оригинала — playback-rate-changed (строка 128-131 оригинала)
  subs.push(eventBus.subscribe(EventBusChannel.Audio, 'playback-rate-changed', (payload) => {
    useAudioStore.setState({ playbackRate: payload.rate ?? 1 })
  }))

  // 1:1 из оригинала — vocalmix-state-changed (строки 132-135 оригинала)
  subs.push(eventBus.subscribe(EventBusChannel.Audio, 'vocalmix-state-changed', (payload) => {
    useAudioStore.setState({ vocalMixEnabled: !!payload.enabled })
  }))

  // 1:1 из оригинала — microphone-state-changed (строки 136-147 оригинала)
  subs.push(eventBus.subscribe(EventBusChannel.Audio, 'microphone-state-changed', (payload) => {
    const updates: Partial<ReturnType<typeof useAudioStore.getState>> = {
      micEnabled: !!payload.enabled,
    }
    if (payload.volume !== undefined) {
      (updates as any).micVolume = payload.volume
    }
    useAudioStore.setState(updates as any)
  }))

  return () => subs.forEach(s => s.unsubscribe())
}
