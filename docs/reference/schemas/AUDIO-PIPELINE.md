---
schema: AUDIO-PIPELINE
version: 1.0
generated: 2026-04-27
nodes:
  - id: stemPlayer
    file: src/audio/core/StemPlayer.ts
    layer: engine
    authority: false
    frozen: true
    observable: true
    p0: false
  - id: audioLoader
    file: src/audio/core/AudioLoader.ts
    layer: engine
    authority: false
    frozen: true
    observable: false
    p0: false
  - id: audioEngineV2
    file: src/audio/core/AudioEngineV2.ts
    layer: engine
    authority: true
    frozen: true
    observable: true
    p0: true
  - id: vocalMix
    file: src/audio/core/VocalMix.ts
    layer: routing
    authority: false
    frozen: true
    observable: true
    p0: false
  - id: microphoneManager
    file: src/audio/core/MicrophoneManager.ts
    layer: engine
    authority: false
    frozen: true
    observable: true
    p0: false
  - id: groupBuses
    file: src/audio/core/AudioEngineV2.ts
    layer: routing
    authority: false
    frozen: true
    observable: true
    p0: false
  - id: programCaptureBus
    file: src/audio/core/AudioEngineV2.ts
    layer: recording
    authority: false
    frozen: false
    observable: true
    p0: true
  - id: monitorMix
    file: js/monitor-mix.js
    layer: boundary
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
  - id: recordingStore
    file: src/stores/recording.store.ts
    layer: recording
    authority: false
    frozen: false
    observable: true
    p0: true
---

# AUDIO-PIPELINE — Как звук течёт

> Полная карта: загрузка стемов → audio graph → bus routing → 
> VocalMix → MonitorMix → Program Capture → Recording.
> N-stem architecture. P0 capture gap.

## Legend

🟢 Stable | 🟡 Active | 🔴 P0 | ⚠️ Seam | ❄️ Frozen | 🔵 Observable | 📦 Boundary

---

## Level 1 — Bird's Eye

