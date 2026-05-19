---
schema: SYSTEM-TOPOLOGY
version: 1.0
generated: 2026-04-27
nodes:
  - id: audioEngineV2
    file: src/audio/core/AudioEngineV2.ts
    layer: engine
    authority: true
    frozen: true
    observable: true
    p0: true
  - id: stemPlayer
    file: src/audio/core/StemPlayer.ts
    layer: engine
    authority: false
    frozen: true
    observable: false
    p0: false
  - id: trackOrchestrator
    file: src/services/track.orchestrator.ts
    layer: service
    authority: true
    frozen: true
    observable: true
    p0: false
  - id: vocalMix
    file: src/audio/core/VocalMix.ts
    layer: engine
    authority: false
    frozen: true
    observable: false
    p0: false
  - id: microphoneManager
    file: src/audio/core/MicrophoneManager.ts
    layer: engine
    authority: false
    frozen: false
    observable: true
    p0: false
  - id: patchV1
    file: src/audio/compat/patchV1.ts
    layer: boundary
    authority: false
    frozen: true
    observable: false
    p0: false
  - id: markerManager
    file: js/marker-manager.js
    layer: boundary
    authority: false
    frozen: true
    observable: true
    p0: false
  - id: lyricsDisplay
    file: js/lyrics-display.js
    layer: boundary
    authority: false
    frozen: true
    observable: true
    p0: false
  - id: trackCatalog
    file: js/track-catalog.js
    layer: boundary
    authority: false
    frozen: false
    observable: true
    p0: false
  - id: wordSyncStore
    file: src/stores/wordSync.store.ts
    layer: store
    authority: true
    frozen: true
    observable: true
    p0: false
  - id: triggerEngine
    file: src/triggers/trigger.engine.ts
    layer: trigger
    authority: true
    frozen: false
    observable: true
    p0: false
  - id: playbackVisualScheduler
    file: src/playback/playback-visual-scheduler.ts
    layer: trigger
    authority: false
    frozen: false
    observable: true
    p0: false
  - id: lyricsStore
    file: src/stores/lyrics.store.ts
    layer: store
    authority: false
    frozen: false
    observable: true
    p0: false
  - id: markersStore
    file: src/stores/markers.store.ts
    layer: store
    authority: false
    frozen: false
    observable: true
    p0: false
  - id: loopStore
    file: src/stores/loop.store.ts
    layer: store
    authority: true
    frozen: true
    observable: true
    p0: false
  - id: modeStore
    file: src/stores/mode.store.ts
    layer: store
    authority: false
    frozen: false
    observable: true
    p0: false
  - id: audioStore
    file: src/stores/audio.store.ts
    layer: store
    authority: false
    frozen: false
    observable: true
    p0: false
  - id: trackStore
    file: src/stores/track.store.ts
    layer: store
    authority: false
    frozen: false
    observable: true
    p0: false
  - id: recordingStore
    file: src/stores/recording.store.ts
    layer: store
    authority: false
    frozen: false
    observable: true
    p0: true
  - id: takesStore
    file: src/takes/takes.store.ts
    layer: store
    authority: false
    frozen: false
    observable: true
    p0: false
  - id: exercisesStore
    file: src/exercises/exercises.store.ts
    layer: store
    authority: false
    frozen: false
    observable: true
    p0: false
  - id: textStyleStore
    file: src/stores/textStyle.store.ts
    layer: store
    authority: true
    frozen: false
    observable: true
    p0: false
  - id: performanceStore
    file: src/stores/performance.store.ts
    layer: store
    authority: true
    frozen: false
    observable: true
    p0: false
  - id: syncStore
    file: src/sync/store/sync.store.ts
    layer: store
    authority: false
    frozen: false
    observable: true
    p0: false
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
  - id: textStyleBridge
    file: src/bridges/textStyle.bridge.ts
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
  - id: stemReactiveBridge
    file: src/bridges/stem-reactive.bridge.ts
    layer: bridge
    authority: false
    frozen: false
    observable: true
    p0: false
  - id: timeSync
    file: src/bridges/time-sync.ts
    layer: bridge
    authority: false
    frozen: false
    observable: true
    p0: false
  - id: idbService
    file: src/services/idb.service.ts
    layer: service
    authority: true
    frozen: false
    observable: false
    p0: false
  - id: mainBoot
    file: src/main.tsx
    layer: boot
    authority: false
    frozen: true
    observable: false
    p0: false
  - id: appShell
    file: src/App.tsx
    layer: boot
    authority: false
    frozen: true
    observable: false
    p0: false
  - id: rehearsalUI
    file: src/components/RehearsalLyrics.tsx
    layer: ui
    authority: false
    frozen: false
    observable: false
    p0: false
  - id: karaokeUI
    file: src/components/KaraokeLyricsBoard.tsx
    layer: ui
    authority: false
    frozen: false
    observable: false
    p0: false
  - id: liveUI
    file: src/components/LiveSubtitle.tsx
    layer: ui
    authority: false
    frozen: false
    observable: false
    p0: false
  - id: syncEditorUI
    file: src/sync/components/SyncEditorPanel.tsx
    layer: ui
    authority: false
    frozen: false
    observable: false
    p0: false
  - id: controlDeck
    file: src/components/ControlDeck.tsx
    layer: ui
    authority: false
    frozen: false
    observable: false
    p0: false
  - id: wagonTrain
    file: src/components/WagonTrain.tsx
    layer: ui
    authority: false
    frozen: false
    observable: false
    p0: false
  - id: wordHighlightLine
    file: src/triggers/WordHighlightLine.tsx
    layer: ui
    authority: false
    frozen: true
    observable: false
    p0: false
