# Архитектурная Карта beLive 2.2

**Status:** Master Architecture Map — Complete (merged v2.1 + v2.2 delta)
**Version:** 2.2
**Date:** 2026-06-10
**Authors:** Architecture Team (Centre 1.3 + Agent 007)
**Based on:** Code-verified recon, live repo state, pipeline docs, v2.2 delta merge

---

## How to Read This Document

| Badge | Meaning |
|-------|---------|
| ✅ | Confirmed by code scan |
| ❄️ | Frozen architectural decision — do not reopen |
| ⚠️ | Open seam — known issue, not yet resolved |
| 🧭 | Strategic direction — accepted but not fully implemented |
| 🕰️ | Historical context — explains why, not current truth |
| 🚫 | No-go zone — do not touch without explicit decision |

**Rule:** If a statement has no badge, treat it as architectural interpretation based on confirmed evidence.

---

# §1. System Statement (5-minute read)

**beLive 2.1** is a hybrid PWA for vocalists. It shows synchronized lyrics in real-time during rehearsal, karaoke, concert, and live performance modes.

**Tech stack:** React 19 + TypeScript 5.9 + Vite 4 + Zustand 5 + Web Audio API + PWA (Workbox)

**Current phase:** Contract hardening + productization. NOT migration rescue.

### Core truths

- ✅ React/TS owns product runtime (190+ TS/TSX files, 27 Zustand stores)
- ✅ Legacy JS remains as 5 compact boundary shells, not business logic centers
- ❄️ Markers remain canonical line-sync backbone
- ❄️ Word sync is additive overlay, never replaces line backbone
- ✅ Trigger/reactive word layer already live in runtime (not future)
- ✅ Visual word consumers already live in runtime (WordHighlightLine, word-effects.css, RehearsalLyrics, KaraokeLyricsBoard, LiveSubtitle) — NOT future-only
- ✅ Performance domain already live as first-class policy layer
- ✅ Prepared catalog pipeline exists as operational external tooling
- ✅ Takes practice surface evolving as canvas-first first-pass practice scene (top control grammar, centered hero trio, unified Solo button)
- ✅ Standard visible take-sync core substantially stabilized (trim clipping seam removed, TC-TSYNC-406)
- ✅ Default learner-facing practice surface remains intentionally minimal (stable-2 recipes only)
- ⚠️ Main risks are contract inconsistencies, not missing architecture

### What this system is NOT

- Not a legacy rescue project
- Not a frontend-only app (has offline batch pipeline)
- Not dependent on real-time backend for core sync (prepared catalog viable)
- Not a single-authority system (intentional split models exist)

---

# §2. Full Lifecycle: Raw Track → Glowing Word

```
═══════════════════════════════════════════════════════════
CONTOUR A: Manual Line-Sync (Legacy Foundation, Still Active)
═══════════════════════════════════════════════════════════

User uploads:
  instrumental.mp3 + vocals.mp3 + lyrics.rtf/.txt
       │
       ▼
  Block Editor → assigns blocks (verse=green, chorus=red, etc.)
       │         → creates TrackMap color structure
       ▼
  Sync Editor → manual marker placement on waveform
       │         → key "1" places marker at current time
       │         → markers inherit block colors
       │         → dual waveform: vocals (red) over instrumental (blue)
       │         → V-I-M toggle for visibility
       ▼
  Save → export.json (markers + structure)
       │
       ▼
  ZIP bundle: instrumental + vocals + lyrics + export.json
       │
       ▼
  Import ZIP → system auto-distributes → track appears in catalog

═══════════════════════════════════════════════════════════
CONTOUR B: Batch Word-Sync Pipeline (Additive)
═══════════════════════════════════════════════════════════

Bank_beLive/{Artist}/{Track}/
  vocals.mp3 + lyrics.rtf + export.json
       │
       ▼
┌─── Step 1: prepare_batch.sh (Local) ───┐
│  RTF→TXT, BOM fix, lang detect,        │
│  slugify, benchmark.json, manifest      │
└──────────────┬──────────────────────────┘
               ▼
┌─── Step 2: Kaggle MMS Alignment (Cloud) ┐
│  Meta MMS forced alignment model         │
│  ~25 min/track, resumable batch          │
│  Raw alignment.json output               │
└──────────────┬──────────────────────────┘
               ▼
┌─── Step 3: fix_artifacts.js (Local) ────┐
│  lineMapping enrichment                  │
│  word IDs, indices, confidence           │
│  Frozen artifact contract                │
│  → research/artifacts/                   │
└──────────────┬──────────────────────────┘
               ▼
┌─── Step 4: mock-align-server.mjs (Dev) ─┐
│  Port 8787, 3-level hash matching        │
│  L1: exact, L2: alias, L3: variant(9) — TODO Wave 5: precompute cache   │
│  Auto-save aliases on match              │
└──────────────┬──────────────────────────┘
               ▼
═══════════════════════════════════════════════════════════
CONTOUR C: App Runtime (Where A + B Meet)
═══════════════════════════════════════════════════════════

  Track load orchestrator
       │
       ├─→ Markers applied (from Contour A)
       ├─→ Word-sync hydrated (from Contour B artifacts)
       │
       ▼
  AudioEngineV2 transport
       │
       ▼
  Marker-driven active line
       │
       ▼
  wordSync.store → fill/cue selectors
       │
       ▼
  TriggerEngine → WordLineDetector (60Hz)
       │
       ▼
  TriggerBridge → CSS vars per frame
       │     --bl-word-active (0|1)
       │     --bl-word-progress (0.000–1.000)
       │     --bl-line-active (0|1)
       ▼
  WordHighlightLine → Visual FX
       │     progress / underline / neon / bounce
       ▼
  Mode renderers (Rehearsal / Karaoke / Concert / Live)
```

---

# §3. Runtime Ownership Matrix

| Domain | Runtime Authority | Mirrors/Consumers | Key Files | Status |
|--------|------------------|-------------------|-----------|--------|
| Audio transport | ✅ `AudioEngineV2` | `audio.store`, bridges | `AudioEngineV2.ts`, `patchV1.ts` | ❄️ Frozen |
| Volume authority | ⚠️ W4a migration: `instrumentalVolume` and `vocalsVolume` removed from `audio.store`. All per-stem volumes now in `useStemStore.stemVolumes`. The 2-stem volume model is DEPRECATED in code. See `n-stem-architecture.md` for current volume authority. |
| Master clock | ✅ Instrumental stem | All time consumers | `AudioEngineV2.ts:371-373` | ❄️ Frozen |
| Track load | ✅ `track.orchestrator` | `track.actions` entry | `track.orchestrator.ts` | ❄️ Frozen |
| Track runtime container | ✅ `window.trackCatalog` | `track.store` mirror | `track-catalog.js` | ⚠️ Hybrid |
| Persistence | ✅ `idb.service` | orchestrator, bridges | `idb.service.ts` | ✅ Separate |
| Active line | ✅ Markers + `lyrics.bridge` | `lyrics.store`, UI | `lyrics.bridge.ts` | ❄️ Frozen |
| Word timing data | ✅ `wordSync.store` | triggers, renderers | `wordSync.store.ts` | ❄️ Frozen |
| TrackMap loop intent | ✅ `loop.store` | bridge propagates | `loop.store.ts` | ❄️ Frozen |
| TrackMap loop execution | ✅ Engine via `loop.bridge` | — | `loop.bridge.ts` | ❄️ Frozen |
| Sync Editor loop | ✅ `WaveformCanvas` local | Direct engine calls | `WaveformCanvas.tsx` | ❄️ Separate |
| Mode commands | ✅ `mode-switch.bridge` | — | `mode-switch.bridge.ts` | ✅ Command path |
| Mode observation | ✅ `mode.bridge` | `mode.store` | `mode.bridge.ts` | ✅ Observer path |
| Style intent | ✅ `textStyle.store` | renderers, bridge | `textStyle.store.ts` | ✅ Creative |
| Performance budget | ✅ `performance.store` | bridge, hooks, CSS | `performance.store.ts` | ✅ Independent |
| Trigger signals | ✅ `trigger.engine` + `bridge` | `trigger.store`, CSS | `trigger.bridge.ts` | ✅ Live |
| Word rendering | ✅ `WordHighlightLine` | Mode surfaces | `WordHighlightLine.tsx` | ✅ Reusable |
| Alignment provider | ✅ `gateway-align.provider` | SyncEditorPanel | `gateway-align.provider.ts` | ✅ Thin |
| Cache verdict | ✅ `alignment-cache.service` | hydration flow | `alignment-cache.service.ts` | ✅ Working |
| Cover art blob | `idb.service` coverArtBlob | track.bridge (Object URL), upload.service (ZIP) | `idb.service.ts` | ✅ Offline-ready |
| LRC version selection | `SyncEditorPanel` handleLrcVersionSelect | auto-lyrics.service, lyricsDisplay | `SyncEditorPanel.tsx` | ✅ Guarded |
| lyricsOriginalContent | IDB + ZIP export.json | LRC Picker (geniusText source) | multiple | ✅ Roundtrip |

---

# §4. Project Tree (Semantic)

