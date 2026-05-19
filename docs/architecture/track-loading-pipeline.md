# Track Loading Pipeline — End-to-End

**Status:** Architecture Reference  
**Version:** 1.0  
**Date:** 2026-04-29  
**Authors:** Центр16.1 + Agent 007 + Operator

---

## Overview

beLive загружает трек в 5 фаз: от ZIP-файла до готового воспроизведения. Каждая фаза имеет чёткого владельца и зависимости.

```
ZIP Upload → Lyrics Acquisition → Sync & Alignment → Audio Engine → State Init
   (1)              (2)                 (3)              (4)          (5)
```

**Общее время загрузки:** ~1.5-3 секунды (зависит от размера аудио и устройства)

---

## §1. Phase 1: Upload & Classification

**Owner:** `upload.service.ts` + `upload.actions.ts`  
**Goal:** Accept files, classify stems, save to IDB

### Flow

```
ZIP file → JSZip.loadAsync() → classify files
  ├── Audio → instrumental / vocal / stems (residual principle)
  ├── Text → lyrics.txt / export.json
  ├── Cover → cover.jpg/png → Blob → IDB coverArtBlob
  └── Sync → markers + blocks from export.json
```

### Stem Classification (Residual Principle)

File WITHOUT stem keyword = instrumental. This is correct because instrumentals are named after the track.

**Details:** → `n-stem-architecture.md` §6

### Cover Art Pipeline

```
cover.jpg in ZIP → Blob → IDB coverArtBlob → URL.createObjectURL() → <img>
     (fallback) → coverArtUrl (HTTP) → <img>
     (no data)  → placeholder gradient
```

**Details:** → `zip-pipeline.md` §6

---

## §2. Phase 2: Lyrics Acquisition

**Owner:** `UploadPanel.tsx` + `auto-lyrics.service.ts`  
**Goal:** Get structure (Genius) + timings (lrclib)

### Flow

```
Genius text paste
  → parseTaggedLyrics() → blocks (structure) + cleanLines
  → lrclib fetch → LRC synced lines (timings)
  → blockFirstLineSync(geniusText, lrcResult) → blocks + markers + lyricsLines
```

### Genius-as-Scaffold Principle

```
Genius  = SCAFFOLD (boxes: Bridge, Chorus, Verse...)
lrclib  = TIMINGS (when each line sounds)
blockFirstLineSync = CONNECTOR (scaffold + timings = TrackMap)
```

**Details:** → `block-first-lyrics-sync.md` §10

### LRC Version Selection

lrclib may have multiple versions of LRC. LRC Picker allows user to select the best one.

**Details:** → `architecture-map-2.1.md` §6B

---

## §3. Phase 3: Sync & Alignment

**Owner:** `track.orchestrator.ts` (21-step pipeline)  
**Goal:** Apply markers, blocks, word-sync to loaded track

### Key Steps

| Step | What it does | Key file |
|------|-------------|----------|
| 8 | Load blocks/lyrics into LD | `lyrics.service.ts` |
| 11a | Apply markers + colors | `marker-manager.js` shell |
| 11a.5 | Vocal Onset Correction (VOC) | `vocal-onset.service.ts` |
| 11b | Word-sync hydration | `ai-lyrics-sync.service.ts` |
| 12 | Delayed block sanitization | `parsing.service.ts` |

### Two-Layer Timing Model

```
Layer 1: Marker-driven line sync (backbone) — ❄️ Frozen
Layer 2: Word-sync additive overlay — never replaces Layer 1
```

**Details:** → `marker-system-spec.md`, `sync-system.md`

### VOC (Vocal Onset Correction)

Async fire-and-forget. Corrects marker timing based on actual vocal audio. L2 (linear) or L3 (multi-anchor).

**Known Issue:** Systematic ~-5s offset on some tracks. Needs investigation (TC-VOC-01).

---

## §4. Phase 4: Audio Engine Loading

**Owner:** `AudioEngineV2.ts` + `patchV1.ts`  
**Goal:** Load audio, build audio graph, prepare playback

### Loading Paths

| Path | Condition | Stems | Speed |
|------|-----------|-------|-------|
| Progressive | stemsMode=true | Phase 1 (inst) → Phase 2 (voc+stems) | Fast first-play |
| Non-progressive | stemsMode=false | inst + voc Blob URLs | Simple |

### Bus Architecture

```
Stem gainNode ──┬──→ VocalMix merger (primary)
                ├──→ Bus gainNode (parallel tap)
                └──→ AnalyserNode (metering, read-only)
```

**Details:** → `n-stem-architecture.md` §4, `audio-engine.md`

---

## §5. Phase 5: State Initialization

**Owner:** Bridges + Stores  
**Goal:** Sync React runtime with loaded track

### Key State Updates

| Store | Bridge | What it mirrors |
|-------|--------|----------------|
| `track.store` | `track.bridge` | Track metadata |
| `blocks.store` | `blocks.bridge` | Blocks from LD.textBlocks |
| `markers.store` | `markers.bridge` | Markers from markerManager |
| `audio.store` | `audio.bridge` | Playback state, duration |
| `loop.store` | `loop.bridge` | TrackMap loop intent |

### Event-Driven Sync

```
AudioEngineV2 → 'track-loaded' event
  → audio.bridge (mirrors state)
  → blocks.bridge (syncs blocks, 300ms delay)
  → markers.bridge (syncs markers)
  → track.bridge (syncs metadata)
```

---

## §6. Timing Breakdown

Typical load timing from `[OrchTiming]` logs:

| Step | Description | Time |
|------|-------------|------|
| 1-2 | IDB read | 0.2ms |
| 3-4 | Clear prev state | 2-5ms |
| 6-7 | RTF parse | 0.2ms |
| 8 | Load lyrics/blocks | 17-37ms |
| 9a | Blob URL creation | 1-2ms |
| 9b-10 | AudioEngine.loadTrack | 1400-2300ms ← **bottleneck** |
| 11a | setMarkers + colors | 1ms |
| 11b | Word-sync preparation | 3-6ms |

**Total:** ~1.5-3 seconds (audio decode dominates)

---

## §7. Error Recovery

| Error Point | Recovery |
|-------------|----------|
| IDB read fails | Use in-memory trackCatalog snapshot |
| LRC fetch fails | Manual sync required (show notification) |
| Audio decode fails | Retry via AudioLoader (3 retries + timeout) |
| Stale load protection | `_loadGeneration` increments on every load |
| Stale resume protection | `_transportGen` increments on play/pause/seek |

---

## §8. Related Documents

| Document | What it covers |
|----------|---------------|
| `block-first-lyrics-sync.md` | blockFirstLineSync algorithm + matching strategy |
| `n-stem-architecture.md` | N-stem loading + bus routing |
| `audio-engine.md` | AudioEngineV2 transport + stem lifecycle |
| `marker-system-spec.md` | M1/M2 marker system |
| `zip-pipeline.md` | ZIP export/import roundtrip |
| `architecture-map-2.1.md` | Ownership matrix, event contracts |
| `sync-system.md` | Two-layer sync architecture |

---

## §9. Known Issues

| Issue | Status | Reference |
|-------|--------|-----------|
| VOC systematic ~-5s offset | Pending investigation | TC-VOC-01 |
| Bridge 8/9 lines (format difference) | Accepted limitation | block-first-lyrics-sync.md §12 |
| parseTaggedLyrics called twice | Optimization opportunity | UploadPanel + blockFirstLineSync |

---

*Track Loading Pipeline v1.0 | 2026-04-29 | Центр16.1*
