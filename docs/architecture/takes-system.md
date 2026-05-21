# Takes System

> **⚠️ This document is a domain-specific reference. For the complete current architecture, see [Architecture Map 2.1](./architecture-map-2.1.md).**

**Status:** Active subsystem architecture / working freeze anchor  
**Version:** 0.4 (Sync fix landed + canvas-first surface)  
**Date:** 2026-04-01  
**Owner:** Center 2.0 + Product Owner + Agent 007  
**Related:**

- `architecture-map-2.1.md`
- `interaction-schema-2.1.md`
- `audio-engine.md`
- `sync-system.md`
- `reactive-lyrics-foundation.md`
- `performance-quality-system.md`
- `pitch-integration-report.md`

---

## 1. Purpose

This document is the **primary architecture anchor for Takes** in beLive.

It exists to freeze three things separately:

1. **VERIFIED CURRENT** — what the code does today
2. **PRODUCT TARGET** — what Takes is meant to become
3. **OPEN SEAMS** — what is not yet solved or still needs product/technical research

This document is also the **research anchor** for future work on:

- compare semantics
- live orange waveform trail
- scoring / proximity
- exercise automation
- persistence / bounce

---

## 2. Product Statement

### Core truth

**Takes is not just a recorder.**  
Takes is beLive’s **block-based practice / compare engine**.

Its product role is:

- rehearse a chosen block
- record a vocal attempt
- compare attempts quickly
- choose a better take
- repeat fast without leaving the workflow

### Short one-line mental model

> **Takes = block-scoped repetition, recording, comparison, and improvement workflow.**

---

## 3. Current Product Shape

### What the user can already do

- choose a block from TrackMap
- open Takes in the dock
- see a block-scoped waveform canvas
- record into one of 3 slots
- get pre-roll countdown
- auto-stop at block end
- preview recorded takes
- use `I / V / M` base context switching
- use live `Hear` controls (`Context / Solo`)
- see recorded take overlay on canvas
- use A/B-related controls that are partially landed technically
- **see live orange trail with working runtime foundation**
- **experience waveform fidelity normalized across tiers**
- **record without stale live bars accumulating after stop**
- **exercise execution lock protects all interference surfaces during listening/pre-recording/recording**
- **host residency mutations blocked during active exercise execution**
- **default Drill popover shows stable-2 recipes only: Echo Drill, 3-Take Challenge**
- **smoke/experimental recipes hidden from default learner surface**
- **standard visible take-sync blocker substantially resolved (trim clipping fix)**
- **canvas-first first-pass surface: top control line integrated, hero trio centered, global Solo unified button**

### Important current truth

Takes already has a **strong foundation**, but the subsystem is still in the middle of a **semantic/product shaping phase**.

**Runtime stabilization status (W2D):**

- ✅ Live orange trail has working runtime foundation
- ✅ Waveform geometry normalized across tiers
- ✅ Stale live bars after stop fixed
- ✅ Imperative live trail runtime landed
- ✅ Live trail no longer depends on React per-frame state

**Take-Sync Fix Status (TC-TSYNC-406):**

- ✅ Standard visible path trim clipping seam removed
- ✅ Root cause: arithmetic clipping on negative engine delta (`Math.max(0, engineNow - startTime)`)
- ✅ Fix applied to standard visible `handleRecord()` path only
- ✅ Raw blob truth remained intact (no decoder changes)
- ✅ In-flight path (Call & Response) remains separate / not reopened
- ✅ Telemetry fields added for diagnostics (`lateStartOffsetSec` now unclipped)
- ✅ Deeper decode-origin / committed consumer diagnosis remains conditional only if issue returns

**Current Surface Status (TC-SURFACE-412/413/414):**

- ✅ Canvas-first first-pass layout: top control line integrated with block info
- ✅ Hero take trio centered (2-1-3 order preserved)
- ✅ All three cards equalized width (340px each)
- ✅ Hero cluster elevated (bottom: 48px) for cleaner lower edge
- ✅ Global Solo control consolidated into one unified clickable button
- ✅ Orange accent for active Solo state (no On/Off wording)
- ✅ Lower strip no longer main visual host (utility zone separated)

**Current repo status:**
This repository remains the **recovery base** for all future waves. Full rollback to previous states is **NOT recommended** — current code truth is more advanced than any prior version.

---

## 4. Recipe Surface Classification

All exercise recipes classified into three categories for learner surface visibility:

### 4.1 Stable

**Definition:** Runtime-confirmed, backing-locked, safe for general learner surface.

**Characteristics:**
- Execution path validated (no runtime errors)
- Backing semantics fully defined (full/instrumental/silent)
- Success criteria clear to user
- Recovery path tested
- Performance budget met (MacBook 2013)

**Current members:**
- `Echo Drill` — Simple listen → echo pattern (3 rounds, instrumental backing)
- `3-Take Challenge` — Record 3 takes, compare, select best (until-filled mode)

**Visibility:** Shown in RecipeCardPopover default launcher (stable-2 surface)

### 4.2 Experimental

**Definition:** Working code, but backing semantics or success criteria under active redesign.

**Characteristics:**
- Code exists in `exercise.recipes.ts`
- Runtime execution may have edge cases
- Backing semantics partially defined or context-dependent
- Requires dedicated configuration UI (not simple card)
- Needs explicit teacher guidance or documentation

**Current members:**
- `No Training Wheels` (backing-only) — Record with instrumental only (smoke surface)
- `A Cappella Boss` (acappella-boss) — Progressive full → instrumental → vocals-only challenge (smoke surface)

