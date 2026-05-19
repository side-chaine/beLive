# Optimization Wave 1 — Stability / Contracts / Ownership Cleanup

**Status:** Completed Wave Freeze  
**Date:** 2026-04-08  
**Owner:** Optimization Architecture Track  
**Scope:** First optimization wave
**Related:**  
- `architecture-map-2.1.md`
- `interaction-schema-2.1.md`
- `performance-quality-system.md`
- `takes-system.md`
- future: `recording-capture-system-research.md`

---

## 1. Purpose

This document freezes the results of the first repository optimization wave.

The goal of this wave was **not** to redesign beLive architecture.  
The goal was to improve the repository by:

- removing real low-level risks
- tightening persistence/runtime contracts
- reducing hidden fragility in practice surfaces
- aligning structural visual ownership
- extracting stable logic from oversized components
- preserving the existing frozen hybrid architecture

This wave was intentionally constrained.

It did **not** include:
- transport rewrite
- bridge removal
- full React migration
- broad legacy purge
- large product-surface redesign

---

## 2. Optimization Doctrine Used in This Wave

This wave followed the rule:

> **Fix risks first, tighten contracts second, clean ownership third, extract stable logic fourth.**

Work was sequenced as:

```text
O1 — Hardening
O2 — Contract Tightening
O3 — Structural Ownership Cleanup
O4 — Thin Infrastructure Cleanup
O5 — Stable Logic Extractions
```

Large recomposition and performance investigations were intentionally deferred.

---

## 3. What Was Completed

---

### O1 — Hardening

#### O1A — AI UI HTML Hardening
Unsafe text-bearing `innerHTML` paths in AI UI were removed or replaced with safer text-only rendering patterns.

**Main outcomes:**
- text-bearing AI UI rendering paths now use safer DOM text insertion
- static decorative HTML (such as thinking animation markup) was left intact
- current repo hygiene improved even though AI is not part of beLive 2.0 shipping scope

#### O1B — Takes Lifecycle Hardening
Timer and cleanup ownership in `TakesControlStrip` was strengthened.

**Main outcomes:**
- active recording timers now have safer cleanup behavior
- delayed delete/re-record timeout gained explicit ownership
- error-path cleanup was improved
- interruption/unmount cleanup became more reliable

---

### O2 — Contract Tightening

#### O2A — Persistence Contract Tightening
Critical persistence shapes were strengthened.

**Main outcomes:**
- `TrackRecord.blocksData` and `TrackRecord.syncMarkers` no longer rely on loose `any[]`
- upload session payloads became more explicit
- alignment artifact typing was tightened
- playlist persistence typing was improved
- invalid JSON payloads are now less likely to silently poison persisted state

#### O2B — LyricsService Contract Repair
A high-blast runtime seam was repaired around block sanitization.

**Main outcomes:**
- `_sanitizeBlocks` compatibility seam restored for existing hybrid callers
- `textBlocks` flow became safer and more explicit
- invalid `_sanitizeBlocks` call path no longer breaks runtime block load flow

**Important note:**  
This was a **runtime seam repair**, not a full LyricsService redesign.

---

### O3 — Structural Ownership Cleanup

#### O3A — Structural Block Color Canon Cleanup
Block color ownership was unified.

**Main outcomes:**
- a shared canonical structural block color source was introduced
- theme primitive block colors now mirror from canonical source
- major duplicate color maps were removed from:
  - marker-related helper logic
  - SyncLyrics canonical block types
  - TakesPanel local block color helper
- CSS fallback values were aligned across key consumers:
  - WagonTrain
  - Rehearsal block cue / trackmap-aware line styling
  - word effects / neon block routing fallback values

**Why this mattered:**  
Block colors are not decorative only.  
They are structural song-form identity and future scene-seed inputs.

---

### O4 — Thin Infrastructure Cleanup

#### O4A — Thin Storage Utility
A minimal storage utility was introduced and one raw storage seam was migrated.

**Main outcomes:**
- storage access pattern became cleaner in selected mode/rehearsal volume restore path
- key names and migration semantics were preserved
- no storage-platform rewrite was attempted

This was intentionally a small, low-risk step.

---

### O5 — Stable Logic Extractions

#### O5A — TakesControlStrip Stable Extractions
Stable logic was extracted from `TakesControlStrip` without touching volatile exercise/recording orchestration.

**Extracted domains:**
- preview/playback logic
- delete logic
- practice interrupt handling

**Important follow-up:**  
A compatibility hotfix restored hidden preview exposure contracts used by internal consumers:
- `__stopPreviewFn`
- `__playTakeFn`

This preserved Tempo Ladder / compare-related hidden playback paths.

#### O5B — WaveformCanvas Stable Extractions
Stable logic was extracted from `WaveformCanvas` while leaving the volatile interaction state machine in place.

