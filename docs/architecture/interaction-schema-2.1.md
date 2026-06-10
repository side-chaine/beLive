# Interaction Schema 2.2

**Status:** Primary interaction handoff / onboarding schema — Complete (merged v2.1 + v2.2 delta)  
**Owner:** Center1.3 / Agent 007  
**Last updated:** 2026-06-10  
**Related:**  
- `architecture-map-2.1.md` (now v2.2 Complete)
- `audio-engine.md`
- `sync-system.md`
- `reactive-lyrics-foundation.md`
- `styles-system.md`
- `performance-quality-system.md`
- `scene-engine-vision.md`

---

## 1. Purpose

This document is the **system interaction schema** for beLive.

It does **not** replace:
- `architecture-map-2.1.md`
- `audio-engine.md`
- `sync-system.md`

Instead, it answers a different question:

> **How does the system actually interact at runtime?**

This document exists to give a new architect or specialist an immediate mental model of:

- boot order
- boundary globals
- bridge topology
- runtime authorities
- event surfaces
- primary flows
- where truth lives
- where mirroring happens
- which seams are open
- which areas are only compatibility residue

### Short distinction

- **Architecture Map** explains what exists and why
- **Interaction Schema** explains who talks to whom, in what order, and under whose authority

This is the document a new specialist should read to stop feeling “inside a big project” and start feeling “inside a structured runtime”.

---

## 2. Scope

This schema covers the interaction model of the current beLive runtime across these domains:

- boot and boundary globals
- React runtime activation
- transport/audio interaction
- marker/line sync interaction
- additive word-sync interaction
- trigger/scheduler publication layer
- mode switching
- loop systems
- sync editor flow
- persistence and hydration
- secondary surfaces:
  - background managers
  - live guard
  - monitor bridge
  - recording/takes
  - exercises quest layer
  - block editor proxy path

It intentionally focuses on **interaction and authority**, not on full internal implementation detail of every domain.

For deep domain truth:
- Audio → `audio-engine.md`
- Sync → `sync-system.md`
- Reactive lyrics / triggers → `reactive-lyrics-foundation.md`
- Styles / controls → `styles-system.md`
- Performance → `performance-quality-system.md`

---

## 3. Source Basis

This document is based on:

### 3.1 Existing architecture docs
- `docs/architecture/architecture-map-2.1.md`
- `docs/architecture/audio-engine.md`
- `docs/architecture/sync-system.md`
- `docs/architecture/reactive-lyrics-foundation.md`
- `docs/architecture/styles-system.md`
- `docs/architecture/performance-quality-system.md`
- `docs/architecture/scene-engine-vision.md`

### 3.2 Raw runtime/code recon
This schema is grounded in direct code recon across:

- `index.html`
- `src/main.tsx`
- `src/App.tsx`
- `src/audio/core/*`
- `src/bridges/*`
- `src/services/*`
- `src/stores/*`
- `src/sync/*`
- `src/triggers/*`
- `src/performance/*`
- legacy JS boundary files:
  - `js/audio-engine.js`
  - `js/lyrics-display.js`
  - `js/track-catalog.js`
  - `js/marker-manager.js`
  - `js/monitor-mix.js`

### 3.3 Confidence policy for this document
Statements here should be read as one of:

- **Confirmed** — directly supported by code scan
- **Boundary** — legacy-compatible shell preserved by design
- **Open seam** — real interaction complexity still worth noting
- **Residue** — compatibility surface still present, but not a live product authority

This document avoids speculative architecture claims unless they are explicitly marked as strategic or open.

---

## 4. System Interaction Overview

At runtime, beLive is best understood as a **five-layer interaction system**:

```text
1. Legacy Boot Globals
   - window.audioEngine
   - window.lyricsDisplay
   - window.markerManager
   - window.trackCatalog
   - window.waveformEditor
   - window.liveMode

2. Boot / Patch Layer
   - main.tsx
   - stub registration
   - legacy helper patching
   - slim method patching
   - window.app host stub

3. React Runtime Layer
   - App.tsx
   - stores
   - services
   - components
   - sync editor
   - reactive lyric consumers
   - performance domain

4. Bridge / Scheduler / Event Fabric
   - audio.bridge
   - lyrics.bridge
   - markers.bridge
   - loop.bridge
   - track.bridge
   - sync.bridge
   - trigger.bridge
   - playback visual scheduler
   - performance bridge
   - monitor bridge
   - takes bridge

5. Product Surfaces
   - Rehearsal
   - Karaoke / Concert
   - Live
   - Sync Editor
   - Catalog
   - Block Editor
   - Monitor / Recording / Takes side surfaces
   - Exercises quest layer (stable drills + hidden challenges)
```

### 4.1 Core principle of the interaction model

The system is **not** a pure React app with leftover garbage.

It is a structured hybrid runtime where:

- boot identity is intentionally preserved for legacy surfaces
- runtime product logic has largely moved into React/TypeScript
- bridges mirror and synchronize across old and new surfaces
- event topology remains part of the operating fabric
- not every global object is an authority
- not every store is a source of truth

### 4.2 The most important interaction truth

beLive is no longer a migration rescue system.

It is now a **mature hybrid product runtime** with:
- preserved boundary shells
- React-owned product logic
- engine-backed transport
- additive sync
- scheduler-driven reactive publication
- product-oriented persistence

---

## 5. High-Level Runtime Picture

A practical one-screen interaction picture looks like this:

```text
index.html
  ├─ loads legacy JS boundary files
  ├─ then loads /src/main.tsx
  ▼

Legacy globals become available
  ├─ window.audioEngine
  ├─ window.lyricsDisplay
  ├─ window.trackCatalog
  ├─ window.markerManager
  ├─ window.monitorMix
  ▼

main.tsx boot layer
  ├─ creates window.app stub
  ├─ registers stubs (liveMode, waveformEditor)
  ├─ patches markerManager helpers/methods
  ├─ patches slim methods onto lyricsDisplay
  ├─ initializes early bridges
  └─ mounts React

App.tsx runtime activation
  ├─ activates AudioEngineV2 via compat patch
  ├─ initializes all runtime bridges
  ├─ initializes scheduler participants
  ├─ initializes text style + performance bridges
  └─ renders product surfaces

Track load flow
  ├─ orchestrator clears old runtime shell
  ├─ loads lyrics/blocks
  ├─ loads audio via AudioEngineV2
  ├─ applies markers
  ├─ hydrates word-sync layer
  └─ optionally autoplays / opens sync

Playback flow
  ├─ AudioEngineV2 owns transport
  ├─ bridges mirror state into stores
  ├─ trigger bridge owns scheduler lifecycle
  ├─ scheduler drives visual publication
  └─ consumers render Rehearsal / Karaoke / Live / Sync visuals
```

---

## 6. Boot Sequence

This section is critical for understanding how the hybrid runtime is assembled.

---

### 6.1 HTML-level boot order

The app boot starts from `index.html`.

Confirmed current order:

1. early HTML / mode restoration / non-runtime utility scripts
2. legacy JS boundary files
3. module entry:
   - `/src/main.tsx`

Important current truth:

- legacy globals are created **before** React runtime activation
- `app.js` no longer exists as a live file
- `main.tsx` now acts as the host stub successor for remaining app-shell responsibilities

### 6.2 Legacy JS boundary files loaded before React

Current boundary files include:

- `js/audio-engine.js`
- `js/lyrics-display.js`
- `js/track-catalog.js`
- `js/marker-manager.js`
- `js/monitor-mix.js`

These are still loaded intentionally.

They are **not** the current product center.
They are the surviving boot/boundary shell.

---

### 6.3 Legacy globals created at boot

By the time React starts, these globals already exist or are expected to exist:

| Global | Source | Role at boot |
|---|---|---|
| `window.audioEngine` | `js/audio-engine.js` | boot audio identity + AudioContext |
| `window.lyricsDisplay` | `js/lyrics-display.js` | boot text/lyrics shell |
| `window.trackCatalog` | `js/track-catalog.js` | track container / boot state shell |
| `window.markerManager` | `js/marker-manager.js` | marker shell |
| `window.monitorMix` | `js/monitor-mix.js` | monitor boundary surface |
| `window.waveformEditor` | TS stub if missing | sync editor entry shell |
| `window.liveMode` | TS stub if missing | live/camera shell |
| `window.app` | created in `main.tsx` | host app shell replacement |

Important:
- some globals are created by legacy JS
- some are guaranteed later by TS boot stubs
- React runtime assumes this hybrid environment and patches into it

---

### 6.4 `main.tsx` responsibilities

`src/main.tsx` is not just a React entry file.
It is a **boot coordination layer**.

Its confirmed responsibilities include:

#### 6.4.1 Host app stub creation
If `window.app` is absent, `main.tsx` creates it.

This stub preserves expected host-level fields such as:
- `currentMode`
- `previousMode`
- `lyricsDisplay`
- `audioEngine`
- `showNotification`
- background manager references

This replaces the removed `app.js` host identity.

#### 6.4.2 Stub registration
`main.tsx` registers:
- live mode stub
- waveform editor stub

These are compatibility-preserving boot surfaces.

