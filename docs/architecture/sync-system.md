# Sync System

> **⚠️ This document is a domain-specific reference. For the complete current architecture, see [Architecture Map 2.1](./architecture-map-2.1.md).**

**Status:** Active freeze / handoff  
**Owner:** Sync Architect + Center1.1  
**Last updated:** 2026-03-12  
**Related:** `audio-engine.md`

---

## 1. Overview

The beLive sync system is built as a **two-layer timing model**:

1. **Marker-driven line sync** — the existing, stable backbone  
2. **Word-sync overlay** — a new additive layer on top of line sync

This architecture is intentionally additive.

The old marker system continues to own:
- current line
- block timing
- line-level playback structure
- coarse sync UX

The new word-sync layer owns:
- per-line word timings
- active word selection
- confidence-gated word highlighting
- future repair-window and alignment workflows

This means:
- line sync remains stable even if word sync is weak or missing
- bad alignment degrades to line-only UX instead of lying
- new alignment engines can evolve without rewriting the backbone

---

## 2. Frozen Architectural Decisions

The following are frozen and should not be reopened without strong new evidence.

### 2.1 Additive model
Word-sync is an additive layer over the existing marker-driven sync.

### 2.2 Source of truth for text
Supplied lyrics remain the canonical truth.
No aligner or ASR transcript is allowed to replace canonical lyrics.

### 2.3 Current line ownership
Current line remains **marker-driven**.

### 2.4 Word-level ownership
Active word is computed from `alignmentData` only, on top of the active line.

### 2.5 Data separation
`syncMarkers`, `lineMap`, and `alignmentData` remain separate layers.

### 2.6 Confidence gate
Low-confidence alignment must degrade to line-only behavior rather than fabricate precision.

### 2.7 Mock phase
Mock alignment route has completed its job and is closed.
It proved app plumbing, but it is no longer a useful source of timing truth.

### 2.8 Primary direction
Forced alignment remains the primary architecture direction.
ASR / Google / transcript-first paths are helper-only, not primary.

---

## 3. System Roles

### 3.1 Marker-driven backbone
The existing marker system continues to provide:
- line starts
- active line progression
- block/section timing
- loop / navigation timing anchors

### 3.2 Word-sync layer
The new layer provides:
- `lineMap`
- `alignmentData`
- per-line word timing access
- active word lookup by time
- future confidence-aware and repair-aware behavior

### 3.3 UI surfaces
Current sync UI roles:
- `SyncEditorPanel` → control/status/trigger surface
- `SyncLyrics` → read-only display surface
- `WagonTrain` → block navigation / block-based loop interaction
- `WaveformCanvas` → sync-editor direct waveform manipulation

---

## 4. Main Data Model

## 4.1 Track-level persistence

Track persistence now includes optional sync-layer fields:

- `lineMap?`
- `alignmentData?`

This means successful alignment is durable and reloadable.

### Track persistence also already includes
- `lyrics`
- `lyricsOriginalContent`
- `blocksData`
- `syncMarkers`

So the app can now carry both:
- old line sync data
- new word sync data

in the same track record.

---

## 4.2 `lineMap`

`lineMap` is the structural bridge between raw lyric lines and alignable content.

A `LineMapEntry` contains:
- `rawLineIndex`
- `kind`
- `contentLineIndex`
- `text`
- `alignable`

### Current `LineKind`
- `lyric`
- `separator`
- `bracket`
- `non-lexical`

### Alignability rules
- `separator` → non-alignable
- `bracket` → non-alignable
- `lyric` → alignable
- `non-lexical` → currently alignable, but still subject to future product policy

### Important invariant
`rawLineIndex` always follows original lyric line position.  
`contentLineIndex` increments only on alignable lines.

---

## 4.3 `alignmentData`

`alignmentData` stores the actual line and word timings.

Top-level shape includes:
- `source`
- `version`
- `trackId?`
- `language?`
- `lyricsHash`
- `audioHash?`
- `audioSource`
- `provider?`
- `providerVersion?`
- `mode?`
- `lines`
- `separators?`

### Each line stores
- `rawLineIndex`
- `contentLineIndex`
- `text`
- `start`
- `end`
- `confidence`
- `words`
- `anchorTime?`