**Visibility:** Hidden from default launcher, accessible via future teacher tools or advanced surface

### 4.3 Special

**Definition:** Alternation modes requiring semantic role patterns, not generic drill recipes.

**Characteristics:**
- Uses semantic role labels (`guide`, `response`) instead of fixed step sequences
- Requires pattern configuration before start (line-pair, phrase-pair, custom)
- Visual pattern preview mandatory before commitment
- Separate entry point from stable Drill (dedicated button/modal)
- Context-dependent backing assignment per role type

**Current members:**
- `Call & Response` — First member of alternation family (special surface)

**Visibility:** Completely separate surface, NOT shown in RecipeCardPopover, hidden from default learner flow

---

## 5. Ownership Map

### Runtime ownership

| Domain                    | Current owner                            | Notes                                       |
| ------------------------- | ---------------------------------------- | ------------------------------------------- |
| Takes panel layout        | `TakesPanel.tsx`                         | container / wiring / canvas-first surface   |
| Top control grammar       | `TakesPanel.tsx`                         | Practice / Compare / Solo / I/V/M buttons   |
| Recording / playback UI   | `TakesControlStrip.tsx`                  | slot cards, preview, record actions         |
| Waveform rendering        | `TakesCanvas.tsx`                        | base context + overlays + playhead visuals  |
| Takes metadata / UI state | `takes.store.ts`                         | lightweight Zustand state                   |
| Binary assets             | `takes.assets.ts`                        | blobs, buffers, peaks, URLs outside Zustand |
| Mic capture               | `takes.recorder.ts`                      | MediaRecorder + analyser tap                |
| Lifecycle cleanup         | `takes.bridge.ts`                        | track change / playback stop / DOM attrs    |
| Transport authority       | `AudioEngineV2`                          | frozen, not owned by Takes                  |
| Mic stream authority      | `MicrophoneManager` via engine           | raw stream source                           |
| Block timing truth        | blocks + markers + `getBlockTimeRange()` | reused utility path                         |
| Exercise execution lock   | `isExerciseExecutionLocked()` helper     | unified guard across all surfaces           |
| Lock state derivation     | `TakesPanel` + `ControlDeck` + `WagonTrain` | uses `activeExercise` + `phase` selectors |

### Ownership principle

Takes consumes:

- engine transport
- marker/block timing
- mic stream

Takes does **not** own:

- transport truth
- track timeline truth
- microphone authority
- marker backbone

---

## 5. File Topology

### Core files

| File                                         | Role                                                        |
| -------------------------------------------- | ----------------------------------------------------------- |
| `src/takes/takes.store.ts`                   | metadata + UI state                                         |
| `src/takes/takes.types.ts`                   | types (`TakeMeta`, `BlockTakes`, `PreviewMode`, `ViewMode`) |
| `src/takes/takes.assets.ts`                  | blob/buffer/peaks registry                                  |
| `src/takes/takes.recorder.ts`                | MediaRecorder wrapper + analyser tap                        |
| `src/takes/takes.bridge.ts`                  | lifecycle and event bridge                                  |
| `src/takes/components/TakesPanel.tsx`        | panel container + canvas wiring                             |
| `src/takes/components/TakesCanvas.tsx`       | waveform renderer                                           |
| `src/takes/components/TakesControlStrip.tsx` | take cards, preview, record actions                         |

### Important external dependencies

| File                                  | Why it matters                             |
| ------------------------------------- | ------------------------------------------ |
| `src/audio/core/AudioEngineV2.ts`     | transport authority, stem loading, volumes |
| `src/audio/compat/patchV1.ts`         | public getters on `window.audioEngine`     |
| `src/audio/core/MicrophoneManager.ts` | raw mic stream                             |
| `src/utils/block-time-range.ts`       | canonical block → time mapping             |
| `src/sync/canvas/peaks.ts`            | peak generation utility                    |
| `src/components/WagonTrain.tsx`       | TrackMap / block navigation                |
| `src/stores/audio.store.ts`           | volume intent + playback mirror            |
| `src/stores/markers.store.ts`         | marker timing truth                        |
| `src/stores/blocks.store.ts`          | block structure                            |

---

## 6. Current Data Model

### 6.1 Store shape (`takes.store.ts`)

### Current key fields

- `activeBlockId`
- `isPanelOpen`
- `isRecording`
- `recordingSlot`
- `blockTakesMap`
- `previewMode`
- `viewMode`

### Current key actions

- `openPanel(blockId)`
- `closePanel()`
- `setActiveBlock(blockId)`
- `startRecording(blockId, slot)`
- `finishRecording(meta)`
- `cancelRecording()`
- `deleteTake(blockId, slot)`
- `selectTake(blockId, slot)`
- `setPreviewMode(mode)`
- `setViewMode(mode)`
- `getBlockTakes(blockId)`
- `getNextEmptySlot(blockId)`
- `cleanup()`

---

### 6.2 `TakeMeta`

Current fields include:

- `id`
- `blockId`
- `slot`
- `mimeType`
- `duration`
- `recordedAt`
- `status`
- `peaksReady`
- `trimStartSec`
- `tempoRate` — optional — Tempo context at recording time (1.0 = normal, 0.75 = slow)
- `takeKind` — optional — Take classification — training takes are practice, final takes are keepers
- optional `error`

### Important semantic note

`recordedAt` is important not only as metadata, but also as a possible fallback signal for “latest ready take”.

---

### 6.3 `BlockTakes`

- one `blockId`
- exactly 3 slots
- `selectedSlot` for chosen/best take semantics

### Primary rule

