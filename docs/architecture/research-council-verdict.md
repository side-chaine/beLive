# Research Council Verdict

> **⚠️ This document is a domain-specific reference. For the complete current architecture, see [Architecture Map 2.1](./architecture-map-2.1.md).**

**Status:** Architecture verdict freeze  
**Owner:** Center1.1  
**Last updated:** 2026-03-13  
**Related:**  
- `audio-engine.md`  
- `sync-system.md`  
- `reactive-lyrics-foundation.md`  
- `styles-system.md`  
- `performance-quality-system.md`

---

## 1. Purpose

This document captures the combined architecture verdict after the multi-model research council phase.

It does not replace the existing architecture documents.

Instead, it records:
- which directions were evaluated
- which ideas were accepted
- which ideas were rejected
- what the final beLive-specific hybrid architecture is
- what the next implementation order should be

This document is the decision bridge between research and implementation.

---

## 2. Frozen Inputs

The council verdict assumes the following already-frozen truths:

- transport authority remains in `AudioEngineV2`
- current line remains marker-driven
- word-sync remains additive over line sync
- trigger layer is a first-class runtime domain
- cue truth and fill truth are now explicitly separated
- `WordHighlightLine` is the reusable runtime word consumer path
- the bottom Styles Console shell already exists
- App Theme and lyric-style behavior are distinct concerns

These are not reopened here.

---

## 3. Accepted Hybrid Direction

The strongest combined direction is:

### 3.1 Three orthogonal domains
beLive should permanently separate:

1. **Timing Truth**
   - transport
   - marker line truth
   - word fill truth
   - trigger timing truth

2. **Style Intent**
   - font
   - word behavior
   - line behavior
   - recipes / looks
   - color routing intent

3. **Performance Budget**
   - what visual richness is allowed on the current device/session

These three concerns must not collapse into one store or one panel.

---

### 3.2 Performance is a first-class domain
The strongest accepted architecture is:

```text
src/performance/
```

Performance does **not** belong:
- inside `textStyle.store`
- inside the app theme system
- inside the trigger layer
- inside the Styles Console as a primary ownership root

Performance is a separate runtime policy domain.

---

### 3.3 User entry point for performance
The accepted user entry point is:

## **top-right avatar quick menu**

Performance / graphics settings are:
- global
- device/user oriented
- not a lyric styling choice

So they should live in the user quick menu, not in the bottom Styles Console.

---

### 3.4 Styles Console remains the creative surface
The bottom dock remains the user-facing surface for lyric styling.

Current/future sections:

- Font
- Word
- Line
- Look

Important:
the current "Theme" section in the lyric console should later evolve toward **Look** / **Recipe** terminology, to avoid confusion with App Theme.

---

## 4. What We Accept From GPT Research

The following ideas are accepted from the GPT research branch:

### 4.1 Performance / quality tiers
Accepted tiers:
- Lite
- Balanced
- Max
- Ultra

### 4.2 Performance must never alter timing truth
This becomes a frozen architecture rule.

### 4.3 `src/performance/` ownership root
Accepted as the strongest domain placement.

### 4.4 Avatar quick menu for graphics control
Accepted.

### 4.5 Recipe-based Random
Accepted as the strongest long-term random model.

### 4.6 Block-aware color routing as a meaningful structural layer
Accepted.

---

## 5. What We Accept From Opus Research

The following ideas are accepted from the Opus research branch:

### 5.1 Word lifecycle model
Words are not just active/inactive.

A future full model should allow:
- idle
- active fill
- lookahead / upcoming words
- completed / hold states later

### 5.2 Cue Window as architectural concept
The internal architectural idea of a word-level future window is accepted.

### 5.3 `Upcoming` as a strong user-facing label
For future word-level cue controls, user-facing language should be simple and non-conflicting.

### 5.4 Color routing table
Accepted as the strongest color source architecture:
- sources
- slots
- routing profile

