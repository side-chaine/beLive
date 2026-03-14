# Reactive Lyrics Foundation

> **⚠️ This document is a domain-specific reference. For the complete current architecture, see [Architecture Map 2.1](./architecture-map-2.1.md).**

**Status:** Phase 1 foundation freeze candidate  
**Owner:** Center1.1 + Trigger/Styles Architect  
**Last updated:** 2026-03-13  
**Related:** `audio-engine.md`, `sync-system.md`

---

## 1. Overview

beLive now has a real **reactive lyrics foundation**.

This is not just a word-highlighting trick.
It is a multi-layer runtime system that connects:

- transport timing
- marker-driven line sync
- word-sync timing data
- trigger normalization
- visual word consumers
- the first generation of a mode-aware Styles Console

This document exists to freeze the first complete foundation layer built on top of the React migration.

It should be read as a bridge document between:

- `audio-engine.md`
- `sync-system.md`

Those two documents remain source-of-truth for their own domains.
This document describes the runtime layer that turns sync truth into reactive lyric behavior.

---

## 2. Why This Document Exists

A new product layer now exists in beLive:

```text
Audio transport
→ marker / line sync
→ word-sync data
→ trigger layer
→ visual lyric consumers
→ styles-controlled presentation
```

This layer did not previously exist as one explicit documented system.

Without documenting it now, future work would risk:
- re-opening solved questions
- mixing cue timing and fill timing again
- coupling effects directly into components
- losing the architectural meaning of the trigger layer
- forgetting which paths are primary and which are still separate

This document freezes the first working architecture.

---

## 3. What Phase 1 Built

Phase 1 delivered the first real reactive lyric foundation.

### Proven capabilities now include:
- word-sync data hydration and durability
- a reusable trigger layer
- normalized word/line trigger signals
- CSS-variable driven word progress
- reusable `WordHighlightLine` rendering path
- word FX working in real runtime modes
- a compact Styles Console shell
- a first separation between cue timing and fill timing

This is no longer exploratory plumbing.
It is a working runtime substrate.

---

## 4. Ownership Map

## 4.1 Transport authority
**Owner:** `AudioEngineV2`

Transport remains fully owned by the audio engine.
Stores and bridges are mirrors or consumers, not authorities.

See:
- `audio-engine.md`

## 4.2 Current line authority
**Owner:** marker-driven line sync / `activeLineIndex`

Current line remains marker-driven.
This remains frozen by the sync architecture.

See:
- `sync-system.md`

## 4.3 Word-sync data authority
**Owner:** `wordSync.store`

`wordSync.store` owns:
- word timing access
- line timing access
- confidence-gated usability
- word lookup by time

This store is data-truth, not transport authority.

## 4.4 Trigger runtime authority
**Owner:** `src/triggers/`

The trigger layer now exists as a first-class runtime domain.

Main pieces:
- `trigger.types.ts`
- `trigger.bus.ts`
- `trigger.engine.ts`
- `trigger.store.ts`
- `trigger.bridge.ts`
- `detectors/word-line.detector.ts`

Its purpose is to convert timing truth into normalized reactive signals.

## 4.5 Visual word rendering authority
**Owner:** consumer components such as `WordHighlightLine`

Visual consumers do not detect timing themselves.
They consume normalized trigger/store state and render accordingly.

## 4.6 App theme authority
**Owner:** existing theme system

Global UI theme remains owned by:
- `theme-store.ts`
- `css-injector.ts`
- `ThemeSelector.tsx`

This is **App Theme**, not lyric behavior theme.

## 4.7 Lyric style surface
**Owner:** `StylesDeck` + `textStyle.store`

The Styles Console is currently the emerging lyric behavior control surface.
It is not yet the full final style profile system, but it is the foundation of it.

---

## 5. Runtime Chain

The current runtime chain is now:

```text
AudioEngineV2 currentTime
→ marker-driven active line
→ wordSync.store timing selectors
→ WordLineDetector
→ TriggerEngine
→ TriggerBus
→ TriggerBridge
→ CSS vars + TriggerStore snapshot
→ WordHighlightLine
→ mode renderer (Rehearsal / Karaoke / Live)
```

This chain is additive.
It does not replace the existing sync backbone.

---

## 6. Cue vs Fill Timing Split

One of the most important architectural findings of Phase 1 is that word timing needed to be split into two semantics.

## 6.1 Cue word selector
`getActiveWordForLine(rawLineIndex, currentTime)`

This selector uses:
- lookahead offset
- epsilon tolerance