Visible active slots remain **3**.  
History or persistence can scale later outside the primary dock surface.

---

### 6.4 Asset registry (`takes.assets.ts`)

Heavy binary data is kept outside Zustand:

- `blob`
- `objectUrl`
- `audioBuffer`
- `peaks`

### Why this is good

- avoids reactive store bloat
- keeps cleanup explicit
- supports lazy decode / lazy URL creation

---

## 8. Recording Architecture

### 8.1 Current chain

```text
User clicks empty slot / record action
  → TakesControlStrip.handleRecord(targetSlot?)
  → pre-roll setup
  → engine seek to pre-roll point
  → engine play
  → START RECORDER AFTER SEEK+PLAY (deterministic position)
  → countdown
  → visible recording state at block start
  → auto-stop at block end
  → blob saved
  → decode + peaks generation
  → finishRecording(meta)
```

### 8.2 Take-Sync Truth (TC-TSYNC-001/002/003/406)

**Standard path significantly stabilized:**

- ✅ Recorder starts AFTER seek+play (engine at known preRollStart position)
- ✅ trimStartSec calculation deterministic (no random offset from unknown arm position)
- ✅ Pre-roll seek happens before recorder.arm()
- ✅ Visible recording state tied to actual musical block start
- ✅ Countdown UX preserved (3-second pre-roll when applicable)

**Trim clipping seam removed (TC-TSYNC-406):**

- ✅ Root cause identified: arithmetic clipping in standard visible path
- ✅ Culprit: `const engineProgressSec = Math.max(0, engineNow - effectiveTimeRange.startTime);`
- ✅ Fix: unclipped engine delta (`const engineProgressSec = rawDelta; // unclipped`)
- ✅ Safety floor preserved: outer `Math.max(0, computedTrim)` retained
- ✅ Telemetry updated: `lateStartOffsetSec` also unclipped (can be negative when engine early)
- ✅ Diagnostic logging added: `[TRIM-BASIS]` log with full computation details

**Root cause of first-take asymmetry documented:**

- Previous bug: recorder started BEFORE seek, writing audio from arbitrary engine position
- Fix: reorder operations so engine seeks first, then recorder starts
- Trim clipping fix: remove arithmetic ceiling that masked negative engine delta
- Result: trim values consistent across cold start vs subsequent takes

**Scope boundaries:**

- Standard visible path: FIXED (recorder armed after seek+play, unclipped delta)
- In-flight path (Call & Response): UNCHANGED (separate semantics, not reopened)
- Raw blob storage: INTACT (no decoder changes required)
- Decode-origin / committed consumer: CONDITIONAL (only if issue returns)

**Current MediaRecorder-based limit:**

- Uses browser MediaRecorder API (not AudioWorklet)
- Raw mic stream capture only
- No processed monitor mix
- Session-only storage (cleared on track change)

**Future precision lane noted:**

- AudioWorklet-based capture could provide sample-accurate timing
- Requires separate research wave
- Not blocking current stable surface delivery

**Targeted fix wave approach:**

- No broad research active yet
- Specific alignment bugs fixed via TC-TSYNC waves
- Empirical validation via manual browser testing
- Telemetry-only fields added for future diagnostics (`lateStartOffsetSec`)

### 8.3 Recording truth

**Confirmed:**

- recording uses MediaRecorder
- source = raw mic stream
- not AudioWorklet-first
- not processed monitor mix
- not VocalMix output
- not session-only (blobs persist within session)

**Frozen:**

> ⚠️ UPDATED: Recording supports tempo context via `tempoRate` field in TakeMeta. TempoLadder recipe records at varying rates. The freeze "only at 1.0x" is LIFTED — tempoRate is active in production code.
- max 3 slots visible
- raw mic capture only
- auto-stop at block end
- safety timeout fallback

### 8.4 Exercise Execution Lock (EXLOCK)

**Landed protection (VERIFICATION-EXLOCK-101):**

During active exercise executable phases (`listening`, `pre-recording`, `recording`):

**ControlDeck surface blocked:**
- Tab switching away from Takes (only Takes tab remains accessible)
- Sync button toggle
- Pitch button toggle
- Dock collapse/expand toggle
- Instrumental volume slider (click + drag)
- Vocal volume slider (click + drag)
- Playback rate buttons (-5%, reset, +5%)
- VMix toggle
- Microphone toggle
- Microphone volume slider

**TakesPanel surface blocked:**
- Canvas seek click (waveform interaction)
- Drill button (recipe popover launcher)
- Retake button (⟳ delete + re-record)
- Starbutton (☆/★ reference toggle)
- Delete button (✕ take removal)

**WagonTrain surface blocked:**
- Wagon click (seek + loop rebind + active block change)
- Loop toggle (+/- add/remove from loop)

**Implementation pattern:**
```typescript
const exerciseLocked = isExerciseExecutionLocked(activeExercise, phase);
// Returns true if activeExercise !== null AND phase in executable phases

// Guard usage:
if (exerciseLocked) return;  // early return in onClick handlers
disabled={exerciseLocked}     // React disabled attribute
opacity: exerciseLocked ? 0.4 : 1  // visual feedback
cursor: exerciseLocked ? 'not-allowed' : 'pointer'
```

**Visual feedback:**
- All blocked controls show `opacity: 0.4-0.5` (dimmed appearance)
- Cursor changes to `not-allowed` on hover
- Tooltips read "Unavailable during exercise execution"
- No side effects when guard triggers (state preserved)

**Stop button exception:**
- Stop button (`■`) remains always available during recording
- Emergency path, intentionally excluded from lock wave
- Only visible when `isRecording || countdown !== null`

