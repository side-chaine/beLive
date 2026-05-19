---
schema: BRIDGE-EVENT-MATRIX
version: 1.0
generated: 2026-04-27
nodes:
  - id: audioBridge
    file: src/bridges/audio.bridge.ts
    layer: bridge
    authority: false
    frozen: false
    observable: true
    p0: false
  - id: lyricsBridge
    file: src/bridges/lyrics.bridge.ts
    layer: bridge
    authority: false
    frozen: false
    observable: true
    p0: false
  - id: markersBridge
    file: src/bridges/markers.bridge.ts
    layer: bridge
    authority: false
    frozen: false
    observable: true
    p0: false
  - id: modeSwitchBridge
    file: src/bridges/mode-switch.bridge.ts
    layer: bridge
    authority: true
    frozen: false
    observable: false
    p0: false
  - id: modeBridge
    file: src/bridges/mode.bridge.ts
    layer: bridge
    authority: false
    frozen: false
    observable: true
    p0: false
  - id: loopBridge
    file: src/bridges/loop.bridge.ts
    layer: bridge
    authority: false
    frozen: true
    observable: true
    p0: false
  - id: trackBridge
    file: src/bridges/track.bridge.ts
    layer: bridge
    authority: false
    frozen: false
    observable: true
    p0: false
  - id: textStyleBridge
    file: src/bridges/textStyle.bridge.ts
    layer: bridge
    authority: false
    frozen: false
    observable: true
    p0: false
  - id: monitorBridge
    file: src/bridges/monitor.bridge.ts
    layer: bridge
    authority: false
    frozen: false
    observable: true
    p0: false
  - id: coverThemeBridge
    file: src/bridges/cover-theme.bridge.ts
    layer: bridge
    authority: false
    frozen: false
    observable: true
    p0: false
  - id: audioReactiveBridge
    file: src/bridges/audio-reactive.bridge.ts
    layer: bridge
    authority: false
    frozen: false
    observable: true
    p0: false
  - id: liveGuard
    file: src/bridges/live-guard.ts
    layer: bridge
    authority: false
    frozen: false
    observable: false
    p0: false
  - id: timeSync
    file: src/bridges/time-sync.ts
    layer: bridge
    authority: false
    frozen: false
    observable: true
    p0: false
  - id: triggerBridge
    file: src/triggers/trigger.bridge.ts
    layer: bridge
    authority: false
    frozen: false
    observable: true
    p0: false
  - id: syncBridge
    file: src/sync/bridge/sync.bridge.ts
    layer: bridge
    authority: false
    frozen: false
    observable: true
    p0: false
  - id: takesBridge
    file: src/takes/takes.bridge.ts
    layer: bridge
    authority: false
    frozen: false
    observable: true
    p0: false
  - id: exerciseBridge
    file: src/exercises/exercise.bridge.ts
    layer: bridge
    authority: false
    frozen: false
    observable: true
    p0: false
  - id: blocksBridge
    file: src/bridges/blocks.bridge.ts
    layer: bridge
    authority: false
    frozen: false
    observable: true
    p0: false
  - id: blockEditorBridge
    file: src/blocks/bridge/blockEditor.bridge.ts
    layer: bridge
    authority: false
    frozen: false
    observable: true
    p0: false
  - id: performanceBridge
    file: src/performance/performance.bridge.ts
    layer: bridge
    authority: false
    frozen: false
    observable: true
    p0: false
  - id: stemReactiveBridge
    file: src/bridges/stem-reactive.bridge.ts
    layer: bridge
    authority: false
    frozen: false
    observable: true
    p0: false
---

# BRIDGE-EVENT-MATRIX — Провода системы

> Все bridges: кто что слушает, кто что эмитит, на каком таргете.
> Без этой карты — не знаешь куда ткнёшь и что отвалится.

## Legend

🟢 Stable | 🟡 Active | 🔴 P0 | ⚠️ Seam | ❄️ Frozen | 🔵 Observable | 📦 Boundary

## Level 1 — Bird's Eye