#### 6.4.3 Early bridge initialization
It initializes some boot-time bridges before React component mount, including:
- blocks bridge
- live guard
- loop bridge
- audio-reactive bridge
- block editor bridge

This means some interaction fabric exists before `App.tsx` runtime bridge boot.

#### 6.4.4 Legacy helper patching
`main.tsx` patches helper methods onto legacy `markerManager`, including:
- marker CRUD helpers
- marker color updates
- marker reset/set logic
- block synthesis support from markers

This confirms that `markerManager` is a boundary shell with TS-owned runtime augmentation.

#### 6.4.5 `lyricsDisplay` slim patching
`main.tsx` calls:
- `patchLyricsDisplaySlimMethods()`

This overlays TypeScript service methods onto the existing `window.lyricsDisplay` object without replacing its identity.

#### 6.4.6 React shell mount
Finally `main.tsx` mounts:
- `ThemeProvider`
- `App`

So the product runtime is layered **on top of** an already-established boundary world.

---

### 6.5 `App.tsx` runtime activation responsibilities

Once React is mounted, `App.tsx` performs runtime activation.

Its responsibilities include:

#### 6.5.1 Audio activation
- `tryActivateV2()`

This is where the existing `window.audioEngine` object is compat-patched into the `AudioEngineV2` runtime surface.

#### 6.5.2 Runtime bridge initialization
`App.tsx` initializes the core bridge layer:

- `initAudioBridge()`
- `initLyricsBridge()`
- `initMarkersBridge()`
- `initModeBridge()`
- `initTrackBridge()`
- `initSyncBridge()`
- `initTimeSync()`
- `initTriggerBridge()`
- `initTextStyleBridge()`
- `initPerformanceBridge()`

This is the main React-side synchronization fabric.

#### 6.5.3 Runtime surfaces rendered
`App.tsx` conditionally renders:
- `WagonTrain`
- `RehearsalLyrics`
- `KaraokeLyricsBoard`
- `LiveSubtitle`
- `SyncLyrics`
- `SyncEditorPanel`
- `ControlDeck`
- `MonitorMixPanel`
- overlays/debug surfaces

This confirms that surfaces are rendered by React, but often still operate in a hybrid environment with boundary globals and bridges.

---

### 6.6 Boot sequence one-liner

The real boot sequence is:

> **Legacy globals first → TS boot patch layer second → React runtime bridges third → product flows on top.**

That is the correct mental model.

---

## 7. Global Boundary Registry

This section explains the most important global objects in the runtime and what they actually mean today.

A new specialist should read this before trying to “clean up globals.”

---

### 7.1 `window.audioEngine`

**Created by:** `js/audio-engine.js`  
**Patched by:** `src/audio/compat/patchV1.ts` via `tryActivateV2()`  
**Current role:** preserved boot identity with `AudioEngineV2` runtime surface behind it

#### Current truth
- The object identity is legacy-preserved
- Runtime transport authority is **not** in the original JS class
- Runtime authority is in `AudioEngineV2`
- The patch happens **in place**

#### Why this matters
Any remaining code holding old references to `window.audioEngine` still sees the patched v2 behavior.

#### Classification
**Boundary shell with live runtime facade**

---

### 7.2 `window.lyricsDisplay`

**Created by:** `js/lyrics-display.js`  
**Patched by:** `patchLyricsDisplaySlimMethods()` using `LyricsService` methods  
**Current role:** preserved text/lyrics identity shell with TS-owned slim behavior overlay

#### Current truth
The legacy file is now mostly constructor + state shell.
Important methods are overlaid from `src/services/lyrics.service.ts`, including:

- `setStyle`
- `clearAllTextBlocks`
- `activateRehearsalDisplay`
- `deactivateRehearsalDisplay`
- `fullReset`
- `_renderLyrics`
- `setActiveLine`
- `reset`
- `reloadLyrics`
- `loadImportedBlocks`
- `loadLyrics`
- `_processLyrics`

#### Why this matters
`window.lyricsDisplay` still exists as a compatibility boundary,
but product logic is no longer primarily owned by the old file.

#### Classification
**Boundary shell with TS method overlay**

---

### 7.3 `window.markerManager`

**Created by:** `js/marker-manager.js`  
**Augmented by:** `main.tsx` helper/method patching  
**Current role:** boundary marker shell with heavily TS-augmented behavior

#### Current truth
The legacy file provides:
- constructor
- subscriber buckets
- initial event listeners
- shell identity

But major live behavior is patched or replaced from TS boot code:
- marker CRUD
- marker color updates
- marker set/reset logic
- marker import/export helper behavior
- subscriber notification helpers

#### Why this matters
This is not a fully authoritative legacy manager anymore.
It is a hybrid shell whose behavior is largely stabilized by TS patching.

#### Classification
**Boundary shell with strong TS augmentation**

---

### 7.4 `window.trackCatalog`

**Created by:** `js/track-catalog.js`  
**Consumed by:** orchestrator, actions, catalog flows, some legacy paths  
**Current role:** boot/state container, not the only persistence authority

#### Current truth
`trackCatalog` still holds:
- `tracks`
- `currentTrackIndex`

And is still used by:
- `track.orchestrator.ts`
- `track.actions.ts`
- some UI/product flows

But durable storage now also lives in:
- `idb.service.ts`

And React metadata mirroring now lives in:
- `track.store`
- `track.bridge`

#### Why this matters
A new specialist should not mistake `trackCatalog` for “the whole track system.”
It is still an active runtime container, but not the entire truth model.

#### Classification
**Boundary container with active runtime use**

---

### 7.5 `window.waveformEditor`

**Created by:** TS waveform editor stub if absent  
**Intercepted by:** `sync.bridge.ts`  
**Current role:** legacy sync-editor entry surface redirected into React Sync Editor

#### Current truth
The object still exists because many old entry points expect it:
- show
- hide
- toggle
- sync-related helpers

But `sync.bridge.ts` intercepts these methods so old callers open the React sync editor.

#### Why this matters
This is a classic preserved API / redirected runtime surface.

#### Classification
**Compatibility surface with React interception**

---

### 7.6 `window.liveMode`

**Created by:** TS live mode stub if absent  
**Patched by:** `live-guard.ts`  
**Current role:** live/camera boundary shell with guarded activation

#### Current truth
The live mode shell still exists and is guarded by:
- camera permission policy via localStorage
- deferred activation patching

#### Why this matters
Live is not simply a React-only island.
It still preserves a shell-style integration contract.

#### Classification
**Boundary shell with guarded activation**

---

### 7.7 `window.app`

**Created by:** `main.tsx`  
**Current role:** host app shell replacement for historical `app.js`

#### Current truth
`app.js` as a file is gone.
But `window.app` still exists because parts of the hybrid runtime expect an app host object.

It carries fields such as:
- `currentMode`
- `previousMode`
- `lyricsDisplay`
- `audioEngine`
- background manager references
- notification hooks

#### Why this matters
This is a host-level compatibility object, not a legacy code smell to remove blindly.

#### Classification
**TS host stub replacing removed `app.js`**

---

### 7.8 Boundary registry one-line summary

The correct mental model is:

> beLive preserves global identities where needed, but product runtime authority has largely moved behind those identities into TS services, bridges, and React runtime layers.

---

## 8. Boundary Philosophy

This section is here to prevent the most common misunderstanding by new engineers.

### 8.1 What these globals are not
They are **not** proof that the project is still legacy-owned.

### 8.2 What they are
They are:
- identity anchors
- compatibility surfaces
- boot boundaries
- bridge endpoints
- integration shells

### 8.3 Why they remain
They remain because they still solve real runtime constraints:
- cached references
- legacy event contracts
- boot timing
- DOM/bootstrap sequencing
- compatibility with still-existing JS modules

### 8.4 What must not be done
Do not enter this project and assume the first necessary move is:
- deleting globals
- swapping object identities
- merging all bridges into stores
- removing boundary shells for purity

That would destroy the actual mature shape of the system.

---

## 9. Fast Entry Route for a New Specialist

Before touching code, a new specialist should read in this order:

1. `docs/architecture/architecture-map-2.1.md`
2. `docs/architecture/interaction-schema-2.1.md` ← this document
3. `docs/architecture/audio-engine.md`
4. `docs/architecture/sync-system.md`
5. `docs/architecture/reactive-lyrics-foundation.md`
6. `docs/architecture/styles-system.md`
7. `docs/architecture/performance-quality-system.md`
8. `docs/architecture/scene-engine-vision.md`

### Why this order
- first: system shape
- second: interaction topology
- third/fourth: core truth domains
- fifth-sixth-seventh: product runtime layers
- last: future growth direction

---

## 10. Part 1 One-Line Summary