```
src/
├── main.tsx                    ← Hybrid boot: React mount + legacy compat station
├── App.tsx                     ← Runtime bridge init + mode-based rendering
│
├── audio/
│   ├── core/
│   │   ├── AudioEngineV2.ts    ← Transport authority (591 lines)
│   │   ├── StemPlayer.ts       ← One stem = audio + graph + transport
│   │   ├── AudioLoader.ts      ← Fetch + decode + blob URL + retry
│   │   ├── VocalMix.ts         ← Stereo routing layer
│   │   ├── MicrophoneManager.ts← Mic capture + gain + stream
│   │   └── audioContext.ts     ← Singleton AudioContext
│   ├── compat/
│   │   └── patchV1.ts          ← Identity preservation: V1 object → V2 methods
│   ├── featureFlag.ts          ← tryActivateV2()
│
├── bridges/                    ← PERMANENT synchronization fabric (18+ files)
│   ├── audio.bridge.ts         ← State mirror + optimistic seek
│   ├── audio-reactive.bridge.ts← Frequency analysis → CSS vars
│   ├── blocks.bridge.ts        ← Legacy LD blocks → store mirror
│   ├── cover-theme.bridge.ts   ← Theme hydration from IDB
│   ├── live-guard.ts           ← Live mode protection
│   ├── loop.bridge.ts          ← Store → engine loop propagation
│   ├── lyrics.bridge.ts        ← Line sync + scheduler + reverse-sync
│   ├── markers.bridge.ts       ← MM subscribe → store mirror
│   ├── mode-switch.bridge.ts   ← Mode command path
│   ├── mode.bridge.ts          ← Mode observer + volume policy
│   ├── monitor.bridge.ts       ← Monitor mix integration
│   ├── textStyle.bridge.ts     ← Font/transition → legacy DOM
│   ├── time-sync.ts            ← 10Hz currentTime polling
│   └── track.bridge.ts         ← IDB meta → store mirror
│   ├── plate.bridge.ts         ← Plate (плашка) state bridge
│   ├── stem-reactive.bridge.ts ← Visual mixer reactive pipeline (CSS vars per stem)
│   ├── takes.bridge.ts         ← Takes system bridge
│   ├── exercise.bridge.ts      ← Exercise runtime bridge
│
├── services/
│   ├── track.orchestrator.ts   ← Central 21-step track load pipeline
│   ├── track.actions.ts        ← Public entry: loadTrack()
│   ├── idb.service.ts          ← IndexedDB CRUD authority
│   ├── lyrics.service.ts       ← LD slim method patches
│   ├── marker.service.ts       ← Marker domain helpers
│   ├── parsing.service.ts      ← RTF/text parsing
│   ├── upload.service.ts       ← Track import/upload
│   ├── upload.actions.ts       ← Upload UI actions
│   └── cover-art.service.ts    ← Cover art fetch + blob persist + theme extraction
│
├── stores/                     ← 27 Zustand stores
│   ├── audio.store.ts          ← Playback state mirror
│   ├── lyrics.store.ts         ← Lines + activeLineIndex
│   ├── markers.store.ts        ← Markers + sections
│   ├── blocks.store.ts         ← Block structure mirror
│   ├── track.store.ts          ← Track meta mirror
│   ├── loop.store.ts           ← TrackMap loop intent owner
│   ├── wordSync.store.ts       ← Word timing data + selectors
│   ├── mode.store.ts           ← Current mode mirror
│   ├── textStyle.store.ts      ← Creative style intent
│   ├── recording.store.ts      ← Recording feature state
│   ├── deck.store.ts           ← Control deck UI state
│   ├── ui.store.ts             ← General UI state
│   ├── camera.store.ts         ← Camera state
│   ├── monitor.store.ts        ← Monitor mix state
│   ├── piano.store.ts          ← Piano overlay state
│   ├── pitch.store.ts          ← Pitch detection state
│   └── ai.store.ts             ← AI chat state
│
├── sync/
│   ├── bridge/
│   │   └── sync.bridge.ts      ← WaveformEditor stub intercept
│   ├── components/
│   │   ├── SyncEditorPanel.tsx  ← Editor controls + align trigger
│   │   ├── SyncLyrics.tsx       ← Editor display (cue-truth path)
│   │   └── WaveformCanvas.tsx   ← Waveform + seek + local loop
│   ├── store/
│   │   └── sync.store.ts       ← Editor UI state
│   ├── word-sync/
│   │   ├── line-map.types.ts   ← LineMapEntry, LineKind
│   │   ├── line-map.builder.ts ← Build lineMap from lyrics
│   │   ├── types.ts            ← AlignmentData, WordTiming
│   │   ├── hash.ts             ← FNV-1a 32-bit
│   │   ├── confidence.ts       ← Threshold constants
│   │   ├── tokenizer.ts        ← Word tokenization
│   │   ├── config.ts           ← Sync config
│   │   ├── providers/
│   │   │   ├── base.ts         ← Provider interface
│   │   │   └── gateway-align.provider.ts ← Frontend provider
│   │   └── services/
│   │       ├── ai-lyrics-sync.service.ts ← Hydration orchestration
│   │       ├── alignment-cache.service.ts← Cache verdict
│   │       ├── alignment-request.builder.ts ← Request assembly
│   │       └── lyrics-align.service.ts   ← Provider facade
│   └── canvas/                  ← Waveform drawing utilities
│
├── triggers/
│   ├── trigger.types.ts         ← TriggerEvent types
│   ├── trigger.bus.ts           ← Sync pub/sub bus
│   ├── trigger.engine.ts        ← Detector orchestrator
│   ├── trigger.store.ts         ← Snapshot store (not hot path)
│   ├── trigger.bridge.ts        ← rAF loop + CSS vars + scheduler owner
│   ├── detectors/
│   │   └── word-line.detector.ts← Word/line timing events
│   ├── WordHighlightLine.tsx    ← Reusable word renderer
│   ├── TriggerDebugOverlay.tsx  ← Debug UI (Ctrl+Shift+T)
│   ├── word-effects.css         ← Visual FX: progress/underline/neon/bounce
│   └── index.ts
│
├── performance/
│   ├── performance.types.ts     ← Tier types, budget shape
│   ├── performance.store.ts     ← Tier state + persistence
│   ├── performance.presets.ts   ← Tier budget definitions
│   ├── performance.detect.ts    ← Device capability detection
│   ├── performance.hooks.ts     ← usePerformanceTier, useVisualBudget, etc.
│   ├── performance.bridge.ts    ← DOM attrs + CSS vars publication
│   ├── performance.clamp.ts     ← Budget clamping utilities
│   └── performance.recording.ts ← Recording-safe capture profiles
│
├── playback/
│   ├── playback-visual-scheduler.ts ← Shared rAF coordinator
│   ├── playback-visual-runtime.ts   ← Runtime helpers
│   ├── playback-visual.types.ts     ← Frame context types
│   └── index.ts
│
├── theme/                       ← App chrome theme (NOT lyric style)
│   ├── store/theme-store.ts
│   ├── engine/css-injector.ts
│   ├── engine/resolver.ts
│   ├── engine/validator.ts
│   ├── components/ThemeProvider.tsx
│   ├── themes/                  ← Theme definitions
│   ├── tokens/                  ← Semantic/primitive/component tokens
│   └── types.ts
│
├── components/                  ← UI surfaces (NOT authorities)
│   ├── RehearsalLyrics.tsx      ← Main rehearsal word consumer
│   ├── KaraokeLyricsBoard.tsx   ← Karaoke word consumer
│   ├── LiveSubtitle.tsx         ← Live word consumer
│   ├── WagonTrain.tsx           ← TrackMap blocks + loop toggle
│   ├── TransportBar.tsx         ← Play/pause/seek controls
│   ├── ControlDeck.tsx          ← Bottom dock container
│   ├── StylesDeck.tsx           ← Lyric style console
│   ├── RecordingPanel.tsx       ← Recording UI
│   ├── VolumeControls.tsx       ← Volume sliders
│   ├── MonitorMixPanel.tsx      ← Monitor routing UI
│   ├── Header.tsx               ← Top bar
│   └── ...
│
├── catalog/                     ← Track catalog UI
├── blocks/                      ← Block editor
├── backgrounds/                 ← Mode background managers
├── runtime/visual/              ← CSS var batching utility
├── data/                        ← Text style presets
├── deck/                        ← Control deck module registry
├── hooks/                       ← Global hooks
├── styles/                      ← Style recipes
├── transitions/                 ← Concert transitions
├── types/                       ← Shared type definitions
├── utils/                       ← Utilities
│
└── js/                          ← Legacy JS in src (AI chat system)
    ├── ai/                      ← AI action executor + providers
    ├── ui/                      ← AI chat UI
    ├── utils/                   ← Performance monitor, scroll lock
    └── main.js                  ← Legacy JS entry

js/                              ← Legacy boundary shells
├── audio-engine.js              ← Boot stub: creates window.audioEngine
├── lyrics-display.js            ← Shell: window.lyricsDisplay identity
├── marker-manager.js            ← Shell: window.markerManager identity
├── track-catalog.js             ← Live runtime container + IDB boot
├── monitor-mix.js               ← Active audio routing boundary
└── worklets/
    └── recorder-processor.js    ← AudioWorklet (JS by design)
```

---

# §5. Boot and Boundary Model

### ✅ Dual-plane boot sequence

```
PLANE A — React (outside DOMContentLoaded)
  main.tsx → createRoot → React.Fragment (ThemeProvider + App as siblings)

> **INV-2.1-THEME:** ThemeProvider is SIDE-EFFECT ONLY — applies CSS vars to :root via useEffect. NO React Context. Components access theme via `var(--bl-*)` only.
  App.tsx useEffect → tryActivateV2() → all bridge inits

PLANE B — Legacy compat (inside DOMContentLoaded)
  main.tsx DOMContentLoaded → {
    window.app stub
    registerLiveModeStub()
    registerWaveformEditorStub()
    initBlocksBridge()
    installLiveGuard()
    initLoopBridge()
    initAudioReactiveBridge()
    initBlockEditorBridge()
    window.markerService = markerService
    patchLyricsDisplaySlimMethods()
    window.parsingService, idbService, rtfService, openCatalog
    markerManager method patches (15+ methods)
    AI Gateway setup
  }
```

