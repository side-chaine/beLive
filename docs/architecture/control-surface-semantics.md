# Control Surface Semantics

> **⚠️ This document is a domain-specific reference. For the complete current architecture, see [Architecture Map 2.1](./architecture-map-2.1.md).**

**Status:** Semantic architecture freeze candidate  
**Owner:** Center1.1 + Styles Architect  
**Last updated:** 2026-03-14  
**Related:**  
- `control-surface-v2.md`
- `styles-system.md`
- `reactive-lyrics-foundation.md`
- `checkpoint-reactive-lyrics-v1.md`

---

## 1. Purpose

This document freezes the semantic meaning of the main lyric control surface.

It exists because several concepts were beginning to blur together:

- active word behavior
- line flow behavior
- block-level preview cues
- field treatment for non-active lines

Without freezing meaning first, implementation becomes confusing and misleading.

This document defines the correct semantic ownership of:

- Word
- Line
- Block Cue
- Look

---

## 2. Core Principle

The control surface must represent real product entities,
not just collections of visual knobs.

This means each section must answer:

> what part of the lyric experience does this actually control?

---

## 3. Word Domain

The Word domain controls the **main moving lyric unit**.

### Word owns:
- how the current word behaves
- how strongly the current word leads attention
- what kind of trailing history stays behind the word

### Word does NOT own:
- line flow
- next block preview line
- field treatment of all background lines

### Public Word structure
```text
Style
Focus
Trail
```

### 3.1 Style
This is the primary word behavior family.

Examples:
- Progress
- Underline
- Neon
- Bounce

Style is not a line control.
It is not a trail control.
It is not a block cue control.

It is the primary family of the active word.

### 3.2 Focus
Focus controls how strongly the word leads the scene.

Values:
- Off
- Soft
- Strong

### Important semantic rule
If `Focus = Off`,
the scene should return to a **line-first reading mode**.

This means:
- the word remains technically present
- but the word stops acting as the main visual leader
- line-level reading becomes dominant again

This is a major semantic rule and should remain explicit.

### 3.3 Trail
Trail controls what remains behind the active word.

Current public-safe scope:
- Off
- Line

`Scene` trail is not part of the current public-safe baseline.

Trail belongs to Word because it is the historical wake of the moving word.

---

## 4. Line Domain

The Line domain controls the **lyric flow field**.

This is not about block structure.
This is about the visible line sequence around the current line.

### Line owns:
- current active line behavior
- next line behavior in the immediate lyric flow
- field treatment of other lines

### Line does NOT own:
- word motion family
- active word progress semantics
- next block preview cue

### Correct public Line structure
```text
Active
Next Line
Others
```

### Block Cue is NOT in Line section
Block Cue remains a separate always-on structural cue.
It does not belong in the public Line controls.
The Line section controls the lyric flow field only:
- Active (current line)
- Next Line (immediate successor in reading flow)
- Others (background field treatment)

---

## 5. Active

`Active` controls the current active lyric line.

This includes:
- how strongly the line reads
- how much the line supports or recedes behind the active word
- how line-first reading works when Word Focus is Off

Active is not a block cue.
It is not about upcoming lines.
It is the current line.

---

## 6. Next Line

`Next Line` controls the line immediately following the active line in lyric reading flow.

This is a line-flow concept.

It is not the same thing as:
- first line of the next block
- structural preview of the next section

`Next Line` belongs to the line reading field.

### Naming clarification
The public label should be `Next Line` (not just `Next`) to emphasize
that this is about lyric line adjacency, not generic "next" semantics.

`Preview` must NOT be used as the public label for this control.

---

## 7. Others

`Others` controls the field treatment of the remaining non-active, non-next lines.

This is a scene-field/background-text concept.

`Others` should not be reduced to simple brightness semantics only.

### Direction for Others
Long-term `Others` should evolve toward:
- **TrackMap-aware toggle** — whether background lines reflect block identity
- **Presence rail** — control over how much background lines are visible at all

This moves `Others` from simple brightness toward intentional field composition.

### What to avoid in V1
- Forced source dropdowns
- Over-complicated multi-selector patterns

Keep the control focused: background field treatment.

---

## 8. Block Cue Domain

There is a separate semantic object that must not be confused with `Next`.

That object is:

# **Block Cue**

This is:
- the first line of the next block
- a structural cue
- often colored by TrackMap / next block identity

### Block Cue is not Line Next
Block Cue and Line Next are different:

- **Line Next** = next line in immediate lyric flow
- **Block Cue** = first line of the next structural block

These must remain separate.

### Current practical rule
Block Cue remains always visible and lightly styled.

Block Cue is a **separate structural object** — it does not live in the Line section.

It must not be mislabeled as `Preview` or confused with `Next Line`.

---

## 9. Look Domain

Look is the high-level lyric style container.

Look owns:
- coherent presets / recipes
- random scene generation
- later color behavior
- later family combinations

Look does not own:
- transport
- trigger truth
- direct line/word semantic meaning

Look coordinates style intent across domains.
It does not replace them.

---

## 10. Preview Terminology Freeze

The term `Preview` is currently dangerous because it can mean two different things.

This document freezes the distinction:

### `Preview` should NOT be used ambiguously.

If the control means:
- line immediately after active line
then use:
## `Next`

If the object means:
- first line of next block
then use:
## `Block Cue`

This distinction must remain protected.

---

## 11. Immediate Consequences for Implementation

### 11.1 Word section
Should remain:
- Style
- Focus
- Trail

### 11.2 Line section
Public structure is now:
- Active
- Next Line
- Others

Block Cue is explicitly NOT part of the Line section.

### 11.3 Block Cue
Remains a separate always-on structural object.
Does not belong in the public Line controls.
Not a mislabeled line rail.

### 11.4 Focus Off
Implemented as true line-first mode in Rehearsal.
When Focus = Off, word-level FX is bypassed and lines render as plain text.
Line becomes the main reading carrier again.

---

## 12. What Must Not Be Done

Do not:
- let `Preview` in Line mean the block cue
- let Block Cue live inside the Line section
- use `Next` without "Line" qualifier in public labels
- let Word own `Others`
- let line rails control block-level structure implicitly
- let future Upcoming/Cue Words reuse Preview naming
- let semantic confusion accumulate under cosmetic controls

---

## 13. One-Line Summary

**Word controls the moving word, Line controls the lyric flow field, Block Cue controls the first line of the next structural block, and these must never be confused again in the public surface.**
