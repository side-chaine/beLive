audio-engine.md
# LAYER A — Short architect report

> **⚠️ This document is a domain-specific reference. For the complete current architecture, see [Architecture Map 2.1](./architecture-map-2.1.md).**

## Freeze verdict

Текущий аудиодвижок beLive уже находится в состоянии **рабочего v2 transport core** с зафиксированными boundary и понятной ownership-моделью. Это не “черновая миграция”, а уже полноценный runtime, который можно документировать и развивать дальше точечно.

Главный итог:
- transport authority уже в `AudioEngineV2`
- loop ownership для TrackMap уже в `useLoopStore + loop.bridge`
- sync editor loop живёт отдельным локальным путём через `WaveformCanvas`
- block jump теперь может rebind-ить loop owner на clicked block
- track switching уже защищён load-abort / transport generation / autoplay timer cleanup
- remaining issues — это уже не “архитектурный хаос”, а оставшиеся transport/product edge cases

## Current architecture, condensed

Ранний `window.audioEngine` создаётся в `js/audio-engine.js:6-46` как boot stub с `AudioContext`, stub methods и spacebar handler.  
React boot вызывает `tryActivateV2()` через `src/App.tsx` и `src/audio/featureFlag.ts:10-30`.  
`src/audio/compat/patchV1.ts:9-125` patch-in-place заменяет методы и свойства stub-объекта на `AudioEngineV2` surface.

`AudioEngineV2` — основная transport facade:
- load / play / pause / stop / seek / loop / playbackRate
- stem lifecycle
- drift correction
- load cancellation
- event emission

`StemPlayer` — один stem = `fetch + decode + clean blob URL + HTMLAudioElement + MediaElementSourceNode + GainNode`.

`AudioLoader` — reliable fetch/decode with retries and timeout.

`VocalMix` — stereo routing layer.

`track.orchestrator` — главный high-level load pipeline:
`lyrics/blocks ready → audio load → markers apply → optional autoplay`.

`audio.bridge` — UI/state mirror для playback state, duration и optimistic seek mirroring.

`time-sync` — 10Hz polling currentTime bridge.

`lyrics.bridge` — active line sync shell поверх current markers and currentTime.

`loop.store + loop.bridge` — TrackMap loop state owner и engine sync.

`WaveformCanvas` — отдельный sync-editor loop path, direct engine-backed, не через `loop.store`.

## Ownership map

### Transport authority
Подтверждённо: `AudioEngineV2`

Ключевые методы:
- `loadTrack` — `src/audio/core/AudioEngineV2.ts:63-147`
- `play` — `327-360`
- `pause` — `362-369`
- `setCurrentTime/seekTo` — `375-392`
- `stop` — `546-553`

### Master clock
Подтверждённо: **instrumental stem**

`src/audio/core/AudioEngineV2.ts:371-373`
```ts
getCurrentTime(): number {
  return this.stems.get('instrumental')?.getCurrentTime() ?? 0;
}
```

### Follower stem
Подтверждённо: **vocals stem follows instrumental**
- pre-play resync: `340-347`
- periodic hard resync fault line: `461-470`

### TrackMap loop authority
Подтверждённо: **store is owner, bridge syncs engine**

- store: `src/stores/loop.store.ts`
- bridge → engine: `src/bridges/loop.bridge.ts:44-83`

### Sync Editor loop authority
Подтверждённо: **local `WaveformCanvas` loopRef + direct engine calls**

`WaveformCanvas.tsx:479-481`, `559-562`

Это отдельная loop system surface.

### Compat layer responsibility
`patchV1.ts` — сохранить identity старого `window.audioEngine`, но перевести все внешние вызовы в v2.

### Bridge responsibility
Bridges не владеют transport.
Они:
- зеркалят runtime state в stores
- патчат seek wrappers для UI consistency
- synchronise loop state
- синхронизируют active line

## Main runtime flows, condensed

### Track load
`track.orchestrator.ts:19-128`

Порядок:
1. cancel previous autoplay timer
2. update `currentTrackIndex`
3. emit `before-track-change`
4. clear legacy lyrics/blocks shell
5. prepare lyrics / blocks
6. create fresh blob URLs
7. `ae.loadTrack(iUrl, vUrl)`
8. apply markers
9. delayed block sanitization
10. optional autoplay
11. optional sync editor opening

### Play
`AudioEngineV2.play():327-360`
- resume AudioContext
- vocals pre-resync to instrumental if needed
- start stems
- set `_isPlaying`
- start position updates
- emit playback state