**Host residency protection:**
All mutation surfaces blocked prevent interference with:
- Exercise backing volumes (authoritative during execution)
- Exercise timing (listen → record transitions)
- Exercise cursor advancement (rounds/steps)
- User focus (forced to complete current step)

**Verification status:** ✅ PASSED (VERIFICATION-EXLOCK-101)
- 17 surfaces tested across all 3 executable phases
- Zero escape routes found
- Zero regression in non-exercise mode (VERIFICATION-EXLOCK-102)

**Interruption Model Doctrine:**

Blanket lock rejected as final architecture. Current direction embraces **freedom-first + interruption model**:

**Key principles:**
- Exit/cancel/esc pathways accepted and documented
- User can leave exercise mid-stream (intentional abandonment)
- Committed evidence should survive interruption (blobs saved, progress recorded)
- Lock protects active execution, not imprisonment
- Practice session interrupt handler registered in TakesControlStrip
- Cleanup on interrupt: cancels countdown, clears timers, stops recorder, exposes analyser

**Interrupt practice API:**
```typescript
import { interruptPracticeSession } from '../../exercises/exercise.interruption';

onClick={(e) => {
  interruptPracticeSession(() => {
    // actual action here
  });
}}
```

**Philosophy:** Lock shields user from accidental self-sabotage during focused execution, but escape hatches remain available for intentional course-correction.

### 7.3 Pre-roll / stop behavior

Current implementation already includes:

- 3-second pre-roll
- recorder start slightly before block start
- auto-stop at block end
- safety timeout
- trim calculation based on wall-clock vs engine progress

---

## 8. Preview Architecture

### 8.1 Current preview path

Recorded take preview uses:

- AudioBufferSourceNode
- independent gain node
- direct Web Audio playback
- engine remains transport authority

**Important contract:**
Engine-led preview remains frozen. No second transport.

### 8.2 Hear controls

Current `previewMode` semantics:

- **context** — take + engine stems audible
- **solo** — engine clock continues, stems muted, only take audible

**Current runtime truth:**
Hear controls are already promoted to live controls:

- not preflight-only
- can switch during active take preview

### 8.3 Volume restore doctrine

Volume restoration uses latest values from `audio.store`, not stale snapshots.

**Why:** Because user slider moves during preview should remain authoritative user intent.

---

## 9. Canvas Architecture

### 9.1 Current layer model

The canvas works as a layered visual surface:

**Verified layers (in draw order):**

1. Base context — I / V / M waveforms
2. Reference layer — gold contour/skeleton (selected take in A-B mode)
3. Recorded compare overlay — orange solid fill (active compare target)
4. Live orange trail — accumulated waveform during recording only
5. Block boundaries
6. Playhead (separate DOM overlay)
7. Canvas HUD overlays (block info, REC badge, countdown)
8. Exercise strip overlay (during active exercise, z-index 30)
9. Response cue overlay (Call & Response countdown, z-index 25)
10. Live trail canvas (imperative renderer, z-index 10)

### 9.1B Exercise Overlay Architecture

**Active exercise visualization:**

When `activeExercise !== null`, canvas zone contains:

**ExerciseStrip component:**
- Absolute positioned div at top of canvas zone
- Height: 28px
- z-index: 30 (above all other overlays)
- Shows current phase icon + instruction
- Displays round/step progress
- `data-no-seek` attribute prevents click-through to canvas

**Response cues (Call & Response special case):**
- Centered countdown during listen phase anticipation
- Font size: 42px, color: rgba(255,200,70,0.9)
- z-index: 25 (below exercise strip, above waveforms)
- `data-no-seek` prevents interaction bleed

**Live trail imperative canvas:**
- Separate `<canvas>` element, absolute positioned
- z-index: 10 (below overlays, above base waveform)
- Managed by `LiveTrailController` imperative class
- NOT managed by React per-frame state updates
- Accumulates orange waveform bars progressively during recording

**Countdown overlay:**
- Full canvas zone coverage during pre-roll
- Large centered number (76px, red glow)
- Background: rgba(0,0,0,0.52)
- z-index: 20
- `data-no-seek` prevents accidental seek

**Interaction blocking:**
Canvas zone onClick handler checks:
```typescript
if ((e.target as HTMLElement).closest('[data-no-seek]')) return;
if (exerciseLocked) return;  // EXLOCK guard
// proceed with seek...
```

Result: Clicking overlays or locked canvas produces no seek behavior.

### 9.2 Base context switching

Current `viewMode`:

- **inst** — instrumental waveform (red)
- **voc** — vocal/original waveform (blue)
- **mix** — both waveforms layered

**Current default:** VOC as base context

**Semantic note:** `viewMode` is visual only. It does not define playback source.

### 9.3 Visual semantics

**Base context colors:**

- Red (`rgba(210,85,85,0.35-0.5)`) — instrumental
- Blue (`rgba(79,139,255,0.45-0.55)`) — vocal/original context

**Compare layers:**

- Gold/yellow (`rgba(247,201,72,0.85)`) — selected reference take (contour/skeleton style)
- Orange (`rgba(255,165,0,0.60-0.85)`) — active compare target / recorded take (solid fill)

**Future:**

- Green reserved for match/proximity zones (scoring system)

### 9.4 Playhead

The playhead is:

- separate DOM layer
- driven by rAF
- reads direct engine time
- no longer forces full canvas redraw

**This is frozen as the correct pattern.**

### 9.5 Canvas-first first-pass surface

**Current surface truth (TC-SURFACE-412/413/414):**

