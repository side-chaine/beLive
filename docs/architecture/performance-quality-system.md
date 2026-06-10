# Performance / Quality System

> **⚠️ This document is a domain-specific reference. For the complete current architecture, see [Architecture Map 2.1](./architecture-map-2.1.md).**

**Status:** As-Built (v1.0)  
**Owner:** Center1.1 + Performance Architect  
**Last updated:** 2026-06-10  
**Related:** `audio-engine.md`, `sync-system.md`, `reactive-lyrics-foundation.md`, `styles-system.md`

---

## 1. Overview

beLive now needs a first-class performance / quality policy system.

This system is not an afterthought.
It is required because beLive is evolving into a multi-layer reactive visual application with:

- trigger-driven word FX
- line behavior control
- block-aware color routing
- preview cues
- audio-reactive visuals
- future richer scene/avatar/3D layers

The system must let users choose how much visual richness their device should render,
without changing the underlying timing truth.

---

## 2. Core Principle

A critical architectural rule is now frozen:

> **Performance policy must never alter timing truth.**

Performance / quality tiers may affect:
- visual richness
- effect layering
- motion intensity
- glow complexity
- background richness
- audio-reactive density
- future scene complexity

Performance / quality tiers must never affect:
- transport truth
- marker line truth
- word fill truth
- trigger timing truth
- cue vs fill semantics
- block structure truth

---

## 3. Three Orthogonal Domains

The strongest model separates three concerns permanently.

## 3.1 Timing truth
Owned by:
- `AudioEngineV2`
- marker-driven active line
- word-sync layer
- trigger layer

This remains frozen and performance-blind.

## 3.2 Style intent
Owned by:
- `textStyle.store`
- Styles Console
- style recipes
- word FX selection
- line rail selection

This represents what the user wants artistically.

## 3.3 Visual budget
Owned by a new performance domain.

This represents what the runtime/device should allow visually.

---

## 4. Resolved Visual Config

The final rendered visual state should come from:

```text
style intent
×
visual budget
×
mode context
×
semantic context
→
effective visual config
```

Examples:
- user chooses Neon
- device is on Lite
- renderer still uses Neon semantics
- but with simplified glow / cheaper implementation

This means users do not lose the meaning of their style choice.
They get a tier-appropriate implementation of it.

---

## 5. Architectural Placement

The strongest ownership root is:

```text
src/performance/
```

### Current structure
```text
src/performance/
├── performance.types.ts
├── performance.store.ts
├── performance.presets.ts
├── performance.detect.ts
├── performance.hooks.ts
├── performance.bridge.ts
├── performance.clamp.ts
├── performance.recording.ts
├── performance.store.test.ts
└── performance.clamp.test.ts
```

### Ownership split
- `src/performance/` → runtime quality policy
- `src/theme/` → app chrome / global theme identity
- `textStyle.store` → lyric style intent
- trigger layer → timing semantics
- consumers → final render decisions using resolved policy

---

## 6. Performance Tiers

Recommended first-generation tiers:

- `lite`
- `balanced`
- `max`
- `ultra`

### 6.1 Lite
Use for:
- weak devices
- battery-sensitive sessions
- stability-first scenarios

Characteristics:
- minimal glow complexity
- simplified word FX
- minimal preview richness
- no heavy motion
- simplified backgrounds
- reduced audio-reactive visuals
- future 3D/avatar off

### 6.2 Balanced
Default recommended mode.

Characteristics:
- current baseline quality
- full practical readability
- current word FX supported
- moderate line richness
- moderate preview richness
- moderate background richness
- lightweight audio-reactive support

### 6.3 Max
Richer visual mode for stronger devices.

Characteristics:
- richer glow stacks
- stronger line/preview behavior
- fuller audio-reactive richness
- more visual density
- future stronger scene support

### 6.4 Ultra
Opt-in showcase tier.

Characteristics:
- highest visual richness
- future heaviest scene/avatar layers
- richest compositing
- strongest reactive scene behavior

Ultra should not be the default.

### 6.5 Performance Hooks

The following React hooks expose performance policy to consumers:

| Hook | Returns | Purpose |
|------|---------|---------|
| `usePerformanceTier()` | `PerformanceTier` | Current active tier |
| `useVisualBudget()` | `VisualBudget` | Visual richness budget for current tier |
| `useRendererBudget()` | `RendererBudget` | Renderer-specific budget limits |
| `useAudioBudget()` | `AudioBudget` | Audio-reactive visualization budget |
| `usePerformanceEffect()` | `void` | Side-effect triggered on tier change |

---

## 7. Quality Policy Domains

A tier should control budgets across these domains.