**beLive boots as a hybrid system: legacy globals establish runtime identity, `main.tsx` patches and stabilizes the boundary layer, and React/TypeScript then activates the real product runtime on top of those preserved shells.**
```

---

## 11. Authority Matrix

This section defines the runtime authorities of the current system.

The key rule is:

> **Not every object that participates in a flow is an authority.**

Many layers:
- mirror
- patch
- observe
- coordinate
- publish
- persist

But only some layers actually own truth.

---

### 11.1 Authority table

| Domain | Runtime authority | Supporting / adjacent layers | Current truth |
|---|---|---|---|
| Audio transport | `AudioEngineV2` | compat patch, audio bridge, UI controls | canonical |
| Boot audio identity | `window.audioEngine` object identity | `patchV1WithV2()` | identity preserved, runtime moved behind it |
| Current playback time | `AudioEngineV2.getCurrentTime()` | time-sync, audio bridge, scheduler reader | canonical source |
| Track loading flow | `track.orchestrator.ts` | track actions, catalog, waveform editor shell | canonical high-level loader |
| Current line | marker-driven line sync | lyrics bridge, markers store, scheduler | canonical line truth |
| Word-level FX activation | `wordSync.store` fill selector via trigger detector | trigger engine, trigger bridge | canonical for reactive FX |
| Sync editor word highlight | `wordSync.store` cue selector | `SyncLyrics` | intentionally separate cue path |
| TrackMap loop intent | `loop.store` | `WagonTrain`, `loop.bridge` | canonical for TrackMap loop surface |
| TrackMap loop execution | `AudioEngineV2` | engine loop API | runtime executor |
| Sync Editor loop intent | `WaveformCanvas.loopRef` | sync UI handlers | separate loop owner |
| Sync Editor loop execution | `AudioEngineV2` | direct engine loop calls | runtime executor |
| Marker persistence | track record in IDB | markerManager shell, track actions | durable |
| Word-sync persistence | track record in IDB (`lineMap`, `alignmentData`) | sync editor, orchestrator hydration | durable |
| Track metadata mirror | `track.store` | `track.bridge`, IDB, trackCatalog | mirror/consumer |
| Text style intent | `textStyle.store` | styles UI, textStyle bridge | canonical style intent |
| Performance budget | `performance.store` | performance bridge/hooks | canonical budget policy |
| Mode switch command path | `mode-switch.bridge.ts` | body class changes, app mirror, live guard | command authority |
| Mode state mirror | `mode.store` via `mode.bridge.ts` | body observer, event sync | mirror/consumer |
| Trigger runtime signals | `TriggerEngine` + detectors | trigger bus, trigger bridge | signal authority |
| Visual publication hot path | `PlaybackVisualScheduler` | trigger/lyrics/audio-reactive participants | publication coordinator, not timing authority |

---

### 11.2 Audio transport authority

**Authority:** `AudioEngineV2`

This is the most important runtime authority in the app-side system.

It owns:
- track loading
- play / pause / stop
- seek
- loop runtime
- playback rate
- stem lifecycle
- hardening protections

It does **not** merely assist legacy code.
It is the real transport facade.

The preserved `window.audioEngine` identity is now a compat shell exposing v2 behavior.

---

### 11.3 Playback time authority

**Authority:** `AudioEngineV2.getCurrentTime()`

This is the real current-time truth.

Everything else around time is secondary:
- optimistic store mirroring
- event payload mirroring
- polling bridge
- scheduler read path

Those are publication and UX synchronization paths, not the source of time truth itself.

This distinction matters because beLive currently has several time-publication surfaces.

---

### 11.4 Current line authority

**Authority:** marker-driven line sync

Current line remains owned by the marker backbone.

This is surfaced through:
- markers
- active line computation
- lyrics bridge
- `lyrics.store.activeLineIndex`

Word-sync does **not** replace current line authority.

This is a frozen architecture truth.

---

### 11.5 Word-level authority split

beLive currently has two intentional word-level paths.

#### 11.5.1 FX / trigger path
**Authority:** `getFillWordForLine(...)` via trigger detector

This is the word truth for:
- trigger events
- word progress
- reactive lyric FX
- `WordHighlightLine`

This is fill-truth.

#### 11.5.2 Sync editor display path
**Authority:** `getActiveWordForLine(...)` in `SyncLyrics`

This is the word truth for:
- cue-style highlight in sync editor display

This is cue-truth.

This split is intentional and should be understood, not “accidentally unified.”

---

### 11.6 Loop authority is intentionally split by surface

There is no single universal loop owner in the current product.

#### TrackMap loop
**Authority:** `loop.store`

Flow:
- user intent in WagonTrain
- range stored in Zustand
- bridge pushes range into engine
- engine executes runtime loop

#### Sync Editor loop
**Authority:** `WaveformCanvas.loopRef`

Flow:
- user selects region directly in waveform editor
- local loop state updates
- direct `ae.setLoop()` / `ae.clearLoop()`
- engine executes runtime loop

This is not an error by itself.
It is a deliberate multi-surface split.

---

### 11.7 Persistence authority

Durable data now lives in track records in IndexedDB.

This includes:
- track audio data
- lyrics
- blocks
- sync markers
- `lineMap`
- `alignmentData`

Important current truth:
- stores are mostly runtime mirrors
- globals are mostly shells or containers
- IDB is the durable persistence layer

---

### 11.8 Mode authority is split into command vs mirror

This is one of the important interaction patterns in the app.

#### Command authority
**Authority:** `mode-switch.bridge.ts`

This path:
- switches mode
- updates body classes
- updates `window.app`
- applies mode-specific side effects
- emits `mode-changed`

#### Mirror/state authority
**Authority:** `mode.bridge.ts` for mirrored React mode state

This path:
- observes body class changes
- listens to `mode-changed`
- updates `mode.store`
- applies volume policy mirroring

This is a command/mirror split, not a contradiction.

---

### 11.9 Scheduler authority is publication-only

**Authority:** `PlaybackVisualScheduler` for visual publication loop

It coordinates:
- readers
- detectors
- writers
- final batched CSS var flush

It does **not** own:
- transport truth
- sync truth
- trigger domain semantics
- line/word data truth

It is a visual publication plane only.

---

### 11.10 Authority matrix one-line summary

The current system is healthy precisely because authority has been separated:

> transport, line sync, word sync, loop intent, style intent, and performance budget do not all live in one place.

That separation should be preserved.

---

## 12. Event Topology Map

The runtime still uses event surfaces as an essential integration fabric.

This is not a sign of chaos.
It is part of the hybrid architecture.

The most important rule for events is:

> **Target matters.**  
> Some events live on `document`, some on `window`, and consumers must match.

---

### 12.1 Primary event table

| Event | Target | Producer(s) | Main consumer(s) | Purpose | Status |
|---|---|---|---|---|---|
| `mode-changed` | `window` | `mode-switch.bridge.ts` | `loop.bridge`, `lyrics.bridge`, `mode.bridge` | propagate mode switch | confirmed |
| `playback-state-changed` | `window` | `AudioEngineV2` | audio bridge, trigger bridge, lyrics bridge, audio-reactive bridge, takes bridge | playback lifecycle sync | confirmed |
| `before-track-change` | `document` | `track.orchestrator.ts`, some track actions | blocks, loop, lyrics, takes, trigger bridges | clear/reset before new track | confirmed |
| `track-loaded` | `document` | `AudioEngineV2` | markerManager, audio bridge, blocks bridge, lyrics bridge, markers bridge, textStyle bridge, track bridge | post-load readiness signal | confirmed |
| `active-line-changed` | `document` | `lyrics.service.ts`, `lyrics.bridge.ts` | monitor mix, background-related consumers, lyrics bridge itself | active line publication | confirmed |
| `playback-rate-changed` | `document` | `AudioEngineV2` | audio bridge | playback rate mirroring | confirmed |
| `vocalmix-state-changed` | `document` | `AudioEngineV2` | audio bridge | vocal mix mirroring | confirmed |
| `microphone-state-changed` | `document` | microphone manager / audio runtime | audio bridge, recording store | microphone state mirroring | confirmed |
| `sections-updated` | `document` | markerManager shell path | markers bridge | sections mirror refresh | confirmed |
| `blocks-applied` | `document` | block editor / block application paths | blocks bridge, track bridge | block mirror refresh | confirmed |
| `sync-editor-closed` | `document` | sync bridge, catalog store path | no known live listeners in repo scan | compatibility residue | residue |

---

### 12.2 Event-target truth

The currently verified target model is:

#### `window` events
Used for:
- mode lifecycle
- playback lifecycle
- some host-level state changes

Examples:
- `mode-changed`
- `playback-state-changed`

#### `document` events
Used for:
- track/content lifecycle
- active line changes
- boundary-shell synchronization
- many integration signals consumed by JS shells and bridges

Examples:
- `before-track-change`
- `track-loaded`
- `active-line-changed`

This split should be documented and preserved carefully.

---

### 12.3 `mode-changed`

**Target:** `window`

#### Producer
- `mode-switch.bridge.ts`

#### Main consumers
- `loop.bridge`
- `lyrics.bridge`
- `mode.bridge`

#### Purpose
This is the mode propagation signal after command-side mode switch work begins.

It is used to:
- clear loop state on mode switch
- resync lyrics-side reactions
- mirror current mode into React state

#### Current truth
Target alignment for `mode-changed` is confirmed:
- producer dispatches on `window`
- active consumers listen on `window`

This seam is currently closed.

---

### 12.4 `playback-state-changed`

**Target:** `window`

#### Producer
- `AudioEngineV2._notifyPlaybackState()`

#### Main consumers
- `audio.bridge`
- `trigger.bridge`
- `lyrics.bridge`
- `audio-reactive.bridge`
- `takes.bridge`

#### Purpose
This is the primary lifecycle event for:
- isPlaying state
- current time snapshot
- duration snapshot
- visual scheduler lifecycle decisions

#### Why it matters
This event effectively coordinates the transition between:
- stopped/paused publication
- active playback publication

It is one of the most important runtime synchronization events in the app.

---

### 12.5 `before-track-change`

**Target:** `document`

#### Producer(s)
- `track.orchestrator.ts`
- some track action paths for destructive reset flows

#### Main consumers
- `blocks.bridge`
- `loop.bridge`
- `lyrics.bridge`
- `takes.bridge`
- `trigger.bridge`

#### Purpose
This is the pre-clear/reset boundary signal before a new track replaces the current runtime shell.

Typical effects:
- clear loops
- clear block mirrors
- clear lyric mirrors
- clear trigger/visual state
- clean takes state

This is one of the most architecturally important reset events.

---

### 12.6 `track-loaded`

**Target:** `document`

#### Producer
- `AudioEngineV2` after successful load path completes

#### Main consumers
- legacy `markerManager`
- `audio.bridge`
- `blocks.bridge`
- `lyrics.bridge`
- `markers.bridge`
- `textStyle.bridge`
- `track.bridge`

#### Purpose
This is the post-audio-load readiness signal.

It tells the runtime:
- track duration is real
- audio transport is loaded
- bridges may now mirror state
- shell consumers can perform post-load sync
- marker/lyrics/block mirrors can hydrate or refresh

This is the most important “track is now actually ready” event.

---

### 12.7 `active-line-changed`

**Target:** `document`

#### Producer(s)
- `lyrics.service.ts`
- `lyrics.bridge.ts` reverse-sync path

#### Main consumers
- monitor mix block-aware behavior
- background-related consumers
- some shell listeners

#### Purpose
This is the line-level publication signal used by consumers that still react to line changes through event surfaces rather than direct store subscriptions.

It is especially important because:
- line truth is marker-driven
- some consumers still depend on event publication
- legacy-facing consumers still exist

---

### 12.8 `sync-editor-closed`

**Target:** `document`

#### Producer(s)
- `sync.bridge.ts`
- a catalog-side compatibility path

#### Known listeners
- no confirmed active repo listeners in current scan

#### Interpretation
This event currently behaves like a **compatibility residue signal**.

It should not be treated as a current primary authority path without new evidence.

---

### 12.9 Event topology one-line summary

The event system is still an important operating layer in beLive.

The correct mental model is:

> **window events mostly coordinate host/runtime lifecycle, while document events mostly coordinate track/content/boundary synchronization.**

---

## 13. Main Runtime Flows

This section documents the main operational flows a new specialist must understand.

---

### 13.1 Track load flow

**Canonical owner:** `track.orchestrator.ts`

This is the high-level load authority.

#### Current flow

1. cancel previous autoplay timer
2. validate target track in `trackCatalog`
3. capture previous/current track ids
4. update `trackCatalog.currentTrackIndex`
5. dispatch `before-track-change`
6. clear legacy lyrics/block shell
7. clear word-sync layer
8. show loading overlay
9. update waveform editor stub refs
10. prepare lyrics source
11. parse RTF if needed
12. load lyrics/blocks into `lyricsDisplay`
13. revoke previous blob URLs
14. build fresh blob URLs from track audio buffers
15. call `audioEngine.loadTrack(...)`
16. apply markers after audio load
17. prepare word-sync layer from persisted/cacheable data
18. delayed block sanitization
19. optional autoplay timer
20. optional sync editor opening
21. hide loading overlay

#### Important consequences
This means:
- content shell is prepared before audio transport is activated
- markers are applied after audio load
- word-sync hydration is orchestrator-driven
- sync editor opening is downstream of canonical load flow

This is already a mature loader, not a temporary migration path.

---

### 13.2 Transport play flow

**Authority:** `AudioEngineV2.play()`

#### Current flow
1. ignore if already playing
2. ignore if no instrumental stem
3. increment transport generation
4. clear soft resync state
5. resume AudioContext if needed
6. pre-resync vocals to instrumental if needed
7. start instrumental
8. start vocals if loaded
9. mark `_isPlaying = true`
10. update `lastSeekTime`
11. start position updates
12. emit `playback-state-changed`

#### Important interaction truth
The engine owns:
- actual playback start
- stem start ordering
- vocal pre-resync
- playback state emission

Bridges only react after that.

---

### 13.3 Pause flow

**Authority:** `AudioEngineV2.pause()`

#### Current flow
1. increment transport generation
2. clear soft resync state
3. pause stems
4. mark not playing
5. stop position updates
6. emit `playback-state-changed`

Pause is engine-owned and bridge-mirrored.

---

### 13.4 Seek flow

**Authority:** `AudioEngineV2.setCurrentTime()`

There are two important runtime paths.

#### While paused
- clamp time
- set current time on stems directly
- return

#### While playing
1. increment transport generation
2. set last seek timestamp
3. clear soft resync state
4. stop position updates
5. pause stems
6. set current time on stems
7. call `_atomicResumeFromSeek(gen)`

#### Atomic resume path
1. wait for seeked events / timeout path
2. verify generation still current
3. verify playing state still valid
4. replay loaded stems
5. restart position updates

#### Important interaction note
The UI sees seek not only through engine state, but also through:
- optimistic `audio.bridge` patching
- time polling
- scheduler readers

So seek has one authority and several publication paths.

---

### 13.5 Current time publication flow

**Authority:** engine time  
**Publication:** several mirrored paths

Current time currently reaches the UI through multiple surfaces:

#### Path A — playback-state snapshot
- `playback-state-changed`
- consumed by `audio.bridge`

#### Path B — optimistic seek patch
- `audio.bridge` wraps `setCurrentTime` / `seekTo`
- immediately updates `audio.store.currentTime`
- also computes optimistic active line

#### Path C — polling mirror
- `time-sync.ts`
- polls `audioEngine.getCurrentTime()` at ~10Hz during playback

#### Path D — scheduler read path
- `trigger.bridge` reader reads engine time every scheduler frame
- lyrics/trigger/audio-reactive publication rides on that publication loop

#### Practical implication
The engine remains the truth.
The UI has several synchronized mirror paths for responsiveness.

This is currently acceptable, but it is also a meaningful interaction complexity point.

---

### 13.6 TrackMap loop flow

**Intent authority:** `loop.store`  
**Execution authority:** `AudioEngineV2`

#### Activation flow
1. user clicks TrackMap loop toggle in `WagonTrain`
2. `loop.store.toggleBlock(block)`
3. store computes block/line/time range from markers
4. store updates:
   - `isLooping`
   - `loopBlockIds`
   - `loopStartTime`
   - `loopEndTime`
   - line boundaries
5. `loop.bridge` subscription reacts
6. bridge calls `ae.setLoop(start, end)`
7. engine executes runtime loop

#### Rebind flow
1. loop already active
2. user clicks another block in `WagonTrain`
3. `loop.store.rebindToBlock(block)`
4. block becomes new loop owner
5. seek jumps to clicked block marker
6. future loop cycles use new range

This is the current TrackMap loop contract.

---

### 13.7 Sync Editor loop flow

**Intent authority:** `WaveformCanvas.loopRef`  
**Execution authority:** `AudioEngineV2`

#### Creation flow
1. user shift-drags in waveform
2. selection is converted into loop region
3. local `loopRef.current` becomes active
4. direct call:
   - `ae.setLoop(start, end)`
5. follow-playhead behavior may be temporarily disabled

#### Adjustment flow
- drag loop handles/body
- update local `loopRef`
- direct repeated `ae.setLoop(...)`

#### Clear flow
- toolbar / escape / helper path
- local loopRef cleared
- direct `ae.clearLoop()`

This loop path does **not** go through `loop.store`.

---

### 13.8 Marker editing flow

**Shell authority:** legacy `markerManager`  
**React mirror:** `markers.store`

#### Current flow
1. marker operation originates from:
   - sync editor
   - key placement
   - marker drag/delete
   - import/reset/set path
2. `markers.store` delegates CRUD into legacy `markerManager`
3. `markerManager` mutates marker shell state
4. `markers.bridge` mirrors markers back into React store

This is a classic boundary-shell + React-mirror pattern.

---

### 13.9 Word-sync hydration flow

**Authority:** orchestrator + `prepareWordSyncLayer(...)`

#### Current flow
1. track load reaches post-audio, post-marker stage
2. orchestrator calls `prepareWordSyncLayer(...)`
3. lineMap is built from display lyrics
4. lyrics hash is computed from hash-source lyrics
5. cache verdict is computed
6. if cache valid:
   - hydrate store with `lineMap`
   - hydrate store with `alignmentData`
   - status becomes `ready`
7. if cache invalid/missing:
   - hydrate lineMap only
   - set status to `missing` or `idle`
   - degraded flag handled as needed

#### Important consequence
Word-sync hydration is not initiated by UI.
It is orchestrator-owned.

That is an important maturity signal in the architecture.

---

### 13.10 Align execution flow

**Entry surface:** `SyncEditorPanel`

#### Current flow
1. user clicks align in sync editor
2. panel validates current word-sync prep state
3. anchors are built from current markers
4. request is built through `buildAlignmentJobRequest(...)`
5. `lyricsAlignService.align(request)` is called
6. provider executes against gateway boundary
7. on success:
   - `alignmentData` goes into word-sync store
   - status becomes `ready`
8. persistence writes back to current track:
   - `alignmentData`
   - `lineMap`

#### Important consequence
The align execution path is already:
- request-structured
- provider-bounded
- persistence-backed
- reload-durable

This is no longer plumbing exploration.

---

### 13.11 Mode switch flow

**Command authority:** `mode-switch.bridge.ts`

#### Current flow
1. caller requests `switchMode(mode)`
2. current mode guard prevents duplicate switch
3. waveform editor is hidden if needed
4. host app mode bookkeeping updated
5. mode-specific activator runs:
   - concert
   - karaoke
   - rehearsal
   - live
6. body classes update
7. style/mode-specific behavior updates
8. mode-specific volume preset path runs
9. `mode-changed` emitted on `window`
10. mirrors and side consumers react

#### Special rehearsal interaction
Rehearsal activation includes:
- delayed readiness logic for lyrics/blocks
- block sanitization attempts
- rehearsal style activation
- BPM control visibility changes
- transport openness policy

#### Live interaction
Live activation also interacts with:
- live shell
- camera activation path
- live guard permission behavior

---

### 13.12 Catalog play flow

**Entry surface:** `CatalogLayout`

#### Current flow
1. user selects track in catalog
2. `loadTrack(index, { autoplay: true, openSyncEditor: false })`
3. `beLiveSwitchMode('rehearsal')`
4. sync editor is closed
5. deck state is set for expected rehearsal/mix UI
6. recent track state may be updated
7. catalog closes

This confirms the current product contract:

> catalog play normally resolves into rehearsal playback, not sync mode.

---

### 13.13 Block editor side flow

**Boundary entry:** legacy-looking block editor API  
**Runtime path:** proxy bridge into React modal

#### Current flow
1. legacy or hybrid caller requests block editor
2. `BlockEditorProxy` intercepts the call
3. `useBlockEditorStore` opens React block editor UI
4. user edits blocks/lyrics
5. save path writes through IDB update logic
6. `blocks-applied` event is dispatched
7. block mirrors refresh in bridges/stores

This is the same architectural pattern as sync bridge:
preserve old entry surface, redirect into React runtime.

---

## 14. Scheduler / Trigger / Reactive Publication Plane

This is one of the most modern and important parts of the current app architecture.

---

### 14.1 What the scheduler is

`PlaybackVisualScheduler` is a shared publication coordinator.

It runs a frame pipeline:

```text
read → detect → write → flush
```

It coordinates:
- frame readers
- frame detectors
- frame writers
- one final batched CSS var flush

It is intentionally:
- truth-blind
- timing-blind
- domain-neutral

It coordinates publication only.

---

### 14.2 What the scheduler is not

It is **not**:
- the owner of playback time
- the owner of line sync
- the owner of trigger truth
- the owner of word timing
- a replacement for the sync architecture

It consumes existing truth and publishes visuals efficiently.

This distinction is central to understanding the current runtime.

---

### 14.3 Shared scheduler participants

Current confirmed participants include:

#### Trigger bridge
Registers:
- reader
- detector
- writer

#### Lyrics bridge
Registers:
- detector
- writer

#### Audio-reactive bridge
Registers:
- detector
- writer

This means the system already has a shared playback visual hot path.

---

### 14.4 Trigger bridge lifecycle ownership

Currently, `trigger.bridge.ts` owns scheduler start/stop lifecycle.

#### Current behavior
- on `playback-state-changed` with playing → scheduler starts
- on stop/pause → scheduler stops
- CSS vars are reset on stop
- trigger store state is reset on track change

#### Why this matters
Other participants register with the scheduler,
but do not currently own scheduler lifecycle.

This is an explicit interaction truth.

---

### 14.5 Trigger signal flow

The trigger runtime chain is currently:

```text
engine currentTime
  → scheduler reader
  → TriggerEngine
  → WordLineDetector
  → TriggerBus emit
  → trigger writer
  → CSS vars + trigger store snapshot
  → WordHighlightLine / overlays / reactive consumers
