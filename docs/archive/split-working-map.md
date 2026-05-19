# Split Working Map

**Status:** Working architecture ledger / live technical map  
**Version:** 0.2  
**Date:** 2026-03-25  
**Owner:** Center 1.9 + Product Owner  
**Related:**
- `architecture-map-2.1.md`
- `interaction-schema-2.1.md`
- `audio-engine.md`
- `split-monitor-mix-v2.md`
- `pitch-integration-report.md`

---

## 1. Purpose

This document is the **working technical map** for Split.

It is not the final polished architecture doc.
It is the **truth ledger** for the live subsystem while product shaping continues.

Its job is to keep four things separate:

- **VERIFIED CURRENT** — what code does today
- **PRODUCT TARGET** — what Split is meant to become
- **OPEN SEAM** — what is still unresolved or hardware-sensitive
- **FROZEN** — what must not be casually reopened

This file should be updated after:

- scans
- implementation TCs
- verification passes
- product-contract clarifications
- real-device testing

---

## 2. Product Statement

### PRODUCT TARGET

**Split is beLive’s audio prompter subsystem.**

Its product role is:

- send music to the outward/main path
- give the singer a guided reference in headphones / BT
- align BT and main timing through a fast repeatable ritual
- use Auto Mix as a smart block-aware vocal reinforcement layer
- let a real rehearsal/live session stabilize quickly without complex setup

### Important semantic freeze

- **Split** = the full dual-output audio prompter subsystem
- **Auto Mix** = the block-aware vocal reinforcement layer
- **Line Up** = the canonical timing ritual
- Auto Mix is **not** the whole prompter system by itself

---

## 3. Vocabulary Freeze

### FROZEN

| Term | Meaning |
|------|---------|
| **Split** | Audio prompter subsystem / dual-output routing mode |
| **Auto Mix** | Block-aware vocal reinforcement layer on top of the vocal stem |
| **Line Up** | Canonical calibration ritual for BT ↔ main timing |
| **Pulse** | Synthetic calibration source used in Line Up |
| **Voc** | Vocal-based calibration source used in Line Up |
| **Main** | Outward path: speakers / PC / Zoom / hall |
| **Monitor / BT** | Headphones path for the singer |

### Semantic note

Older naming like **MonitorMix** still exists in code and file names.
Product-facing language is now **Split**.

---

## 4. Product Truth

### PRODUCT TARGET

Split exists to reduce cognitive load and increase confidence by separating:

- dense musical information in the room / main path
- guided reference for the singer
- fast timing correction for the actual session

This is **not** “set one ms value forever”.

This is a **repeatable session ritual**:

1. open Line Up
2. hear reference immediately
3. turn the drum
4. lock sync by ear
5. press **Sounds right**

### Current practical truth

Calibration should be treated as **session truth**, not mythical permanent absolute truth.

Bluetooth latency can drift between sessions and between devices.
The system should optimize for:
- speed
- repeatability
- trust
not for fake promises of perfect eternal ms stability.

---

## 5. Current Ownership Map

### VERIFIED CURRENT

| Layer | Owner |
|------|-------|
| React panel UI | `src/components/MonitorMixPanel.tsx` |
| UI state / actions | `src/stores/monitor.store.ts` |
| Hydration / event sync | `src/bridges/monitor.bridge.ts` |
| Routing engine | `js/monitor-mix.js` |
| Transport / source authority | `AudioEngineV2` via compat patch |
| Block timing truth | marker / lyrics system |

### VERIFIED CURRENT

`window.monitorMix` remains the long-lived singleton routing engine.

React does **not** own the audio graph.
React owns the panel and state layer around it.

---

## 6. Store Contract — Current Truth

### VERIFIED CURRENT

`src/stores/monitor.store.ts` contains the Split panel runtime store.

### State domains

#### A. Engine-synced fields
These are mirrored from the legacy engine through the bridge:

- `enabled`
- `routeMainEnabled`
- `includeMusic`
- `musicLevel`
- `vocalToMain`
- `vocalHallLevel`
- `delayMs`
- `compensateOn`
- `outputDeviceId`
- `mainDeviceId`
- all 6 Auto Mix On/Level pairs

#### B. UI-only fields
These are store-owned and not mirrored into engine today:

- panel UI state
- Line Up state
- Tap session assist state
- Back Vocal Stage 1 state
- UI output volume state
- enumerated devices array

### Important rule

The store is **not** persistence authority.
It is a React runtime state layer.

Persistence still lives in:
- legacy engine localStorage keys
- device calibration service for per-device memory

---

## 7. Bridge Contract — Current Truth

### VERIFIED CURRENT

`src/bridges/monitor.bridge.ts` is the boundary sync layer.