Purpose:
- early-feel highlight
- responsive cue-style UX

This path remains valid for cue/highlight semantics.

## 6.2 Fill word selector
`getFillWordForLine(rawLineIndex, currentTime)`

This selector uses:
- raw current time
- exact word boundaries
- no lookahead

Purpose:
- real fill/progress timing
- accurate progress-based effects

## 6.3 Why this split matters
Originally, trigger word FX used cue truth while progress used raw word timing.
That created a semantic mismatch:

- words activated early
- progress started partly filled
- short words looked wrong
- the visual result felt unstable

The split fixes that architecture mistake.

### Freeze rule
Cue semantics and fill semantics must remain conceptually separate.

---

## 7. Trigger Layer Architecture

The trigger layer is now a first-class system.

## 7.1 Trigger contracts
Trigger domain currently supports:
- `word-start`
- `word-end`
- `word-active`
- `word-progress`
- `line-start`
- `line-end`
- `line-active`
- `trigger-reset`

## 7.2 Detector model
Current first detector:
- `WordLineDetector`

It reads:
- active line from `lyrics.store`
- word timing from `wordSync.store`

It now uses:
- fill-truth for word FX timing

## 7.3 Bus model
`triggerBus` is a lightweight synchronous pub/sub bus.

## 7.4 Bridge model
`trigger.bridge.ts` runs an rAF loop and produces:
- CSS vars:
  - `--bl-word-active`
  - `--bl-word-progress`
  - `--bl-line-active`
- throttled Zustand snapshot updates in `trigger.store`

## 7.5 Debug model
The system already supports debug visibility via:
- `TriggerDebugOverlay`
- trigger store debug flag
- CSS var inspection

---

## 8. Word Rendering Foundation

## 8.1 Reusable word renderer
`WordHighlightLine.tsx` is now the reusable word consumer for runtime modes.

It:
- renders word spans from `wordSync.store`
- activates the current word via trigger store state
- supports effect mode via `data-word-fx`
- supports focus level via `data-word-focus`

## 8.2 Current consumers
`WordHighlightLine` is now used in:
- Rehearsal
- Karaoke / Concert
- Live

## 8.3 Separate Sync Path
`SyncLyrics.tsx` remains a separate path.

It still:
- renders words manually
- uses its own active-word lookup path
- does not consume `WordHighlightLine`

### Important semantic difference
`SyncLyrics` uses `getActiveWordForLine` (cue truth) for its word highlighting.

This is intentional for now, but it is an explicit architectural split.
The trigger layer uses `getFillWordForLine` (fill truth) for word FX timing.
These two paths are intentionally separate during Phase 1.

---

## 9. Word FX Wave R1

Phase 1 also introduced the first usable word FX pack.

Current working modes include:
- `progress`
- `underline`
- `neon`
- `bounce`

## 9.1 Progress
- raw fill-truth based
- CSS-driven
- no longer cue/fill mismatched
- isolated from base active transition behavior

## 9.2 Underline
- strongest rehearsal-safe baseline
- low-noise
- highly readable

## 9.3 Neon
- brighter show-like emphasis
- still controlled

## 9.4 Bounce
- lightweight motion accent
- one-shot style

## 9.5 Focus levels
Current word focus levels:
- `off`
- `soft`
- `strong`

These shape intensity independently from FX mode.

---

## 10. Styles Console Foundation

A compact Styles Console shell now exists in the bottom dock.

### 10.1 Current shell
Current user-facing sections:

- Font
- Word
- Line
- Theme

### 10.2 What is real already
Real persisted controls already exist for:

- font family
- font scale
- transition set / transition id
- word focus level
- word FX mode

### 10.3 What is still partial
The current Line section is still mostly semantic/mock surface.
It is not yet fully wired into Rehearsal line rendering.

### 10.4 Product interpretation
This shell is the beginning of a lyric behavior console,
not just an FX panel.

It already embodies the future separation between:

- App Theme
- lyric style behavior

---

## 11. Theme Foundation Relationship

beLive already has a strong app theme system.

That system provides:

- CSS variable injection
- mode-aware accent changes
- reusable semantic tokens
- `data-theme`
- `data-mode`

The reactive lyrics foundation must build on top of that system, not replace it.

### Important distinction
App Theme = global UI chrome
Lyric style profile = text behavior and lyric presentation

This distinction is now architectural.

---

## 12. What Has Been Proven