### AUDIO GRAPH — Complete Signal Flow

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            STEM LOADING PIPELINE                                  │
│                                                                                   │
│  URL / ArrayBuffer                                                                │
│    ↓                                                                              │
│  AudioLoader.fetch() / Blob URL creation                                          │
│    ↓                                                                              │
│  StemPlayer.load()                                                                │
│    ├─ HTMLAudioElement (src = blob URL)                                           │
│    ├─ MediaElementSourceNode (ctx.createMediaElementSource)                       │
│    └─ GainNode (per-stem volume control)                                          │
│         ↓                                                                         │
│  sourceNode ──→ gainNode ──┬──→ VocalMix.merger (primary path)                   │
│                            ├──→ bus.gainNode (parallel tap)                      │
│                            ├──→ analyserNode (parallel tap — metering)           │
│                            └──→ [N/A — no direct output]                         │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                        INSTRUMENTAL (MASTER STEM) — SPECIAL PATH                  │
│                                                                                   │
│  audio ──→ sourceNode ──→ gainNode (clock tap, gain=1 ALWAYS)                   │
│                               ↓                                                  │
│                         masterVolumeGain (mute invariant A2.25)                 │
│                               ↓                                                  │
│                    ┌──────┴──────┬────────────┐                                  │
│                    ↓             ↓            ↓                                  │
│              master-bus    analyser    VocalMix.merger                           │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                        GROUP BUS ARCHITECTURE (4 buses)                          │
│                                                                                   │
│  master-bus:  instrumental (via masterVolumeGain)                                │
│  music-bus:   drums, bass, keys, guitar, other                                   │
│  vocal-bus:   vocals (lead), backing                                             │
│  fx-bus:      (reserved for future)                                              │
│                                                                                   │
│  INVARIANT: bus.gainNode.gain = 1.0 ALWAYS (unity summing point)                │
│  Volume control: stem.gainNode.gain = stemVol × busVol × (muted ? 0 : 1)        │
│                                                                                   │
│  Architecture:                                                                     │
│    stem.gainNode ───┬──→ VocalMix merger (primary — stereo separation)           │
│                     ├──→ bus.gainNode (parallel tap — program capture)           │
│                     └──→ analyserNode (parallel tap — VU meters)                 │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                        VOCALMIX STEREO ROUTING                                   │
│                                                                                   │
│  VocalMix ENABLED (V-Mix ON):                                                    │
│    Music stems ──→ merger (L+R both channels)                                    │
│    Vocals ───────→ merger (L only — left ear)                                    │
│    Microphone ───→ merger (R only — right ear)                                   │
│                                                                                   │
│  VocalMix DISABLED (standard):                                                   │
│    Music stems ──→ merger (L+R both)                                             │
│    Vocals ───────→ merger (L+R both)                                             │
│    Microphone ───→ merger (L+R both)                                             │
│                                                                                   │
│  Merger (ChannelMergerNode 2ch) ──→ ctx.destination (speakers/headphones)        │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                        PROGRAM CAPTURE BUS (Recording)                           │
│                                                                                   │
│  master-bus.gainNode ──┐                                                         │
│  music-bus.gainNode ───┼──→ _programCaptureDest (MediaStreamDestination)        │
│  vocal-bus.gainNode ───┤        ↓                                                 │
│  fx-bus.gainNode ──────┘        MediaStream → MediaRecorder → .webm download     │
│                                                                                   │
│  External sources:                                                                │
│    attachProgramSource(node, {kind}) ──→ _programCaptureDest                     │
│    (preview audio, exercise cues, compare)                                        │
│                                                                                   │
│  Microphone:                                                                      │
│    setCaptureMicEnabled(true) ──→ mic.gainNode → _programCaptureDest             │
│                                                                                   │
│  🔴 P0 GAP: Preview audio (instrumental + vocals) NOT in capture by default      │
│     recording.store.ts calls ae.getProgramCaptureStream() but preview audio       │
│     is NOT connected via attachProgramSource().                                   │
│     Expected: ae.captureStream() + microphoneGain + streamDestination             │
│     Actual: Only bus gainNodes + mic (if enabled)                                 │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                        MONITORMIX (Legacy Boundary) 📦                          │
│                                                                                   │
│  js/monitor-mix.js (55KB) — SEPARATE audio graph, NOT part of AudioEngineV2      │
│                                                                                   │
│  Mic ──→ DelayNode ──→ monitorGain ──→ dest (MediaStreamDestination)            │
│                                      ──→ <audio> (sinkId = BT speaker)          │
│                                                                                   │
│  Music tap: instrumentalGain ──→ musicGain ──→ dest                              │
│                                                                                   │
│  Vocal reinforcement: vocalsSourceNode ──→ vocalToMainGain ──→ mainDest          │
│                                      ──→ <audio> (sinkId = main output)          │
│                                                                                   │
│  Purpose: Monitor latency compensation, separate output device routing           │
│  Status: 🟡 Active (used for live performance scenarios)                         │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Level 2 — Wire Table

### Секция A: Stem Lifecycle (загрузка → воспроизведение → утилизация)

| Phase | Action | Component | Status |
|-------|--------|-----------|--------|
| 1. Fetch | `AudioLoader.loadAudio(url)` — fetch with retry (3 attempts, 30s timeout) | AudioLoader.ts | 🟢 |
| 2. Decode | `ctx.decodeAudioData(arrayBuffer)` — skipped for music stems (skipDecode=true) | AudioLoader.ts | 🟢 |
| 3. Blob URL | `URL.createObjectURL(Blob([arrayBuffer]))` — clean URL, no blob:null | AudioLoader.ts | 🟢 |
| 4. Audio Element | `new Audio()` — crossOrigin, preload, playsInline, preservesPitch | StemPlayer.ts | 🟢 |
| 5. Source Node | `ctx.createMediaElementSource(audio)` — ONE per audio element | StemPlayer.ts | 🟢 |
| 6. Gain Node | `ctx.createGain()` — per-stem volume, created in constructor | StemPlayer.ts | 🟢 |
| 7. Connect | `sourceNode.connect(gainNode)` — internal StemPlayer wiring | StemPlayer.ts | 🟢 |
| 8. Route | `_rebuildFullRouting()` or `_addStemToRouting()` — bus + merger + analyser | AudioEngineV2.ts | 🟢 |
| 9. Play | `stem.play()` — await audio.play(), error suppression for followers | AudioEngineV2.ts | 🟢 |
| 10. Dispose | `stem.dispose()` — revoke blob URL, disconnect, null refs | StemPlayer.ts | 🟢 |

### Секция B: Audio Graph Connections (AudioNode → AudioNode)