**Consequence:** React can mount BEFORE legacy compat is complete. This explains all retry/polling/delayed patterns in bridges. This is NOT chaos — it is **hybrid staged boot architecture.**

### ✅ Boundary objects

| Global | File | Role | Patched By | Status |
|--------|------|------|-----------|--------|
| `window.audioEngine` | `audio-engine.js` | Boot stub → V2 identity shell | `patchV1.ts` | ❄️ Identity boundary |
| `window.lyricsDisplay` | `lyrics-display.js` | Field shell + state container | `lyrics.service.ts` via `main.tsx` | ❄️ Shell boundary |
| `window.markerManager` | `marker-manager.js` | Constructor + subscribers | `main.tsx` (15+ method patches) | ❄️ Shell boundary |
| `window.trackCatalog` | `track-catalog.js` | Live runtime container + IDB | — (still active) | ⚠️ Hybrid runtime |
| `window.monitorMix` | `monitor-mix.js` | Audio routing boundary | — (active product surface) | ⚠️ Supported boundary |
| `window.waveformEditor` | `waveform-editor.stub.ts` | Compat stub | `sync.bridge.ts` intercept | ✅ Compat shell |
| `window.liveMode` | `live-mode.stub.ts` | Placeholder | — | ✅ Placeholder |
| `window.app` | `main.tsx` | Compat host shell | — | ✅ Not authority |

**🚫 Do not remove boundary files for purity. They preserve identity contracts that surviving consumers depend on.**

---

# §6. Audio Architecture

### ✅ Boot patch chain

```
js/audio-engine.js:6-46 → creates window.audioEngine (stub)
  ↓
src/audio/featureFlag.ts:tryActivateV2()
  ↓
src/audio/compat/patchV1.ts:9-125
  → injects V1 AudioContext into singleton
  → creates AudioEngineV2
  → patches 30+ methods/properties onto SAME object
  → window.audioEngine identity PRESERVED, V2 authority INSTALLED
```

### ✅ AudioEngineV2 internals

| Component | Role |
|-----------|------|
| `stems: Map<string, StemPlayer>` | Audio assets |
| `vocalMix: VocalMix` | Stereo routing |
| `microphone: MicrophoneManager` | Mic capture |
| `_loadGeneration` | Stale load protection |
| `_transportGen` | Stale resume protection |
| `_loopActive/Start/End` | Engine-level loop |

### ✅ Transport hardening

- `_loadGeneration` increments on every load → stale loads abort
- `_transportGen` increments on play/pause/seek → stale resumes rejected
- `_lastSeekTime` prevents stale time reports
- `_softResyncTimer` cleared on every transport change
- Hard resync cooldown prevents runaway drift correction
- First-load block jump stutter resolved — transport seek/resume cycle stabilized

### ✅ StemPlayer = one audio asset

`fetch → decode → clean blob URL → HTMLAudioElement → MediaElementSourceNode → GainNode`

Preserves pitch via HTMLAudio flags. Disposes cleanly on reload.

### ✅ Master/follower model

- **Instrumental = master clock** (`getCurrentTime()` reads instrumental)
- **Vocals = follower** (resynced before play if drift > 0.01, hard resync during playback if drift > 0.04)

### ✅ Recording compat (resolved)

`recording.store.ts` expects:
- `ae.captureStream()` ✅ available
- `ae.microphoneGain` ✅ exposed via TC-003 (public getter in V2 + patchV1 compat)
- `ae.streamDestination` ✅ exposed via TC-003 (public getter in V2 + patchV1 compat)

Internal equivalents exist:
- `microphoneGain` → `v2.microphone.gainNode` (public property)
- `streamDestination` → `v2._streamDest` (private, created by captureStream)

**Status:** ❄️ Tactical expose done. Structural recording API deferred to later wave.

### ⚠️ MonitorMix compat gap

`monitor-mix.js` expects some engine surfaces not fully exposed:
- `vocalsSourceNode` — not confirmed as patchV1 surface
- `microphoneSource` — potentially seam

**Status:** Supported boundary, not fully seam-free.

---

## §6A. Cover Art Offline Pipeline

### Data model

| Field | Storage | Type | Purpose |
|-------|---------|------|---------|
| `coverArtUrl` | IDB + Store | string | HTTP URL (fallback + API reference) |
| `coverArtBlob` | IDB | Blob | Offline binary (TC-COVER-02) |
| `coverTheme` | IDB + Store | CoverArtTheme | Dominant colors for UI theming |

### Hydration chain

```
IDB coverArtBlob → URL.createObjectURL() → store → <img src="blob:...">
     (fallback) → IDB coverArtUrl (HTTP) → store → <img src="https://...">
     (no data)  → null → CoverArt placeholder (gradient + initial)
```

### Object URL lifecycle

Managed by `track.bridge.ts` via `_coverArtObjectUrls` Set. Revoked on: syncAll, catalog-cleared, bridge cleanup.

### ZIP roundtrip

- **Export:** cover.jpg file + HTTP URL in export.json (not internal reference)
- **Import:** cover.jpg → arraybuffer → Blob(correct MIME) → IDB
- **MIME type:** Explicit via `new Blob([ab], { type: isPng ? 'image/png' : 'image/jpeg' })`

### See also

Full ZIP pipeline documentation: `zip-pipeline.md`

---

## §6B. LRC Version Picker

### Purpose

The LRC Picker allows users to select different synced lyrics versions from lrclib, applying new markers, lyrics, and block structures to the current track.

### Key functions

| Function | File | Purpose |
|----------|------|---------|
| `fetchLrcVersions()` | auto-lyrics.service.ts | Fetch available LRC versions from lrclib |
| `parseLrcVersion()` | auto-lyrics.service.ts | Parse LRC → markers + lyricsLines + blocks |
| `handleLrcVersionSelect()` | SyncEditorPanel.tsx | Apply selected version to runtime + persist |
| `blockFirstLineSync()` | auto-lyrics.service.ts | Create blocks from [Verse]/[Chorus] tags |

### handleLrcVersionSelect flow

```
1. Get geniusText from legacyTrack.lyricsOriginalContent
2. parseLrcVersion(version, geniusText) → markers, lyricsLines, blocks
3. Determine blocksToApply:
   - IF result.blocks.length > 0 → use new blocks
   - ELSE → preserve existing ld.textBlocks (TC-LRC-03)
4. ld.loadImportedBlocks(blocksToApply, lyrics, true)
5. useLyricsStore.setState({ lines: [...ld.lyrics] })
6. mm.setMarkers(markers) + updateMarkerColors()
7. Persist to IDB: lyrics + lyricsOriginalContent + syncMarkers + blocksData
```

### Block preservation rule (TC-LRC-03)

`blocks=[]` from parser = "no blocks in this LRC format" (NOT "user deleted blocks").
Existing blocks are preserved because they are tied to the track, not the LRC version.

### lyricsOriginalContent chain

```
Genius API → lyricsOriginalContent (with [Verse]/[Chorus] tags)
  → IDB persist (TC-LRC-02)
  → ZIP export.json (TC-LRC-04)
  → ZIP import → IDB restore (TC-LRC-05)
  → LRC Picker reads → blockFirstLineSync() → blocks created
```

Without lyricsOriginalContent: parseLrcVersion returns blocks=[] → existing blocks destroyed → white markers.

### See also

- Full block-first sync algorithm: `block-first-lyrics-sync.md`
- Full ZIP pipeline: `zip-pipeline.md`

---

# §7. Track Load Pipeline

### ✅ Orchestrator: `track.orchestrator.ts` (21 steps)

```
 1. Cancel previous autoplay timer
 2. Get trackCatalog reference
 3. Validate bounds
 4. Save prev track id
 5. Set currentTrackIndex
 6. Dispatch 'before-track-change'
 7. Clear lyricsDisplay blocks + full reset
 8. Clear word sync layer
 9. Show loading overlay
10. Update waveformEditor refs (stub)
11. Parse lyrics / RTF if needed
12. Load blocks or reload lyrics into LD
13. Revoke previous blob URLs
14. Create fresh blob URLs from track bytes
15. await ae.loadTrack(iUrl, vUrl)
16. Set markers / reset markers + update colors
16a. Vocal Onset Correction (VOC) — L3 (multi-anchor, dataVersion=4) or L2 (linear, dataVersion=3). L3 currently falls back to L2 if insufficient anchors found. Group Drag available for manual correction.
17. prepareWordSyncLayer(...)  ← word-sync hydration
18. Delayed sanitize blocks
19. Optional autoplay (200ms delay)
20. Optional open sync editor
21. Hide overlay (finally)
```

### ✅ Keyboard track switching

`Shift+Arrow` → `queueTrackJump(delta)` → accumulates → 250ms debounce → `loadTrack(target, { autoplay: true, openSyncEditor: false })`

### ✅ Catalog play path

`CatalogLayout.play(index)` → `loadTrack` → `beLiveSwitchMode('rehearsal')` → close catalog

---

# §8. Sync Architecture

### ❄️ Two-layer timing model

```
Layer 1: Marker-driven line sync (backbone)
  ├── markers array
  ├── active line progression
  ├── block/section timing
  ├── loop/navigation anchors
  └── REMAINS CANONICAL

Layer 2: Word-sync additive overlay
  ├── lineMap (structural bridge: raw lines → alignable content)
  ├── alignmentData (per-line, per-word timings)
  ├── confidence-gated display
  ├── cache verdict (reject stale/mock data)
  └── NEVER REPLACES Layer 1
```

### ✅ Data model