```

Important current truth:
- trigger word detection uses fill-truth
- trigger store progress hot path was removed from Zustand
- progress now primarily rides through CSS vars

This is a mature hot-path optimization decision.

---

### 14.6 Lyrics publication through scheduler

`lyrics.bridge.ts` participates in the shared scheduler to:
- compute active line from marker timing
- publish line changes to `lyrics.store`
- reverse-sync active line back into `lyricsDisplay`
- dispatch `active-line-changed` for consumers

This means current line remains marker-driven,
but publication is now integrated into the shared visual scheduler path.

---

### 14.7 Audio-reactive publication through scheduler

`audio-reactive.bridge.ts` uses the same scheduler to:
- read analyser values
- compute energy/bass/mid/high/beat
- queue CSS vars for visual use

This confirms that audio-reactive visuals are not running as an unrelated isolated loop.
They already participate in the shared playback visual publication model.

---

### 14.8 CSS var batching

The scheduler owns final batched CSS var publication.

Participants queue values.
The scheduler flushes them once per frame.

This is important because it reduces:
- repeated DOM writes
- hot-path churn
- fragmented visual updates

It is one of the strongest modernized interaction points in the current system.

---

### 14.9 Trigger store vs CSS vars

Current design split:

#### CSS vars
Used for:
- hot-path visual publication
- high-frequency progress state

#### Zustand trigger store
Used for:
- lower-frequency snapshots
- active word id/text/confidence
- trigger line index
- debug state

This is a deliberate performance architecture choice.

---

### 14.10 Scheduler / trigger one-line summary

The modern visual runtime of beLive is now:

> **shared scheduler for publication, trigger engine for normalized word/line signals, and CSS var batching for hot-path rendering.**

---

## 15. Part 2 One-Line Summary

**beLive runtime interaction is authority-separated: the engine owns transport, markers own current line, word-sync adds word truth, loops are surface-specific, and a shared scheduler publishes reactive visuals without owning timing truth.**
```