| From Node | To Node | Type | Purpose | Status |
|-----------|---------|------|---------|--------|
| `MediaElementSourceNode` | `StemPlayer.gainNode` | Internal | Per-stem signal entry | 🟢 |
| `StemPlayer.gainNode` | `VocalMix.merger` | Primary | Stereo routing to speakers | 🟢 |
| `StemPlayer.gainNode` | `bus.gainNode` | Parallel tap | Bus summing for program capture | 🟢 |
| `StemPlayer.gainNode` | `AnalyserNode` | Parallel tap | VU metering (read-only) | 🟢 |
| `instStem.gainNode` | `_masterVolumeGain` | Internal | Clock tap (gain=1 ALWAYS) | ❄️ |
| `_masterVolumeGain` | `master-bus.gainNode` | Parallel tap | Instrumental bus summing | ❄️ |
| `_masterVolumeGain` | `AnalyserNode` | Parallel tap | Instrumental metering | ❄️ |
| `_masterVolumeGain` | `VocalMix.merger` | Primary | Instrumental to speakers | 🟢 |
| `VocalMix.merger` | `ctx.destination` | Output | Final audio output | 🟢 |
| `bus.gainNode` (×4) | `_programCaptureDest` | Recording | Program capture bus | 🟢 |
| `MicrophoneManager.gainNode` | `_programCaptureDest` | Recording | Mic in recording (conditional) | 🟢 |
| `MicrophoneManager._sourceNode` | `MicrophoneManager.gainNode` | Internal | Mic volume control | 🟢 |
| `monitor-mix: micSource` | `delayNode` | Legacy | Monitor latency compensation | 🟡 |
| `monitor-mix: delayNode` | `monitorGain` | Legacy | Monitor mix level | 🟡 |
| `monitor-mix: monitorGain` | `dest (MSD)` | Legacy | BT speaker output | 🟡 |

### Секция C: Bus Architecture (4 bus GainNodes)

| Bus | Stems | Volume Formula | Program Capture | Status |
|-----|-------|----------------|-----------------|--------|
| `master-bus` | instrumental (via masterVolumeGain) | `instVol × masterBusVol × mute` | ✅ Yes (bus.gainNode → capture) | ❄️ |
| `music-bus` | drums, bass, keys, guitar, other | `stemVol × musicBusVol × mute` | ✅ Yes (bus.gainNode → capture) | 🟢 |
| `vocal-bus` | vocals (lead), backing | `stemVol × vocalBusVol × mute` | ✅ Yes (bus.gainNode → capture) | 🟢 |
| `fx-bus` | (reserved) | `stemVol × fxBusVol × mute` | ✅ Yes (if stems present) | ⚠️ Unused |

**Key Invariants:**
- ❄️ `bus.gainNode.gain = 1.0` ALWAYS — summing point, NOT gain stage
- ❄️ Effective gain applied at `stem.gainNode.gain` (or `masterVolumeGain` for instrumental)
- Formula: `effectiveGain = stemVolume × busVolume × (muted ? 0 : 1)`
- Solo logic: `effectiveMute = isMuted || (anySoloed && !isSoloed)`

### Секция D: VocalMix Routing

| Mode | Vocals | Mic | Music | Output | Status |
|------|--------|-----|-------|--------|--------|
| **V-Mix ON** | L only | R only | L+R both | Merger → destination | 🟢 |
| **V-Mix OFF** | L+R both | L+R both | L+R both | Merger → destination | 🟢 |
| **No vocals** | N/A | L+R both | L+R both | Merger → destination | 🟢 |
| **No mic** | L/L+R | N/A | L+R both | Merger → destination | 🟢 |

### Секция E: MonitorMix (Legacy)

| Method | Purpose | Status |
|--------|---------|--------|
| `enable()` | Mic → delay → monitorGain → dest (BT speaker) | 🟡 Active |
| `_connectMusicTap()` | instrumentalGain → musicGain → dest (music in monitor) | 🟡 Active |
| `_connectVocalToMain()` | vocalsSourceNode → vocalToMainGain → mainDest (vocal reinforcement) | 🟡 Active |
| `_updateAutoVocalGainForLine()` | Auto-mix vocal level per block type (verse/chorus/etc) | 🟡 Active |
| `testPulse()` | Pulse to both dest + mainDest for latency testing | 🟡 Active |
| `beginPulseCalibration()` | Precise AudioContext-scheduled pulse loop for sync calibration | 🟡 Active |
| `_setupRouting()` | Split instrumentalGain → defaultBranchGain + mainBranchGain | 🟡 Active |