### Each word stores
- `id`
- `text`
- `normalizedText?`
- `start`
- `end`
- `confidence`
- `rawLineIndex`
- `contentLineIndex`
- `wordIndex`
- `charStart?`
- `charEnd?`

---

## 4.4 Hash policy

Current `lyricsHash` contract:
- normalize line endings (`\r\n` / `\r` → `\n`)
- compute FNV-1a 32-bit
- store as `fnv1a:xxxxxxxx`

### Important semantic split
- `displayLyrics` → used for lineMap / rendering
- `hashSourceLyrics` → used for cache truth

This was explicitly fixed to avoid cache invalidation on parser-transformed text.

---

## 4.5 Confidence policy

Current thresholds:
- `LOW_CONFIDENCE = 0.55`
- `HIGH_CONFIDENCE = 0.80`

### Current status
These thresholds are **temporary-frozen**.
They are enough to gate UX for now, but final calibration is still open.

### Current behavior
- low confidence → no word-level highlight
- medium confidence → repair candidate
- high confidence → safe word-level display

---

## 5. Runtime State

## 5.1 `wordSync.store`

Main runtime store fields:
- `lineMap`
- `alignmentData`
- `lyricsHash`
- `audioSource`
- `status`
- `error`
- `degraded`

### Status values
- `idle`
- `ready`
- `missing`
- `loading`
- `error`

### Runtime selectors
The store already provides:
- `getLineTiming(rawLineIndex)`
- `getWordsForLine(rawLineIndex)`
- `hasUsableWordSyncForLine(rawLineIndex)`
- `getActiveWordForLine(rawLineIndex, currentTime)`

### Important note
This store is **not the transport authority**.
It is a sync-data state layer consumed by UI and services.

---

## 5.2 `lyrics.store`

Current relevant fields:
- `lines`
- `activeLineIndex`
- `activeBlockId`

This store carries the current line state that `SyncLyrics` uses as its backbone.

---

## 5.3 `audio.store`

Current relevant fields:
- `isPlaying`
- `currentTime`
- `duration`
- `hasVocals`
- `playbackRate`
- volume state

`currentTime` is the primary timing input for active word selection.

---

## 5.4 `loop.store`

Loop store carries:
- `isLooping`
- `loopBlockIds`
- `loopStartTime`
- `loopEndTime`
- `loopStartLine`
- `loopEndLine`

It is important for block-based rehearsal and later repair-window design.

---

## 5.5 `track.store`

Track store carries:
- `tracksMeta`
- `currentTrack`
- `currentTrackIndex`

Used for orchestration, persistence routing and SyncEditor interactions.

---

## 6. Main Services

## 6.1 `alignment-cache.service.ts`
Pure cache verdict layer.

It decides whether cached `alignmentData + lineMap` are:
- ready
- missing
- stale-lyrics
- stale-audio
- stale-source

### Important current behavior
Mock provider data is rejected as stale / non-truth when appropriate.

---

## 6.2 `ai-lyrics-sync.service.ts`
Hydration-only service layer.

Responsibilities:
- build `lineMap`
- compute `lyricsHash`
- validate cache
- hydrate `wordSync.store`
- mark `degraded` for trusted-source issues

This is the first runtime entry point of the new sync layer.

---

## 6.3 `lyrics-align.service.ts`
Thin execution facade around the chosen provider.

Responsibilities:
- hold provider instance
- expose `align(request)`

No business logic should leak from UI into provider calls.

---

## 6.4 `alignment-request.builder.ts`
Pure domain builder for outgoing alignment requests.

Responsibilities:
- reconstruct request from:
  - `lineMap`
  - `lyricsHash`
  - `audioSource`
  - optional anchors / windows / language
- keep UI free from alignment-domain assembly logic

---

## 6.5 `gateway-align.provider.ts`
Current frontend provider boundary.

Responsibilities:
- send `AlignmentJobRequest`
- receive `AlignmentResult`
- report controlled errors
- target current gateway or local mock path

---

## 7. Runtime Flow

## 7.1 Track load
Main flow:
1. track selected
2. legacy lyrics/blocks shell cleared
3. lyrics prepared
4. audio loaded
5. markers applied/reset
6. `prepareWordSyncLayer(...)`
7. cache verdict
8. `wordSync.store` hydration

### Important consequence
Word-sync hydration is **orchestrator-driven**, not UI-driven.

---