---

## 16. Persistence & Hydration Topology

A new specialist must understand that beLive already has a real persistence model.
This is not an in-memory-only runtime.

The current system distinguishes clearly between:

- durable track artifacts
- runtime store mirrors
- boundary containers
- hydration services

---

### 16.1 Durable track record model

Track records in IndexedDB now carry more than raw media.

Confirmed durable fields include:

- `instrumentalData`
- `instrumentalType`
- `vocalsData`
- `vocalsType`
- `lyrics`
- `lyricsOriginalContent`
- `blocksData`
- `syncMarkers`
- `lineMap`
- `alignmentData`

This means one persisted track can now hold:

```text
audio assets
+ lyrics
+ block structure
+ line sync
+ additive word sync artifacts
```

That is already a product-grade persistence shape.

---

### 16.2 Durable vs runtime distinction

The following distinction is essential:

#### Durable layer
Lives in:
- IndexedDB track records
- app_state records where relevant

#### Runtime mirror layer
Lives in:
- Zustand stores
- some boundary global containers
- some bridge-published DOM attributes/CSS vars

#### Compatibility/boundary layer
Lives in:
- `window.trackCatalog`
- `window.markerManager`
- `window.lyricsDisplay`
- `window.waveformEditor`

These are not all equal.
A new architect must not confuse:
- runtime convenience mirrors
with
- durable persistence truth

---

### 16.3 Persistence table

| Artifact | Durable location | Hydrated / loaded by | Main runtime consumers |
|---|---|---|---|
| Audio buffers / stems | track record in IDB | `track.orchestrator.ts` | `AudioEngineV2` |
| Lyrics text | track record in IDB | orchestrator / `lyricsDisplay` | lyric surfaces |
| Original lyrics source | track record in IDB | orchestrator / word-sync prep | hash/degraded decisions |
| Blocks | `blocksData` in track record | orchestrator / block editor flow | rehearsal / blocks bridge |
| Markers | `syncMarkers` in track record | orchestrator / markerManager | line sync, loops, sync editor |
| Line map | `lineMap` in track record | `prepareWordSyncLayer()` | word-sync layer |
| Alignment data | `alignmentData` in track record | `prepareWordSyncLayer()` | trigger path, SyncLyrics, word consumers |
| Track metadata mirror | derived from IDB + trackCatalog index | `track.bridge` | React catalog/store consumers |

---

### 16.4 Track hydration flow

The main hydration flow is orchestrator-driven.

#### Current sequence
1. track selected
2. orchestrator loads track record from runtime container
3. lyrics/blocks shell is prepared
4. audio is loaded
5. markers are applied
6. word-sync preparation runs from persisted artifacts
7. bridges mirror runtime state into stores
8. surfaces render from those stores and boundary shells

This confirms that hydration is not scattered randomly across UI components.

---

### 16.5 Word-sync hydration flow

This is one of the most important persistence interactions in the current app.