Takes has evolved into a canvas-first first-pass surface:

**Top control line integrated:**
- Compact rail hosts main control grammar at top of canvas zone
- Practice button (label-only, opens recipe popover)
- Compare toggle (On/Off wording retained for clarity)
- Solo toggle (unified button, orange accent, no On/Off text)
- I/V/M mode buttons (inst/voc/mix)
- Block info chip (type dot, name, time range)
- z-index: 8, positioned above waveform, below exercise strip

**Hero take trio centered:**
- Three take cards arranged in 2-1-3 order (Take 2 left, Take 1 center, Take 3 right)
- All cards equalized width: 340px each (no more side/center width difference)
- Cluster centered via absolute positioning (left: 50% + translateX(-50%))
- Elevated position: bottom: 48px (cleaner lower edge, no visual cropping)
- Hover affordance preserved (translateY(-4px), enhanced shadow/glow)
- Card order unchanged, center geometry preserved

**Lower strip role clarified:**
- TakesControlStrip reduced to cards-first layer
- Emergency stop button separated into utility zone
- No longer main visual host (canvas field dominates)
- Sits in canvas field, not dock panel padding

**Global Solo control unified:**
- Consolidated from dual-element (label + oval) into single button
- "Solo" text inside button (full click target)
- Active state: orange border glow, orange wash background, bright orange text
- Inactive state: calm dimmed appearance, still clearly clickable
- No On/Off wording (visual state communicates meaning)
- Toggle logic unchanged (previewMode switches solo/context)

**Design principles:**
- Canvas zone reclaims width from dock panel padding
- Control grammar distributed, not collapsed into single strip
- Hero trio reads as unified object, not fragmented controls
- Click targets natural and fully accessible
- Visual state obvious without textual crutches

---

## 10. Current Compare Architecture

### 10.1 Current landed compare foundation

**What exists in codebase today:**

- Compare-related local state exists
- Compare UI foundation landed
- Active compare target wiring exists
- Recorded overlay logic exists
- Original vocal reference playback path exists technically
- Selected take semantics (`selectedSlot` state)
- Overlay target priority chain (active target → selected → latest ready)

**Technical status:** Foundation is technically complete and functional.

### 10.2 Accepted product direction (open pivot)

**Current product verdict:**

V1 compare should pivot toward:

- **Selected take = reference** (gold contour layer)
- **Clicked take = active compare target** (orange solid layer)
- Take-to-take comparison within the same block
- **Freedom-first + interruption model accepted** (exit/cancel/esc pathways documented)
- **Committed evidence survives interruption** (blobs saved, progress recorded)

**Not:**

- Take vs vocal stem as primary v1 compare semantics

**Meaning:**

- `selectedSlot` acts as the reference take for A-B comparison
- Clicking a filled take card sets it as the active compare target
- Comparison happens between two takes from the same block
- Original vocal reference path remains a future seam / secondary compare lane

**Status:** Direction accepted, implementation refinement ongoing.

### 10.3 Separate concerns

**Clearly separated domains:**

1. **Recorded compare overlay** — orange solid fill, shows recorded take waveform
2. **Live input trail** — orange accumulated waveform during recording only
3. **Compare semantics** — A-B comparison model (clicked vs selected)
4. **Vocal reference path** — isolated playback of vocal buffer (future/secondary)

**Key principle:** Live trail ≠ recorded overlay. Compare ≠ live recording.

---

## 11. Live Orange Wave — Current Status

### 11.1 What exists now

A live orange trail exists in runtime and uses:

- analyser from `TakesRecorder`
- panel-local state
- progressive accumulated timeline-bar rendering
- **imperative accumulator architecture**

### 11.2 Current baseline: Progressive accumulated waveform

**Landed implementation (TC-W2D-004):**

Progressive accumulated timeline-bar live trail:

- Time-to-space mapping: `barIndex = progress × 96`
- Each bar represents amplitude at specific time slice
- Accumulation preserves history: loud/quiet moments remain distinct
- NOT all bars pulsing together (not a VU meter)
- Reads as DAW-like waveform behind playhead
- **Geometry frozen at 384 bars across all performance tiers**
- Style varies by tier (Lite/Balanced/Max), geometry constant

**Technical approach:**

- Fixed 96 bars for performance on target hardware
- Per-frame: compute min/max for entire analyser buffer (1024 samples)
- Update only current bar based on progress
- Preserve all previous bars (functional React setState)
- Cheap accumulation without ring buffer complexity
- **Imperative controller architecture (no React state churn)**

**Status:** This is the **current production baseline**.

### 11.3 Runtime stabilization (W2D)

**Landed improvements:**

- ✅ Imperative accumulator/controller/renderer split landed
- ✅ Waveform fidelity no longer degraded by tier geometry
- ✅ Stale live bars after stop fixed
- ✅ Live trail no longer depends on React per-frame state
- ✅ Cleanup on recording stop working correctly
- ✅ **Fixed 384-bar geometry across all tiers** (tier scales style, not bar count)

**Architecture:**

- Imperative accumulator class manages time-slice history
- Controller handles analyser reads, bar indexing, accumulation logic
- Renderer draws accumulated bars with style injection
- Functional React state replaced with imperative accumulator instance
- Cleaner separation enables easier testing and optimization
- Performance benefits: avoid React state churn, direct mutation of accumulator buffer

**Analyser FFT contract note:**
Current implementation uses 1024-sample FFT buffer. Future cleanup seam may refine:
- FFT size optimization (balance resolution vs performance)
- Sub-bar interpolation for smoother visual curves
- Ring-buffer exploration for ultra-high-fidelity tier
This remains a small, isolated cleanup task not blocking current stability.