---

# SYSTEM-TOPOLOGY — Карта мира beLive

> Все домены, авторитеты и основные провода между ними.
> Для нового специалиста — первая схема которую нужно понять.

## Legend

🟢 Stable | 🟡 Active | 🔴 P0 | ⚠️ Seam | ❄️ Frozen | 🔵 Observable | 📦 Boundary

## Level 1 — Bird's Eye

```
┌─────────────────────────────────────────────────────────────┐
│                        LEGACY BOUNDARY                       │
│  📦 window.audioEngine  📦 window.lyricsDisplay              │
│  📦 window.markerManager 📦 window.trackCatalog              │
└──────────────┬──────────────────────────────┬────────────────┘
               │ patchV1                      │ markers
               ▼                              ▼
┌──────────────────────────┐    ┌──────────────────────────────┐
│    AUDIO DOMAIN ❄️        │    │     SYNC DOMAIN ❄️            │
│  AudioEngineV2 (auth)    │◄──►│  Markers + WordSync (auth)   │
│  StemPlayer              │    │  lyrics.store                │
│  VocalMix / Mic          │    │  markers.store               │
└──────────┬───────────────┘    └────────────┬─────────────────┘
           │ playback-state                  │ active-line
           │ vocalmix-state                  │ track-loaded
           ▼                                 ▼
┌──────────────────────────┐    ┌──────────────────────────────┐
│   TRIGGER DOMAIN 🟡       │    │     MODE DOMAIN ❄️            │
│  TriggerEngine           │    │  mode-switch (command auth)  │
│  PlaybackVisualScheduler │    │  mode.bridge (observer)      │
│  trigger.store           │    │  mode.store                  │
└──────────┬───────────────┘    └────────────┬─────────────────┘
           │ CSS vars                        │ mode-changed
           ▼                                 ▼
┌──────────────────────────┐    ┌──────────────────────────────┐
│      UI SURFACES 🟡       │    │     LOOP DOMAIN ❄️            │
│  RehearsalLyrics         │    │  loop.store (TrackMap auth)  │
│  KaraokeLyricsBoard      │    │  WaveformCanvas (SyncEditor) │
│  LiveSubtitle            │    │  loop.bridge                 │
│  WordHighlightLine       │    └──────────────────────────────┘
│  SyncEditorPanel         │
└──────────────────────────┘
           ▲
           │ user intent
┌──────────────────────────────────────────────────────────────┐
│                   BRIDGE FABRIC (21 bridges)                  │
│  audio │ lyrics │ markers │ mode-switch │ mode │ loop │ track│
│  trigger │ sync │ textStyle │ performance │ takes │ exercise │
│  monitor │ cover-theme │ stem-reactive │ audio-reactive     │
│  time-sync │ live-guard │ blocks │ block-editor             │
└──────────────────────────────────────────────────────────────┘
           ▲
           │ persist / hydrate
┌──────────────────────────┐    ┌──────────────────────────────┐
│    STORES (19 Zustand)   │    │     SERVICES 🟢              │
│  audio │ lyrics │ markers│    │  track.orchestrator (auth)  │
│  wordSync │ mode │ loop  │    │  idb.service (persist auth) │
│  recording 🔴 │ takes    │    │  auto-lyrics.service         │
│  exercises 🔴 │ textStyle│    │  upload.service              │
│  performance │ sync      │    └──────────────────────────────┘
│  track │ plate │ ui      │
└──────────────────────────┘
```