#### Flow
1. orchestrator calls `prepareWordSyncLayer(...)`
2. lineMap is rebuilt from display lyrics
3. lyrics hash is computed from hash-source lyrics
4. persisted `lineMap` + `alignmentData` are checked by cache verdict service
5. if valid:
   - hydrate word-sync store into `ready`
6. if invalid or missing:
   - keep structural lineMap
   - no fake alignment is hydrated
   - status becomes `missing` or idle/degraded as appropriate

#### Why this matters
This means:
- additive sync survives reload
- bad cache degrades honestly
- word-sync is not recreated ad hoc by UI

This is a strong maturity signal.

---

### 16.6 Marker persistence flow

Marker persistence still uses a hybrid route.

#### Flow
1. markerManager shell owns active marker mutation surface
2. save path emits `save-track-markers`
3. `track.actions.ts` listener receives the event
4. current track record is updated with `syncMarkers`
5. IDB persists that update

This is a real hybrid boundary flow:
- shell-side event
- React/TS persistence handling
- durable storage result

---

### 16.7 Align persistence flow

Alignment is persisted immediately after successful align execution.

#### Flow
1. Sync Editor runs align request
2. provider returns `alignmentData`
3. word-sync store is updated
4. current track id is resolved
5. `updateTrackField(trackId, { alignmentData, lineMap })`
6. future loads rehydrate from persisted artifacts

#### Important consequence
Alignment is not just runtime memory state.
It is already a durable track artifact.

---

### 16.8 Track metadata mirroring

`track.store` does not own track durability.

It mirrors:
- tracks meta
- current track meta
- current track index

And it gets this via:
- direct IDB reads in `track.bridge`
- plus current index read from `trackCatalog`

So this layer is a mirror and consumer layer, not the durable authority.

---

### 16.9 Persistence one-line summary

beLive already persists real synchronized track artifacts.

The correct mental model is:

> **IDB owns durable track artifacts, orchestrator and services hydrate them, stores mirror them, and boundary globals still host compatibility-facing runtime shells.**

---

## 17. Secondary Interaction Surfaces

These surfaces are not the main transport/sync truth,
but they matter for real runtime behavior and onboarding completeness.

They form the “second interaction ring” of the app.

---

### 17.1 Background managers

**Current interaction root:** `useBackgroundManagers()`

#### Current truth
This hook:
- creates background managers
- binds them onto `window.app`
- reacts to mode changes from `mode.store`
- starts the correct manager for the active mode

#### Why this matters
Background management is not fully isolated in some future scene-only system.
It already participates in the runtime through:
- app host shell
- mode store
- React hook lifecycle

This is the current bridge between product modes and visual environment behavior.

#### Classification
**Live secondary surface, mode-coupled**

---

### 17.2 Live guard

**Current interaction root:** `live-guard.ts`

#### Current truth
`live-guard` patches `liveMode.activate()` so that activation only proceeds when camera permission policy allows it.

It currently uses:
- localStorage permission state
- delayed patching if `liveMode` is not yet ready

#### Why this matters
Live mode is not a raw direct activation path.
It has a compatibility shell plus a guard layer.

#### Classification
**Guarded boundary interaction**

---

### 17.3 Monitor bridge

**Current interaction root:** `monitor.bridge.ts`

#### Current truth
This bridge hydrates legacy `monitorMix` state into a React/Zustand-facing store layer.

It listens to:
- `monitor-state-changed`
- `monitor-route-changed`
- device change events from media devices

#### Why this matters
Monitor mix is still a boundary-heavy domain.
Its state is not born inside React, but React now consumes and mirrors it.

#### Classification
**Boundary-hydrated operational surface**

---

### 17.4 Monitor mix boundary sensitivity

Monitor mix remains an important boundary-sensitive surface.

It still interacts with audio through engine-facing properties such as:
- context access
- gain nodes
- microphone-related sources
- routing destinations

This means monitor functionality should be treated as:
- active
- useful
- but still boundary-sensitive

A new specialist should not assume it is fully normalized into the same shape as the modern audio runtime.

#### Classification
**Supported boundary surface with compat sensitivity**

---

### 17.5 Global recording state

**Current interaction root:** `recording.store.ts`

#### Current truth
There is a global recording state domain, separate from takes.

It reacts to:
- microphone-related events
- recording start/stop flows
- UI consumers
- performance budget clamping

#### Why this matters
Global recording has architectural impact because:
- performance policy clamps visual richness during recording
- recording state is published into DOM attributes
- some visual modes are recording-sensitive

#### Classification
**Separate first-class runtime policy surface**

---

### 17.6 Takes recording surface

**Current interaction roots:**
- `takes.store.ts`
- `takes.bridge.ts`

#### Current truth
The takes system has its own recording state, separate from global recording.

It includes:
- take recording state
- take preview stop/cleanup on playback changes
- track-change cleanup
- DOM publication via `data-takes-recording`

#### Why this matters
There are currently **two recording-adjacent systems**:
1. global recording
2. takes recording

They are related but not identical.

A new specialist must not collapse them mentally into one boolean.

#### Classification
**Separate secondary runtime subsystem**

---

### 17.6A Exercises quest layer

**Current interaction roots**:
- `src/exercises/` domain root
- `exercises.store.ts`
- `exercises.bridge.ts`
- `exercise.recipes.ts`
- `ExerciseStrip.tsx`
- `RecipeCardPopover.tsx`

#### Current truth
The exercises system sits **on top of Takes**, not as a replacement.

It provides:
- quest-based practice workflows
- recipe-driven step sequences
- automated backing changes per step
- listen + record phase orchestration
- goal tracking (rounds, filled slots)

#### Hidden runtime already exists
All exercise recipes are functional at runtime level:
- `Echo Drill` — listen → echo pattern (stable)
- `3-Take Challenge` — record 3 takes, compare, select best (stable)
- `No Training Wheels` — instrumental-only challenge (experimental)
- `A Cappella Boss` — progressive backing difficulty (experimental)
- `Call & Response` — alternation mode (special, under redesign)

#### First visible surfaces
- **ExerciseStrip** — lower strip state-aware surface for active exercise steps
- **RecipeCardPopover** — block-scoped recipe launcher (currently shows stable + smoke-test allowlist)

#### Bridge/store/runtime ownership map
| Domain | Owner | Role |
|---|---|---|
| Exercise metadata / active step | `exercises.store.ts` | quest state, step index, rounds |
| Lifecycle / track-change cleanup | `exercises.bridge.ts` | reset on track change, playback stop |
| Recipe definitions | `exercise.recipes.ts` | generate exercise instances from templates |
| Step execution | `TakesControlStrip.tsx` | delegates to takes substrate for record/listen actions |
| Backing assignment | `monitor-mix.js` via exercise step config | context-dependent backing per step type |

#### Call & Response is special lane, not stable generic drill
**Important product distinction**:
- `Call & Response` is **NOT** a stable generic drill recipe
- It is the first member of a **special alternation mode family**
- Requires semantic role patterns (`guide`, `response`) instead of fixed step sequences
- Needs dedicated entry point (separate from stable Drill launcher)
- Requires pattern configuration UI before start

#### Why this matters
A new Center must understand:
- Exercises are a **quest wrapper** around Takes substrate
- Hidden recipes exist and work, but are intentionally hidden from default learner surface
- Stable learner-facing drill surface has priority over exposing all modes
- Special modes (alternation) require separate interaction model from stable drills

#### Classification
**Separate quest layer on top of Takes substrate**

---

### 17.7 Recording and performance interaction

Performance policy reacts to recording state.

#### Current truth
`performance.bridge.ts`:
- reads effective tier
- reads recording state
- applies recording-safe clamp to visual budget
- publishes:
  - `data-visual-tier`
  - `data-recording-active`
  - budget CSS vars

#### Why this matters
Performance policy is not a static preference only.
It also reacts to session context.

This is one of the strongest examples of:
- timing truth staying frozen
- visual richness remaining adaptive

#### Classification
**Live policy interaction between performance and recording**

---

### 17.8 Block editor proxy surface

**Current interaction root:** `blockEditor.bridge.ts`

#### Current truth
The block editor path preserves old entry surfaces,
but redirects them into a React-owned modal/store flow.

It uses a proxy object to:
- intercept old-style modal construction/show calls
- open React block editor
- save updated blocks/lyrics
- dispatch `blocks-applied`

#### Why this matters
This is a textbook hybrid interaction pattern in beLive:
- preserve old API
- redirect into React runtime
- keep surrounding ecosystem stable

#### Classification
**Boundary entry, React-owned editing runtime**

---

### 17.9 Secondary surfaces one-line summary

The second interaction ring of beLive is already coherent:

> **backgrounds, live, monitor, recording, takes, exercises quest layer, and block editing are all integrated through bridges and shells rather than living as isolated side hacks.**

---

## 18. Open Seams

This section records current interaction seams that are still worth understanding.

These are **not** reasons to rebuild the system.
They are places where the interaction model is still a little more complex than the core frozen architecture.

---

### 18.1 Current time publication is distributed

Current time reaches the runtime through several paths:

- engine truth
- optimistic seek patching
- playback-state snapshot event
- 10Hz polling
- scheduler readers

