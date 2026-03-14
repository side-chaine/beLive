# Styles System

> **⚠️ This document is a domain-specific reference. For the complete current architecture, see [Architecture Map 2.1](./architecture-map-2.1.md).**

**Status:** Foundation architecture freeze candidate  
**Owner:** Center1.1 + Styles Architect  
**Last updated:** 2026-03-13  
**Related:** `reactive-lyrics-foundation.md`, `sync-system.md`

---

## 1. Overview

The beLive Styles system is evolving into a compact visual control console for lyric presentation.

It must support:
- font behavior
- word behavior
- line behavior
- style themes / presets
- future recipe-driven randomization
- future handoff behavior between Preview and Active lines

This system must remain:
- compact
- intuitive
- fast to operate
- mode-aware
- scalable

---

## 2. Two Theme Layers

A critical distinction is now frozen:

### 2.1 App Theme
Owned by the existing theme engine:
- `theme-store.ts`
- `css-injector.ts`
- `ThemeSelector.tsx`

It controls:
- global UI chrome
- surfaces
- accent tokens
- mode-aware app theming

### 2.2 Lyric Style Profile
Owned by the Styles Console layer.

It controls:
- font choice and scale
- word FX / focus behavior
- line behavior
- lyric visual presets
- future scene-style random combinations

These two theme layers must remain distinct.

---

## 3. Current Styles Console Foundation

Current user-facing sections:
- Font
- Word
- Line
- Theme

Current state:
- Font section is real
- Word section is real
- Theme section is real as shell / preset area
- Line section is partially real and is now moving toward a preset-rail model

---

## 4. Why Line Needs a New Model

Simple chip controls were useful for testing,
but they are not the strongest long-term control surface.

The line domain needs:
- fast visual control
- compact screen usage
- richer semantic meaning than raw "low / medium / high"
- future compatibility with family banks and Random recipes

Because of that, line behavior should evolve into:
## **Line Preset Rail Model**

---

## 5. Line Preset Rail Model v1

The Line section should become three compact lanes:

- Active
- Preview
- Others

Each lane contains:
1. a discrete rail
2. a preset label
3. a bank badge

### Example shell

```text
Line
Active   ○──○──●──○──○   Focus Soft        [A]
Preview  ○──●──○──○──○   Guide Green       [C]
Others   ○──○──○──●──○   Open Mist         [D]
```

### Important note
In v1, bank badges are primarily structural / semantic.
They do not need to be fully interactive until real family bundles exist.

---

## 6. Lane Meanings

### 6.1 Active
Controls the current active lyric line.

### 6.2 Preview
Controls the preview line of the next block.
This is not the same as the next lyric line in continuous karaoke flow.

### 6.3 Others
Controls all non-active, non-preview lyric lines.
This creates scene depth and determines how strongly the active word stands out.

---

## 7. Rail Philosophy

A rail does not control a raw numeric value directly.

A rail selects a **preset step**.

That step maps to a named behavior preset.

This is stronger than exposing only:
- opacity
- color
- glow

because it keeps the control surface compact and expressive.

---

## 8. Bank Philosophy

A bank represents a visual family.

Suggested v1 family direction:

- A = Neutral
- B = Warm
- C = Cue
- D = Atmosphere

A bank should eventually encode:
- color family
- contrast style
- glow behavior
- scene character

In v1, banks may remain mostly semantic until family bundles are implemented.

---

## 9. V1 Mapping Strategy

To avoid unnecessary churn, v1 should reuse current real store values.

### Active lane
Current store values:
- `off`
- `soft`
- `strong`

### Preview lane
Current store values:
- `off`
- `hint`
- `guide`

### Others lane
Current store values:
- `dim`
- `medium`
- `low`

### User-facing labels may already improve
For example:
- `dim` → `Dim`
- `medium` → `Balanced`
- `low` → `Open`

Store keys do not need renaming yet.

---

## 10. Random Direction

Random should not become a chaotic parameter lottery.

The strongest long-term direction is:
## recipe-based Random

A Random recipe should combine:
- font choice
- word mode
- word focus
- Active lane preset
- Preview lane preset
- Others lane preset
- optional style preset/theme shell state

This creates:
- coherence
- variety
- speed
- many valid combinations without visual garbage

---

## 11. Preview Handoff — Future Direction

Preview should later support handoff behavior toward Active.

Examples:
- brighten near line end
- shift closer to active color family
- create intuitive "prepare to sing" motion

This is not part of v1 shell.
It should be built only after a proper line-progress / handoff signal exists.

---

## 12. Implementation Phases

### Phase LR0
Freeze architecture and document the model

### Phase LR1
Replace current Line chip rows with compact rail lanes in the UI shell

### Phase LR2
Keep v1 runtime on current line store values

### Phase LR3
Introduce bank family bundles

### Phase LR4
Introduce recipe-based Random

### Phase LR5
Introduce Preview handoff behavior

---

## 13. Current Best Interpretation

The Styles Console is not a traditional settings panel.
It is becoming a compact scene-control console for lyrics.

The Line section should therefore feel like:
- quick
- expressive
- preset-driven
- musical
- compositional

not like a set of raw sliders or modal pickers.

---

## 14. One-Line Summary

**The beLive Line section should evolve into a compact preset-rail console where Active, Preview and Others are controlled as semantic visual lanes, not just raw brightness values.**