## 7.1 Word domain
Examples:
- allowed word FX richness
- max glow complexity
- motion allowance
- cue word count caps later
- completed-word richness later

## 7.2 Line domain
Examples:
- active line richness
- preview richness
- future handoff allowance
- line motion richness

## 7.3 Background domain
Examples:
- blur richness
- ambient motion
- scene layers
- particles later

## 7.4 Audio-reactive domain
Examples:
- beat pulse allowance
- frequency-band richness
- spectral richness later

## 7.5 Scene / avatar domain
Examples:
- future 3D allowance
- avatar richness
- environment richness

---

## 8. User Entry Point

The strongest user-facing location for performance tier control is:

## **top-right avatar quick menu**

Why:
- it is a user/device-level preference
- it is not a lyric styling control
- it should not compete with creative controls in the Styles Console
- it scales naturally into future user/profile settings

### Suggested quick menu content
- Graphics quality:
  - Lite
  - Balanced
  - Max
  - Ultra
- Reduce Motion (later)
- Restore Recommended (later)

This should be:
- fast
- compact
- no modal chain
- directly accessible

---

## 9. Styles Console Relationship

The Styles Console should remain responsible for:
- font
- word
- line
- look/theme/recipe behavior

It should not own:
- device performance policy
- graphics quality tiers

This separation is now architectural.

### Rule
Styles Console = artistic intent  
Avatar quick menu = runtime/device budget

---

## 10. CSS / Runtime Integration

A performance bridge should publish the current tier into the DOM as:

```html
<html data-visual-tier="balanced">
```

This allows:
- CSS gating
- low-overhead tier-based visual changes
- consumer hooks to resolve richer vs simpler visual implementations

### Important note
Consumers should not all sniff device capabilities directly.
They should read the resolved policy.

---

## 11. Store Model

Suggested store shape:

```ts
type PerformanceTier = 'lite' | 'balanced' | 'max' | 'ultra';

interface PerformanceState {
  tier: PerformanceTier;
  autoDetect: boolean;
  detectedTier: PerformanceTier;

  setTier: (tier: PerformanceTier) => void;
  setAutoDetect: (auto: boolean) => void;
}
```

This should be persisted as user preference.

---

## 12. Playback Visual Scheduler

Система `src/playback/` — общий rAF coordinator:

- `playback-visual-scheduler.ts` — Shared rAF loop
- `playback-visual-runtime.ts` — Runtime helpers
- `playback-visual.types.ts` — Frame context types

Участники scheduler (зарегистрированы):
- trigger.bridge
- performance.bridge
- stem-reactive.bridge
- billy.bridge

---

## 13. VisualMixer Pipeline

CSS var-based reactive pipeline:

- `stem-reactive.bridge.ts` — per-stem CSS vars
- `audio-reactive.bridge.ts` — frequency analysis → CSS vars

---

## 14. Rendering Strategy

The strongest rendering strategy is:

- no giant global mega-resolver
- local consumer hooks
- CSS vars and `data-visual-tier`
- style intent and performance budget resolved close to rendering

### Why this is stronger
It:
- avoids giant central complexity
- scales better
- keeps ownership local
- remains additive

---

## 15. Anti-Patterns

Do not do any of the following:

### 15.1 Do not put performance tier inside `textStyle.store`
That would mix creative intent with device/runtime policy.

### 15.2 Do not put performance tier inside the theme system
Theme = identity. Performance = budget.

### 15.3 Do not let performance change timing truth
No transport changes.
No trigger changes.
No cue/fill semantic changes.

### 15.4 Do not create a giant bag of booleans
Use coherent tier policies, not dozens of per-effect flags.

### 15.5 Do not hide performance controls inside Styles Console
Wrong user mental model.

### 15.6 Do not make aggressive live auto-switching the first release
Stable user-selected tiers are stronger than unpredictable visual changes mid-song.

---

## 16. Phased Rollout

### Phase P0
Document and freeze architecture

### Phase P1
Create `src/performance/` domain:
- types
- store
- presets
- bridge
- hooks

### Phase P2
Expose tier selection through avatar quick menu

### Phase P3
Apply first real policy effects:
- simplify Neon on Lite
- disable Bounce on Lite
- cap richer visuals later
- keep Balanced as current baseline

### Phase P4
Expand into:
- preview richness
- cue-word richness later
- background richness
- future scene systems

---

## 17. Strategic Interpretation

The performance / quality system is not a small option menu.

It is the policy layer that lets beLive scale from:
- weak devices
to
- rich visual performance systems

without breaking semantic correctness.

This is a foundational architecture step.

---

## 18. One-Line Summary

**beLive performance tiers must become a first-class runtime policy system that controls visual richness while leaving timing truth completely untouched.**