#### Interpretation
This is acceptable today, but it is still a distributed publication model.

#### Why it matters
A new specialist should be careful not to mistake a mirrored currentTime surface for the canonical source.

---

### 18.2 Mode system is command/mirror split

Current mode handling is split between:
- `mode-switch.bridge.ts` as command authority
- `mode.bridge.ts` as mirror/observer path

#### Interpretation
This is not inherently broken.
It is an interaction seam worth understanding clearly.

#### Why it matters
New code should not randomly choose one path without understanding whether it is:
- commanding a mode switch
or
- consuming mirrored mode state

---

### 18.3 Rehearsal volume policy has duplicated persistence semantics

Current scans show multiple rehearsal-volume persistence shapes in the system.

Examples include:
- `bl-rehearsal-volumes`
- older rehearsal-specific keys in mode-switch logic

#### Interpretation
This suggests a real policy seam rather than transport confusion.

#### Why it matters
This is the kind of seam that can create subtle “why did the restored volumes differ?” behavior without being a core architecture failure.

#### Classification
**Open policy seam**

---

### 18.4 Loop ownership is intentionally split, but still a complexity point

TrackMap loop and Sync Editor loop are different systems:
- different intent owners
- shared runtime executor

#### Interpretation
This split is currently valid and product-meaningful.

#### Why it matters
A new architect should treat it as:
- intentional
- but still a meaningful future semantic complexity point

#### Classification
**Known multi-surface complexity**

---

### 18.5 Monitor surface is still compat-sensitive

Monitor mix still relies on a boundary-heavy interaction with audio engine surfaces.

#### Interpretation
This does not mean monitor is invalid.
It means monitor should be treated carefully as a compatibility-sensitive domain.

#### Classification
**Open compat seam**

---

### 18.6 Compatibility residue still exists

Some event and shell surfaces remain in place mainly for compatibility value.

The strongest confirmed example:
- `sync-editor-closed`

#### Interpretation
These should not be promoted into new primary architecture without need.

---

## 19. Frozen Areas

These areas should be treated as architecturally settled unless strong new evidence appears.

---

### 19.1 Audio runtime authority
Frozen:
- `AudioEngineV2` owns transport
- `window.audioEngine` identity is preserved, but authority is behind it

### 19.2 Marker backbone
Frozen:
- current line remains marker-driven

### 19.3 Additive sync model
Frozen:
- word sync remains additive over line sync

### 19.4 Separate sync artifacts
Frozen:
- `syncMarkers`
- `lineMap`
- `alignmentData`
remain separate layers

### 19.5 Orchestrator-driven hydration
Frozen:
- word-sync hydration belongs in track load orchestration

### 19.6 Trigger layer as separate domain
Frozen:
- trigger runtime is a first-class domain
- it does not collapse into lyric components

### 19.7 Shared publication scheduler
Frozen enough to document:
- scheduler is the shared visual publication plane
- it is not timing truth

### 19.8 Performance as separate policy domain
Frozen:
- performance budget is outside style intent and outside theme ownership

### 19.9 Boundary identity preservation
Frozen:
- major globals remain because they are real boundary shells, not accidental leftovers

---

## 20. Residual / Compatibility-Only Areas

These are not fake, but they should be interpreted correctly.

---

### 20.1 `sync-editor-closed`
Current status:
- still emitted
- no confirmed active listeners in current repo scan

Interpretation:
- compatibility residue

### 20.2 Historical `app.js` references
Current status:
- `app.js` file is gone
- comments still reference it historically

Interpretation:
- historical migration residue, not active runtime file ownership

### 20.3 Legacy shell files with demoted logic ownership
Examples:
- `lyrics-display.js`
- `marker-manager.js`

Interpretation:
- still real shell identities
- no longer the center of product logic

---

## 21. What a New Specialist Must Understand Immediately

A new architect entering beLive should internalize these truths on day one:

### 21.1 The system is already structured
Do not enter assuming:
- chaos
- unfinished migration
- fake architecture docs

The current runtime has real separation of:
- authority
- mirroring
- publication
- persistence
- compatibility shells

### 21.2 React does not mean shell replacement
The React/TS product layer sits on top of preserved identities and event/boundary surfaces.

### 21.3 Stores are not automatically authorities
Many stores are mirrors, selectors, or intent holders.
They are not transport truth just because they exist.

### 21.4 Bridges are first-class architecture
Bridges are not temporary glue.
They are part of how this hybrid runtime works.

### 21.5 Do not reopen solved domains
Do not reopen:
- additive sync
- marker backbone
- provider/hydration plumbing
- trigger-domain separation
- performance-domain separation
- shell identity preservation

---

## 22. Operational Entry Route for a New Architect

After reading the architecture docs, the best code-first path is:

### Step 1 — boot and boundary
Read:
- `index.html`
- `src/main.tsx`
- `src/App.tsx`

### Step 2 — transport authority
Read:
- `src/audio/core/AudioEngineV2.ts`
- `src/audio/compat/patchV1.ts`
- `js/audio-engine.js`

### Step 3 — load flow
Read:
- `src/services/track.orchestrator.ts`
- `src/services/track.actions.ts`

### Step 4 — line/marker interaction
Read:
- `src/bridges/lyrics.bridge.ts`
- `src/bridges/markers.bridge.ts`
- `src/stores/loop.store.ts`
- `src/bridges/loop.bridge.ts`
- `src/components/WagonTrain.tsx`

### Step 5 — word-sync and align flow
Read:
- `src/stores/wordSync.store.ts`
- `src/sync/word-sync/services/ai-lyrics-sync.service.ts`
- `src/sync/word-sync/services/alignment-cache.service.ts`
- `src/sync/components/SyncEditorPanel.tsx`

### Step 6 — trigger/scheduler publication path
Read:
- `src/playback/playback-visual-scheduler.ts`
- `src/triggers/trigger.bridge.ts`
- `src/triggers/detectors/word-line.detector.ts`
- `src/triggers/WordHighlightLine.tsx`

### Step 7 — style/performance split
Read:
- `src/stores/textStyle.store.ts`
- `src/bridges/textStyle.bridge.ts`
- `src/performance/performance.store.ts`
- `src/performance/performance.bridge.ts`

### Step 8 — secondary surfaces
Read:
- `src/hooks/useBackgroundManagers.ts`
- `src/bridges/live-guard.ts`
- `src/bridges/monitor.bridge.ts`
- `src/takes/takes.bridge.ts`
- `src/blocks/bridge/blockEditor.bridge.ts`

This route gives the fastest accurate mental model.

---

## 23. What Must Not Be Rebuilt

Do not rebuild the system around these misconceptions:

### 23.1 “We should remove all globals first”
Wrong.
Globals are serving as boundary identities.

### 23.2 “Stores should become the only truth everywhere”
Wrong.
Some stores are mirrors, not authorities.

### 23.3 “Scheduler should own timing”
Wrong.
Scheduler is publication only.

### 23.4 “Word sync should replace marker line sync”
Wrong.
Word sync is additive.

### 23.5 “Sync Editor loop and TrackMap loop must be unified immediately”
Wrong.
They are separate product surfaces with different ownership semantics.

### 23.6 “Legacy shells prove migration is incomplete”
Wrong.
They prove compatibility boundaries are still consciously preserved.

---

## 24. Strategic Interaction Interpretation

The best strategic interpretation of beLive today is:

### 24.1 Core runtime is already stable enough to document
The architecture is mature enough that interaction can be documented as a real operating system, not as migration notes.

### 24.2 Current complexity lives at seams, not at the center
The core truths are mostly settled.
The remaining complexity sits in:
- policy seams
- compatibility-sensitive surfaces
- multi-surface ownership edges

### 24.3 Growth will happen on top of this shape
Future work such as:
- prepared catalog productization
- backend alignment services
- richer scene engine
- deeper performance tiers
- future cue-window systems

should be layered on top of the current authority model,
not achieved by resetting it.

---

## 25. Final System One-Liner