### 5.5 Look / Recipe as the right lyric-style container
Accepted as the long-term naming direction for the lyric "theme" area.

### 5.6 Line rail form
The accepted line section shape is the rail model:

```text
Active   ○──○──●──○──○   Focus Soft    [A]
Preview  ○──●──○──○──○   Guide         [C]
Others   ○──○──○──●──○   Open          [D]
```

This is accepted as the strongest compact line control surface.

---

## 6. Final beLive-Specific Hybrid Architecture

The final combined architecture for beLive is:

### 6.1 Timing truth stays frozen
No council idea may reopen:
- transport truth
- marker backbone
- fill truth
- trigger truth
- cue/fill split

### 6.2 Style intent remains in style domain
Current owner remains:
- `textStyle.store`
- Styles Console
- future recipe/look model

### 6.3 Performance budget becomes separate policy layer
Current strongest path:
- new `src/performance/` domain
- user entry via avatar quick menu
- CSS/runtime policy via `data-visual-tier`
- local consumer resolution via hooks and CSS vars

### 6.4 Block-aware color becomes structural, not decorative
Color should increasingly come from semantic sources like:
- neutral
- mode
- current block
- next block

but should remain routed coherently, not exposed as chaos to the user.

### 6.5 Preview remains line-level
A critical semantic distinction is frozen:

- **Preview** = first line of the next block
- **not** the next lyric word(s)

This meaning must remain protected.

### 6.6 Upcoming words become separate later
Future word-level future guidance should be introduced as:
- a separate word-domain feature
- not collapsed into Preview

### 6.7 Random must remain coherent
Random should evolve through:
- recipes
- constrained variation
- performance-aware filtering
- mode-aware behavior

not through raw parameter chaos.

---

## 7. Accepted Semantic Language

The following language is now preferred:

| Concept | Preferred Meaning |
|--------|--------------------|
| Theme | App chrome / app-wide theme system |
| Look | Lyric presentation / recipe container |
| Preview | First line of next block |
| Upcoming | Future word guidance (user-facing) |
| Cue Window | Internal architecture term for future word guidance |
| Graphics | Performance tier user-facing label |
| Performance Tier | Internal policy term |

---

## 8. What Is Explicitly Rejected

The following directions are rejected:

### 8.1 Performance inside `textStyle.store`
Rejected because it mixes artistic intent with device/runtime policy.

### 8.2 Performance inside Theme system
Rejected because Theme owns app identity, not runtime budget.

### 8.3 Giant central mega resolver
Rejected as the primary architecture.
Resolution should remain local/consumer-friendly, driven by shared policy and CSS vars.

### 8.4 Renderer-specific ad hoc cue logic everywhere
Rejected because it would produce semantic drift.

### 8.5 Trigger-layer overreach into presentation state
Rejected.
Trigger layer remains timing/signal truth, not full presentation orchestration.

### 8.6 Random raw parameter soup
Rejected.

### 8.7 Modal-heavy control strategy
Rejected for the line/style interaction path.

---

## 9. Final Priority Order

The strongest next implementation order is:

### P1
Performance / quality domain foundation

### P2
Avatar quick menu graphics entry

### P3
First tier-aware simplification of existing visual consumers

### P4
Look / Recipe system deepening

### P5
Future Upcoming / Cue Window architecture

### P6
Preview handoff / richer semantic scene behavior

This order is accepted because it:
- stabilizes scaling
- protects performance
- avoids overbuilding future guidance before policy infrastructure exists

---

## 10. Immediate Next Practical Target

The strongest immediate implementation frontier after this verdict is:

## **Performance foundation first**

Meaning:
- document freeze
- `src/performance/` foundation
- user quality control entry
- first visual budget wiring

This is the highest-leverage next move.

---

## 11. One-Line Verdict

**beLive should scale through a hybrid architecture where timing truth stays frozen, lyric style intent lives in the Styles/Look domain, and a new first-class performance policy layer controls how richly that intent is rendered.**