### 11.4 Research branch: Higher-fidelity polish

**Open for future evaluation:**

Research branch should assess:

- Would full ring-buffer approach provide noticeably better UX?
- Is 96 bars sufficient for professional use cases?
- Should we explore sub-bar interpolation for smoother visuals?
- Are there cheaper alternatives to current accumulation model?

**Decision framework:**

- Research must evaluate **refine vs replace**
- Any replacement must maintain MacBook Pro 2013 performance
- Must preserve separation from recorded overlay layer
- Must not require transport rewrite

**Status:** Baseline stabilized, higher-fidelity polish remains optional future enhancement.

### 11.5 Product target achieved

During recording, the user sees their waveform being written behind the playhead like in a DAW:

- ✅ Time-accumulated history
- ✅ Not just current-frame analyser visualization
- ✅ Song structure visible (loud/quiet sections frozen in time)
- ✅ Working runtime foundation

---

## 13. Frozen Decisions

### Frozen current truths

- Takes = practice/compare engine
- Compare is more important than Bounce
- 3 visible slots remain primary UI
- Engine-led preview remains
- Recording is raw mic only
- Recording remains session-only
- `viewMode` and `previewMode` are separate domains
- Live orange trail and recorded overlay are separate layers
- Selected take = reference for v1 compare (accepted product direction)
- `selectedSlot` remains chosen/best take semantics
- Compare and live recording are separate concerns
- Green is reserved for future match/proximity semantics
- Playhead remains separate DOM layer
- Full transport authority remains in `AudioEngineV2`
- Target hardware = MacBook Pro 2013 (performance gate)
- **Exercise execution lock blocks all interference surfaces during listening/pre-recording/recording**
- **Host residency mutations forbidden during active exercise execution**
- **Default learner-facing Drill popover = stable-2 surface only**
- **Smoke/experimental recipes hidden from default flow**
- **Call & Response = special surface, separate entry point required**
- **Waveform geometry frozen at 384 bars across tiers** (style scales, geometry constant)
- **Stop button remains emergency path, intentionally excluded from lock wave**
- **Standard visible take-sync substantially resolved** (trim clipping seam removed, TC-TSYNC-406)
- **Canvas-first first-pass surface landed** (top control grammar, hero trio centered, Solo unified)
- **Freedom-first + interruption model accepted** (blanket lock rejected, exit pathways documented)
- **Committed evidence survives interruption** (blobs persist, cleanup explicit)

### Current repo truth vs product surface

**Current code truth:**
- Repository contains full recipe library (5 recipes)
- All recipes functional at runtime level
- Hidden recipes accessible via smoke-test allowlist

**Product-visible stable surface:**
- Stable learner-facing drill surface has priority over exposing all modes
- Only runtime-confirmed recipes shown in default launcher
- Experimental/special recipes hidden until dedicated execution waves land

**Accepted future directions:**
- Hidden recipe rehab remains active lane (Phase 1: No Training Wheels, Phase 2: A Cappella Boss)
- Call & Response redesign as special alternation mode (separate entry point)
- Waveform customization doctrine established (Lite/Balanced/Max tiers)
- Instant Review (one-shot post-record loop) defined for rapid iteration

---

## 14. What Is Already Done

### Foundation / Wave 1

- ✅ Vocal buffer exposed
- ✅ I / V / M base context wired
- ✅ Playhead separated from canvas redraw
- ✅ Canvas enlarged / full-bleed
- ✅ HUD overlays for block info and REC
- ✅ Take cards replace plain buttons
- ✅ Countdown overlay on canvas
- ✅ Slot-directed recording
- ✅ Retake and delete actions
- ✅ Auto-follow between blocks
- ✅ Takes update on new recording completion

### Wave 2A / 2B

- ✅ Hear controls are live
- ✅ Context / Solo preview works
- ✅ Recorded take overlay exists
- ✅ Local compare state groundwork exists

### Wave 2C / 2D Runtime Stabilization

- ✅ **Progressive accumulated live trail landed** (TC-W2D-004)
- ✅ Analyser path exposed
- ✅ Time-to-space mapping implemented
- ✅ History preservation working
- ✅ DAW-like waveform appearance achieved
- ✅ **Imperative accumulator/runtime stabilization landed**
- ✅ **Waveform geometry normalized across tiers**
- ✅ **Stale live bars after stop fixed**
- ✅ **Live trail no longer depends on React per-frame state**

### Wave 3 Compare/Lower-Strip Cleanup

- ✅ **Lower strip cleanup landed** — stale live bars removed after stop
- ✅ **Compare foundation stabilized** — selected take semantics clear
- ✅ **Overlay target priority chain** — active target → selected → latest ready fallback

### TAKE-SYNC-TRUTH Wave

- ✅ **Standard path reordered** — recorder starts after seek+play (TC-TSYNC-001)
- ✅ **Telemetry added** — lateStartOffsetSec captured for diagnostics (TC-TSYNC-002)
- ✅ **In-flight scope documented** — Call & Response unchanged in this wave (TC-TSYNC-003)
- ✅ **Diagnostic logging cleaned up** — production code contains only essential validation logs

### EXLOCK Hardening Wave