**lineMap entry:**
```
{ rawLineIndex, kind, contentLineIndex, text, alignable }
```
- `lyric` → alignable
- `separator` → non-alignable
- `bracket` → non-alignable
- `non-lexical` → currently alignable

**alignmentData:** top-level with `source`, `version`, `trackId`, `language`, `lyricsHash`, `provider`, `lines[]`

**Each line:** `{ rawLineIndex, contentLineIndex, text, start, end, confidence, words[] }`

**Each word:** `{ id, text, start, end, confidence, rawLineIndex, contentLineIndex, wordIndex }`

### ❄️ Cue vs Fill split

| Selector | Purpose | Used By |
|----------|---------|---------|
| `getActiveWordForLine(raw, time)` | Early-feel highlight, lookahead + epsilon | SyncLyrics (editor) |
| `getFillWordForLine(raw, time)` | Exact progress timing, no lookahead | WordLineDetector (triggers) |

**This split is frozen. Do not collapse.**

### ✅ Hydration flow

```
Track load → prepareWordSyncLayer()
  → build lineMap
  → compute lyricsHash (FNV-1a 32-bit)
  → check cache verdict
  → if valid: hydrate store to 'ready'
  → if invalid: set status 'missing', await manual align
```

### ✅ Align execution flow

```
SyncEditorPanel 'Align' button
  → check lineMap, lyricsHash, audioSource present
  → block if degraded trusted source
  → build anchors from existing markers
  → build request (mode: 'anchored')
  → lyricsAlignService.align(request)
  → on success: store + persist alignmentData + lineMap into track
  → survives reload ✅
```

### ✅ Hash policy

- Normalize `\r\n` / `\r` → `\n`
- FNV-1a 32-bit → `fnv1a:xxxxxxxx`
- `displayLyrics` for rendering, `hashSourceLyrics` for cache truth
- ❄️ Mock provider data rejected as stale

### Confidence thresholds (temporary-frozen)

- `LOW_CONFIDENCE = 0.55`
- `HIGH_CONFIDENCE = 0.80`
- Low → no word highlight. Medium → repair candidate. High → safe display.

---

# §9. Reactive Runtime

### ✅ Runtime chain (already live)

```
AudioEngineV2 currentTime
  → marker-driven active line (lyrics.bridge + scheduler detector)
  → wordSync.store timing selectors
  → WordLineDetector (fill-truth)
  → TriggerEngine.tick()
  → TriggerBus (sync pub/sub)
  → TriggerBridge (rAF writer)
      → CSS vars: --bl-word-active, --bl-word-progress, --bl-line-active
      → trigger.store snapshot (throttled, not hot path)
  → WordHighlightLine consumer
  → Mode renderers: RehearsalLyrics, KaraokeLyricsBoard, LiveSubtitle
```

### ✅ PlaybackVisualScheduler

Shared coordinator for rAF-driven publication:
- **Readers** read runtime state
- **Detectors** compute deltas
- **Writers** publish outputs
- **Flush** batches CSS vars once per frame

Current participants:
- Trigger bridge (reader + detector + writer + **lifecycle owner**)
- Lyrics bridge (detector + writer)
- Audio-reactive bridge (detector + writer)

**⚠️ Hidden coupling:** Scheduler start/stop owned by `trigger.bridge` only. If trigger bridge doesn't start, all participants are dead.

**Fallback:** Lyrics bridge still has event-based path outside scheduler for non-playback line sync.

### ✅ WordHighlightLine behavior

- Word sync not ready → plain text
- Line has no usable word sync → plain text
- Otherwise: renders words with `data-word-fx`, `data-word-focus`, `data-block-type`, `data-word-state`
- Determines: active word, settled history, line role, block-aware color hooks
- Performance-aware trail resolution via `useResolvedTrailDepth()`

### ✅ Current word FX families

| FX | Type |
|----|------|
| `progress` | Fill-based, CSS-driven |
| `underline` | Low-noise rehearsal baseline |
| `neon` | Bright show emphasis |
| `bounce` | Lightweight motion accent |

### ✅ Word focus levels: `off` / `soft` / `strong`

When `focus = off`: line-first reading mode. Word FX bypassed, lines render as plain text.

### ✅ Visual consumers are live — NOT future

The following mode surfaces already use WordHighlightLine as their word renderer:
- RehearsalLyrics (primary product surface)
- KaraokeLyricsBoard
- LiveSubtitle

`word-effects.css` provides production-ready FX families. Pipeline prompt documents describing visual consumers as "next step" are historically accurate but no longer reflect current repo state.

---

# §10. Performance Domain

### ✅ Already real and integrated

| Component | Status |
|-----------|--------|
| `performance.store.ts` | ✅ Live, persisted |
| `performance.bridge.ts` | ✅ Publishes DOM attrs + CSS vars |
| `performance.hooks.ts` | ✅ 7 consumer hooks |
| `performance.presets.ts` | ✅ Tier budgets defined |
| `performance.detect.ts` | ✅ Device detection |
| `performance.clamp.ts` | ✅ Budget clamping |
| `performance.recording.ts` | ✅ Recording-safe profiles |

### ✅ Takes practice surface (canvas-first first-pass)

| Component | Status | Notes |
|-----------|--------|-------|
| `TakesPanel.tsx` | ✅ Top control grammar integrated | Practice / Compare / Solo / I/V/M + block info |
| `TakesControlStrip.tsx` | ✅ Hero trio centered (2-1-3) | All cards 340px, bottom: 48px |
| `TakesCanvas.tsx` | ✅ Canvas-first layout | Full-bleed waveform field |
| ❄️ Global Solo unified button | Orange accent active state, no On/Off wording |
| ❄️ Standard visible take-sync stabilized | Trim clipping seam removed (TC-TSYNC-406) |

### ✅ Exercises learner surface policy

| Policy | Status | Notes |
|--------|--------|-------|
| Default learner surface | ✅ Minimal (stable-2 only) | Echo Drill + 3-Take Challenge |
| Smoke/experimental | ⚠️ Hidden from default popover | No Training Wheels, A Cappella Boss |
| Special alternation lane | ⚠️ Separate entry point required | Call & Response (dedicated config UI) |
| ❄️ Freedom-first interruption model | Accepted doctrine | Blanket lock rejected, exit/cancel/Esc documented |
| ❄️ Committed evidence survives | Blobs saved, progress recorded | Interruption handler registered |
| Next deepening lanes | 🧭 Sequenced roadmap | 1. Composable I/V/T layer, 2. X-axis timing feedback |

### ❄️ Three orthogonal domains rule

```
1. Timing truth (transport, markers, word fill, triggers)
   → Performance NEVER alters this

2. Style intent (font, word FX, line controls, recipes)
   → textStyle.store owns this

3. Visual budget (what device/session allows)
   → performance.store owns this
```

### ✅ Performance tiers: `lite` / `balanced` / `max` / `ultra`

### ✅ DOM publication

Performance bridge publishes attrs on `document.documentElement`:

```html
<html data-visual-tier="balanced" data-recording-active="false">
```

CSS vars for budget values published on change (not per-frame).

### ✅ Recording-safe clamp

When recording active:
- `maxTrailDepth → off`
- `allowBounce → false`
- `allowHeavyNeon → false`
- `maxCueWords → 0`
- `allowPreviewHandoff → false`

---

# §11. Event Surface Contracts

### ✅ Confirmed consistent events

| Event | Emit Target | Listen Target | Status |
|-------|------------|---------------|--------|
| `before-track-change` | `document` | `document` | ✅ Consistent |
| `track-loaded` | `document` | `document` | ✅ Consistent |
| `track-stem-ready` | `document` | `AudioEngineV2 → audio.bridge` | Progressive Phase 1 complete |
| `track-fully-loaded` | `document` | `AudioEngineV2 → audio.bridge` | Progressive Phase 2 complete |
| `audio-position-changed` | `document` | `audio.bridge listener` | Current time update |
| `active-line-changed` | `document` | `document` | ✅ Consistent |
| `sections-updated` | `document` | `document` | ✅ Consistent |
| `lyrics-rendered` | `document` | `document` | ✅ Consistent |

### ⚠️ Broken contract

| Event | Emit Target | Listen Target | Affected | Status |
|-------|------------|---------------|----------|--------|
| `mode-changed` | **`window`** | **`window`** | loop.bridge, lyrics.bridge, mode.bridge | ✅ Fixed (TC-001) |

**Impact:** `loop.bridge` handler (`clearAllLoops`) may not fire on mode switch → loop ghosting in engine. `lyrics.bridge` mode sync may not trigger. `mode.bridge` partially masked by `MutationObserver` fallback.

### ⚠️ Likely dead event

| Event | Emitters | Listeners Found | Status |
|-------|----------|----------------|--------|
| `sync-editor-closed` | `sync.bridge.ts`, `catalog.store.ts` | None found in repo | ⚠️ Marked as RESIDUE (TC-004) |

---

# §12. Split Models (Intentional)

These splits are **by design**. Do not unify without explicit architectural decision.

### ❄️ Split 1: Mode system

| Path | Owner | Purpose |
|------|-------|---------|
| Command | `mode-switch.bridge.ts` | Imperative: switch mode, set classes, emit event |
| Observer | `mode.bridge.ts` | Reactive: mirror mode, apply volume policy |

### ❄️ Split 2: Loop system

| Surface | Owner | Mechanism |
|---------|-------|-----------|
| TrackMap loop | `loop.store` → `loop.bridge` → engine | Store-driven, block-based, adjacent constraint |
| Sync Editor loop | `WaveformCanvas` local → engine direct | Shift-drag, local loopRef, not through store |

### ❄️ Split 3: Sync rendering