```
                    ┌─────────────────────────────────────────────────┐
                    │              window (events)                    │
                    │                                                 │
                    │  playback-state-changed  ◄──── 4 bridges        │
                    │  mode-changed            ◄──── 3 bridges        │
                    │  keydown (Ctrl+Shift+T)  ◄──── 1 bridge         │
                    └──────────────┬──────────────────────────────────┘
                                   │
                    ┌──────────────▼──────────────────────────────────┐
                    │          document (events)                      │
                    │                                                 │
                    │  track-loaded            ◄──── 6 bridges        │
                    │  before-track-change     ◄──── 5 bridges        │
                    │  track-fully-loaded      ◄──── 1 bridge         │
                    │  track-stem-ready        ◄──── 1 bridge         │
                    │  playback-rate-changed   ◄──── 1 bridge         │
                    │  vocalmix-state-changed  ◄──── 1 bridge         │
                    │  microphone-state-changed◄──── 1 bridge         │
                    │  audio-position-changed  ◄──── 1 bridge         │
                    │  timeupdate              ◄──── 1 bridge         │
                    │  active-line-changed     ◄──── 1 bridge         │
                    │  lyrics-rendered         ◄──── 2 bridges        │
                    │  sections-updated        ◄──── 1 bridge         │
                    │  blocks-applied          ◄──── 2 bridges        │
                    │  catalog-cleared         ◄──── 2 bridges        │
                    │  tracks-changed          ◄──── 1 bridge         │
                    │  monitor-state-changed   ◄──── 1 bridge         │
                    │  monitor-route-changed   ◄──── 1 bridge         │
                    │  track-load-failed       ◄──── 1 bridge         │
                    └──────────────┬──────────────────────────────────┘
                                   │
                    ┌──────────────▼──────────────────────────────────┐
                    │          Store Subscriptions                    │
                    │                                                 │
                    │  useLoopStore            ────► loopBridge       │
                    │  usePerformanceStore     ────► performanceBr    │
                    │  useRecordingStore       ────► performanceBr    │
                    │  useTakesStore           ────► performanceBr    │
                    │                           ────► takesBridge     │
                    │                           ────► exerciseBridge  │
                    │  useTrackStore           ────► coverThemeBr     │
                    │  useTextStyleStore       ────► textStyleBridge  │
                    │  useTakesStore           ────► exerciseBridge   │
                    └──────────────┬──────────────────────────────────┘
                                   │
                    ┌──────────────▼──────────────────────────────────┐
                    │          Legacy window.* Calls                  │
                    │                                                 │
                    │  audioBridge ────► window.audioEngine           │
                    │  lyricsBridge ───► window.lyricsDisplay         │
                    │  markersBridge ─► window.markerManager          │
                    │  modeSwitchBr ───► window.app                   │
                    │                 ───► window.liveMode            │
                    │                 ───► window.waveformEditor      │
                    │  monitorBridge ──► window.monitorMix            │
                    │  textStyleBr ────► window.lyricsDisplay         │
                    │  syncBridge ─────► window.waveformEditor        │
                    │  blockEditorBr ─► window.waveformEditor         │
                    │                 ───► window.ModalBlockEditor    │
                    │                 ───► window.lyricsDisplay       │
                    │  liveGuard ──────► window.liveMode              │
                    │  timeSync ───────► window.audioEngine           │
                    │  stemReactiveBr ─► window.audioEngine           │
                    │  audioReactiveBr─► window.audioEngine           │
                    └─────────────────────────────────────────────────┘
```

## Level 2 — Wire Table

### Секция A: Event Listeners (кто что слушает)