It does three jobs:

1. **hydrate** React state from `window.monitorMix`
2. **patch** persistence-aware setter methods onto the legacy engine
3. **subscribe** to engine / device events and mirror them into store

### VERIFIED CURRENT

Bridge patches these method families onto `window.monitorMix`:

- `getState`
- `_persist`
- `setMusicLevel`
- `setDelayMs`
- all 6 Auto Mix setters and levels

### VERIFIED CURRENT

Bridge listens to:

- `monitor-state-changed` on `document`
- `monitor-route-changed` on `document`
- `devicechange` on `navigator.mediaDevices`

### Important rule

Bridge direction is:

**engine → bridge → store**

This is a one-way sync contract.
UI writes go through store actions which call engine methods.

---

## 8. Persistence Boundaries

### VERIFIED CURRENT

There are **two different persistence layers** in Split:

#### A. Engine config persistence
Stored by `js/monitor-mix.js` in localStorage, including:

- `monitor:delayMs`
- `monitor:compensateOn`
- `monitor:includeMusic`
- `monitor:musicLevel`
- `monitor:deviceId`
- `monitor:mainDeviceId`
- `monitor:routeMain`
- `monitor:vocalToMain`
- `monitor:vocalHallLevel`
- 6-block Auto Mix On/Level pairs

#### B. Device calibration persistence
Stored by `src/services/device-calibrations.ts` under:

- `monitor:deviceCalibrations`

This is per-device memory:
- keyed by `deviceId`
- stores label, delayMs, confidence, calibratedAt, calibrationCount
- LRU capped at 20 entries

### VERIFIED CURRENT

Line Up seed priority in panel is:

1. device calibration (`getCalibration(outputDeviceId)`)
2. `lineUpDelayMs` from store
3. `st.delayMs` fallback

### Important caveat

Per-device calibration is only saved when `outputDeviceId` is truthy.
That is correct:
device memory belongs to a real selected output device, not to a generic default route.

---

## 9. Current Audio Graph Truth

### VERIFIED CURRENT

Split currently contains these main paths:

### A. Monitor / BT path

- `dest`
- `outputEl`
- sink selected via `outputDeviceId`

Potential sources into BT path:
- monitor gain path
- music tap
- calibration pulse

### B. Main path

- `mainDest`
- `mainEl`
- sink selected via `mainDeviceId`

Potential sources into main path:
- instrumental main branch
- vocal main gain
- calibration pulse

### C. Instrumental branch split

- `defaultBranchGain`
- `mainBranchGain`

### D. Vocal route

- source: `engine.vocalsSourceNode`
- gain: `vocalToMainGain`
- destination: main path

### VERIFIED CURRENT

When `compensateOn === 'main'`, delay compensation is applied to the main branch through `mainDelayNode`.

### VERIFIED CURRENT

Pulse calibration now also relies on a valid main delay path.
If normal routing is not yet ready, Pulse session creates a standalone calibration-safe delay node.

---

## 10. Split Enable Semantics

### VERIFIED CURRENT

Current Split CTA in panel performs a compound action:

- `enable({ skipMic: true })`
- `setRouteMain(true)`
- `setIncludeMusic(true)`

### VERIFIED CURRENT

Current split-first mode does **not** create the mic path.

This means:
- Split-first is not currently true self-monitoring
- it is currently main routing + BT reference + calibration + Auto Mix support

### OPEN SEAM

Long-term product shaping still needs a final answer for:
- what exactly singer should hear in BT in each mode
- whether future self-monitor path is part of Split baseline or a later layer

---

## 11. Auto Mix System Anatomy

### VERIFIED CURRENT

Auto Mix has 6 block domains:

- Intro
- Verse
- Pre-chorus
- Chorus
- Bridge
- Outro

Each has:
- `On`
- `Level`

### VERIFIED CURRENT

Runtime flow:

1. `active-line-changed`
2. Split resolves current block type from `lyricsDisplay.textBlocks`
3. matching Auto Mix block level becomes target
4. `vocalToMainGain.gain.value` is updated

### VERIFIED CURRENT

Auto Mix currently controls a **main-path vocal reinforcement gain**.

### VERIFIED CURRENT

Back Vocal UI is Stage 1 only:
- fully present in panel/store
- not yet engine-wired
- not persisted
- not bridged

### OPEN SEAM

Auto Mix gain changes are still instantaneous.
That keeps logic simple, but may create:
- abrupt transitions
- perceived lateness under load
- clicks on block edges

A future gain-ramp pass remains valid backlog work.

---

## 12. Line Up System Anatomy

### VERIFIED CURRENT

Line Up is the canonical timing ritual.