| Path | Selector | Used By | Purpose |
|------|----------|---------|---------|
| Cue | `getActiveWordForLine` | SyncLyrics (editor) | Responsive early-feel |
| Fill | `getFillWordForLine` | WordLineDetector (triggers) | Exact progress timing |

### ⚠️ Split 4: Runtime vs persistence

| Concern | Authority | Notes |
|---------|-----------|-------|
| Runtime container | `window.trackCatalog` | Still actively consumed by orchestrator |
| Persistence | `idb.service.ts` | React-native DB access |

Both open same DB (`TextAppDB` v6) independently.

---

# §13. Publication Topology

### currentTime publication paths

| # | Path | Mechanism | Frequency |
|---|------|-----------|-----------|
| 1 | Engine event | `playback-state-changed` | On state change |
| 2 | Optimistic seek | `audio.bridge` patches `setCurrentTime/seekTo` | On seek |
| 3 | Polling | `time-sync.ts` reads engine | 10Hz during playback |
| 4 | Scheduler reader | `trigger.bridge` reads engine | 60Hz rAF |
| 5 | Waveform UI | `WaveformCanvas` local playhead | rAF-ish |

### activeLineIndex publication paths

| # | Path | Mechanism |
|---|------|-----------|
| 1 | Legacy LD | `lyricsDisplay.setActiveLine` → `active-line-changed` event |
| 2 | Lyrics bridge event | Syncs from `active-line-changed` when not scheduler-driven |
| 3 | Scheduler detector | Computes from markers + currentTime per frame |
| 4 | Scheduler writer | Reverse-syncs result into `lyricsDisplay.currentLine` |
| 5 | Seek patch | `audio.bridge` optimistically sets on seek |

**Source of truth remains engine `getCurrentTime()`**, but UI state arrives through multiple synchronization surfaces.

---

# §14. Prepared Catalog Pipeline

### 🧭 Status: Tooling operational, import path not fully integrated

| Component | Status | Notes |
|-----------|--------|-------|
| `prepare_batch.sh` | ✅ Working | RTF→TXT, BOM, lang, slugify, benchmarks |
| `kaggle_batch_notebook.py` | ✅ Working | MMS alignment, ~25min/track, resumable |
| `fix_artifacts.js` | ✅ Working | Enrichment, frozen artifact contract |
| `mock-align-server.mjs` | ✅ Working | 3-level hash matching, auto-alias |
| Artifact → app runtime | ✅ Working | Via mock server → provider → store → persist |
| Artifact → zip import | ✅ Done (TC-006, TC-008, TC-014) | Upload path ingests alignment.json + builds lineMap |
| Mock route vs provider | ✅ Done (TC-007) | Mock server now accepts /v1/align alongside /align and /api/align |
| Registry L1 exact hash | ⚠️ **Dormant** | `lyricsHash: ""` in artifacts, L2/L3 active — TODO Wave 5: precompute variant cache |

### Artifact contract (frozen)

```json
{
  "source": "ai-aligner",
  "version": 1,
  "audioSource": "vocal-stem",
  "language": "en",
  "mode": "anchored",
  "lyricsHash": "",  // auto-populated by mock server on first match or ZIP export
  "dataVersion": 3,  // 1=raw, 2=clean-lyrics, 3=voc-corrected
  "provider": "mms_fa",
  "trackId": "track-slug",
  "lines": [
    {
      "rawLineIndex": 2,
      "contentLineIndex": 1,
      "text": "line text",
      "start": 12.34,
      "end": 14.56,
      "confidence": 0.92,
      "words": [
        {
          "id": "track-slug:2:0",
          "text": "word",
          "start": 12.34,
          "end": 12.67,
          "confidence": 0.95,
          "rawLineIndex": 2,
          "contentLineIndex": 1,
          "wordIndex": 0
        }
      ]
    }
  ]
}
```

---

# §15. Confirmed Seams & Open Issues

### Class A — Confirmed bugs

| Issue | Impact | Status |
|-------|--------|--------|
| `mode-changed` target mismatch | Loop ghosting... | ✅ Fixed (TC-001) |
| INDEX MISMATCH (markers out of bounds) | App crash on tracks with raw LRC | ✅ Fixed (TC-AL-01..04 + TC-VOC-01..04) |

### Class B — Confirmed residual ambiguity

| Issue | Impact | Status |
|-------|--------|--------|
| Rehearsal volume dual persistence | Canonical grouped path + one-time migration | ✅ Fixed (TC-002) |
| VERSION MISMATCH (non-linear drift) | ~20% markers may drift individually | ⚠️ L3 code exists but needs tuning (TC-ANCHOR-01/02). Group Drag available for manual fix (TC-DRAG-01) |
| VOC performance (12.7s on old hardware) | Delays track load on slow devices | 📝 W13 (Async VOC) |
| `sync-editor-closed` likely dead | Emitters exist, no listeners found | ⚠️ Decision pending |
| `audioStore.ts` duplicate | Removed: src/audio/hooks/ + src/audio/store/ | ✅ Cleaned (TC-005) |

### Class C — Confirmed compat seams

| Issue | Impact | Status |
|-------|--------|--------|
| Recording: `microphoneGain` + `streamDestination` | Exposed via public getters | ✅ Fixed (TC-003) |
| MonitorMix: `vocalsSourceNode` possibly missing | Vocal-to-main routing may be degraded | ⚠️ Scan needed |

### Class D — Requires measurement

| Issue | Impact | Status |
|-------|--------|--------|
| Double blob layering | Possible load inefficiency | ⚠️ Measure if needed |
| Distributed publication paths | Debugging complexity, subtle races | ⚠️ Map before consolidating |

### Class E — Pipeline seams

| Issue | Impact | Status |
|-------|--------|--------|
| Mock `/align` vs provider `/v1/align` | All three routes supported | ✅ Fixed (TC-007) |
| Registry `lyricsHash: null` | L1 exact matching dormant | ⚠️ Backfill or accept L2/L3 |
| Zip import alignment artifacts | Full roundtrip: export ZIP → import ZIP → word-sync ready | ✅ Done (TC-006/008/014/015) |
| Cover Art URL-only in old ZIPs | Reimport loses offline capability | Graceful fallback to API fetch | Medium |
| lyricsOriginalContent missing in old ZIPs | LRC Picker cannot create blocks after reimport | Block preservation guard (TC-LRC-03) | Medium |

### Class F — Resolved in current session

| Issue | Resolution | TC |
|-------|-----------|-----|
| mode-changed target mismatch | Listeners aligned to window | TC-001 |
| Rehearsal volume dual persistence | Migration to grouped key | TC-002 |
| Recording compat gap | Public getters exposed | TC-003 |
| sync-editor-closed unknown status | Marked as residue | TC-004 |
| audioStore.ts dead duplicate | Removed with dead hook | TC-005 |
| ZIP import no alignment support | Full alignment ingestion | TC-006/008/014 |
| Mock/provider route mismatch | All routes supported | TC-007 |
| ZIP lyricsHash not roundtripped | Hash persisted in export.json | TC-015 |
| ZIP export missing | Full ZIP export with progress | TC-009-019 |
| No unit tests | 97 tests via Vitest | TC-020 |
| Dock restructure | Mix/AI removed, always-on controls, toggle buttons | TC-DOCK series |
| Pitch integration | z-index fix, ResizeObserver guard, --bl-deck-height ownership | TC-PITCH series |
| Double active state | activeTabId reset on toggle | TC-DOCK-20 |

---

# §16. No-Go Zone

🚫 **Do not touch without explicit architectural decision:**

| Item | Why |
|------|-----|
| Loop system unification | Two surfaces serve different UX needs |
| SyncLyrics unification with reactive path | Cue/fill split is intentional |
| `trackCatalog` removal/inversion | Runtime still depends on it |
| `main.tsx` patch station reshuffle | Boot order matters, hidden timing dependencies |
| Bridge layer purge | Bridges ARE the permanent architecture |
| Blob-layering cleanup (without measurement) | Accepted reliability residue |
| Legacy wholesale removal | Boundary shells preserve identity contracts |
| Additive sync architecture redesign | Proven and frozen |
| Transport rewrite | Hardened, needs instrumentation not rewrite |
| Backend-first push | Prepared catalog mode comes first |

---

# §17. Recommended Work Sequence

### Wave 1 — Contract fixes (done)

| TC | What | Status |
|----|------|--------|
| TC-001 | Align `mode-changed` listeners to `window` | ✅ Done |
| TC-002 | Migrate rehearsal volume split keys → grouped canonical | ✅ Done |

### Wave 2 — Architectural decisions (resolved)

| Item | Status |
|------|--------|
| Recording compat | ✅ Tactical expose done (TC-003) |
| `sync-editor-closed` | ✅ Marked as residue (TC-004) |
| `audioStore.ts` duplicate | ✅ Removed (TC-005) |

### Wave 3 — Pipeline completion (done)

| Item | Status |
|------|--------|
| ZIP import alignment artifacts | ✅ Done (TC-006/008/014) |
| Mock/provider route reconciliation | ✅ Done (TC-007) |
| lyricsHash roundtrip | ✅ Done (TC-015) |
| ZIP export with full track package | ✅ Done (TC-009/011/013) |
| ZIP export UX (feedback, progress, guard) | ✅ Done (TC-010/012/016-019) |

### Wave 3.5 — Testing infrastructure (done)

| Item | Status |
|------|--------|
| Vitest setup + 97 unit tests | ✅ Done (TC-020) |

### Wave 6 — Dock restructure (done)