**Extracted domains:**
- render path
- hit-testing helpers
- viewport / playhead logic

**Not extracted yet:**
- full mouse orchestration state machine
- wheel-scroll interaction core

This kept risk low while reducing complexity.

---

## 4. What Became Better

After Wave 1, the repository became better in several concrete ways:

### 4.1 Safer
- fewer unsafe text-rendering paths
- better cleanup of active recording timers
- fewer hidden runtime seams

### 4.2 More honest in contracts
- persistence shapes are less soft
- upload/import flow is less permissive toward malformed payloads
- Lyrics/block sanitization path is less fragile

### 4.3 Cleaner in structural ownership
- block color drift across surfaces was significantly reduced
- future scene/visual work now has a stronger structural seed foundation

### 4.4 Easier to maintain
- `TakesControlStrip` no longer owns every stable concern directly
- `WaveformCanvas` no longer mixes all stable logic into one body
- selected storage access patterns became clearer

### 4.5 More ready for future work
This wave improved readiness for:
- future Visual Engine implementation
- descriptor-driven scene work
- future recording/capture investigation
- future product polishing in practice surfaces

---

## 5. Main Difficulties Encountered

This wave surfaced several important realities of the repo:

### 5.1 Hidden hybrid seams still exist
Some internal behavior depends on hidden compatibility contracts rather than obvious imports.

Example:
- preview compatibility exposure paths had to be restored after extraction

### 5.2 Runtime verification mattered more than code shape alone
Several changes were architecturally correct in isolation but still needed runtime verification to confirm they preserved behavior.

### 5.3 Contract tightening had to stay surgical
Trying to “fully clean” hybrid services would have increased risk.
Instead, only high-blast seams were touched.

### 5.4 Ownership cleanup is not cosmetic
Structural block color canon cleanup was not merely visual polish.
It corrected a real ownership drift that affected current surfaces and future architecture.

---

## 6. What This Wave Explicitly Did NOT Solve

Wave 1 intentionally did **not** solve all performance or rendering issues.

The following remain separate lanes:

### 6.1 Track load/start latency
A later dedicated investigation is needed for:
- catalog click → playback readiness delay
- audio load sequencing
- deferred/non-critical work in startup path

### 6.2 Take waveform post-stop drift
A later dedicated investigation is needed for:
- cases where live take waveform appears aligned during recording
- but committed take waveform shifts after stop/decode/trim/peaks path

This seam is especially important on weaker hardware and in Takes practice modes.

### 6.3 Recording/capture fidelity and smoothness
A later dedicated research branch is needed for:
- screen recording performance
- browser capture load
- word FX / neon / visual richness while recording
- audio fidelity inside recorded output
- V-Mix / compare audio behavior inside capture

### 6.4 Large panel recomposition
This wave did not yet attempt:
- `TakesPanel` split
- broad `MonitorMixPanel` split
- broad upload orchestration refactor
- broad logging migration

These are later waves only if justified.

---

## 7. Known Open Seams After Wave 1

### 7.1 Take waveform post-stop alignment seam
Known product seam:
- during recording, take wave can appear correctly aligned
- after stop, committed take waveform may shift left/right
- this remains open and separate from Wave 1

### 7.2 Track load feels slower than before
Known user-visible seam:
- load/play path may have become slower after additional features
- requires dedicated investigation, not guesswork

### 7.3 AI is parked for 3.0
AI-related code is not part of beLive 2.0 shipping scope.
Current AI-related hardening should be interpreted as:
- repo hygiene
- future readiness
not
- active 2.0 feature expansion

---

## 8. Current Repository Status After Wave 1

### Status summary
```text
Hybrid runtime architecture preserved ✅
Hardening wave completed ✅
Critical contract tightening completed ✅
Structural block color canon introduced ✅
Stable Takes/Canvas extractions completed ✅
Large recomposition deferred intentionally ✅
Dedicated performance/capture investigation still pending ✅
```

### Overall interpretation
Wave 1 should be understood as a **stabilization and foundation cleanup wave**.

It did not try to “finish optimization forever.”
It created a safer and cleaner base for the next serious investigations:
- track load speed
- recording/capture performance
- waveform post-stop fidelity
- future visual-engine implementation

---

## 9. Recommended Next Documentation / Research Files

Recommended follow-up docs:
- `track-load-latency-investigation.md`
- `recording-capture-system-research.md`
- `take-waveform-poststop-seam.md`
- `storage-contracts.md`
- `structural-color-canon.md`

---

## 10. Final Summary

**Optimization Wave 1 improved beLive’s safety, contract integrity, structural ownership clarity, and maintainability without breaking frozen hybrid architecture, and it now serves as the stabilization base for future investigations into track load speed, recording/capture performance, and waveform fidelity.**
```

---