## Level 2 — Wire Table

| From | To | Signal | Freq | Type | Status |
|------|----|--------|------|------|--------|
| AudioEngineV2 | audioBridge | playback-state-changed | per event | window event | 🟢 |
| AudioEngineV2 | trackBridge | track-loaded | per load | document event | 🟢 |
| AudioEngineV2 | lyricsBridge | vocalmix-state-changed | per change | document event | 🟢 |
| AudioEngineV2 | takesBridge | playback-state-changed | per event | window event | 🟢 |
| lyricsBridge | lyricsStore | activeLineIndex | per line | store update | 🟢 |
| markerManager | markersBridge | sections-updated | per marker | document event | 🟢 |
| modeSwitchBridge | modeBridge | mode-changed | per switch | window event | 🟢 |
| modeSwitchBridge | loopBridge | mode-changed | per switch | window event | 🟢 |
| modeSwitchBridge | lyricsBridge | mode-changed | per switch | window event | 🟢 |
| trackOrchestrator | all bridges | before-track-change | per load | document event | 🟢 |
| triggerEngine | triggerBridge | fill-word | 60Hz | method call | 🟡 |
| triggerBridge | DOM | CSS vars (--bl-*) | per frame | batched | 🟡 |
| wordSyncStore | triggerEngine | getFillWordForLine | 60Hz | selector | 🟢 |
| performanceBridge | DOM | data-visual-tier | per change | attribute | 🟢 |
| performanceBridge | DOM | data-recording-active | per change | attribute | 🟢 |
| recordingStore | performanceBridge | recording state | per toggle | store sub | 🟡 |
| loopStore | loopBridge | loop range | per change | store sub | 🟢 |
| loopBridge | AudioEngineV2 | setLoop/clearLoop | per change | method | 🟢 |
| syncBridge | syncStore | editor open/close | per toggle | store update | 🟢 |
| textStyleBridge | textStyleStore | style intent | per change | store update | 🟢 |
| takesBridge | takesStore | take state | per action | store update | 🟢 |
| exercisesStore | takesBridge | exercise step | per step | method call | 🔴 |
| idbService | trackBridge | track data | per load | async | 🟢 |
| patchV1 | window.audioEngine | identity preservation | boot once | object patch | ❄️ |

## Level 3 — Deep Dive

### Domain: Audio

- **Authority:** AudioEngineV2 ❄️
- **Nodes:** StemPlayer, VocalMix, MicrophoneManager, AudioLoader
- **Key files:** `src/audio/core/AudioEngineV2.ts`, `src/audio/core/StemPlayer.ts`, `src/audio/compat/patchV1.ts`
- **Contract:** Single transport authority. All time/loop/playback flows through here. patchV1 preserves `window.audioEngine` identity.
- **Known issues:** 
  - ⚠️ MonitorMix boundary sensitivity (legacy JS)
  - 🔴 P0-RECORDING-CAPTURE: Preview audio not in Program Capture Bus
  - 🔴 P0-TEMPO-RATE: tempoRate not applied in listen steps

### Domain: Sync

- **Authority:** Markers (line) + wordSync.store (word) ❄️
- **Nodes:** lyrics.store, markers.store, lyricsDisplay (legacy)
- **Key files:** `src/stores/lyrics.store.ts`, `src/stores/markers.store.ts`, `src/stores/wordSync.store.ts`, `js/lyrics-display.js`
- **Contract:** Two-layer sync: markers = backbone, word-sync = additive overlay. Never collapse.
- **Known issues:**
  - ⚠️ Intentional cue/fill split (different word paths for FX vs editor)
  - ⚠️ VOC -5.030s systematic offset (LRC shift bug)
  - ⚠️ Hard resync drift 209-528ms on hot-plug play()

### Domain: Triggers

- **Authority:** TriggerEngine 🟡
- **Nodes:** PlaybackVisualScheduler, trigger.store, WordLineDetector
- **Key files:** `src/triggers/trigger.engine.ts`, `src/playback/playback-visual-scheduler.ts`, `src/triggers/trigger.bridge.ts`
- **Contract:** Trigger reads timing from sync, publishes to DOM via CSS vars. Scheduler = coordinator, NOT timing authority.
- **Known issues:** None (working as designed)