| Item | Status |
|------|--------|
| Mix tab → always-on sliders | ✅ Done (TC-DOCK-05/06) |
| AI tab removed (deferred v3) | ✅ Done (TC-DOCK-11) |
| BPM on dock bar | ✅ Done (TC-DOCK-08/09) |
| VMix + Mic on dock bar | ✅ Done (TC-DOCK-10) |
| Sync/Monitor/Pitch as toggle buttons | ✅ Done (TC-DOCK-13) |
| Tools tab removed | ✅ Done (TC-DOCK-19) |
| Blocks → Sync Editor panel | ✅ Done (TC-DOCK-18) |
| Double active state fix | ✅ Done (TC-DOCK-20) |
| Pitch z-index + pianoOpenRef guard | ✅ Done (TC-PITCH series) |

### Wave 4 — Instrumentation

| Item | Goal |
|------|------|
| MonitorMix compat audit | Boundary contract closure |
| Performance profiling under stress | Measure edge cases |

### Wave 5 — Documentation hardening

| Doc | Purpose |
|-----|---------|
| `event-surface-contracts.md` | Prevent future target drift |
| `boundary-contracts.md` | Formalize what globals promise |
| `publication-topology.md` | Map currentTime/line/CSS var flows |

---

# §18. Key File Quick Reference

| Need to understand... | Read this file |
|----------------------|----------------|
| How audio works | `src/audio/core/AudioEngineV2.ts` |
| How V1→V2 patch works | `src/audio/compat/patchV1.ts` |
| How tracks load | `src/services/track.orchestrator.ts` |
| How line sync works | `src/bridges/lyrics.bridge.ts` |
| How word sync hydrates | `src/sync/word-sync/services/ai-lyrics-sync.service.ts` |
| How alignment triggers | `src/sync/components/SyncEditorPanel.tsx` |
| How triggers work | `src/triggers/trigger.bridge.ts` |
| How words render | `src/triggers/WordHighlightLine.tsx` |
| How word FX look | `src/triggers/word-effects.css` |
| How performance tiers work | `src/performance/performance.bridge.ts` |
| How modes switch | `src/bridges/mode-switch.bridge.ts` |
| How TrackMap loop works | `src/stores/loop.store.ts` + `src/bridges/loop.bridge.ts` |
| How recording works | `src/stores/recording.store.ts` |
| How the system boots | `src/main.tsx` + `src/App.tsx` |
| How blocks work | `src/blocks/components/BlockEditorModal.tsx` + `src/stores/blocks.store.ts` |
| How WagonTrain works | `src/components/WagonTrain.tsx` + `src/stores/loop.store.ts` |
| How styles console works | `src/components/StylesDeck.tsx` + `src/stores/textStyle.store.ts` |
| How themes work | `src/theme/store/theme-store.ts` + `src/theme/engine/css-injector.ts` |
| How upload/import works | `src/services/upload.service.ts` + `src/services/upload.actions.ts` |

---

# §19. Glossary

| Term | Meaning |
|------|---------|
| **Identity boundary** | Legacy global object preserving identity while V2 owns runtime |
| **Runtime authority** | The actual decision-maker in live runtime |
| **Publication path** | How truth reaches store/UI/DOM |
| **Policy owner** | Who owns intent/rules (not raw state) |
| **Split model** | Intentional dual-surface design serving different needs |
| **Protective residue** | Preserved compatibility element — scan before removing |
| **Accepted residual layering** | Non-ideal but tolerable implementation layer |
| **Fill-truth** | Exact word timing for progress FX (no lookahead) |
| **Cue-truth** | Early-feel word timing for responsive highlight |
| **Block Cue** | First line of next block (NOT "next line" in flow) |
| **Settled** | Past words shown as quiet history, not competing with active |
| **Prepared catalog** | Batch-processed tracks with pre-baked sync artifacts |

---

# §20. Architecture Invariants

These invariants define what must remain true unless an explicit architectural decision changes them.

## ❄️ Invariant 1 — Identity boundaries remain preserved

The following globals must continue to exist as stable identity shells:

- `window.audioEngine`
- `window.lyricsDisplay`
- `window.markerManager`
- `window.trackCatalog`
- `window.waveformEditor`
- `window.liveMode`
- `window.monitorMix`
- `window.app`

These objects may be patched or mirrored, but their existence and identity continuity are part of the surviving compatibility contract.

## ❄️ Invariant 2 — Audio transport authority belongs to `AudioEngineV2`

Stores and bridges do not own transport.

They may:
- mirror transport state
- publish optimistic UI state
- synchronize policies around transport

They do not own:
- seek execution
- play/pause execution
- stem lifecycle
- loop execution

## ❄️ Invariant 3 — Marker backbone remains canonical for active line

Line progression, block timing, and navigation anchors remain marker-driven.

Word sync is additive and may enhance display quality, but may not replace:
- line truth
- block truth
- marker timing truth

## ❄️ Invariant 4 — Word sync remains additive

The system must continue to treat:
- `lineMap`
- `alignmentData`
- marker line sync

as separate layers.

Bad word alignment must degrade to line-only UX, not fabricate precision.

## ❄️ Invariant 5 — Cue and fill semantics remain split

Two timing semantics exist intentionally:

- **Cue truth** — early-feel highlight (`getActiveWordForLine`)
- **Fill truth** — exact word timing (`getFillWordForLine`)

These are consumed by different surfaces for different UX reasons.
Do not collapse them casually.

## ❄️ Invariant 6 — Bridges are permanent architecture

The bridge layer is not temporary migration trash.
It is the synchronization fabric between:

- React/TS runtime
- legacy globals
- DOM event contracts
- CSS var publication
- runtime policy propagation

Do not purge bridges for purity.

## ❄️ Invariant 7 — Performance remains orthogonal

Performance policy must stay separate from:

- timing truth
- style intent
- app theme identity

Current ownership remains valid:

- timing truth → audio/sync/trigger
- style intent → `textStyle.store`
- budget policy → `performance.store`

## ❄️ Invariant 8 — Prepared catalog is a valid product lane

Offline/batch-prepared sync artifacts are not a workaround.
They are a legitimate productization path.

The system must remain compatible with:
- curated prepared tracks
- artifact delivery without live alignment at runtime
- backend-later sequencing

---

# §21. Blast Radius Map

This section explains not just what seams exist, but what they can break.

| Seam | Direct Impact | Hidden Impact | Severity |
|------|---------------|---------------|----------|
| `mode-changed` target mismatch | loop cleanup may fail | ghost loop in engine/store, confusing mode transitions | High |
| Rehearsal volume legacy read path | stale settings source | inconsistent restore behavior across mode/sync flows | Medium |
| Recording compat gap | mic may not be included in capture path | feature appears present but behaves partially | High |
| MonitorMix compat gap | vocal-to-main routing may degrade | rehearsal/monitor product behavior may be incomplete | Medium |
| First-load stutter | ✅ Resolved — transport seek/resume stabilized | High |
| Mock/provider route seam | artifacts may not resolve in some dev/proxy setups | false diagnosis of sync pipeline failure | Medium |
| Zip import artifact gap | prepared catalog not fully self-contained | extra runtime dependency on server delivery path | Medium |
| `sync-editor-closed` residue | none if truly dead | accidental reliance by hidden consumer if removed blindly | Low |

### High-severity seam details

**`mode-changed`:** Most dangerous affected handler is `loop.bridge` → `clearAllLoops()`. Product-facing because it can leave loop semantics alive after mode switch.

**Recording:** The feature is already real: UI exists, store exists, MediaRecorder path exists, performance-aware capture profiles exist, recording-safe visual clamp exists. This raises severity: the seam is under an active feature, not a speculative one.

---

# §22. Decision Doctrine

This section defines how architectural changes should be evaluated.

### Every change should first be classified into one of five categories

**1. Contract fix** — event target mismatch, stale persistence path, compat getter exposure. Usually safest and highest-ROI.

**2. Boundary compat fix** — MonitorMix expected field, recording surface mismatch, shell method completion. Handle carefully: touches compatibility surfaces.

**3. Instrumentation-first issue** — drift anomalies, publication race suspicion. Do not refactor before measuring.

**4. Product lane completion** — prepared catalog import, artifact bundling, production delivery. Not bug fixes; strategic completeness tasks.

**5. No-go speculative cleanup** — loop unification, bridge removal, trackCatalog inversion. Reject unless product or evidence strongly forces them.

### Default rule

**If the issue is already known and product-visible, prefer a contract fix. If the issue is only suspected, prefer instrumentation.**

---

# §23. How to Add New Work Safely

This section is for future contributors.

### If you want to change audio transport behavior
Start in `src/audio/core/AudioEngineV2.ts`. Then inspect `src/audio/compat/patchV1.ts`, `src/bridges/audio.bridge.ts`, `src/bridges/time-sync.ts`. Do **not** assume store writes equal transport truth.

### If you want to change line sync behavior
Start in `src/bridges/lyrics.bridge.ts`, `src/stores/markers.store.ts`, marker data consumers. Remember: line truth is marker-driven; scheduler is only one publication path.

### If you want to change word-level sync behavior
Start in `src/stores/wordSync.store.ts`, `src/sync/word-sync/services/ai-lyrics-sync.service.ts`, `src/triggers/detectors/word-line.detector.ts`, `src/triggers/WordHighlightLine.tsx`. Remember: editor cue path and trigger fill path are intentionally separate.

### If you want to change loop behavior
Start in `src/stores/loop.store.ts`, `src/bridges/loop.bridge.ts`, `src/components/WagonTrain.tsx`, `src/sync/components/WaveformCanvas.tsx`. Remember: TrackMap loop and Sync loop are different systems.