Core behavior:
- open session
- preview delay live
- commit once with **Sounds right**
- restore on **Cancel**

### VERIFIED CURRENT

Current Line Up uses:
- `previewDelayMs()` during adjustment
- `setDelayMs()` on explicit commit
- device calibration memory to seed the drum
- source chips (`Pulse` / `Voc`) inside active session

### FROZEN

Continuous-session doctrine:
- preview is continuous
- commit is explicit
- cancel restores pre-session value
- no fake “magic sync” behavior
- calibration remains a real-time ritual

---

## 13. Pulse Architecture — Current Truth

### VERIFIED CURRENT

Pulse is the current implemented calibration source.

### VERIFIED CURRENT

Pulse architecture has been substantially hardened.

Current Pulse session includes:

- dedicated session entry via `beginPulseCalibration(seedMs, intervalMs)`
- dedicated session cleanup via `endPulseCalibration()`
- startup token guard
- `_syncTestActive` guard against duplicate entry
- source-switch guards in panel
- sink reset before first hit
- delay-node validation / creation
- precise AudioContext scheduling
- explicit session-local vocal isolation

### VERIFIED CURRENT

Pulse no longer depends on audible timing from `setInterval`.
It now uses AudioContext-time scheduling for actual pulse emission.

### VERIFIED CURRENT

Source switching semantics:
- `Pulse` in sound mode → precise pulse sequence
- `Voc` in sound mode → pulse suppressed
- active-session switching starts/stops correctly
- live mode remains separate

### VERIFIED CURRENT

Legacy helper methods still exist in engine:
- `suspendForPulseLineUp()`
- `restoreAfterPulseLineUp()`

But they are **no longer panel-wired**.
They are residue, not current authority.

---

## 14. Voc Mode — Current and Target

### VERIFIED CURRENT

`Voc` chip is a real session branch in UI/runtime selection.

Current behavior:
- selecting `Voc` suppresses Pulse
- `Voc` chip is guarded by `hasVocals`
- invalid persisted Voc preference auto-recovers to Pulse on instrumental tracks

### PRODUCT TARGET

`Voc` should later become a true calibration source.

Likely v1 shape:
- first-block resolver
- temporary vocal emphasis
- temporary instrumental suppression
- full session-local restore

### OPEN SEAM

Real `Voc` calibration path is not yet implemented.
Current `Voc` is an honest branch placeholder, not a fake completed feature.

---

## 15. Current Split Panel Layout

### VERIFIED CURRENT

Dock panel now uses three columns:

- **Route**
- **Line Up**
- **Auto Mix**

### VERIFIED CURRENT

Route column currently keeps only Split-critical controls:

- main output selector
- Split CTA
- Music with me
- compensate target selector
- headphone output selector

### VERIFIED CURRENT

Route cleanup already removed:
- duplicate Delay slider
- summary block (`In ears / Out / Sync`)

This reduced dock height and clarified ownership:
- timing adjustment belongs to Line Up
- route selection belongs to Route

### VERIFIED CURRENT

Auto Mix column now shows block names on both sides.
The right BV side no longer repeats generic `(Back Vocal)` labels.

---

## 16. Current Real-World Hardware Truth

### VERIFIED CURRENT

Pulse architecture bugs have been fixed.
Remaining inconsistency is now strongly correlated with hardware behavior.

### VERIFIED CURRENT

Real BT behavior can still drift between sessions.

This is expected from consumer Bluetooth:
- codec negotiation
- internal buffer size
- chip behavior
- session re-initialization variance

### OPEN SEAM

Current remaining ambiguity is mostly **hardware trust**, not software chaos.

### Working product interpretation

If:
- pulse ritual works,
- commit works,
- playback sync is good after commit,

then slight variation on later re-open is not automatically a software bug.
It may be BT hardware variance.

---

## 17. Current Risks / Seams

### OPEN SEAM

1. Real `Voc` calibration runtime not implemented yet
2. Auto Mix still uses instant gain steps, not smooth ramps
3. BT latency may drift between sessions and devices
4. Heavier visual load may affect event timing on weaker hardware
5. Back Vocal remains UI-only Stage 1
6. Old legacy helper methods still exist in engine as residue

### OPEN SEAM — testing freeze note

Pulse implementation is now good enough to freeze while waiting for better BT hardware for further testing.

That is a product/testing freeze, not an architecture failure.

---

## 18. Frozen Decisions

### FROZEN

- Split is the audio prompter subsystem
- Auto Mix is smart vocal reinforcement, not the whole Split concept
- Line Up is the canonical timing ritual
- Continuous preview doctrine stays
- Commit remains explicit
- Cancel restores pre-session timing
- User source preference should be remembered
- `Pulse` / `Voc` are session source semantics
- Route and timing responsibilities should stay visually separated
- Calibration is a repeatable session ritual, not permanent absolute truth