## 7.2 Align execution
Current flow:
1. user opens `SyncEditorPanel`
2. user clicks `Align`
3. request built by request builder
4. `lyricsAlignService.align(...)`
5. provider executes
6. on success:
   - `alignmentData` goes to store
   - `alignmentData` and `lineMap` are persisted into current track
7. reload durability path already works

---

## 7.3 Reload / durability
This is already proven.

After successful Align:
- `alignmentData` and `lineMap` survive reload
- rehydration restores `ready`
- no second Align is needed to restore the layer

This was one of the biggest plumbing milestones.

---

## 7.4 Rendering path
`SyncLyrics` already knows how to:
- use active line from old sync
- read `alignmentData`
- read current time
- split active line into words
- highlight active word when available

This means current remaining problems are **not** basic render existence problems.

---

## 8. What Has Been Proven

## 8.1 App-side plumbing
Proven:
- hydration
- cache verdict
- provider path
- persistence write-back
- reload durability
- UI observability
- word overlay substrate

## 8.2 Mock route
Proven and closed:
- request path
- response path
- save path
- reload path

But mock is not used for quality decisions anymore.

## 8.3 EN / LP real artifact
Real LP artifact:
- usable
- visually convincing
- good enough to keep forced alignment as primary direction

## 8.4 RU / Omega real artifact
RU real artifact:
- works through the same app pipeline
- weaker than LP
- line starts feel mostly right
- internal groove weaker
- not enough to reject the architecture

---

## 8.5 RU preprocessing compare
Current strongest finding:
simple preprocessing tuning on MMS was not enough to close RU quality sufficiently.

This does **not** mean:
- forced alignment is invalid
- the whole engine direction is wrong

It means:
- current RU weakness is still open
- simple preprocessing compare did not solve it

## 8.6 Second-engine compare
Second-engine compare on RU is the current active quality-decision frontier.

At this stage:
- app plumbing should no longer be modified
- only quality-source / engine-map decisions matter

---

## 9. What Is Frozen

The following are frozen:

- additive sync architecture
- marker-driven line backbone
- separate `lineMap`
- separate `alignmentData`
- orchestrator hydration placement
- provider boundary
- persistence + reload durability
- mock phase closed
- forced alignment as primary architecture direction

---

## 10. What Is Open

The following are still open:

- final RU engine verdict
- final global engine map
- confidence calibration
- final RU preprocessing contract
- last-word tail polish
- backend/productization route
- helper role of ASR/Google later

---

## 11. Current Strategic Interpretation

The sync frontier has moved.

It is no longer:
- “can we store data?”
- “can we render words?”
- “can the app survive reload?”
- “can we call a provider?”

All of that is already solved.

The real frontier now is:
- **quality source selection**
- **engine map**
- **confidence truthfulness**
- **how much polish is needed before productization**

---

## 12. What Must Not Be Reopened

Do not reopen:
- additive architecture
- mock tuning
- persistence / hydration / provider plumbing
- fake-timing offset experiments
- old “does app support alignment at all?” questions
- backend-first pressure

These are already closed or intentionally deferred.

---

## 13. Prepared Catalog Mode

A very important product mode is already valid:

### Prepared / curated catalog mode
Instead of aligning everything live on demand,
beLive can:
- batch-prepare tracks offline
- store real artifacts
- ship a curated synchronized catalog
- deliver a product demo/showcase mode before full backend automation

This is a legitimate product stage, not a compromise.

---

## 14. Current Recommended Direction

### Right now:
1. finish RU engine-quality decision
2. freeze engine map
3. do a small quality-policy pass
   - confidence
   - tails
   - maybe non-lexical policy
4. only then move to backend/productization

### Not now:
- backend
- frontend redesign
- audio engine work
- giant UI polish
- more mock experimentation

---

## 15. Current Open Questions for Sync Architect

Only these categories still matter:

1. Final RU second-engine compare verdict
2. Final engine map:
   - MMS globally
   - or MMS EN + engine2 RU
3. Confidence policy:
   - temporary thresholds
   - recalibration timing
4. Productization order:
   - tiny quality-policy pass first
   - backend second

Everything else is already either proven or intentionally closed.

---

## 16. Current One-Line Summary

**The sync system is no longer a plumbing problem.  
It is now a quality-source and engine-selection problem.**