| Bridge | Event | Target | Freq | Purpose | Status |
|--------|-------|--------|------|---------|--------|
| audioBridge | playback-state-changed | window | on event | Sync isPlaying, currentTime, duration | 🟢 |
| audioBridge | track-loaded | document | on event | Init stem.store, apply volumes | 🟢 |
| audioBridge | track-stem-ready | document | on event | Add stem to store, set hasVocals | 🟢 |
| audioBridge | track-fully-loaded | document | on event | Merge stem volumes/mutes/solos | 🟢 |
| audioBridge | playback-rate-changed | document | on event | Update playbackRate in store | 🟢 |
| audioBridge | vocalmix-state-changed | document | on event | Update vocalMixEnabled | 🟢 |
| audioBridge | microphone-state-changed | document | on event | Update micEnabled/micVolume | 🟢 |
| audioBridge | audio-position-changed | document | on event | Update currentTime | 🟢 |
| audioBridge | timeupdate | document | on event | Update currentTime (fallback) | 🟢 |
| lyricsBridge | active-line-changed | document | on event | Update activeLineIndex | 🟢 |
| lyricsBridge | lyrics-rendered | document | on event | Sync lines from legacy | 🟢 |
| lyricsBridge | track-loaded | document | on event | Sync lines + retry 50ms/250ms | 🟢 |
| lyricsBridge | mode-changed | window | on event | Sync lines on mode switch | 🟢 |
| lyricsBridge | before-track-change | document | on event | Clear lines + reset guard | 🟢 |
| lyricsBridge | playback-state-changed | window | on event | Toggle rAF sync active | 🟢 |
| markersBridge | sections-updated | document | on event | Bulk sync markers | 🟢 |
| markersBridge | track-loaded | document | on event (500ms delay) | Sync markers after load | 🟢 |
| loopBridge | before-track-change | document | on event | Clear all loops | 🟢 |
| loopBridge | mode-changed | window | on event | Clear all loops | 🟢 |
| trackBridge | track-loaded | document | on event (debounced 100ms) | Sync track metadata from IDB | 🟢 |
| trackBridge | blocks-applied | document | on event (debounced 100ms) | Sync track metadata from IDB | 🟢 |
| trackBridge | catalog-cleared | document | on event (direct) | Clear tracks + revoke URLs | 🟢 |
| trackBridge | tracks-changed | document | on event (debounced 100ms) | Sync track metadata from IDB | 🟢 |
| textStyleBridge | track-loaded | document | on event | Re-apply font style | 🟢 |
| monitorBridge | monitor-state-changed | document | on event | Sync monitor state to store | 🟢 |
| monitorBridge | monitor-route-changed | document | on event | Sync monitor state to store | 🟢 |
| coverThemeBridge | catalog-cleared | document | on event | Reset cover theme | 🟢 |
| coverThemeBridge | track-load-failed | document | on event | Reset cover theme | 🟢 |
| triggerBridge | playback-state-changed | window | on event | Start/stop visual scheduler | 🟢 |
| triggerBridge | before-track-change | document | on event | Reset engine + CSS vars | 🟢 |
| triggerBridge | keydown (Ctrl+Shift+T) | window | on event | Toggle debug mode | 🟢 |
| takesBridge | before-track-change | document | on event | Cleanup takes | 🟢 |
| takesBridge | playback-state-changed | window | on event | Stop take preview on stop | 🟢 |
| exerciseBridge | before-track-change | document | on event | Cancel exercise | 🟢 |
| blocksBridge | before-track-change | document | on event | Clear blocks | 🟢 |
| blocksBridge | blocks-applied | document | on event | Sync blocks from legacy | 🟢 |
| blocksBridge | track-loaded | document | on event (300ms delay) | Sync blocks from legacy | 🟢 |
| blocksBridge | lyrics-rendered | document | on event | Sync blocks from legacy | 🟢 |
| audioReactiveBridge | playback-state-changed | window | on event | Setup analyser on play | 🟢 |
| stemReactiveBridge | before-track-change | document | on event | Clear stem energies | 🟢 |
| stemReactiveBridge | playback-state-changed | window | on event | Restart scheduler on play | 🟢 |

### Секция B: Event Emitters (кто что эмитит)

| Bridge | Event | Target | Consumers | Status |
|--------|-------|--------|-----------|--------|
| modeSwitchBridge | mode-changed | window | modeBridge, loopBridge, lyricsBridge | 🟢 |
| lyricsBridge | active-line-changed | document | legacy MonitorMix/RBG | 🟢 |
| syncBridge | sync-editor-closed | document | ⚠️ residue (no known listeners) | ⚠️ |
| blockEditorBridge | blocks-applied | document | trackBridge, blocksBridge | 🟢 |

### Секция C: Store Subscriptions (кто какие stores слушает)