---

## 19. Verification Ledger

### How to use this section

After each scan / TC / verification, append:
- Date
- ID
- What was proven
- What changed
- What remains open

---

### Ledger Entries

#### 2026-03-23 — Initial working map created

- skeleton created
- current truth / target truth / seam separation established
- ready for iterative updates

#### 2026-03-23 — TC-SPLIT-PULSE-001: Pulse startup stabilization

**What was proven:**
- pulse startup required async readiness handling
- AudioContext resume and sink readiness needed hardening
- cancel/start races existed

**What changed:**
- startup waits added
- sink readiness awaited
- startup token pattern introduced
- post-async validity checks added

**Seams closed:**
- ✅ unstable pulse startup
- ✅ late-start-after-cancel race

**Status:** VERIFIED COMPLETE

#### 2026-03-23 — TC-SPLIT-LINEUP-SOURCE-001: Real Pulse/Voc source branching

**What was proven:**
- source chips needed real runtime semantics
- active-session switching needed explicit branching

**What changed:**
- runtime `lineUpSource` field in engine
- persistent UI preference
- source mirrored store → engine
- pulse source starts/stops correctly in active session

**Seams closed:**
- ✅ cosmetic-only source chips
- ✅ clean Pulse/Voc branching

**Status:** VERIFIED COMPLETE

#### 2026-03-23 — TC-SPLIT-LINEUP-SOURCE-002: hasVocals guard for Voc source chip

**What was proven:**
- Voc source must be disabled on tracks without vocal stem
- persisted invalid source needed safety fallback

**What changed:**
- `hasVocals` guard in panel
- disabled Voc chip with tooltip
- safety auto-switch to Pulse

**Seams closed:**
- ✅ invalid Voc UX on instrumental tracks

**Status:** VERIFIED COMPLETE

#### 2026-03-24 — Pulse architecture hardening wave

**What was proven:**
- JS timer jitter made calibration untrustworthy
- pulse path needed precise scheduling
- source-switch and startup races could skip delay-node creation
- standalone delay path needed validation when normal routing was unavailable

**What changed:**
- Pulse session moved to dedicated architecture seam
- precise AudioContext scheduling replaced audible timer timing
- sink reset added before first hit
- `_syncTestActive` and scheduler guards hardened
- delay node creation path stabilized
- source-switch race fixed
- pulse session cleanup separated from commit
- panel now uses `beginPulseCalibration()` / `endPulseCalibration()`

**Seams closed:**
- ✅ setInterval timing instability
- ✅ duplicate pulse startup race
- ✅ missing main delay node during Adjust
- ✅ unstable first-entry pulse session behavior

**Status:** VERIFIED COMPLETE

#### 2026-03-25 — Split UI polish wave

**What was proven:**
- Route column still contained duplicate timing surface
- dock height could be reduced safely without losing core controls
- BV labels needed to reflect block names, not generic repeated wording

**What changed:**
- duplicate Route delay slider removed
- Route summary removed
- Auto Mix BV side now uses block names
- dock panel became shorter and clearer

**Seams closed:**
- ✅ duplicate timing control in Route
- ✅ unnecessary route summary clutter
- ✅ generic repeated BV row naming

**Status:** VERIFIED COMPLETE

---

## 20. Implementation Roadmap

### CURRENT PRACTICAL ORDER

#### Wave A — Freeze and document
- refresh working map
- keep Split architecture legible
- preserve current verified truth

#### Wave B — Hardware retest later
- retest with stronger BT devices
- confirm session-to-session stability envelope
- compare drift behavior across device classes

#### Wave C — Next likely engineering targets
1. Auto Mix gain ramp smoothing
2. Back Vocal engine wiring (Stage 2/3)
3. Real `Voc` calibration runtime
4. confidence / trust UX around BT drift if needed

---

## 21. Working Notes

### OPEN SEAM

Use this section for temporary notes before they are merged upward.

- current Pulse architecture is good enough to freeze while waiting for fresh BT hardware
- observed playback sync after commit is stronger than perceived pulse repeatability on reopen
- this suggests remaining seam is mostly device latency variance, not pulse timing architecture
- if future tests confirm visual load affects Auto Mix perception, performance-tier-assisted testing should be documented explicitly

---

## 22. One-Line Summary

**Split is beLive’s audio prompter subsystem; Auto Mix is its smart vocal reinforcement layer; Line Up is the canonical calibration ritual; and the current architecture is now software-stable enough that remaining uncertainty is mostly Bluetooth hardware variance rather than subsystem chaos.**