**beLive is a mature hybrid runtime where preserved legacy globals provide identity and boundary compatibility, while React/TypeScript now owns the real product behavior through orchestrators, bridges, stores, trigger/scheduler publication, and durable synchronized track artifacts.**
```

---

## §18. Delta v2.2 — Bridge layer expansion

С момента публикации v2.1 bridge слой расширился. Ниже — полный актуальный список.

### 18.1 Полный список bridge'ей (22 файла)

| Bridge | Файл | Статус в v2.1 |
|--------|------|--------------|
| Audio | `src/bridges/audio.bridge.ts` | ✅ Был |
| Lyrics | `src/bridges/lyrics.bridge.ts` | ✅ Был |
| Markers | `src/bridges/markers.bridge.ts` | ✅ Был |
| Loop | `src/bridges/loop.bridge.ts` | ✅ Был |
| Track | `src/bridges/track.bridge.ts` | ✅ Был |
| Monitor | `src/bridges/monitor.bridge.ts` | ✅ Был |
| Sync | `src/sync/bridge/sync.bridge.ts` | ✅ Был |
| Trigger | `src/triggers/trigger.bridge.ts` | ✅ Был |
| Performance | `src/performance/performance.bridge.ts` | ✅ Был |
| Takes | `src/takes/takes.bridge.ts` | ✅ Был |
| **Mode Switch** | `src/bridges/mode-switch.bridge.ts` | 🆕 Не был |
| **Mode Mirror** | `src/bridges/mode.bridge.ts` | 🆕 Не был |
| **Blocks** | `src/bridges/blocks.bridge.ts` | 🆕 Не был |
| **TextStyle** | `src/bridges/textStyle.bridge.ts` | 🆕 Не был |
| **Cover Theme** | `src/bridges/cover-theme.bridge.ts` | 🆕 Не был |
| **Plate** | `src/bridges/plate.bridge.ts` | 🆕 Не был |
| **Stem Reactive** | `src/bridges/stem-reactive.bridge.ts` | 🆕 Не был |
| **Audio Reactive** | `src/bridges/audio-reactive.bridge.ts` | 🆕 Не был |
| **Billy** | `src/billy/billy.bridge.ts` | 🆕 Не был |
| **Exercise** | `src/exercises/exercise.bridge.ts` | 🆕 Не был |
| **Pitch Visual** | `src/audio/pitch/pitch-visual-bridge.ts` | 🆕 Не был |
| **Block Editor** | `src/blocks/bridge/blockEditor.bridge.ts` | 🆕 Не был |

### 18.2 Дополнительные события Event Matrix

| Событие | Producer | Consumers |
|---------|----------|-----------|
| `lyrics-rendered` | lyrics.service.ts | blocks.bridge, lyrics.bridge |
| `track-stem-ready` | AudioEngineV2 | audio.bridge |
| `track-fully-loaded` | AudioEngineV2 | audio.bridge |
| `catalog-cleared` | track.bridge | cover-theme.bridge |
| `tracks-changed` | track.bridge | (listener) |
| `monitor-state-changed` | monitor store | monitor.bridge |
| `monitor-route-changed` | monitor store | monitor.bridge |

### 18.3 Дополнительные App.tsx init вызовы

Помимо документированных 10, App.tsx также инициализирует:
- `coverTheme` bridge
- `stemReactive` bridge
- `plate` bridge
- `billy` bridge
- `takes` bridge
- `exercise` bridge
- `monitor` bridge

---

## §26. Auth Interaction Flow (v2.2 delta)

### 26.1 Guest Skip Flow

```
WelcomePage
  └─ click "Пропустить"
       └─ authService.skipAuth()
            ├─ useUserProfileStore.createProfile('Гость', '🎤', true)
            │    ├─ set({ isGuest: true, isLoggedIn: true })
            │    └─ localStorage persist (belive:user-profile v2)
            └─ useAppStore.setSurface('app')
                 └─ App.tsx switch(surface) → return <AppShell />
```

**Authority:** `authService` — entry point. `userProfileStore` — data authority.

### 26.2 Google OAuth Flow

```
WelcomePage
  └─ click "Войти через Google"
       └─ authService.initiateGoogleOAuth()
            ├─ VITE_USE_MOCK_AUTH=true → _mockAuth() (dev)
            └─ window.location.href = CF_WORKER_URL/auth/google
                 └─ Worker → Google Consent → callback
                      └─ URL params: ?auth=JWT&name=...&email=...
                           └─ App.tsx useEffect → handleCallback()
                                ├─ validate JWT (exp check)
                                ├─ createOAuthProfile({name, email, authToken, ...})
                                │    ├─ set({ isGuest: false, isLoggedIn: true })
                                │    └─ localStorage persist
                                └─ setSurface('app')
```

### 26.3 Auth Check on Boot

```
App.tsx mount
  └─ useEffect → authService.checkExistingAuth()
       ├─ userProfileStore.currentUser exists?
       │    ├─ NO → setSurface('welcome'), setAuthChecked(true)
       │    └─ YES → isTokenValid(authToken)?
       │         ├─ NO → logout() → setSurface('welcome')
       │         └─ YES → setSurface('app'), setAuthChecked(true)
       └─ Fallback: LoadingSplash поверхностью welcome до authChecked=true
```

---

## §27. Surface Gate Interaction (v2.2 delta)

### 27.1 Surface switch topology

```
useAppStore.surface
  ├─ 'welcome' → <WelcomePage /> (Guest entry)
  │    └─ on skip/OAuth → setSurface('app')
  ├─ 'app' → <AppShell /> (main workspace)
  │    └─ QuickActions → setSurface('profile')
  └─ 'profile' → <UserRoom /> (profile/settings)
       └─ back/Escape → setSurface('app')
       └─ logout → setSurface('welcome')
```

### 27.2 Кто меняет surface

| Действие | Кто вызывает | target surface |
|----------|-------------|----------------|
| Guest skip | `authService.skipAuth()` | `app` |
| OAuth success | `authService.handleCallback()` | `app` |
| Клик аватар | `QuickActions.tsx` | `profile` |
| Escape в UserRoom | `UserRoom.tsx useEffect` | `app` |
| Logout | `UserRoom.tsx handleLogout` | `welcome` |
| Принудительно | `NikitaApi` (dev tool) | любая |

---

## §28. Guest / OAuth User Split (v2.2 delta)

### 28.1 Влияние isGuest на поверхности

```
isGuest = true:
  ├─ UserRoom → показывает блок апгрейда
  │    ├─ "Зарегистрируйся!" + Google button
  │    └─ скрывает профиль, email, аватар
  ├─ Статистика → "Доступно после регистрации"
  └─ AI → BeliveProvider отдаёт AUTH_REQUIRED

isGuest = false:
  ├─ UserRoom → показывает профиль (аватар, имя, email)
  ├─ Статистика → "скоро..."
  └─ AI → BeliveProvider шлёт запрос с JWT
```

### 28.2 Guest → OAuth upgrade path
Прямой апгрейд не реализован (нет слияния гостевых данных с OAuth). При OAuth входе создаётся новый профиль.

---

## §29. beLive AI Provider Interaction (v2.2 delta)

### 29.1 Поток запроса

```
AIHub.sendMessage(request)
  └─ определил провайдер = 'belive'
       └─ BeliveProvider.streamChat(request, callbacks)
            ├─ Читает JWT: userProfileStore.currentUser.authToken
            ├─ NO TOKEN → AIError('AUTH_REQUIRED')
            ├─ Fetch POST {VITE_AI_WORKER_URL}
            │    ├─ Headers: { Authorization: Bearer JWT }
            │    └─ Body: { model, messages, stream: true, ... }
            ├─ 401 → AIError('Сессия истекла')
            ├─ 429 → AIError('Лимит 20 запросов/день')
            └─ SSE stream:
                 ├─ onToken(delta) → UI
                 ├─ [DONE] → onDone(fullText)
                 └─ AbortError → stop()
```

### 29.2 Выбор провайдера

```
AiSettingsModal
  ├─ "beLive AI" → useAiSettingsStore.setProvider('belive')
  └─ "OpenRouter" → useAiSettingsStore.setProvider('openrouter-direct')
       └─ (требует API-ключ от пользователя)
```

---

## §30. Event Surface Contract — New Events (v2.2 delta)

События, добавленные в auth/welcome системе:

| Event | Target | Producer | Consumer | Purpose |
|-------|--------|----------|----------|---------|
| `auth-checked` | `window` | `App.tsx` | — | Auth check complete (планируется) |
| `guest-login` | `window` | `authService` | — | Guest вошёл (планируется) |
| `oauth-login` | `window` | `authService` | — | OAuth пользователь вошёл (планируется) |

> ⚠️ Эти события пока не реализованы — это architectural intent для будущих волн.

---

## §31. Persistence & Hydration — User Profile (v2.2 delta)

### 31.1 User Profile

| Артефакт | Хранилище | Ключ | Версия |
|----------|-----------|------|--------|
| Профиль + JWT | localStorage (zustand persist) | `belive:user-profile` | 2 |
| Onboarding | localStorage (там же) | в составе профиля | — |

### 31.2 Migration

```
Version 1 → Version 2:
  Добавлены поля:
    catalogOnboardingComplete: false
    onboardingProgress: { step1Done: false, step2Done: false, activeStep: 1 }
```

---

## §32. New File Interaction Map (v2.2 delta)

```
WelcomePage.tsx
  └─ читает: nothing (stateless)
  └─ вызывает: authService.initiateGoogleOAuth(), authService.skipAuth()

UserRoom.tsx
  └─ читает: useAppStore(surface), useUserProfileStore(currentUser, isGuest, ...)
  └─ вызывает: authService.initiateGoogleOAuth(), logout(), setSurface()

auth.service.ts
  └─ читает: import.meta.env (VITE_*), URL params
  └─ пишет: useUserProfileStore, useAppStore (setSurface)

app.store.ts
  └─ читается: App.tsx, UserRoom.tsx, QuickActions.tsx
  └─ пишется: authService, QuickActions

user-profile.store.ts
  └─ читается: UserRoom.tsx, QuickActions.tsx, BeliveProvider
  └─ пишется: authService, UserRoom (logout)

belive.provider.ts
  └─ читает: userProfileStore.currentUser.authToken
  └─ вызывает: fetch(AI_WORKER_URL)
```

---