| Bridge | Store | Selector | Action | Status |
|--------|-------|----------|--------|--------|
| loopBridge | useLoopStore | full state | Apply loop to engine / fallback rAF | 🟢 |
| performanceBridge | usePerformanceStore | getEffectiveTier, getBudget | Apply tier + budget CSS vars | 🟢 |
| performanceBridge | useRecordingStore | isRecording | Apply recording clamp + DOM attr | 🟢 |
| performanceBridge | useTakesStore | isRecording | Apply recording clamp + DOM attr | 🟢 |
| takesBridge | useTakesStore | isRecording | Publish data-takes-recording attr | 🟢 |
| textStyleBridge | useTextStyleStore | fontFamily, fontScale, transitionId | Apply font + transition to legacy | 🟢 |
| coverThemeBridge | useTrackStore | currentCoverTheme | Apply cover theme to DOM | 🟢 |
| exerciseBridge | useTakesStore | isRecording | Transition exercise phase | 🟢 |

### Секция D: window.* Calls (вызовы legacy globals)

| Bridge | Global | Method | Purpose | Status |
|--------|--------|--------|---------|--------|
| audioBridge | window.audioEngine | setStemVolume, setStemsEnabled, getCurrentTime, setCurrentTime, seekTo, setLoop, clearLoop | Stem control + transport | 🟢 |
| audioBridge | window.audioEngine | .stems (Map), vocalsAudio | Check loaded stems, vocals presence | 🟢 |
| audioBridge | window.markerManager | getMarkers | Compute line index on seek | 🟢 |
| audioBridge | window.trackCatalog | tracks, currentTrackIndex | Read track for stemsMode | 🟢 |
| lyricsBridge | window.lyricsDisplay | lyrics, currentLine | Sync lines + reverse-sync active line | 🟢 |
| markersBridge | window.markerManager | markers, sections, trackDuration, subscribe | Mirror markers to store | 🟢 |
| modeSwitchBridge | window.app | currentMode, previousMode, lyricsDisplay | Mode state + lyrics access | 🟢 |
| modeSwitchBridge | window.liveMode | isActive, deactivate, activate | Deactivate live mode on switch | 🟢 |
| modeSwitchBridge | window.waveformEditor | isVisible, hide | Hide waveform on mode switch | 🟢 |
| modeSwitchBridge | window.audioEngine | setStemVolume | Apply mode volume presets | 🟢 |
| modeBridge | window.audioEngine | setStemVolume | Observer: confirm volume policy | 🟢 |
| monitorBridge | window.monitorMix | getState, _persist, setMusicLevel, setAutoVerse, etc. | Patch-in-place 13 methods | 🟢 |
| textStyleBridge | window.lyricsDisplay | setStyle, setTransition, lyricsContainer, activateRehearsalDisplay | Apply font + transition | 🟢 |
| syncBridge | window.waveformEditor | show, hide, toggle | Patch to open React SyncEditor | 🟢 |
| blockEditorBridge | window.waveformEditor | modalBlockEditor, _openNewBlockEditor, show, currentTrackId | Patch to open React BlockEditor | 🟢 |
| blockEditorBridge | window.ModalBlockEditor | constructor | Replace with proxy class | 🟢 |
| blockEditorBridge | window.lyricsDisplay | lyrics, fullText, loadImportedBlocks | Read lyrics text, apply blocks | 🟢 |
| blockEditorBridge | window.markerManager | updateMarkerColors | Update marker colors after save | 🟢 |
| liveGuard | window.liveMode | activate | Patch to check camera permission | 🟢 |
| timeSync | window.audioEngine | getCurrentTime | Poll time at 10Hz | 🟢 |
| stemReactiveBridge | window.audioEngine | getStemMeterLevel, getStemAnalyser | Read per-stem RMS + frequency data | 🟢 |
| audioReactiveBridge | window.audioEngine | audioContext, stereoMerger, instrumentalGain | Create AnalyserNode | 🟢 |

## Level 3 — Deep Dive

### Bridge: audioBridge