### Proven by Phase 1
- trigger layer works end-to-end
- word progress can drive live visual behavior
- cue/fill mismatch was identified and corrected
- runtime word FX can work in Rehearsal
- other runtime modes also benefit from improved word timing
- the bottom dock can host a compact style console
- React now fully owns the real lyric rendering surfaces

---

## 13. Known Limitations

The following are still intentionally open.

### 13.1 SyncLyrics is separate
Sync editor still uses a separate render path.

### 13.2 Rehearsal line controls are not fully wired
The Line section exists in the Styles Console,
but line emphasis control is not yet fully connected to Rehearsal runtime styling.

### 13.3 Residual Rehearsal line highlight
In Progress mode, the active line in Rehearsal still appears slightly highlighted.
This is a remaining line-level styling interaction outside the word FX layer.

### Root cause
- **Source:** `RehearsalLyrics.module.css`
- **Selector:** `.line[data-active="true"]`
- **Property:** `text-shadow: 0 0 20px rgba(255, 255, 255, 0.6), 0 0 40px rgba(255, 255, 255, 0.2)`
- **Issue:** Line wrapper glow conflicts with Progress word FX (which uses `background-clip: text`)

This is not a trigger bug. It is a remaining line-level styling interaction that needs suppression when Word FX is active.

### 13.4 No completed-word hold yet
A cumulative completed-word model was explored,
but was intentionally rolled back until timing/state semantics are properly frozen.

### 13.5 No full style profile model yet
The console exists, but mode-aware lyric style profiles are not fully encoded in store shape yet.

---

## 14. What Must Not Be Reopened

Do not reopen:

- transport authority in AudioEngineV2
- marker-driven line backbone
- additive sync model
- trigger layer as a separate first-class domain
- cue/fill timing split
- WordHighlightLine as a reusable runtime consumer path
- reuse of the existing app theme engine

These are now foundation truths.

---

## 15. Implementation Matrix

| Component | Status | Notes |
|-----------|--------|-------|
| Word Sync Store | ✅ LIVE | `getActiveWordForLine` (cue), `getFillWordForLine` (fill) both implemented |
| Trigger Layer | ✅ LIVE | Full stack: bus, engine, bridge, detector, store, debug overlay |
| WordHighlightLine | ✅ LIVE | Used in Rehearsal, Karaoke, Live |
| Word FX Modes | ✅ LIVE | `progress`, `underline`, `neon`, `bounce` all in `word-effects.css` |
| Word Focus Levels | ✅ LIVE | `off`, `soft`, `strong` with CSS overrides |
| StylesDeck Word Section | ✅ LIVE | Full UI + persistence |
| StylesDeck Font Section | ✅ LIVE | Font select, scale controls, preview |
| StylesDeck Theme Section | ✅ LIVE | Preset display, randomize, mode pill |
| StylesDeck Line Section | 🟡 SEMANTIC / PARTIAL | `lineActive/Next/Others` labels exist but NOT wired to rendering |
| Line Level Controls | 🟡 STORE EXISTS, UI PARTIAL | `lineActiveLevel`, `lineNextLevel`, `lineOthersLevel` persisted but not connected |
| SyncLyrics | 🔴 SEPARATE PATH | Uses own word render, `getActiveWordForLine` (cue), NOT `WordHighlightLine` |
| Rehearsal Residual Line Glow | 🟡 KNOWN ISSUE | `.line[data-active="true"]` text-shadow conflicts with Progress FX |
| Cumulative/Completed Word State | 🔴 EXPLORATORY / ROLLED BACK | Not in current codebase |

---

## 16. Immediate Next Steps

After this documentation freeze, the strongest next work is:

- suppress residual line glow for Progress mode (add `data-word-fx-mode` to line wrapper)
- wire real line controls into Rehearsal rendering
- continue mode-aware Styles Console evolution
- later styles-system documentation
- later revisit cumulative/completed word states on top of the corrected timing model

### Not now:

- giant visual rewrite
- SyncLyrics unification
- advanced particle / destruction FX
- replacing the theme system

---

## 17. Strategic Interpretation

The beLive sync frontier has now expanded.

It is no longer only:

- marker timing
- word timing
- alignment quality

It now also includes:

- runtime reactive lyrics behavior
- normalized trigger semantics
- cue vs fill timing correctness
- style-controlled word presentation

This is the real first phase of the reactive lyric system.

---

## 18. One-Line Summary

**Reactive Lyrics Foundation is the first completed runtime layer that turns beLive sync truth into reusable trigger-driven lyric behavior across real app modes.**