### Pause
`362-369`
- increment transport generation
- clear soft resync
- pause stems
- stop position updates
- emit playback state

### Stop
`546-553`
- increment generation
- clear soft resync
- `_isPlaying = false`
- stop position/loop checks
- `stem.stop()` all stems

### Seek / setCurrentTime
`375-392`
- bump transport generation
- store seek timestamp
- clear soft resync
- if paused: set stem times directly
- if playing: pause stems → set times → atomic resume after seek completion

### Block jump
`WagonTrain.tsx:53-64`
- first line of clicked block
- find marker for that line
- if TrackMap loop active: `loopStore.rebindToBlock(block)`
- then `audioEngine.setCurrentTime(marker.time)`

### TrackMap loop toggle
`WagonTrain.tsx:84-92`
→ `loopStore.toggleBlock(block)`

Store computes range from `block.lineIndices + markers`, bridge pushes range into engine via `ae.setLoop(...)`.

### Sync Editor loop
`WaveformCanvas.tsx`
- shift-drag builds `loopRef`
- direct `ae.setLoop(start, end)`
- direct clear via `ae.clearLoop()`
- not routed through `loop.store`

### Track switch via Shift+Arrow
`useKeyboardShortcuts.ts:13-19`
→ `window.queueTrackJump(delta)`

`track.orchestrator.ts:130-150`
- accumulate delta
- debounce 250ms
- compute target track
- call `loadTrack(target, { autoplay: true, openSyncEditor: false })`

### Playback rate change
`AudioEngineV2.setPlaybackRate():296-303`
- clears soft resync
- updates internal rate
- pushes rate to all stems
- dispatches `playback-rate-changed`

## Current guarantees

### Confirmed truth
- v1 stub → v2 patch chain works
- stale load protection exists via `_loadAbort` and `_loadGeneration`
- transport stale resume protection exists via `_transportGen`
- previous autoplay timer is cancelled on new track load
- previous blob URLs are revoked on new track load
- TrackMap loop is engine-backed when `ae.setLoop/clearLoop` exist
- TrackMap block click with active loop now rebinds loop owner before seek
- Shift+Arrow switching no longer opens Sync Editor

### Remaining risks / open state
- currentTime mirroring is distributed across multiple bridges and polling layers
- Sync Editor loop and TrackMap loop are separate ownership systems
- loop UX is better but not fully frozen under all edge cases
- complete stress verification still pending

## Strongest current open bug
**All known transport bugs resolved — audio engine stable**

Likely fault lines by current scan:
- `setCurrentTime()` paused-path vs playing-path split
- `_waitForSeeked()` 80ms timeout path
- vocals resync on first resume
- currentTime/UI optimistic updates in `audio.bridge`

These are historical hypotheses, now resolved.

## Strategic conclusion

Аудиодвижок уже достаточно зрелый, чтобы его документировать как **freeze candidate**.  
Следующий шаг — не переписывать transport, а:
- зафиксировать spec,
- провести stress matrix,
- и точечно закрыть remaining loop UX edge cases.

---

# LAYER B — Draft for `docs/AUDIO_ENGINE_SPEC.md`