- **Init:** Listens to 9 events, patches window.audioEngine.setCurrentTime/seekTo for optimistic line index, retries patch after 500ms
- **Listens:** playback-state-changed (window), track-loaded/track-stem-ready/track-fully-loaded/playback-rate-changed/vocalmix-state-changed/microphone-state-changed/audio-position-changed/timeupdate (document)
- **Emits:** None
- **Calls:** window.audioEngine.setStemVolume, setStemsEnabled, getCurrentTime, setCurrentTime, seekTo, setLoop, clearLoop; window.markerManager.getMarkers; window.trackCatalog
- **Store writes:** useAudioStore (isPlaying, currentTime, duration, playbackRate, vocalMixEnabled, micEnabled, micVolume), useStemStore (initStems, setStemVolume, setStemsEnabled, setStemsMode, loadedStems, stemVolumes, stemMutes, stemSolos, stemPans), useLyricsStore (activeLineIndex)
- **Cleanup:** Removes 9 event listeners, clears patchTimer, unpatches audioEngine methods
- **Known issues:** 
  - ⚠️ Double currentTime updates (audio-position-changed + timeupdate) — may cause store churn
  - ⚠️ `__stemsMuteListener` global on window — potential leak if bridge disposed before track-fully-loaded

### Bridge: lyricsBridge

- **Init:** Syncs lines from legacy lyricsDisplay, registers with PlaybackVisualScheduler (detector + writer), retries sync after 1s
- **Listens:** active-line-changed/lyrics-rendered/track-loaded/before-track-change (document), mode-changed (window), playback-state-changed (window)
- **Emits:** active-line-changed (document) — reverse-sync to legacy for MonitorMix/RBG
- **Calls:** window.lyricsDisplay.lyrics, .currentLine
- **Store writes:** useLyricsStore (lines, activeLineIndex)
- **Scheduler:** Registers `lyrics-line-detector` (computes active line from markers), `lyrics-line-writer` (publishes to store + legacy)
- **Cleanup:** Removes 5 event listeners, clears retryTimer, unregisters 2 scheduler components, removes playback-state-changed listener
- **Known issues:** None (healthy pattern)

### Bridge: markersBridge

- **Init:** Polls markerManager.subscribe every 200ms until available, syncs markers with out-of-bounds lineIndex guard
- **Listens:** sections-updated/track-loaded (document, 500ms delay)
- **Emits:** None
- **Calls:** window.markerManager.markers, .sections, .trackDuration, .subscribe(markerAdded/markerUpdated/markerDeleted/markersReset)
- **Store writes:** useMarkersStore (markers, sections, trackDuration)
- **Cleanup:** Removes 2 event listeners, clears poll interval. Note: markerManager.subscribe has no unsubscribe — acceptable since bridge lives for app lifetime
- **Known issues:** 
  - ⚠️ No unsubscribe from markerManager.subscribe — relies on app lifetime bridge pattern

### Bridge: modeSwitchBridge

- **Init:** Binds .mode-button click listeners, exposes `window.beLiveSwitchMode`, no cleanup function (permanent)
- **Listens:** None (command path — initiates mode changes)
- **Emits:** mode-changed (window) — after every mode switch
- **Calls:** window.app.currentMode/previousMode/lyricsDisplay, window.liveMode.isActive/deactivate, window.waveformEditor.isVisible/hide, window.audioEngine.setStemVolume, document.body.classList, localStorage (bl-rehearsal-volumes)
- **Store writes:** useTextStyleStore (styleId), useMarkersStore (markers.length read)
- **Cleanup:** None (permanent bridge, no initLyricsBridge-style return)
- **Known issues:** None (healthy command path)

### Bridge: modeBridge

- **Init:** Observes document.body class changes via MutationObserver, syncs mode from body class, applies volume policy with 100ms delay
- **Listens:** mode-changed (window), document.body class changes (MutationObserver)
- **Emits:** None
- **Calls:** window.audioEngine.setStemVolume, localStorage (bl-rehearsal-volumes read)
- **Store writes:** useModeStore (mode), useStemStore (setStemVolume per stem)
- **Cleanup:** Disconnects MutationObserver, removes mode-changed listener
- **Known issues:** None (healthy observer path)

### Bridge: loopBridge

- **Init:** Subscribes to useLoopStore, applies loop to engine setLoop/clearLoop or falls back to rAF manual jumping
- **Listens:** before-track-change (document), mode-changed (window), useLoopStore subscription
- **Emits:** None
- **Calls:** window.audioEngine.setLoop, clearLoop, getCurrentTime, setCurrentTime
- **Store writes:** useLoopStore (clearLoop on track/mode change)
- **Cleanup:** None (no return function — potential HMR leak)
- **Known issues:** 
  - ⚠️ No cleanup function returned — HMR may leak rAF loop
  - ❄️ Frozen: working pattern, low priority fix