### If you want to change mode behavior
Start in `src/bridges/mode-switch.bridge.ts`, `src/bridges/mode.bridge.ts`. Remember: command and observation are split; body class mutation is part of the mode truth surface.

### If you want to change performance behavior
Start in `src/performance/performance.store.ts`, `src/performance/performance.bridge.ts`, `src/performance/performance.hooks.ts`. Do **not** move budget policy into `textStyle.store`.

### If you want to change prepared catalog / artifact delivery
Start in `scripts/prepare_batch.sh`, `scripts/fix_artifacts.js`, `scripts/mock-align-server.mjs`, `src/sync/word-sync/providers/gateway-align.provider.ts`, `src/services/upload.service.ts`. Remember: delivery contract and import contract are not yet fully unified.

---

# §24. Specialist Onboarding Paths

A new specialist should not read the entire repo in random order. Use role-specific entry paths.

### Audio / Transport Specialist
Read in order: §5 → §6 → `AudioEngineV2.ts` → `patchV1.ts` → `audio.bridge.ts` → `time-sync.ts` → §15.
Focus on: transport authority, seek/resume flow, loop execution, drift correction, compat surface.

### Sync / Alignment Specialist
Read in order: §2 → §8 → §14 → `wordSync.store.ts` → `sync/word-sync/services/*` → `SyncEditorPanel.tsx`.
Focus on: additive model, artifact contract, provider boundary, prepared catalog delivery, quality-source open decisions.

### Reactive / Visual Specialist
Read in order: §9 → §10 → `src/triggers/*` → `RehearsalLyrics.tsx` → `word-effects.css` → `src/performance/*`.
Focus on: scheduler, CSS var hot-path, word renderer contract, settled history, performance-aware degradation.

### Boundary / Legacy Specialist
Read in order: §5 → §11 → `js/` files → `src/main.tsx` → `lyrics.service.ts` → `src/bridges/*`.
Focus on: object identity preservation, patch station behavior, surviving consumers, no-go cleanup zones.

### Productization / Prepared Catalog Specialist
Read in order: §2 → §14 → §17 → `prepare_batch.sh` → `fix_artifacts.js` → `upload.service.ts` → `idb.service.ts`.
Focus on: artifact production, persistence, delivery, import gap, demo/showcase viability.

---

# §25. Prepared Catalog Completion Paths

The architecture currently supports prepared catalog conceptually, but product completion can happen in multiple ways.

### Option A — Server-delivered prepared artifacts
Track imports remain mostly as today. Word artifacts are delivered at runtime through gateway/mock-compatible service.

**Pros:** simpler import path, easier artifact updates, no need to rebundle tracks.
**Cons:** runtime server dependency remains, prepared catalog not fully self-contained.

### Option B — Artifact baked into track record at import time
ZIP/import path is extended so imported tracks can carry `lineMap` and `alignmentData` directly into `TrackRecord`.

**Pros:** fully self-contained prepared catalog, no runtime alignment server needed, stronger offline/demo mode.
**Cons:** import format must evolve, upload/import flow gets more responsibilities.

### Option C — Hybrid
Allow both runtime delivery via provider and import-time baked artifacts.

**Recommendation:** For beLive product sequencing, **Option C** is strongest long-term, with **Option B** especially valuable for investor/demo/prepared catalog scenarios.

---

# §26. Recording Architecture Decision Options

Recording is now an explicit architectural decision point.

### Problem
`recording.store.ts` expects `ae.captureStream()`, `ae.microphoneGain`, `ae.streamDestination`. Only `captureStream()` is currently exposed safely.

### Option 1 — Tactical compatibility exposure
Expose `microphoneGain` and `streamDestination` through V2 public getters and patchV1 surface.

**Pros:** quick fix, preserves existing recording store shape.
**Cons:** expands compat surface with lower-level internals, may reinforce accidental dependency on engine internals.

### Option 2 — Structural recording API
Introduce explicit engine-facing recording support: processed mic capture stream getter, combined capture stream getter, recording-oriented surface independent of raw internal node names.

**Pros:** cleaner architecture, safer future evolution, better for long-term product maturity.
**Cons:** larger change, requires refactor of recording store logic.

**Recommendation:** Short-term tactical expose is acceptable if recording is urgent. Long-term structural API is the stronger architecture.

---

# §27. Observability & Diagnostics

The system is mature enough that hidden ambiguity now costs more than missing logs.

### Existing observability surfaces

| Tool | Purpose |
|------|---------|
| `TriggerDebugOverlay` | Trigger/runtime debug |
| `PlaybackPerfOverlay` | Scheduler metrics, FX state, tier state |
| Console logs in load flow | Audio load diagnostics |
| Scheduler metrics | Frame time, CSS var count |

### Current observability gap

Weakest diagnostic surface today: transport seek/resume path trace, drift correction analysis, mode-change blast trace.

### Recommended minimal diagnostics expansion

Without building a telemetry platform, add enough structure to observe:
- seek start / seek complete
- atomic resume begin/end
- hard resync trigger
- loop set/clear/rebind
- mode-changed receipt by bridge
- artifact hydration status transitions

---

# §28. Documentation Sync Register

This master map does not replace all domain docs. It should synchronize them.

### Update these existing docs

**`audio-engine.md`** — Add: exact boot patch chain, recording seam, MonitorMix compat seam, current stutter suspect cluster, loop split note.

**`sync-system.md`** — Add: prepared catalog tooling is operational, cue/fill split in runtime usage, artifact delivery/import gap, mock/provider contract seam, registry hash exact path nuance.

**`reactive-lyrics-foundation.md`** — Add: visual consumers already live, scheduler lifecycle owned by trigger bridge, current runtime consumers across modes.

**`performance-quality-system.md`** — Add: implementation status is real not prospective, recording-safe clamp is live, recording feature depends on audio compat contract.

**`research-council-verdict.md`** — Adjust: performance domain is already implemented, trigger/reactive layer is further along than original wording, prepared catalog should be elevated from strategy to active tooling lane.

### Recommended new docs

| Doc | Purpose |
|-----|---------|
| `event-surface-contracts.md` | Canonical emit/listen targets |
| `boundary-contracts.md` | What globals promise |
| `prepared-catalog-pipeline.md` | Full external batch pipeline |
| `publication-topology.md` | currentTime/line/CSS var graph |

---

# §29. First Questions a New Specialist Should Answer Before Coding

A specialist should not start by "cleaning things up". They should first answer:

1. Who is the authority for this behavior?
2. Is this path transport truth, data truth, or publication path?
3. Is this split model intentional?
4. Is this boundary shell still actively consumed?
5. Is this a contract fix, a compat fix, or a measurement problem?
6. Is there already a prepared/offline path solving this externally?

If these are not clear, more recon is needed before code changes.

---

# §30. Final Interpretation

beLive has already crossed the threshold where the biggest architectural mistakes would no longer be:

- "missing subsystem"
- "unmigrated legacy core"
- "no state architecture"

The biggest mistakes now would be:

- touching frozen split models without recognizing them
- breaking boundary identity contracts
- confusing mirrors with authorities
- treating offline artifact production and runtime consumption as one layer
- rewriting strong foundations instead of fixing ambiguous contracts

---

# §31. TrackMap and Block System

## ❄️ Core product workflow

The block/TrackMap system is the visual and structural backbone of the beLive rehearsal experience.

### Block creation flow
1. User uploads instrumental + vocals + lyrics
2. Block Editor opens after save
3. User assigns blocks to text sections:
   - Verse (green)
   - Chorus (red)
   - Bridge, intro, outro, etc. (other colors)
4. Save → TrackMap structure created
5. Block colors propagate to:
   - WagonTrain wagons
   - Marker colors in Sync Editor
   - Line colors in rehearsal display
   - Block Cue (first line of next block)

### Block ownership
- Block structure stored in track record as `blocksData`
- Runtime mirror: `blocks.store` ← `blocks.bridge` ← `lyricsDisplay.textBlocks`
- Block editing: `BlockEditorModal.tsx` + `blockEditor.store.ts` + `blockEditor.bridge.ts`

### TrackMap / WagonTrain
`WagonTrain.tsx` renders blocks as colored wagons.

Each wagon supports:
- Click → jump to first marker of block
- Loop toggle → TrackMap loop on block
- Visual active/past/future state

### Block Cue
First line of the next block. Always-on structural preview.
NOT the same as "next line" in line flow.
This distinction is frozen (see `control-surface-semantics.md`).

### Color routing
Block colors create structural coherence:
- Marker colors follow block identity
- Preview line follows next block color
- Neon FX follow current block color
- TrackMap wagons show block sequence visually

---

# §32. Sync Editor Deep View

The Sync Editor is the primary tool for creating line-level sync and triggering word-level alignment.

### Components
- `SyncEditorPanel.tsx` — controls, save, export, undo/redo, align button
- `WaveformCanvas.tsx` — dual waveform display, marker placement, local loop
- `SyncLyrics.tsx` — editor lyrics display with cue-truth word highlighting

### Waveform display
- Instrumental waveform (blue) as base layer
- Vocals waveform (red) overlaid
- V-I-M toggle switches visibility (Vocals / Instrumental / Mixed)
- Click to seek, shift-drag to create loop
- Markers appear as colored vertical lines inheriting block colors

### Marker placement
- Key "1" places marker at current playback time
- Marker assigned to next unassigned line
- Marker color inherits from block structure
- Markers can be dragged to adjust timing
- Save exports JSON with markers + block structure

### Alignment trigger
SyncEditorPanel "Align" button:
1. Validates lineMap, lyricsHash, audioSource
2. Blocks if trusted source is degraded (RTF)
3. Builds anchors from existing markers
4. Sends alignment request (mode: 'anchored')
5. On success: persists alignmentData + lineMap into track record
6. Word sync survives reload