### Секция F: Recording Capture

| Source | Captured? | P0? | Status |
|--------|-----------|-----|--------|
| `master-bus.gainNode` | ✅ Yes | No | 🟢 Connected via `_reconnectProgramBus()` |
| `music-bus.gainNode` | ✅ Yes | No | 🟢 Connected via `_reconnectProgramBus()` |
| `vocal-bus.gainNode` | ✅ Yes | No | 🟢 Connected via `_reconnectProgramBus()` |
| `fx-bus.gainNode` | ✅ Yes (if stems) | No | ⚠️ Unused but connected |
| `MicrophoneManager.gainNode` | ✅ Yes (if `setCaptureMicEnabled(true)`) | No | 🟢 Conditional |
| **Preview audio** (external AudioElement) | ❌ **NO** | 🔴 **YES** | 🔴 **P0 GAP** |
| **Compare audio** (external AudioElement) | ❌ **NO** | 🔴 | ⚠️ Not attached |
| **Exercise cue audio** | ❓ Maybe | ⚠️ | ⚠️ Needs `attachProgramSource()` |

**🔴 P0-RECORDING-CAPTURE Detail:**
```
recording.store.ts calls:
  const audioStream = ae.getProgramCaptureStream();
  
What's in audioStream:
  ✅ Bus gainNodes (master, music, vocal, fx)
  ✅ Microphone (if setCaptureMicEnabled(true))
  
What's MISSING:
  ❌ Preview audio (external <audio> element for playback reference)
  ❌ Compare audio (external <audio> element for A/B comparison)
  
Expected (from docs):
  ae.captureStream() + microphoneGain + streamDestination
  
Actual:
  Only buses + mic — preview audio not connected to Program Capture Bus
```

---

## Level 3 — Deep Dive

### 1. StemPlayer — Full Lifecycle

**File:** `src/audio/core/StemPlayer.ts`

```
Constructor:
  this.gainNode = ctx.createGain()

load(url):
  1. dispose() — clean previous state
  2. AudioLoader.loadAudio(url, signal, skipDecode)
     ├─ fetch with retry (3 attempts)
     ├─ decodeAudioData (if !skipDecode)
     └─ URL.createObjectURL(Blob) — clean blob URL
  3. new Audio() — HTMLAudioElement
     ├─ crossOrigin = 'anonymous'
     ├─ preload = 'auto'
     ├─ playsInline = true
     ├─ preservesPitch = true (all vendor prefixes)
     └─ src = cleanBlobUrl
  4. await 'loadedmetadata' event
  5. sourceNode = ctx.createMediaElementSource(audio)
  6. sourceNode.connect(gainNode)
  7. _loaded = true

play():
  await audio.play()

pause():
  audio.pause()

stop():
  audio.pause()
  audio.currentTime = 0

dispose():
  sourceNode.disconnect()
  gainNode.disconnect()
  audio.pause()
  audio.removeAttribute('src')
  audio.load()
  URL.revokeObjectURL(cleanBlobUrl)
  null all refs
```

**Key Design:**
- ❄️ `sourceNode.disconnect()` ONLY in `dispose()` — forbidden elsewhere (OI-1)
- ❄️ `gainNode.disconnect()` allowed in `disconnect()` — for routing changes
- ❄️ `skipDecode=true` for music stems — saves 3.5s decode time (TC-DEC-01)
- 🔵 `cleanBlobUrl` public accessor — replaces `(stem as any)` casts (★10)

### 2. AudioEngineV2 — Routing Methods

**File:** `src/audio/core/AudioEngineV2.ts`

#### `_rebuildFullRouting()` — Full rebuild (loadTrack only)

```
1. Disconnect old bus gainNodes
2. Create 4 fresh bus gainNodes (gain=1.0)
3. For each stem:
   a. Disconnect from current destination
      - instrumental: disconnect masterVolumeGain downstream only
      - others: stem.disconnect() (gainNode only)
   b. Determine bus via ROLE_ROUTING[role]
   c. Add to bus.stemIds
   d. Init _stemVolumes[id] = 1 (if undefined)
   e. Collect gainNodes by bus (masterGains, musicGains, vocalGains, fxGains)
4. VocalMix.updateRouting(allMusicGains, mainVocalGain, micGain, destination)
5. Connect additional vocal-bus stems to merger
6. Connect fx-bus stems to ctx.destination
7. _reconnectBusTaps() — parallel taps to bus gainNodes
8. _reconnectAnalysers() — parallel taps for metering
9. _applyEffectiveGain() for each stem
10. _reconnectProgramBus() — bus gainNodes → program capture
```