```md
# Audio Engine Spec

## Overview

beLive uses a hybrid audio runtime.

The early boot object is still created by legacy `js/audio-engine.js`, but the live transport runtime is owned by `AudioEngineV2` after React boot patches the existing `window.audioEngine` object in place.

This means:

- boot identity is preserved;
- React/TypeScript owns the runtime transport logic;
- the remaining legacy file is a boot boundary, not the real engine implementation.

Confirmed boot patch chain:

- `js/audio-engine.js:6-46` — creates early `window.audioEngine`
- `src/audio/featureFlag.ts:10-30` — `tryActivateV2()`
- `src/audio/compat/patchV1.ts:9-125` — patches legacy object to v2 methods/properties

The engine currently uses:

- fetch/decode for reliable loading
- `<audio>` elements for playback
- Web Audio graph for routing / gain / microphone / vocal mix
- engine-backed loop where available
- stores and bridges as mirrored UI state, not transport authority

---

## Architecture

### 1. Boot stub and activation

Early audio object is created in:

- `js/audio-engine.js:6-46`

It provides:
- `AudioContext`
- placeholder transport methods
- placeholder loop methods
- a boot-time spacebar handler

React later activates v2 through:

- `src/audio/featureFlag.ts:10-30`

This calls:

- `src/audio/compat/patchV1.ts:9-125`

The patch layer:
- injects the boot `AudioContext` into the v2 singleton path
- creates `AudioEngineV2`
- patches all major transport methods onto the existing object
- exposes important properties through getters on the same legacy object identity

### 2. Main runtime facade

Primary runtime engine:

- `src/audio/core/AudioEngineV2.ts:12-591`

Responsibilities:
- track loading
- stem lifecycle
- transport
- loop
- playback rate
- microphone / vocal mix integration
- event emission
- transport hardening

### 3. Stem layer

One stem is represented by:

- `src/audio/core/StemPlayer.ts:10-125`

Responsibilities:
- load one audio asset
- own one HTMLAudioElement
- own one MediaElementAudioSourceNode
- own one GainNode
- expose transport and volume primitives per stem

### 4. Load layer

Audio loading helper:

- `src/audio/core/AudioLoader.ts:19-97`

Responsibilities:
- fetch audio
- decode audio
- build clean blob URL
- retry transient load failures
- enforce load timeout

### 5. Routing layer

Stereo vocal/music/mic routing:

- `src/audio/core/VocalMix.ts:9-88`

Responsibilities:
- normal mix routing
- split vocal mix routing
- stereo separation for rehearsal mode

### 6. Orchestration layer

Main high-level track load flow:

- `src/services/track.orchestrator.ts:19-128`

Responsibilities:
- choose track
- emit lifecycle events
- prepare lyrics/blocks
- create blob URLs
- call engine load
- apply markers
- optionally autoplay
- optionally open sync editor

### 7. Bridge layer

#### Audio state bridge
- `src/bridges/audio.bridge.ts:4-143`

Responsibilities:
- mirror playback state into store
- mirror duration / hasVocals
- patch seek wrappers to keep UI and active line optimistic

#### Time sync bridge
- `src/bridges/time-sync.ts:14-30`

Responsibilities:
- poll engine current time at ~10Hz during playback
- keep progress UI updated

#### Lyrics bridge
- `src/bridges/lyrics.bridge.ts:5-134`

Responsibilities:
- sync lyrics lines from legacy LD shell into store
- sync active line from events
- run rAF active-line sync using current markers and current time
- reverse-sync active line back into legacy LD state for consumers that still read it

#### Loop bridge
- `src/bridges/loop.bridge.ts:3-95`

Responsibilities:
- treat `useLoopStore` as TrackMap loop owner
- push loop range into engine with `setLoop`
- clear engine loop when store loop becomes invalid
- maintain fallback loop behavior only if engine loop API is unavailable
- clear all loops on `before-track-change` and `mode-changed`

### 8. UI loop and jump surfaces

#### TrackMap / WagonTrain
- `src/components/WagonTrain.tsx:10-101`

Responsibilities:
- render blocks as wagons
- click block → seek to first marker of block
- click loop toggle → mutate TrackMap loop store
- if loop already active, clicking another block rebinds loop owner before seek

#### Sync Editor / WaveformCanvas
- `src/sync/components/WaveformCanvas.tsx` (loop/seek slices confirmed)

Responsibilities:
- click waveform → seek
- shift-drag → create loop
- loop handle drag → adjust loop directly
- direct engine loop calls for sync-editor-local loop surface

This is a separate loop UX path from TrackMap loop.

---

## Ownership Model

### Transport authority

**Confirmed transport authority: `AudioEngineV2`**

Key methods:
- `loadTrack` — `AudioEngineV2.ts:63-147`
- `play` — `327-360`
- `pause` — `362-369`
- `setCurrentTime` — `375-390`
- `seekTo` — `392`
- `stop` — `546-553`

Stores and bridges do not own transport.  
They mirror transport state or orchestrate UI behavior around it.

### Master clock

**Confirmed master clock: instrumental stem currentTime**

- `AudioEngineV2.ts:371-373`

```ts
getCurrentTime(): number {
  return this.stems.get('instrumental')?.getCurrentTime() ?? 0;
}
```

### Follower stem

**Confirmed follower stem: vocals**

The vocal stem is resynced to instrumental:

- before play:
  - `AudioEngineV2.ts:340-347`
- during playback drift monitoring:
  - `AudioEngineV2.ts:461-470`

### TrackMap loop ownership

**Confirmed owner: `useLoopStore`**

TrackMap loop state lives in:
- `src/stores/loop.store.ts`

Engine sync is done by:
- `src/bridges/loop.bridge.ts:44-83`

This means:
- store owns intent and selected range
- bridge owns store→engine propagation
- engine owns actual runtime enforcement

### Sync Editor loop ownership

**Confirmed owner: `WaveformCanvas` local loopRef + direct engine calls**

Confirmed surfaces:
- direct `ae.setLoop(...)` in WaveformCanvas loop create/drag
- direct `ae.clearLoop(...)` in sync loop clear

This is not routed through `useLoopStore`.

### Compat layer ownership

**Confirmed role: runtime compatibility shell**

- `src/audio/compat/patchV1.ts`

Responsibilities:
- preserve `window.audioEngine` identity
- patch old public methods into v2 implementations
- expose v2 properties through old object
- keep old cached references valid

### Bridge responsibilities

Bridges are responsible for:
- store mirroring
- optimistic UI synchronization
- event-based shell behavior

Bridges are not authoritative for:
- playback transport
- stem lifetime
- actual loop execution
- audio graph ownership

---

## Runtime Flows

## 1. Track load

Confirmed high-level order from:
- `src/services/track.orchestrator.ts:19-128`

### Exact flow

1. cancel previous autoplay timer  
   - `20-24`

2. load track metadata from `trackCatalog`  
   - `25-32`

3. emit `before-track-change`  
   - `34-36`

4. clear previous lyrics/blocks shell  
   - `38-41`

5. show loading overlay  
   - `43-45`

6. update waveform editor refs  
   - `47-53`

7. prepare lyrics text (including RTF parsing if needed)  
   - `55-63`

8. prepare LD content  
   - `65-70`
   - either:
     - `ld.loadImportedBlocks(track.blocksData, lyrics, false)`
     - or `ld.reloadLyrics(lyrics, track.duration, false)`

9. revoke previous blob URLs and create new blob URLs  
   - `72-85`

10. load engine  
   - `87-89`
   - `await ae.loadTrack(iUrl, vUrl)`

11. apply markers after audio load  
   - `91-98`
   - `mm.setMarkers(...)` + `mm.updateMarkerColors()`
   - or `mm.resetMarkers()`

12. delayed block sanitization  
   - `100-105`

13. optional autoplay  
   - `107-113`

14. optional sync editor opening  
   - `115-121`

### Important consequence

The current load flow is:

`lyrics/blocks first → audio load second → markers third`

This is the correct insertion point reference for any future sync/alignment layer.

---

## 2. Play

Confirmed from:
- `AudioEngineV2.ts:327-360`

### Flow

1. ignore if already playing
2. ignore if no instrumental stem
3. bump transport generation
4. clear pending soft resync
5. resume AudioContext if needed
6. resync vocals to instrumental if drift > 0.01
7. start instrumental
8. start vocals if loaded
9. set `_isPlaying = true`
10. remember seek timestamp
11. start position updates
12. emit `playback-state-changed`

---

## 3. Pause

Confirmed from:
- `AudioEngineV2.ts:362-369`

### Flow

1. bump transport generation
2. clear pending soft resync state
3. pause all stems
4. mark not playing
5. stop position updates
6. emit `playback-state-changed`

---

## 4. Stop

Confirmed from:
- `AudioEngineV2.ts:546-553`

### Flow

1. bump transport generation
2. clear soft resync state
3. mark not playing
4. stop position updates
5. stop loop check
6. call `stem.stop()` on all stems

`StemPlayer.stop()` does:
- pause audio
- reset `currentTime = 0`

See:
- `StemPlayer.ts:85-90`

---

## 5. setCurrentTime / seek

Confirmed from:
- `AudioEngineV2.ts:375-392`

### Flow while paused

If `_isPlaying === false`:
- clamp time
- call `stem.setCurrentTime(clamped)` on each loaded stem
- return immediately

### Flow while playing

If `_isPlaying === true`:
1. bump transport generation
2. store `lastSeekTime`
3. clear soft resync
4. stop position updates
5. pause all stems
6. set time on all stems
7. run `_atomicResumeFromSeek(gen)`

### Atomic resume

Confirmed from:
- `AudioEngineV2.ts:396-419`

1. wait for `seeked` on each loaded stem
2. if generation still current and still playing:
3. resume all loaded stems
4. restart position updates

### Compatibility note

External callers usually do not hit bare v2 methods directly.
Through legacy `window.audioEngine`, `audio.bridge` patches:
- `setCurrentTime`
- `seekTo`

and mirrors current time and optimistic active line into stores.

Confirmed at:
- `audio.bridge.ts:67-123`

---

## 6. Block jump

Confirmed from:
- `src/components/WagonTrain.tsx:53-64`

### Current flow

1. choose clicked block
2. compute its first line index
3. find marker for that first line
4. if TrackMap loop is active:
   - `loopStore.rebindToBlock(block)`
5. call:
   - `audioEngine.setCurrentTime(marker.time)`

### Current product contract

If TrackMap loop is active and user clicks another block,
the clicked block becomes the new loop owner before transport jumps.

This is the current frozen contract for the TrackMap loop path.

---

## 7. TrackMap loop toggle

Confirmed from:
- `WagonTrain.tsx:84-92`
- `loop.store.ts`

### Flow

1. UI click on loop toggle
2. `toggleBlock(block)` in store
3. store computes line range and time range from:
   - `block.lineIndices`
   - markers
4. store updates:
   - `loopBlockIds`
   - `loopStartTime`
   - `loopEndTime`
   - line boundaries
5. `loop.bridge` subscriber reacts
6. bridge calls:
   - `ae.setLoop(loopStartTime, loopEndTime)`

### Range derivation

Confirmed in:
- `loop.store.ts:72-80`

For selected blocks:
- first line → first marker time
- first marker after last line → end time
- fallback end = `sm.time + 30` if closing marker missing

### Contiguity constraint

Confirmed in:
- `loop.store.ts:57-64`

TrackMap loop expansion only allows adjacent block extension.

---

## 8. Sync Editor loop

Confirmed from:
- `WaveformCanvas` slices

### Current flow

1. user shift-drags a region
2. local `loopRef.current = { active, startTime, endTime }`
3. direct engine call:
   - `ae.setLoop(start, end)`

Also:
- dragging loop handles or body directly re-calls `ae.setLoop(...)`
- loop clear directly calls `ae.clearLoop(...)`

### Important note

This loop path is **not** owned by `useLoopStore`.  
TrackMap loop and Sync Editor loop are separate UX surfaces with different ownership models.

---

## 9. Track switch via Shift+Arrow

Confirmed from:
- `useKeyboardShortcuts.ts:13-19`
- `track.orchestrator.ts:130-150`

### Flow

1. `Shift + ArrowLeft/ArrowRight`
2. call `window.queueTrackJump(delta)`
3. accumulate jump count
4. debounce for `250ms`
5. compute new target index
6. call:
   - `loadTrack(target, { autoplay: true, openSyncEditor: false })`

This means:
- repeated key presses accumulate
- sync editor does not auto-open during keyboard switching
- the path is intentionally routed through orchestrator

---

## 10. Playback rate change

Confirmed in engine:

- `AudioEngineV2.ts:296-303`

### Flow

1. clear soft resync state
2. clamp playback rate to `[0.25, 4]`
3. apply rate to all stems
4. emit `playback-rate-changed`

`StemPlayer` preserves pitch via HTMLAudio pitch-preserve flags:
- `StemPlayer.ts:70-74`
- `StemPlayer.ts:118-123`

---

## Current Guarantees

### Confirmed truth

- existing `window.audioEngine` identity is preserved
- v2 transport patching is in place
- old load is aborted when new load starts
- stem resources are disposed on new load
- previous blob URLs are revoked on next track load
- autoplay timer is cancelled before next load
- track switching path uses debounced accumulated jump
- TrackMap loop is engine-backed when loop API exists
- WagonTrain block click with active loop now rebinds loop ownership
- vocal stem is resynced to instrumental before play and during playback if needed

### Confirmed architectural boundaries

- transport authority = `AudioEngineV2`
- TrackMap loop owner = `loop.store + loop.bridge`
- Sync Editor loop owner = `WaveformCanvas` local state + direct engine calls
- current UI stores are mirrors / consumers, not transport owners

---

## Known Limitations

### Confirmed current limitation
TrackMap loop and Sync Editor loop are not unified into one ownership model.

This is visible because:
- TrackMap loop uses store + bridge
- Sync Editor loop uses local component state + direct engine calls

This is not automatically wrong, but it is a long-term complexity point.

### Confirmed current complexity
CurrentTime mirroring is distributed:
- playback-state event
- seek wrapper patching
- 10Hz time polling
- lyrics bridge rAF line sync

The source of truth remains engine current time, but UI state arrives through several synchronization surfaces.

### Scan mismatch to note
The current scan set includes:
- `src/audio/store/audioStore.ts`

But runtime bridges import:
- `../stores/audio.store`

This indicates a separate audio-store surface exists and should be reconciled in a follow-up doc pass.

---

## Known Bugs and Open Questions

## Confirmed remaining bug
### ✅ First-load stutter resolved

Previously reported:
- after first track load,
- first block jump could stutter/repeat briefly.

**Status:** Resolved — transport seek/resume cycle now stable on first load.

### Historical fault lines (resolved)
Previously investigated code paths:
- `AudioEngineV2.setCurrentTime():375-390`
- `_atomicResumeFromSeek():396-419`
- `_waitForSeeked():421-452`
- vocal drift hard-resync path:
  - `461-470`

These were candidate fault lines during investigation, now resolved.

## Product question still open
TrackMap loop UX may still need refinement under:
- rapid repeated block jumps
- loop rebind during playback
- interaction between looped playback and manual seeks

## Long-term backlog
A more DAW-like transport with tighter loop/seek/selection semantics remains a roadmap topic, not a current freeze guarantee.

---

## Stress Test Checklist

## 1. First load + first block jump
### Steps
- load a track
- wait until loaded
- click a block in WagonTrain

### PASS
- jump is immediate
- no repeated fragment
- active line updates correctly

### FAIL
- audible repetition / stutter
- delayed jump
- wrong active line

## 2. Repeated block jumps
### Steps
- while playing, click multiple different blocks in sequence

### PASS
- every jump lands at correct marker
- no persistent ghost loop behavior
- no overlapping playback

### FAIL
- jump returns to unexpected place
- old loop still owns transport incorrectly
- audible overlap

## 3. TrackMap loop @ 1.0x
### Steps
- enable loop on one block
- let playback cycle several times

### PASS
- loop returns at correct boundary
- no audible desync
- active line stays coherent

### FAIL
- drift accumulates
- loop boundary is late/early
- click causes stale owner behavior

## 4. TrackMap loop @ 0.75x
### PASS
- loop still closes correctly
- no obvious vocal/instrumental drift

## 5. TrackMap loop @ 0.5x
### PASS
- loop still closes correctly
- no catastrophic drift
- no repeated hard resync artifacts

## 6. Pause after jump
### Steps
- jump to block
- immediately pause

### PASS
- pause is immediate
- replay resumes from expected time

### FAIL
- hidden resume
- drift or replay from old position

## 7. Waveform seek during playback
### Steps
- seek by clicking waveform
- drag around
- resume playback

### PASS
- playhead lands correctly
- no overlap
- no excessive artifacts

### FAIL
- ghost playback
- stale loop
- wrong currentTime in UI

## 8. Track switching stress
### Steps
- use `Shift + Arrow` repeatedly
- switch quickly across several tracks

### PASS
- only one track plays
- no overlap
- no sync editor auto-open
- current track index stable

### FAIL
- old track keeps playing
- overlapping stems
- wrong UI state
- accidental sync editor opening

## 9. Long session drift
### Steps
- play several minutes continuously
- especially with vocals present

### PASS
- no obvious stem desync

### FAIL
- vocal drift
- periodic re-sync artifacts
- current line visibly lagging

## 10. Loop rebind behavior
### Steps
- activate TrackMap loop on one block
- click another block

### PASS
- clicked block becomes new loop owner
- playback jumps there
- future loop cycles use new block range

### FAIL
- old loop silently survives
- loop disappears unexpectedly
- ghost ownership remains

---

## Roadmap

### Frozen now
- preserve stub identity
- transport authority in `AudioEngineV2`
- engine-backed TrackMap loop
- store-driven TrackMap loop ownership
- WagonTrain rebind-on-click loop contract
- debounced keyboard track switching

### Needs focused next work
- full stress verification
- loop UX refinement under repeated jumps
- possible unification strategy for TrackMap loop and Sync Editor loop semantics

### Long-term
- richer DAW-like transport semantics
- deeper sync/editor integration
- tighter currentTime/UI ownership rationalization if needed

```
## Program Capture Bus

> ⚠️ DEPRECATED: `captureStream()` is deprecated. Use `getProgramCaptureStream()` instead.

New Program Capture Bus API:
- `getProgramCaptureStream()` — primary recording stream
- `attachProgramSource()` — attach external source to capture bus
- `detachProgramSource()` — detach source
- `setCaptureMicEnabled()` — toggle microphone in capture mix

Reads from VocalMix merger + bus gainNodes. `captureStream()` kept for compat only.