### Bridge: trackBridge

- **Init:** Reads tracks from IDB, creates Object URLs for cover art, debounces syncAll (100ms) for 3 events
- **Listens:** track-loaded/blocks-applied/tracks-changed (document, debounced 100ms), catalog-cleared (document, direct)
- **Emits:** None
- **Calls:** getAllTracks (IDB), parseTrackName, URL.createObjectURL/revokeObjectURL
- **Store writes:** useTrackStore (tracksMeta, currentTrack, currentTrackIndex, currentCoverTheme)
- **Cleanup:** Clears retry/debounce timers, removes 4 event listeners, revokes all cover art Object URLs
- **Known issues:** None (healthy double-buffer pattern with deferred URL revoke)

### Bridge: textStyleBridge

- **Init:** Polls applyAll every 500ms until lyricsDisplay ready, subscribes to useTextStyleStore, creates MutationObserver on lyrics container for font re-application
- **Listens:** track-loaded (document)
- **Emits:** None
- **Calls:** window.lyricsDisplay.setStyle, setTransition, lyricsContainer, activateRehearsalDisplay
- **Store writes:** useTextStyleStore subscription (fontFamily, fontScale, transitionId → applyFont/applyTransition)
- **Cleanup:** Unsubscribes from store, clears retry interval, disconnects MutationObserver, clears timeout, removes track-loaded listener
- **Known issues:** None (healthy retry + MutationObserver pattern)

### Bridge: monitorBridge

- **Init:** Polls monitorMix availability every 200ms (max 30 attempts), patches 13 methods in-place on monitorMix, hydrates store from original state BEFORE patch
- **Listens:** monitor-state-changed/monitor-route-changed (document), navigator.mediaDevices.devicechange
- **Emits:** None
- **Calls:** window.monitorMix.getState/_persist/setMusicLevel/setAutoVerse/etc. (13 methods patched), navigator.mediaDevices.addEventListener
- **Store writes:** useMonitorStore (syncFromLegacy with 16 fields mapped)
- **Cleanup:** Removes 2 document listeners, removes devicechange listener. Note: no unpatch of monitorMix methods — acceptable for app lifetime
- **Known issues:** 
  - ⚠️ No unpatch of monitorMix methods — assumes app lifetime bridge
  - ⚠️ No cleanup function returned from initMonitorBridge (uses separate destroyMonitorBridge)

### Bridge: coverThemeBridge

- **Init:** Subscribes to useTrackStore.currentCoverTheme, applies theme on change
- **Listens:** catalog-cleared/track-load-failed (document)
- **Emits:** None
- **Calls:** applyCoverTheme service
- **Store writes:** useTrackStore (setCurrentCoverTheme on catalog-cleared)
- **Cleanup:** Unsubscribes from store, removes 2 event listeners
- **Known issues:** None (clean simple pattern)

### Bridge: audioReactiveBridge

- **Init:** Registers with PlaybackVisualScheduler (detector + writer), sets up AnalyserNode on playback start
- **Listens:** playback-state-changed (window)
- **Emits:** None
- **Calls:** window.audioEngine.audioContext, .stereoMerger/.instrumentalGain (connect analyser), analyser.getByteFrequencyData
- **Store writes:** None (CSS vars only)
- **Scheduler:** Registers `audio-reactive-detector` (computes energy/bass/mid/high/beat), `audio-reactive-writer` (queues 5 CSS vars)
- **Cleanup:** Resets CSS vars, unregisters 2 scheduler components, removes playback-state-changed listener, disconnects analyser
- **Known issues:** None (healthy scheduler participant)

### Bridge: liveGuard

- **Init:** Patches window.liveMode.activate to check localStorage bl-live-camera permission, retries after 2s if liveMode not ready
- **Listens:** None (patch-only)
- **Emits:** None
- **Calls:** window.liveMode.activate (wrapped), localStorage.getItem('bl-live-camera')
- **Store writes:** None
- **Cleanup:** None (permanent patch, no return)
- **Known issues:** 
  - ⚠️ No cleanup function — permanent patch