#### `_reconnectBusTaps()` — Parallel bus connections

```
For each stem:
  instrumental: masterVolumeGain.connect(bus.gainNode)
  others: stem.gainNode.connect(bus.gainNode)
```

**CRITICAL:** Called AFTER `VocalMix.updateRouting()` because that method calls `gainNode.disconnect()` which kills ALL outputs.

#### `_reconnectProgramBus()` — Recording capture

```
1. Disconnect ALL current sources from program capture:
   - vocalMix.merger.disconnect(dest)
   - stem.gainNode.disconnect(dest) for each stem
   - masterVolumeGain.disconnect(dest)
   - bus.gainNode.disconnect(dest) for each bus
2. Connect bus gainNodes to program capture:
   - bus.gainNode.connect(dest) for each bus with stems
3. Connect external program sources:
   - node.connect(dest) for each in _programSources
4. Connect microphone if capture-enabled:
   - mic.gainNode.connect(dest) if _micCaptureEnabled
```

### 3. Effective Gain Formula

**File:** `src/audio/core/AudioEngineV2.ts` — `_applyEffectiveGain()`

```typescript
const anySoloed = Object.values(this._stemSolos).some(s => s);
const isSoloed = this._stemSolos[stemId] === true;
const isMuted = this._stemMutes[stemId] === true;
const effectiveMute = isMuted || (anySoloed && !isSoloed);

const stemVolume = this._stemVolumes[stemId] ?? 1;
const role = this._stemRoles[stemId];
const busId: RoutingTarget = role ? ROLE_ROUTING[role] : 'music-bus';
const busVolume = this._busVolumes[busId] ?? 1;
const effectiveGain = effectiveMute ? 0 : stemVolume * busVolume;

if (stemId === 'instrumental') {
  this._masterVolumeGain.gain.value = effectiveGain;  // NOT gainNode (clock invariant)
} else {
  stem.gainNode.gain.value = effectiveGain;
}
```

### 4. N-Stem Loading Sequence

**File:** `src/audio/core/AudioEngineV2.ts` — `loadTrack()`

```
1. Increment _loadGeneration (abort previous loads)
2. Reset state: stems, buses, analysers, volumes, roles
3. Register URLs + roles: instrumental, vocals, additionalStems
4. Load instrumental FIRST (master clock — serial)
   └─ skipDecode=true (waveform decodes lazily)
5. Create _masterVolumeGain (gain=1)
6. Connect: instStem.gainNode → masterVolumeGain

NON-PROGRESSIVE PATH:
  7a. Load all other stems in parallel (Promise.allSettled)
  7b. _rebuildFullRouting()
  7c. _reconnectProgramBus()
  7d. setPlaybackRate for all stems
  7e. _notifyTrackLoaded()

PROGRESSIVE PATH:
  7a. _rebuildFullRouting() (instrumental only — safe)
  7b. _notifyTrackLoaded(['instrumental'])
  7c. Fire-and-forget _runPhase2()
      ├─ Load vocals + additional stems in background
      ├─ Hot-plug each stem when ready:
      │  ├─ _addStemToRouting()
      │  ├─ setCurrentTime(instTime)
      │  ├─ setPlaybackRate(currentRate)
      │  ├─ Anti-pop fade-in (50ms)
      │  └─ Notify awaitStemReady resolvers
      └─ Emit track-fully-loaded
```

### 5. Program Capture Bus — Registration

**File:** `src/audio/core/AudioEngineV2.ts` — `attachProgramSource()`

```typescript
attachProgramSource(node: AudioNode, opts: { kind: string }): void {
  if (this._programSources.has(node)) return; // dedup
  
  if (!this._programCaptureDest) {
    this.getProgramCaptureStream(); // auto-create
  }
  
  node.connect(this._programCaptureDest);
  this._programSources.set(node, opts);
}
```

**Usage (expected but NOT implemented):**
```typescript
// Preview audio should be connected like this:
ae.attachProgramSource(previewAudioGainNode, { kind: 'preview' });

// Currently: preview audio plays separately, NOT captured
```