### Domain: Bridges

- **Authority:** None (mirrors only)
- **Nodes:** 21 bridges connecting legacy globals ↔ React stores
- **Key files:** `src/bridges/*.bridge.ts`, `src/triggers/trigger.bridge.ts`, `src/sync/bridge/sync.bridge.ts`, `src/performance/performance.bridge.ts`, `src/takes/takes.bridge.ts`, `src/exercises/exercise.bridge.ts`, `src/blocks/bridge/*.ts`
- **Contract:** Bridges ARE permanent architecture, NOT migration artifacts. They synchronize across old/new surfaces.
- **Known issues:** 
  - ⚠️ 5 bridges without cleanup functions (loopBridge, blocksBridge, modeSwitchBridge, liveGuard, blockEditorBridge)
  - ⚠️ 1 residue event (sync-editor-closed — no listeners)

### Domain: Stores

- **Authority:** Varies per store (see Ownership Matrix in architecture-map-2.1.md §3)
- **Nodes:** 19 Zustand stores (audio, lyrics, markers, wordSync, mode, loop, recording, takes, exercises, textStyle, performance, sync, track, plate, ui, textStyle, etc.)
- **Key files:** `src/stores/*.store.ts`
- **Contract:** Stores are mostly runtime mirrors. IDB = durable persistence authority.
- **Known issues:**
  - 🔴 recording.store: captureStream() gap (P0-RECORDING-CAPTURE)
  - ⚠️ 19 stores may have churn risk (monitor carefully)

### Domain: UI Surfaces

- **Authority:** None (consumers only)
- **Nodes:** RehearsalLyrics, KaraokeLyricsBoard, LiveSubtitle, SyncEditorPanel, ControlDeck, WagonTrain, WordHighlightLine
- **Key files:** `src/components/RehearsalLyrics.tsx`, `src/components/KaraokeLyricsBoard.tsx`, `src/sync/components/SyncEditorPanel.tsx`
- **Contract:** Mode-gated rendering. Rehearsal = 70%, Karaoke/Concert = 15%, Live = 10%.
- **Known issues:** None (healthy separation)

### Domain: Legacy Boundary

- **Authority:** None (compatibility shells)
- **Nodes:** window.audioEngine, window.lyricsDisplay, window.markerManager, window.trackCatalog, window.monitorMix
- **Key files:** `js/audio-engine.js`, `js/lyrics-display.js`, `js/marker-manager.js`, `js/track-catalog.js`, `js/monitor-mix.js`
- **Contract:** Boundary shells preserve identity contracts. NEVER remove. patchV1 wraps them with V2 methods.
- **Known issues:**
  - ⚠️ MonitorMix vocalsSourceNode gap (boundary compat seam)

## 🔵 Observability Points

| Node | What to observe | How | Priority |
|------|----------------|-----|----------|
| AudioEngineV2 | getCurrentTime(), play/pause state | audioBridge → audioStore | P0 (transport truth) |
| recordingStore | isRecording, captureStream | recording.bridge → UI | P0 (capture gap) |
| wordSyncStore | activeWord (fill vs cue) | triggerEngine → CSS vars | P1 (sync accuracy) |
| triggerEngine | 60Hz detector cadence | triggerBridge → DOM | P1 (visual perf) |
| modeSwitchBridge | mode-changed event | multiple bridges | P1 (mode sync) |
| loopStore | loop range changes | loopBridge → engine | P2 (loop correctness) |
| performanceStore | tier changes | performanceBridge → DOM | P2 (budget enforcement) |
| exercisesStore | active exercise step | exerciseBridge → takes | P2 (quest flow) |

## 🔗 Cross-References

- Bridge events detail → [BRIDGE-EVENT-MATRIX](BRIDGE-EVENT-MATRIX.md)
- Reactive chain detail → [SYNC-REACTIVE-CHAIN](SYNC-REACTIVE-CHAIN.md) *(TODO: создать)*
- Audio detail → [audio-engine](../architecture/audio-engine.md)
- Sync detail → [sync-system](../architecture/sync-system.md)
- Ownership matrix → [architecture-map-2.1 §3](../architecture/architecture-map-2.1.md)
- Authority matrix → [interaction-schema-2.1 §11](../architecture/interaction-schema-2.1.md)
- Event topology → [interaction-schema-2.1 §12](../architecture/interaction-schema-2.1.md)
- Boot sequence → [main.tsx](../../src/main.tsx) + [App.tsx](../../src/App.tsx)