### Bridge: timeSync

- **Init:** Polls audioEngine.getCurrentTime at 10Hz during playback
- **Listens:** None (polling pattern)
- **Emits:** None
- **Calls:** window.audioEngine.getCurrentTime
- **Store writes:** useAudioStore (currentTime)
- **Cleanup:** Clears interval
- **Known issues:** None (simple polling pattern)

### Bridge: triggerBridge

- **Init:** Creates TriggerEngine, registers with PlaybackVisualScheduler (reader + detector + writer), owns scheduler lifecycle (start/stop)
- **Listens:** playback-state-changed (window), before-track-change (document), keydown Ctrl+Shift+T (window)
- **Emits:** None
- **Calls:** window.audioEngine.getCurrentTime, .isPlaying
- **Store writes:** useTriggerStore (isActive, activeWordId, activeWordText, activeWordConfidence, triggerLineIndex)
- **Scheduler:** Registers `trigger-reader` (reads audioEngine time), `trigger-detector` (runs engine.tick), `trigger-writer` (queues 3 CSS vars + store updates)
- **DOM:** Sets --bl-word-active, --bl-word-progress, --bl-line-active CSS vars
- **Cleanup:** Stops scheduler, unregisters 3 scheduler components, disposes engine, removes 3 event listeners, removes 3 CSS properties
- **Known issues:** None (healthy scheduler owner)

### Bridge: syncBridge

- **Init:** Patches window.waveformEditor.show/hide/toggle to open React SyncEditor, polls every 200ms until waveformEditor ready, exposes window.__zustand_audio
- **Listens:** None (patch-only)
- **Emits:** sync-editor-closed (document) — ⚠️ RESIDUE: no known listeners
- **Calls:** window.waveformEditor.show/hide/toggle (patched), switchMode('rehearsal'), localStorage (bl-rehearsal-volumes save)
- **Store writes:** useSyncStore (openSync/closeSync), useAudioStore (exposed as window.__zustand_audio)
- **Cleanup:** Clears poll interval. Note: no unpatch of waveformEditor methods — acceptable for app lifetime
- **Known issues:** 
  - ⚠️ sync-editor-closed event has no known listeners — residue
  - ⚠️ No unpatch of waveformEditor methods

### Bridge: takesBridge

- **Init:** Listens to track/mode changes, subscribes to useTakesStore.isRecording for DOM attribute
- **Listens:** before-track-change (document), playback-state-changed (window)
- **Emits:** None
- **Calls:** useTakesStore.__stopPreviewFn (attached to store object, not state)
- **Store writes:** useTakesStore (cleanup on track change), DOM data-takes-recording attribute
- **Cleanup:** Removes 2 event listeners, unsubscribes from takesStore
- **Known issues:** None (clean pattern)

### Bridge: exerciseBridge

- **Init:** Subscribes to useTakesStore.isRecording to transition exercise phases
- **Listens:** before-track-change (document)
- **Emits:** None
- **Calls:** None
- **Store writes:** useExerciseStore (cancelExercise, setPhase, onStepCompleted)
- **Cleanup:** Removes event listener, unsubscribes from takesStore
- **Known issues:** None (clean simple pattern)

### Bridge: blocksBridge

- **Init:** Syncs blocks from window.lyricsDisplay.textBlocks on events, initial sync after 500ms
- **Listens:** before-track-change/blocks-applied/track-loaded (300ms delay)/lyrics-rendered (document)
- **Emits:** None
- **Calls:** window.lyricsDisplay.textBlocks
- **Store writes:** useBlocksStore (setBlocks, clearBlocks)
- **Cleanup:** None (no return function — potential HMR leak)
- **Known issues:** 
  - ⚠️ No cleanup function returned — HMR may leak event listeners

### Bridge: blockEditorBridge

- **Init:** Replaces window.ModalBlockEditor with proxy class, creates window.modalBlockEditorInstance, patches window.waveformEditor.modalBlockEditor and _openNewBlockEditor, patches we.show for auto-lyrics skip
- **Listens:** None (patch-only)
- **Emits:** blocks-applied (document) — from save callback
- **Calls:** window.waveformEditor.modalBlockEditor/_openNewBlockEditor/show/currentTrackId, window.ModalBlockEditor (constructor replaced), window.lyricsDisplay.lyrics/fullText/loadImportedBlocks, window.markerManager.updateMarkerColors, updateTrackField (IDB)
- **Store writes:** useBlockEditorStore (open/close), useTrackStore (currentTrack read)
- **Cleanup:** None (permanent patches, no return)
- **Known issues:** None (healthy patch pattern)