### 6. Recording Store — Capture Flow

**File:** `src/stores/recording.store.ts`

```
startRecording():
  1. getDisplayMedia({ video: true, audio: false })
  2. ae.audioContext.resume() (if suspended)
  3. audioStream = ae.getProgramCaptureStream()
  4. ae.enableMicrophone() (if not enabled)
  5. ae.setCaptureMicEnabled(true)
  6. Combine: displayStream video tracks + audioStream audio tracks
  7. MediaRecorder(combined, { vp8, opus })
  8. mediaRecorder.start()
  9. onstop: Blob → download as beLive-recording-TIMESTAMP.webm

stopRecording():
  1. ae.setCaptureMicEnabled(false)
  2. mediaRecorder.stop()
  3. displayStream tracks stopped
  4. timer cleared
```

**🔴 GAP:** Step 3 gets bus gainNodes + mic, but NOT preview audio.

---

## 🔵 Observability Points

| Node | What to observe | How | Priority |
|------|----------------|-----|----------|
| `StemPlayer.audio` | loaded metadata, duration, currentTime | `audio.duration`, `audio.currentTime` | 🟢 High |
| `StemPlayer.gainNode` | volume, mute state | `gainNode.gain.value` | 🟢 High |
| `AnalyserNode` | RMS level for VU meters | `getFloatTimeDomainData()` → RMS calc | 🟢 High |
| `bus.gainNode` | bus volume, stem count | `bus.stemIds.size`, `bus.gainNode.gain.value` | 🟡 Medium |
| `_programCaptureDest` | connected sources | `_programSources.size`, `_micCaptureEnabled` | 🔴 **P0** |
| `VocalMix.merger` | enabled/disabled | `vocalMix.enabled` | 🟡 Medium |
| `MicrophoneManager.stream` | enabled, volume | `mic.enabled`, `mic.volume` | 🟡 Medium |
| `MonitorMix` | delayMs, compensateOn, routeMainEnabled | `monitorMix.getState()` | 🟡 Medium |

---

## 🔗 Cross-References

| Document | Relationship |
|----------|--------------|
| `docs/architecture/n-stem-architecture.md` | N-stem roles, routing, ZIP classification, mode policies |
| `docs/architecture/audio-engine.md` | Transport authority, ownership map, runtime flows |
| `docs/reference/P0-RECORDING-CAPTURE.md` | P0 gap details — preview audio not captured |
| `docs/architecture/monitor-mix-v2.md` | MonitorMix latency compensation, separate output routing |
| `docs/reference/P0-TEMPO-RATE.md` | Tempo rate application in listen steps |
| `docs/architecture/marker-system-spec.md` | Marker system (M1/M2) — affects loop boundaries |

---

## 📊 Architecture Summary

### Signal Path Count

| Path | AudioNodes | Connections | Status |
|------|-----------|-------------|--------|
| **Stem playback** | sourceNode → gainNode → merger → destination | 3 per stem | 🟢 |
| **Bus summing** | gainNode → bus.gainNode (parallel) | 1 per stem | 🟢 |
| **Metering** | gainNode → analyser (parallel, no output) | 1 per stem | 🟢 |
| **Program capture** | bus.gainNode → _programCaptureDest | 4 buses | 🟢 |
| **V-Mix stereo** | merger (2ch) → destination | 1 | 🟢 |
| **Monitor mix** | mic → delay → monitorGain → dest | 3-5 | 🟡 |
| **Recording** | displayMedia + programCapture → MediaRecorder | 2 streams | 🔴 P0 gap |

### Invariant Checklist

- [x] ❄️ `bus.gainNode.gain = 1.0` ALWAYS
- [x] ❄️ Instrumental `gainNode.gain = 1.0` ALWAYS (clock tap)
- [x] ❄️ Instrumental mute via `masterVolumeGain`, NOT `audio.pause()`
- [x] ❄️ AnalyserNodes are parallel taps (NOT in signal path)
- [x] ❄️ Program Capture reads from buses, NOT VocalMix merger
- [x] ❄️ `sourceNode.disconnect()` ONLY in `dispose()`
- [x] 🔴 Preview audio NOT in Program Capture (P0 gap)

---

*Generated: 2026-04-27 | Schema: AUDIO-PIPELINE v1.0*
*Owner: beLive Audio Team | Status: Living document*