- ✅ **Unified lock helper landed** — `isExerciseExecutionLocked()` single source of truth
- ✅ **ControlDeck guards deployed** — 10 surfaces blocked (tabs, sync, pitch, sliders, toggles)
- ✅ **TakesPanel guards deployed** — 5 surfaces blocked (seek, drill, retake, star, delete)
- ✅ **WagonTrain guards deployed** — 2 surfaces blocked (wagon click, loop toggle)
- ✅ **Visual feedback consistent** — opacity 0.4-0.5, not-allowed cursor, tooltips
- ✅ **Zero regression verified** — non-exercise mode fully functional (VERIFICATION-EXLOCK-102)
- ✅ **Stable-2 surface filter** — default Drill popover shows Echo Drill + 3-Take only
- ✅ **Smoke/special hidden** — backing-only, acappella-boss, call-response excluded from default

---

## 11B. Waveform Customization Doctrine

### Separation of data model and visual style

**Core principle:** Waveform data truth and waveform visual style must remain architecturally separate.

**Why:**

- Users may want to customize wave appearance in future
- Different visual tiers may require different rendering styles
- Style richness must scale by performance tier
- Timing truth must remain consistent regardless of visual customization

### Future customization surface

**Potential user customizations:**

- Waveform colors (beyond current red/blue/orange/gold palette)
- Bar width and spacing
- Gradient fills or solid colors
- Outline/contour emphasis
- Glow effects or animation
- Peak markers or annotations

**Architectural requirement:**
Waveform rendering pipeline must support style injection without corrupting:

- Timing accuracy
- Progress mapping
- Accumulation logic
- Performance constraints

### Style tiers

**Recommended future structure:**

**Lite tier:**

- Cheapest readable waveform
- Minimal decoration
- Solid fills or simple contours
- No animation

**Balanced tier (current baseline):**

- 96 bars for live trail
- Gold contour for reference
- Orange solid for compare
- Readable contrast

**Max / Ultra tier:**

- Richer visual skins
- Possible subtle animation
- Enhanced glow or depth cues
- Smoother gradients

**Constraint:** No architecture may assume heavy animation or rich visuals are always allowed.

---

## 11C. Performance-Aware Wave Rendering

### Scaling by visual tier

**Mandatory scaling:**

Live and recorded waveforms must scale rendering quality by user's performance tier.

### Tier specifications

**Lite tier:**

- Target: Lowest-end hardware, battery saving
- Rendering: Cheapest readable path
- Bar count: Possibly < 96 bars
- Effects: None
- Priority: Legibility over beauty

**Balanced tier (default):**

- Target: MacBook Pro 2013 equivalent
- Rendering: Current baseline (96 bars, accumulation)
- Effects: Minimal (contour vs solid distinction)
- Priority: Clear feedback, stable performance

**Max / Ultra tier:**

- Target: High-end modern hardware
- Rendering: Enhanced visual fidelity
- Effects: Optional subtle animation, glow, richer gradients
- Priority: Professional polish without breaking timing truth

### Architectural guardrails

**Non-negotiable constraints:**

1. Timing accuracy must never depend on visual tier
2. Progress mapping must remain deterministic
3. Accumulation logic must be tier-agnostic
4. Performance gate = MacBook Pro 2013 (if Lite works there, Max will fly)
5. Visual customization must not corrupt binary waveform data
6. Waveform fidelity/readability stays stable across tiers
7. Tiers may alter style richness, not core waveform geometry
8. Recorded overlay and live trail remain separate layers

**Implementation pattern:**

```typescript
// Good: style injected separately from data
const renderWaveform(data, style) {
  // data contains timing + amplitude
  // style contains colors, widths, effects
}

// Bad: style assumptions baked into data model
const renderWaveform() {
  // assumes 96 bars, orange color, no animation
  // ❌ Not customizable
}
```

### Future-proofing

**Design for change:**

- Assume users will request waveform themes
- Assume accessibility may require high-contrast modes
- Assume pro users may want finer granularity
- Assume mass market may prefer simpler visuals

**But:** Never compromise baseline performance for feature richness.

---

## 14. What Is Still Open

### Product / UX

- Compare semantics clarity
- Selected take as true A/B reference (direction accepted, implementation ongoing)
- Clearer visual difference between:
  - Reference layer (gold contour)
  - Active compare target (orange solid)
  - Recorded overlay
  - Live trail

### Technical

- Active compare target semantics finalization
- Possibly cleaner compare UI ownership
- Final visual distinction refinement

### Future waves

- Scoring / proximity
- Green match zones
- Exercise automation
- Takes Box
- Bounce
- Persistence
- AI coaching

---

## 15. Open Seams

### Seam T1 — Compare semantics

Current A/B model is technically landed but still product-ambiguous. Needs simplification toward selected-take-as-reference model.

### Seam T2 — Overlay target clarity

Clicked take, selected take, and latest ready fallback still need clearer product ownership.

### Seam T3 — ~~Live trail semantics~~

**RESOLVED (TC-W2D-004):** Progressive accumulated waveform landed. Higher-fidelity polish remains optional future enhancement.

### Seam T4 — Reference layer readability

**PARTIALLY RESOLVED (TC-W2P-004):** Gold contour/skeleton style implemented. May still benefit from additional visual separation polish.

### Seam T5 — Layout / polish

Controls placement and card sizing are still subject to product polish after logic stabilizes.

### Seam T6 — Analyser FFT refinement (minor cleanup)

FFT buffer size and sub-bar interpolation remain future micro-optimization opportunities:
- Current 1024-sample FFT: sufficient for production use
- Potential refinement: 2048+ for ultra-high-fidelity tier
- Sub-bar interpolation could smooth visual curves
- Ring-buffer exploration for research branch
**Assessment:** Small isolated seam, not blocking current stability

### Seam T7 — Exercise integration hardening (future wave)

