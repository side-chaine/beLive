# Checkpoint: Reactive Lyrics v1

> **⚠️ This document is a domain-specific reference. For the complete current architecture, see [Architecture Map 2.1](./architecture-map-2.1.md).**

**Status:** Milestone freeze checkpoint  
**Owner:** Center1.1  
**Last updated:** 2026-03-13  
**Related:**  
- `audio-engine.md`
- `sync-system.md`
- `reactive-lyrics-foundation.md`
- `styles-system.md`
- `performance-quality-system.md`
- `research-council-verdict.md`
- `responsiveness-recovery.md`

---

## 1. Purpose

This checkpoint freezes the current state of the first major reactive lyrics wave in beLive.

It exists to:
- record what is already stable enough
- separate shipping-grade behavior from exploratory behavior
- capture the current performance and productization conclusions
- preserve momentum before returning to the main direction:
  - word-sync as product-grade guidance
  - better Look / Styles control surface for Rehearsal

This is not a replacement for the larger architecture docs.
It is a milestone snapshot.

---

## 2. What Was Achieved

The following major systems now exist and are real:

### 2.1 Reactive lyric foundation
- marker-driven current line backbone remains intact
- word-sync is active and durable
- cue / fill split is explicit
- trigger layer exists as a first-class domain
- `WordHighlightLine` is a reusable runtime consumer

### 2.2 Working word FX baseline
Current working word FX families:
- `progress`
- `underline`
- `neon`
- `bounce`

### 2.3 Styles / Look console foundation
The compact bottom control console now has real sections for:
- Font
- Word
- Line
- Theme (future Look direction)

### 2.4 Line semantics
Line domain has been structurally clarified into:
- Active
- Preview
- Others

Important:
- `Preview` = first line of the next block
- not upcoming words

### 2.5 Recipe direction
Rehearsal recipes / randomization direction is now established and meaningful.

### 2.6 Performance foundation
A first-class `src/performance/` domain now exists:
- performance tiers
- store
- bridge
- hooks
- avatar quick menu entry

### 2.7 Hot-path improvement
The following hot-path optimizations already landed:
- CSS var batching utility
- trigger hot writer batched
- audio-reactive hot writer batched
- `wordProgress` removed from Zustand hot path
- playback visual scheduler foundation created
- trigger bridge migrated under scheduler
- audio-reactive bridge migrated under scheduler
- lyrics line sync migrated under scheduler

### 2.8 Recording-safe policy
A first recording-safe visual clamp exists:
- recording state is recognized
- visual budget is clamped during recording
- recording UI shows capture optimization state

---

## 3. Shipping-Grade Baseline

The current best shipping-safe baseline is:

### 3.1 Rehearsal / playback
- `Progress`
- `Underline`
- `Neon`
- `Bounce` as a lighter accent mode
- `Trail = Off / Line`

### 3.2 Performance
- `Balanced` is the strongest default
- `Lite` is safe mode
- `Max` / `Ultra` are richer opt-in modes

### 3.3 Structural color routing
- Preview follows next block color
- Neon follows current block color
- this already creates useful structural coherence with TrackMap

---

## 4. Experimental / Not Shipping-Grade Yet

The following should not be treated as fully productized yet:

### 4.1 Scene trail
`Scene` trail is currently considered exploratory.
It is richer than the current shipping-safe path and can reduce clarity / responsiveness.

### 4.2 Upcoming / Cue words
Future upcoming word guidance is not yet implemented and should not be confused with Preview.

### 4.3 Preview handoff
The system does not yet have the stronger semantic handoff behavior for Preview.

### 4.4 Richer line family interactivity
Rail family banks and richer line family editing remain future work.

### 4.5 Camera-in-recording visual mode
Recording with more visual richness plus future camera overlay is not yet productized.

---

## 5. Performance Conclusions So Far

### 5.1 Strong conclusion
The current main bottleneck is no longer raw timing truth.
It is the playback visual publication path and the richness of compositor-heavy effects.

### 5.2 Legacy conclusion
Legacy tail is currently more of an architecture drag than the primary direct FPS killer.

### 5.3 Practical device truth
On an older MacBook Pro 2013 class machine:
- `Balanced` is workable
- `Trail Off / Line` is acceptable
- rich `Neon` during recording remains expensive
- this is now an honest and acceptable baseline truth

### 5.4 Hot-path conclusion
The scheduler / batching / store-churn cleanup path was the correct engineering move.

---

## 6. Product Truths Now Frozen

The following truths should be treated as stable unless strong new evidence appears:

### 6.1 Word is the main moving reactive unit
The active fill word remains the visual leader.

### 6.2 Preview is line-level and block-level
Preview means:
- first line of next block

It does not mean:
- upcoming words

### 6.3 Performance is a separate domain
Graphics / performance policy should remain:
- outside textStyle store ownership
- outside app theme ownership
- available from the avatar quick menu

### 6.4 App Theme and lyric Look are distinct
App Theme remains global chrome.
Lyric style remains a separate Look/recipe direction.

### 6.5 Shipping trail scope is limited
Current public-safe trail path is:
- `Off`
- `Line`

---

## 7. Current Recommended Public Surface

### Keep public and stable:
- Word FX families
- Word focus
- Trail Off / Line
- Rehearsal recipes
- Graphics tier switching

### Keep internal / cautious:
- Scene trail
- richer future cue systems
- more aggressive scene richness

---

## 8. Main Risks That Still Exist

### 8.1 Visual richness can still outrun clarity
Especially in rich modes or future expansions.

### 8.2 Recording remains sensitive on weaker hardware
Particularly with visually richer word FX such as Neon.

### 8.3 The console shell is ahead of full semantic completion
The shell is strong, but not all future intended semantics are implemented yet.

---

## 9. Main Direction Resumes Here

After this checkpoint, the strongest main direction returns to:

## 9.1 Sync words as product-grade guidance
Continue making word-sync feel like a real singing guide, not just decoration.

## 9.2 Better Rehearsal Look / Styles console
Continue evolving the control surface into the best practical preset / recipe tool for Rehearsal.

This means:
- not more random richness first
- but stronger clarity, control, and musical guidance

---

## 10. What Comes Next

The likely next major frontier is:

- better Look / Styles control structure
- stronger preset / recipe UX
- future upcoming-word guidance, if still justified
- continued careful optimization where it gives clear value

Not now:
- giant rewrite
- full legacy purge
- uncontrolled visual expansion

---

## 11. One-Line Summary

**Reactive Lyrics v1 is now a real, working, performance-aware lyric system in beLive, with a stable shipping baseline and a clear path back toward sync-guidance and a stronger Rehearsal control console.**