### Local loop
WaveformCanvas owns its own loop:
- Shift-drag creates loop region
- Loop handles can be dragged
- Direct engine calls (not through loop.store)
- Saves/restores followPlayhead state during loop

### Export
Save produces JSON file containing markers and structure. This JSON + audio + lyrics can be bundled into ZIP for distribution.

---

**beLive 2.2 is a mature hybrid architecture where React/TS owns the product runtime over preserved boundary shells. The system includes a complete offline batch pipeline for word-sync artifact production, a live reactive visual layer, a first-class performance policy domain, a fully operational ZIP-based prepared catalog cycle (export → import → word-sync ready), a Surface Gate navigation system, OAuth/Guest auth flow, and beLive AI provider. Contract seams from Waves 1-3 have been resolved. Unit tests provide regression safety. Dock restructured: always-on volume/BPM/mic controls, Sync/Monitor/Pitch as toggle buttons, Tools tab eliminated. Next priorities: transport instrumentation (Wave 4) and documentation hardening (Wave 5).**

---

## §33. Surface Gate System (v2.2 delta)

### 33.1 Назначение
Единственный контроллер навигации. Заменяет URL-роутинг. Управляется через Zustand store.

### 33.2 Surface Map

| Surface | Компонент | Описание |
|---------|-----------|----------|
| `welcome` | `WelcomePage.tsx` | Стартовый экран: Google OAuth, VK (disabled), Skip |
| `app` | `App.tsx` (AppShell) | Основное рабочее пространство (каталог, режимы, редактор) |
| `profile` | `UserRoom.tsx` | Профиль, настройки, Guest Upgrade UI |

### 33.3 Surface Gate реализация

```ts
// src/stores/app.store.ts
type AppSurface = 'welcome' | 'app' | 'profile';

interface AppState {
  surface: AppSurface;
  authChecked: boolean;
  setSurface: (s: AppSurface) => void;
  setAuthChecked: (v: boolean) => void;
}
```

App.tsx (Surface Gate switch):
```tsx
const surface = useAppStore(s => s.surface);
switch (surface) {
  case 'welcome': return <WelcomePage />;
  case 'app': return <AppShell />;
  case 'profile': return <UserRoom />;
}
```

### 33.4 Файлы Surface Gate

| Файл | Назначение |
|------|-----------|
| `src/stores/app.store.ts` | Surface state + authChecked |
| `src/App.tsx` | Surface switch gate |
| `src/components/welcome/WelcomePage.tsx` | Surface welcome |
| `src/components/welcome/WelcomePage.css` | Стили welcome |
| `src/components/welcome/LoadingSplash.tsx` | Сплаш для auth-check |
| `src/components/profile/UserRoom.tsx` | Surface profile |
| `src/components/profile/UserRoom.css` | Стили profile |

---

## §34. Auth Flow (v2.2 delta)

### 34.1 Схема потоков

```
GOOGLE OAUTH:
  WelcomePage "Войти через Google"
    → authService.initiateGoogleOAuth()
    → CF Worker /auth/google
    → Google Consent Screen
    → Worker callback → JWT
    → URL params (?auth=...&name=...&email=...)
    → handleCallback() → createOAuthProfile()
    → setSurface('app')

GUEST SKIP:
  WelcomePage "Пропустить"
    → authService.skipAuth()
    → createProfile('Гость', '🎤', true)
    → setSurface('app')

MOCK AUTH (dev):
  VITE_USE_MOCK_AUTH=true
    → _mockAuth() → createOAuthProfile()
    → setSurface('app')
```

### 34.2 Auth Service API

```ts
// src/services/auth.service.ts
authService.skipAuth()            // Guest вход
authService.initiateGoogleOAuth() // OAuth редирект
authService.checkExistingAuth()   // Проверка при загрузке
authService.handleCallback(params) // Обработка OAuth callback
```

### 34.3 User Profile Store (OAuth)

```ts
// src/stores/user-profile.store.ts
interface UserProfileStoreState {
  currentUser: UserProfile | null;
  isLoggedIn: boolean;
  isGuest: boolean;
  isReturning: boolean;

  createProfile(name, emoji, isGuest?)     // Создать профиль (гость/обычный)
  createOAuthProfile({name, email, authToken, ...}) // OAuth профиль
  updateProfile(updates)                    // Обновить
  logout()                                   // Выйти
  deleteProfile()                            // Удалить профиль
}
```

### 34.4 Profile data model

```ts
interface UserProfile {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string;
  emoji?: string;
  isGuest: boolean;
  authProvider?: 'google';
  authToken?: string;
  serverId?: string;
  createdAt: string;
  lastSeenAt: string;
  preferences: Record<string, any>;
}
```

### 34.5 Persistence & Migration

- Store: `belive:user-profile` (localStorage via zustand/persist)
- Version: 2
- Migration v1→v2: adds `catalogOnboardingComplete`, `onboardingProgress`
- Partialize: сохраняет только нужные поля (без функций)

---

## §35. Guest Mode (v2.2 delta)

### 35.1 Принцип
Guest-режим — архитектурный принцип. Пользователь начинает творить мгновенно, конвертация происходит через ценность, а не через забор.

### 35.2 Guest flow
1. `createProfile('Гость', '🎤', true)` → `isGuest: true`
2. Поверхность: `welcome` → (skip) → `app`
3. UserRoom показывает блок апгрейда
4. AI Provider блокирует запросы (`AUTH_REQUIRED`)
5. Статистика скрыта ("Доступно после регистрации")

### 35.3 Guest restrictions

| Фича | Guest | OAuth User |
|------|-------|-----------|
| Просмотр каталога | ✅ | ✅ |
| Прослушивание треков | ✅ | ✅ |
| Режимы (rehearsal/concert/etc) | ✅ | ✅ |
| beLive AI | ❌ `AUTH_REQUIRED` | ✅ (20 req/day) |
| Статистика | ❌ скрыта | ✅ |
| UserRoom апгрейд | ✅ блок апгрейда | ✅ профиль |

---

## §36. beLive AI Provider (v2.2 delta)

### 36.1 Регистрация провайдера

```ts
// src/js/ai/providers/belive.provider.ts
class BeliveProvider implements AIProvider {
  id = 'belive';
  models = [
    { id: 'openrouter/free', ... },
  ];
}
```

### 36.2 Поток запроса
```
User message → AIHub.sendMessage()
  → BeliveProvider.streamChat()
  → Fetch POST {CF_WORKER_URL} (Authorization: Bearer JWT)
  → SSE stream (data: {...} events)
  → onToken/delta → UI
```

### 36.3 Rate limit
- KV namespace: `RATE_LIMIT_KV` (в `wrangler.toml`), не `belive-ai-rates`
- 20 запросов/МИН на IP (per-minute, per-IP)
- HTTP 429 при превышении

### 36.4 Безопасность
- JWT читается динамически из `userProfileStore.currentUser.authToken`
- Guest → `AIError('AUTH_REQUIRED')`
- Worker без авторизации → 401

### 36.5 Дополнительные AI провайдеры

Помимо BeliveProvider, в системе есть два недокументированных провайдера:

| Провайдер | Файл | Строк | Назначение |
|-----------|------|-------|-----------|
| `OpenRouterDirectProvider` | `src/js/ai/providers/openrouter-direct.provider.ts` | 233 | AI через API-ключ пользователя (OpenRouter) |
| `GatewayProvider` | `src/js/ai/providers/gateway-provider.ts` | 223 | AI через локальный gateway с ephemeral-токенами |

---

## §37. Env Vars & CF Workers (v2.2 delta)

### 37.1 Production

```env
VITE_AUTH_WORKER_URL=https://belive-auth.nikitosss007.workers.dev
VITE_AI_WORKER_URL=https://belive-ai.nikitosss007.workers.dev
VITE_USE_MOCK_AUTH=false
VITE_GETSONGBPM_KEY=***
VITE_LASTFM_API_KEY=***
VITE_BASE_PATH=/
```

### 37.2 Development

```env
VITE_USE_MOCK_AUTH=true
VITE_GATEWAY_URL=http://localhost:8787
```

### 37.3 CF Workers Registry

| Worker | Endpoints | Secrets |
|--------|-----------|---------|
| `belive-auth` | `/auth/google`, `/auth/callback`, `/health` | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `JWT_SECRET` |
| `belive-gateway` | `/v1/chat/stream` (SSE), `/auth/ephemeral`, `/v1/align`, `/admin/operator-prompt` | `OPENROUTER_API_KEY`, KV: `RATE_LIMIT_KV`, `CACHE_KV`, `OPERATOR_PROMPT_KV`, `EPHEMERAL_KV` |

---

## §38. New File Reference (v2.2 delta — SCAN results)

Все новые файлы проверены — `tsc --noEmit` не выдаёт ошибок в этих файлах.

| Файл | Строк | Назначение |
|------|-------|-----------|
| `src/components/welcome/WelcomePage.tsx` | 40 | Стартовый экран |
| `src/components/welcome/WelcomePage.css` | — | Стили welcome |
| `src/components/welcome/LoadingSplash.tsx` | — | Сплаш загрузки |
| `src/components/profile/UserRoom.tsx` | 192 | Профиль + Guest Upgrade |
| `src/components/profile/UserRoom.css` | — | Стили UserRoom |
| `src/services/auth.service.ts` | 132 | OAuth/Guest/JWT |
| `src/stores/app.store.ts` | 17 | Surface gate |
| `src/stores/user-profile.store.ts` | 219 | Профиль + persist |
| `src/js/ai/providers/belive.provider.ts` | 163 | beLive AI |

---