Future work may address:
- In-flight capture alignment for Call & Response multi-window semantics
- Round-capture telemetry visibility for teacher diagnostics
- Recovery path documentation for interrupted exercises

---

## 16. Performance Doctrine

This subsystem must always respect:

### Target hardware

**MacBook Pro 2013**

**Meaning:** If it works well there, it will work almost anywhere.

### Therefore

Takes must prefer:

- cheap canvas paths
- small bar counts where possible (96 bars for live trail)
- local state over unnecessary global churn
- no transport rewrite
- no heavy redraw behavior
- no speculative complexity before proof

**Important:** A "beautiful" waveform that compromises responsiveness is not acceptable.

---

## 19. Immediate Roadmap

### Landed waves

- ✅ **W1 foundation landed** — core Takes infrastructure, recording, preview
- ✅ **W2A Hear live controls landed** — Context/Solo preview modes
- ✅ **W2B recorded overlay landed** — compare overlay foundation
- ✅ **W2C/W2D runtime stabilization landed** — imperative live trail, waveform normalization
- ✅ **W3 compare/lower-strip cleanup landed** — stale live bars removed, selected take semantics clear
- ✅ **TAKE-SYNC-TRUTH wave landed** — standard path reordered, telemetry added, diagnostics cleaned up
- ✅ **EXLOCK hardening wave landed** — unified lock helper, 17 surfaces protected, zero regression

### Wave next — Compare simplification

- ⏳ Pivot compare toward selected take = reference
- ⏳ Tie overlay target directly to clicked take intent
- ⏳ Improve compare clarity

### Wave after that — Aesthetics/skin wave

- ⏳ Waveform visual polish (higher-fidelity DAW-like look)
- ⏳ Style tier implementation (Lite/Balanced/Max)
- ⏳ Customization infrastructure

### Then

- Scoring / proximity
- Green match zones
- Block ratings
- Exercise automation

### Next roadmap lanes (sequenced)

**Lane 1: Composable I/V/T layer model**
- Separate instrumental/vocal/teaching concerns
- Cleaner ownership boundaries
- Easier to test and extend independently

**Lane 2: X-axis timing evidence lane**
- Visual timing feedback alongside waveform
- Early/late/on-grid indicators
- Proximity scoring foundation

**Parallel lane: Hidden recipe rehab**

**Current surface truth:**
- Default learner-facing Drill popover shows stable-2 recipes only
- Smoke/experimental recipes hidden until dedicated execution waves
- Special recipes require separate entry point (not RecipeCardPopover)

**Validation phases:**
- Phase 1: `No Training Wheels` (backing-only) — validate instrumental-only challenge
- Phase 2: `A Cappella Boss` (acappella-boss) — validate progressive backing difficulty  
- Phase 3: `Call & Response` (call-response) — redesign as special alternation mode with dedicated UI

---

## 18. Research Question

### Primary question (resolved)

**How do we implement a true DAW-like live waveform behind the playhead during recording?**

**RESOLVED (TC-W2D-004):** Progressive accumulated timeline-bar approach landed successfully.

**Implementation details:**

- Time-to-space mapping: `barIndex = progress × 96`
- Per-frame amplitude capture (min/max of 1024 samples)
- Single-bar updates preserving history
- Functional React state for immutability
- 96 fixed bars for performance on target hardware

**Runtime stabilization (W2D):**

- Imperative accumulator/controller/renderer split landed
- Waveform fidelity no longer degraded by tier geometry
- Stale live bars after stop fixed
- Live trail no longer depends on React per-frame state

**Open for future exploration:**

- Would a full ring-buffer approach provide noticeably better UX?
- Is 96 bars sufficient for professional use cases?
- Should we explore sub-bar interpolation for smoother visuals?

### Remaining research questions

1. How do we finalize compare semantics to make A-B comparison instantly understandable?
2. What's the minimal viable scoring/proximity system that doesn't compromise performance?
3. How do we support exercise automation without collapsing Takes into a full DAW?

---


## TakesPanel as Exercise Orchestration Host

> ⚠️ Architectural note: TakesPanel is not only a recording UI — it is the de facto exercise runtime executor.

TakesPanel contains 10+ `useEffect` hooks that orchestrate the full exercise lifecycle:

- **Scope resolution** — resolves exercise block scope on step change
- **Backing save/apply** — saves and restores stem volumes per exercise step
- **PlaybackRate save/apply** — saves and restores tempo for tempo-aware steps
- **V-Mix automation** — applies V-Mix per exercise step requirements
- **Volume restoration** — restores user volumes after exercise completion
- **Listen executor** — plays reference audio for listen steps (with previous-take preview polling)
- **Wait executor** — manages timed wait steps
- **Response cue/window management** — manages Call & Response countdown and window state

**Why TakesPanel?** Exercise execution requires direct access to Takes UI state (recording slots, waveform display, response windows).

**Future refactor candidate:** Extract orchestration effects to `useExerciseOrchestrator.ts` hook for testability.

## 21. One-Line Summary

Takes in beLive is a real block-based practice/compare subsystem with working recording, preview, overlays, **runtime-stabilized progressive accumulated live waveform**, and **comprehensive exercise execution lock protecting all interference surfaces**; its next critical step is product simplification of compare semantics toward the selected-take-as-reference model, while maintaining performance discipline on target hardware, separating waveform data truth from visual customization, **stabilizing learner-facing drill surface (stable-2 only) over exposing all modes**, actively rehabilitating hidden recipes through phased validation, and preserving **frozen 384-bar waveform geometry across tiers** with style scaling rather than geometry changes.