### Bridge: performanceBridge

- **Init:** Reads detected tier, applies to DOM + CSS vars, subscribes to 3 stores
- **Listens:** usePerformanceStore subscription, useRecordingStore subscription, useTakesStore subscription
- **Emits:** None
- **Calls:** document.documentElement.setAttribute/removeAttribute (data-visual-tier, data-recording-active), document.documentElement.style.setProperty/removeProperty (5 CSS vars)
- **Store writes:** DOM only (no store writes)
- **Cleanup:** Unsubscribes from 3 stores, removes tier/recording/budget from DOM
- **Known issues:** None (clean subscription pattern)

### Bridge: stemReactiveBridge

- **Init:** Registers with PlaybackVisualScheduler (detector + writer), starts scheduler independently of trigger.bridge
- **Listens:** before-track-change (document), playback-state-changed (window)
- **Emits:** None
- **Calls:** window.audioEngine.getStemMeterLevel, .getStemAnalyser (for drums kick-band), analyser.getByteFrequencyData
- **Store writes:** None (CSS vars only), reads useStemStore.loadedStems, useRecordingStore.isRecording, useTakesStore.isRecording, usePerformanceStore.getBudget
- **Scheduler:** Registers `stem-reactive-detector` (reads per-stem RMS, hit detection, energy calculation), `stem-reactive-writer` (publishes --bl-stem-{id}-energy/hit CSS vars)
- **DOM:** Sets per-stem CSS vars (--bl-stem-{id}-energy, --bl-stem-{id}-hit)
- **Cleanup:** Unregisters 2 scheduler components, removes 2 event listeners, removes per-stem CSS properties
- **Known issues:** None (healthy scheduler participant with recording-safe clamps)

## 🔵 Observability Points

| Bridge | What to observe | How | Priority |
|--------|----------------|-----|----------|
| audioBridge | Stem volume sync on track-loaded | Store vs engine comparison | P1 (volume correctness) |
| audioBridge | setCurrentTime/seekTo patch | Line index computation accuracy | P1 (seek sync) |
| lyricsBridge | active-line-changed reverse-sync | Legacy MonitorMix receives updates | P1 (lyrics sync) |
| markersBridge | markerManager.subscribe | Real-time marker additions show in React | P1 (marker sync) |
| triggerBridge | Scheduler start/stop | CSS vars update at 60Hz during play | P1 (visual perf) |
| modeSwitchBridge | mode-changed event | All 3 consumer bridges receive it | P1 (mode consistency) |
| loopBridge | rAF fallback loop | Manual jumping when engine setLoop unavailable | P2 (loop correctness) |
| monitorBridge | monitorMix patch-in-place | Original state captured before patch | P2 (monitor correctness) |
| syncBridge | waveformEditor.show patch | React SyncEditor opens instead of legacy | P2 (UX correctness) |
| performanceBridge | Recording clamp | Tier downgrades during recording | P2 (budget enforcement) |
| stemReactiveBridge | Per-stem CSS vars | Energy/hit values match audio | P2 (visual mixer) |

## 🔗 Cross-References

- System overview → [SYSTEM-TOPOLOGY](SYSTEM-TOPOLOGY.md)
- Reactive chain → [SYNC-REACTIVE-CHAIN](SYNC-REACTIVE-CHAIN.md) *(TODO: создать)*
- Event topology → [interaction-schema-2.1 §12](../architecture/interaction-schema-2.1.md)
- Ownership matrix → [architecture-map-2.1 §3](../architecture/architecture-map-2.1.md)
- Audio engine detail → [audio-engine](../architecture/audio-engine.md)
- Sync system detail → [sync-system](../architecture/sync-system.md)
- Playback visual scheduler → [playback-visual-scheduler](../../src/playback/playback-visual-scheduler.ts)
- Trigger engine → [trigger-engine](../../src/triggers/trigger.engine.ts)
