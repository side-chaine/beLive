# Tempo Scenario Current Truth

**Status:** Current Product Reality Document  
**Date:** 2026-04-06  
**Purpose:** Honest documentation of how Tempo Scenario works today, separate from future roadmap  
**Related Docs:** [scenario-stage-state-model.md](./scenario-stage-state-model.md), [quest-scenario-system.md](./quest-scenario-system.md), [takes-system.md](./takes-system.md)

---

## 1. Purpose

### 1.1 Why Tempo Scenario Needs Its Own Current-Truth Doc

Tempo Scenario is currently **experimental** and under active development. This document exists to:

- **Document current working behavior honestly** — what actually happens today, not what we plan
- **Separate current reality from future roadmap** — avoid overclaiming or mixing aspirations with facts
- **Freeze current product state** — provide a stable reference for implementation and testing
- **Identify known seams clearly** — document what works, what's partial, what's under observation
- **Prevent historical rewriting** — capture this moment in the evolution of Tempo Scenario

### 1.2 Why Current Implementation Must Be Documented Separately from Future Tempo Roadmap

**Current state:** Tempo Scenario is a working experimental family with known limitations.

**Future state:** Tempo Scenario may evolve significantly (compare semantics, V-Mix routing, hold/advance system).

**Risk of mixing:** If we document "current + future" together, we lose clarity about what's real today vs what's aspirational.

**Solution:** This document captures **current truth only**. Future enhancements are documented separately in roadmap docs.

---

## 2. Current Product Statement

### 2.1 What Tempo Scenario Is Today

**Tempo Scenario is an experimental scenario family** that enables progressive tempo-based practice.

**Current user flow:**

1. User selects a starting tempo (e.g., 70%, 85%, or 100%)
2. System generates explicit stages walking toward 100% (original tempo)
3. Each stage follows: reference listen → record → optional previous-take preview
4. User completes rounds at each stage, then advances to next faster tempo
5. Final stage is always 100% (original tempo)
6. Takes recorded at non-100% tempos are marked as training takes
7. Takes recorded at 100% are marked as final takes

**Current surface visibility:** Experimental/smoke surface (not shown in default learner launcher)

**Current recipe ID:** `tempo-ladder`

**Current generator:** `src/exercises/generators/tempo-ladder.generator.ts`

---

## 3. Current Setup Truth

### 3.1 Tempo Slider Range

**Current slider range:** 50–150 (representing 50% to 150% of original tempo)

**Current default:** 100% = original tempo

**Current setup behavior:**

- User can adjust playback rate via slider before entering Tempo Scenario
- Selected rate becomes the starting point for scenario generation
- Scenario generates stages walking toward 100% from that starting point

**What is currently visible in the room:**

- Tempo slider in ControlDeck (always visible, user-controlled)
- Playback rate display (shows current %)
- Tempo Scenario card in practice launcher (experimental surface)
- Stage progression display during active scenario (round/stage indicator)

### 3.2 Current Tempo Ladder Generation

**If user selects 70% as starting tempo:**
- Stage 1: 70% tempo
- Stage 2: 75% tempo (70% + 0.05)
- Stage 3: 80% tempo
- Stage 4: 85% tempo
- Stage 5: 90% tempo
- Stage 6: 95% tempo
- Stage 7: 100% tempo (final)

**If user selects 85% as starting tempo:**
- Stage 1: 85% tempo
- Stage 2: 90% tempo
- Stage 3: 95% tempo
- Stage 4: 100% tempo (final)

**If user selects 100% as starting tempo:**
- Stage 1: 100% tempo (final, single stage)

**Ladder increment:** Fixed 0.05 (5%) per stage

---

## 4. Current Generated Stage Truth

### 4.1 How Stages Are Generated

**Generator location:** `src/exercises/generators/tempo-ladder.generator.ts`

**Generation algorithm:**

```
Input: startRate (e.g., 0.9 for 90%), previewBetweenRounds flag

If startRate < 1.0:
  Generate ascending ladder: startRate → startRate+0.05 → ... → 1.0
Else if startRate > 1.0:
  Generate descending ladder: startRate → startRate-0.05 → ... → 1.0
Else:
  Single stage at 1.0

For each stage:
  Add listen step (reference listen at that tempo)
  Add record step (record at that tempo)
  If previewBetweenRounds enabled:
    Add listen step (previous-take preview at that tempo)
```

**Current step structure per stage:**

```
Stage N (at tempo T):
  1. Listen step
     - action: 'listen'
     - backing: 'full'
     - tempoRate: T
     - listenSource: 'reference'
     - instruction: "Listen at [T%]"
  
  2. Record step
     - action: 'record'
     - backing: 'full'
     - slot: 0
     - tempoRate: T
     - takeKind: 'training' (if T < 1.0) or 'final' (if T === 1.0)
     - instruction: "Record at [T%]"
  
  3. Previous-Take Preview step (optional, if previewBetweenRounds enabled)
     - action: 'listen'
     - backing: 'full'
     - tempoRate: T
     - listenSource: 'previous-take'
     - instruction: "Review your previous take at [T%]"
```

### 4.2 How previewAfterRound Works

**Current behavior:** When `previewBetweenRounds` parameter is true:

- After each record step, a separate listen step is inserted
- This listen step plays back the take just recorded
- User hears their own recording at the same tempo they just recorded at
- This is a **separate review stage**, not a hijack of the next reference listen

**Important distinction:** Previous-take preview does NOT steal the next reference listen stage. It's an additional stage inserted after record.

**Current implementation:** Controlled by `previewBetweenRounds` parameter in generator params

**Current default:** `previewBetweenRounds = false` (preview not enabled by default)

### 4.3 Previous-Take Preview Is a Separate Review Stage

**Current truth:** Previous-take preview is **not** automatic or mandatory.

**Current behavior:**

- If enabled, it appears as a distinct step after record
- User can listen to their take before advancing to next stage
- It's a **review opportunity**, not a forced comparison
- User can skip or advance past it

**Current semantics:**

- `listenSource: 'previous-take'` marks this as a review step
- Distinct from `listenSource: 'reference'` (original reference listen)
- Plays back the take from slot 0 (where record just wrote)

**Current limitation:** No automatic comparison with reference during previous-take preview (that's future work)

### 4.4 It No Longer Steals the Next Reference Listen Stage

**Current truth:** Previous-take preview is **additive**, not **replacement**.

**Old anti-pattern (not current):** Previous-take preview would replace the next reference listen, leaving user without reference context.

**Current pattern:** Previous-take preview is inserted as a separate step, then the next reference listen follows normally.

**Example flow (with preview enabled):**

```
Stage 1 (70%):
  1. Listen (reference) at 70%
  2. Record at 70%
  3. Listen (previous-take) at 70%  ← Review step
  4. [Advance to next stage]

Stage 2 (75%):
  1. Listen (reference) at 75%  ← Next reference listen, not stolen
  2. Record at 75%
  3. Listen (previous-take) at 75%
  4. [Advance to next stage]
```

---

## 5. Current Take Semantics

### 5.1 Current Slowed Takes Are Training-Context Takes

**Current truth:** Takes recorded at tempos below 100% are marked as `takeKind: 'training'`.

**Semantic meaning:**

- Training takes are **practice artifacts**, not final output
- They exist to build muscle memory and confidence
- They are **not** intended for downstream workflows (sharing, performance, etc.)
- They are **not** the "best take" for the song

**Current implementation:**

```typescript
takeKind: isFinalStage ? 'final' : 'training'
```

**Current storage:** Training takes are stored in session (same as final takes), but marked distinctly.

### 5.2 Current Final 100 Stage Remains in Slot 0

**Current truth:** All recording, regardless of tempo, uses **slot 0**.

**Current behavior:**

- Listen stage: no recording
- Record stage: writes to slot 0 (overwrites previous take at that tempo)
- Previous-take preview: plays back from slot 0

**Current limitation:** No multi-slot recording per tempo stage (only slot 0 is used).

**Current implication:** User can only keep one take per stage. If they record again at the same tempo, the previous take is overwritten.

### 5.3 Current One-Slot Overwrite Doctrine

**Current truth:** Each stage uses only slot 0, and recording overwrites the previous take at that tempo.

**Current behavior:**

- User records at 70% → take stored in slot 0 with `tempoRate: 0.7`
- User records again at 70% → slot 0 is overwritten
- User advances to 75% → new record at 75% overwrites slot 0
- User returns to 70% → slot 0 now contains 75% take (lost 70% take)

**Current limitation:** No take history per tempo stage. Only the most recent take is kept.

**Current workaround:** None. User must accept overwrite behavior.

### 5.4 Current Card Shows Tempo Truth

**Current take card display:**

- Shows take slot (1, 2, or 3)
- Shows duration
- Shows recorded timestamp
- Shows `tempoRate` if available (e.g., "70% speed")
- Shows `takeKind` if available (e.g., "training" or "final")

**Current visual distinction:**

- Training takes may be visually marked differently (e.g., dimmed, labeled "training")
- Final takes are visually prominent (e.g., highlighted, labeled "final")

**Current limitation:** No visual distinction between takes at different tempos (all show in same slot 0 area).

---

## 6. Current Runtime Truth

### 6.1 Stage-State Runtime Doctrine

**Current truth:** Tempo Scenario uses the stage-state runtime model (see scenario-stage-state-model.md).

**Current stage-state dimensions:**

- **Audio mix state:** Backing (full, instrumental, etc.)
- **Tempo state:** `tempoRate` (0.7, 0.75, ..., 1.0)
- **Scope state:** Block-scoped (single block)
- **Take-flow state:** Slot 0, recording mode standard
- **Review state:** Optional previous-take preview
- **Progression state:** Rounds per stage, advancement to next tempo

### 6.2 Current Prep/Listen/Record/Review Flow

**Current runtime phases:**

```
Prep Phase:
  - User enters scenario
  - Scenario state NOT yet applied
  - User can adjust sliders freely
  - User baseline captured

Listen Phase:
  - Reference listen step executes
  - Backing applied (full)
  - Tempo applied (e.g., 70%)
  - User hears reference at that tempo
  - User cannot record yet

Record Phase:
  - Countdown appears (3-2-1)
  - Scenario backing applied
  - Scenario tempo applied
  - Recorder armed
  - User sings
  - Auto-stop at block end
  - Take saved to slot 0

Review Phase (optional):
  - If previewBetweenRounds enabled:
    - Previous-take preview step executes
    - User hears their take at same tempo
    - User can listen, compare mentally
  - User can advance to next stage or repeat current stage

Progression Phase:
  - User selects advance or repeat
  - If advance: move to next tempo stage
  - If repeat: stay at current tempo stage
  - If complete: scenario ends
```

### 6.3 Current Useful V-Mix-Assisted Effect in Review

**Current observation:** During review phase, V-Mix (vocal mix) can be toggled to hear user's take with or without reference vocals.

**Current behavior:**

- User records at 70% (instrumental backing only)
- User enters review phase
- User can toggle V-Mix to hear reference vocals mixed with their take
- This provides a quick compare without explicit compare UI

**Current limitation:** This is a **side effect** of V-Mix being user-controlled, not a designed feature.

**Current note:** V-Mix routing architecture remains nuanced and not fully optimized for this use case.

### 6.4 Routing Architecture Nuance Remains

**Current truth:** V-Mix routing during Tempo Scenario review is **not yet fully architected**.

**Current behavior:** V-Mix toggle works, but the exact routing (which stems, which volumes, which phases) is not formally documented.

**Current limitation:** No formal contract for V-Mix behavior during scenario review.

**Current status:** This is a known seam, not a blocker, but needs future formalization.

---

## 7. Current Known Observational Seams

### 7.1 Occasional First-Take Early/Lead Residual Remains Under Observation

**Current observation:** On first take of a session, there is occasionally a slight early/lead residual in the recording.

**Current status:** Under observation, not a primary blocker.

**Current hypothesis:** Timing between recorder arm and engine play may have edge cases on cold start.

**Current workaround:** Recording a second take typically resolves the issue.

**Current tracking:** Telemetry fields added (`lateStartOffsetSec`) for future diagnostics.

### 7.2 Post-Quest Manual V-Mix/Take Preview Restore May Still Have Seams

**Current observation:** After completing a Tempo Scenario quest, manually toggling V-Mix or previewing takes may have occasional audio routing seams.

**Current status:** Under observation, not a primary blocker.

**Current hypothesis:** V-Mix state restoration after scenario execution may not be fully deterministic.

**Current workaround:** Toggling V-Mix again or restarting the scenario typically resolves the issue.

**Current tracking:** No formal telemetry yet, but reported in user feedback.

### 7.3 These Are Not Current Primary Blockers

**Current truth:** These seams are **known and accepted** as part of experimental status.

**Current decision:** Continue with experimental surface while gathering evidence.

**Current next step:** Formalize V-Mix routing architecture (future work).

---

## 8. What Current Tempo Scenario Is NOT Yet

### 8.1 Not the Final Tempo Ecosystem

**Current truth:** Tempo Scenario is **experimental**, not final.

**Current limitations:**

- No hold/advance/simplify system yet
- No mastery-based progression (always fixed stages)
- No adaptive tempo adjustment based on performance
- No evidence-based recommendations

**Future possibilities:** These may be added, but are not current.

### 8.2 Not Final Compare Semantics for Mixed-Tempo Takes

**Current truth:** Comparing takes at different tempos is **not yet designed**.

**Current limitation:** All takes use slot 0, so only one take per tempo is kept.

**Current behavior:** User cannot easily compare their 70% take with their 85% take.

**Future possibility:** Multi-slot recording per tempo, or take history, or compare across tempos.

### 8.3 Not Final V-Mix Routing Architecture

**Current truth:** V-Mix routing during Tempo Scenario is **not yet formally architected**.

**Current behavior:** V-Mix works, but routing is implicit, not explicit.

**Current limitation:** No formal contract for V-Mix behavior during scenario phases.

**Future work:** Formalize V-Mix routing (which stems, which volumes, which phases).

### 8.4 Not Full Hold/Advance/Simplify System Yet

**Current truth:** User progression is **manual**, not system-assisted.

**Current behavior:**

- User can repeat current stage (hold)
- User can advance to next stage (advance)
- User cannot simplify to easier stage (no simplify)

**Current limitation:** No system recommendation for hold/advance/simplify based on evidence.

**Future possibility:** System suggests hold/advance/simplify based on take quality, timing, pitch.

---

## 9. Immediate Current Value

### 9.1 Why Current Tempo Scenario Is Already Useful

**Current value proposition:**

- **Progressive difficulty:** User can start slow and build confidence
- **Explicit stages:** User knows exactly what tempo they're practicing at
- **Clear progression:** User can see progress from 70% → 100%
- **Training context:** Slowed takes are marked as training, not final output
- **Muscle memory:** Repetition at each tempo builds muscle memory

### 9.2 What Users Can Meaningfully Test With It Now

**Current capabilities:**

- Start at a comfortable slow tempo (70%, 80%, 90%)
- Practice the same block at progressively faster tempos
- Record multiple takes at each tempo
- Review takes immediately after recording
- Advance to next tempo when ready
- Complete the full progression to 100%

**Current use cases:**

- Learning a new song (start slow, build speed)
- Building confidence (practice at comfortable tempo first)
- Muscle memory development (repetition at each stage)
- Tempo challenge (test speed limits)

---

## 10. Frozen Current Truth vs Future Open Split

### 10.1 Frozen Current Truth

**What is frozen (current working behavior):**

- ✅ Explicit stage generation (ascending/descending ladder toward 100%)
- ✅ Fixed 0.05 (5%) increment per stage
- ✅ Listen → record → optional preview flow per stage
- ✅ Slot 0 recording with overwrite behavior
- ✅ Training/final take classification
- ✅ Manual hold/advance progression
- ✅ Experimental surface visibility
- ✅ V-Mix remains user-controlled

### 10.2 Open Future Tempo Refinements

**What is open (future possibilities):**

- ❓ Adaptive tempo adjustment based on performance
- ❓ Mastery-based progression (not fixed stages)
- ❓ Hold/advance/simplify system with evidence-based recommendations
- ❓ Multi-slot recording per tempo (take history)
- ❓ Compare semantics for mixed-tempo takes
- ❓ Formal V-Mix routing architecture
- ❓ Automatic previous-take preview (not optional)
- ❓ Tempo-based scoring or proximity metrics
- ❓ Integration with evidence/mastery system

**Current status:** These are possibilities, not commitments.

---

## 11. Relation to Other Architecture Docs

### 11.1 scenario-stage-state-model.md

**Relationship:** Tempo Scenario is a concrete implementation of the stage-state model.

**How it uses stage-state:**
- Each tempo stage is a distinct stage state
- Audio mix state: backing (full)
- Tempo state: tempoRate (0.7, 0.75, ..., 1.0)
- Take-flow state: slot 0, standard recording
- Review state: optional previous-take preview
- Progression state: rounds per stage, advancement rules

**No contradiction:** Tempo Scenario demonstrates stage-state model in practice.

### 11.2 quest-scenario-system.md

**Relationship:** Tempo Scenario is one family in the scenario system.

**How it fits:**
- Family: `tempo-ladder`
- Generator: `tempoLadderGenerator`
- Recipe ID: `tempo-ladder`
- Surface: `smoke` (experimental)

**No contradiction:** Tempo Scenario is a concrete family implementation.

### 11.3 takes-system.md

**Relationship:** Tempo Scenario uses Takes for recording and playback.

**How it uses Takes:**
- Records to slot 0 per stage
- Marks takes as training/final
- Stores tempoRate metadata
- Enables previous-take preview

**No contradiction:** Tempo Scenario is a consumer of Takes system.

---

## 12. Key Takeaways

### For Architects

1. **Tempo Scenario is experimental** — working code, but not final product
2. **Stage-state model enables tempo progression** — each stage has its own tempo
3. **Training/final distinction is semantic** — marks intent, not storage
4. **Slot 0 overwrite is current limitation** — not final design
5. **V-Mix routing needs formalization** — currently implicit

### For Implementers

1. **Generator creates explicit stages** — ascending/descending ladder toward 100%
2. **Runtime applies tempoRate to listen steps** — (currently not implemented, known gap)
3. **Recording always uses slot 0** — overwrites previous take at that tempo
4. **Previous-take preview is optional** — controlled by parameter
5. **Take metadata includes tempoRate and takeKind** — for downstream use

### For Designers

1. **Tempo progression is clear to user** — explicit stages, visible advancement
2. **Training context is important** — users understand slowed takes are practice
3. **Manual progression is current** — no system recommendations yet
4. **V-Mix is user-controlled** — scenario cannot hijack it
5. **Review phase is optional** — previous-take preview can be enabled/disabled

### For Teachers/Scenario Authors

1. **Tempo Scenario is ready for testing** — experimental surface, gather evidence
2. **Start tempo is user-selected** — not system-assigned
3. **Ladder increment is fixed** — 0.05 (5%) per stage
4. **Slot 0 behavior is current** — plan accordingly
5. **Training/final distinction is available** — use for downstream workflows

---

## 13. Known Gaps and Future Work

### 13.1 Runtime tempoRate Application

**Current gap:** Generator declares `tempoRate` in listen steps, but runtime does NOT apply it.

**Current status:** Listen steps play at 1.0x, not at declared tempo.

**Impact:** Tempo Scenario is partially broken (listen steps don't slow down).

**Future work:** Either implement tempoRate application in exercise runtime, or disable tempo-ladder until implemented.

### 13.2 Multi-Slot Recording Per Tempo

**Current gap:** Only slot 0 is used, so only one take per tempo is kept.

**Current status:** Recording at same tempo overwrites previous take.

**Impact:** User cannot keep multiple takes at same tempo.

**Future work:** Design multi-slot recording per tempo, or take history, or compare across tempos.

### 13.3 V-Mix Routing Formalization

**Current gap:** V-Mix routing during scenario is implicit, not explicit.

**Current status:** V-Mix works, but contract is not documented.

**Impact:** Behavior is unpredictable in edge cases.

**Future work:** Formalize V-Mix routing (which stems, which volumes, which phases).

### 13.4 Evidence-Based Progression

**Current gap:** No system recommendations for hold/advance/simplify.

**Current status:** User progression is manual only.

**Impact:** No adaptive difficulty or mastery-based advancement.

**Future work:** Integrate with evidence/mastery system for recommendations.

---

## 14. Glossary

**Final take** — Take recorded at 100% tempo, intended for downstream workflows

**Ladder** — Sequence of tempos walking toward 100% (e.g., 70%, 75%, 80%, ..., 100%)

**Previous-take preview** — Separate review step where user hears their take immediately after recording

**Slot 0** — Primary recording slot used by Tempo Scenario (overwrites on each record)

**Stage** — Single tempo level in the ladder (e.g., 70% stage, 85% stage, 100% stage)

**Tempo Scenario** — Experimental scenario family enabling progressive tempo-based practice

**tempoRate** — Playback speed multiplier (0.7 = 70%, 1.0 = 100%, 1.5 = 150%)

**Training take** — Take recorded at tempo below 100%, marked as practice artifact

**V-Mix** — Vocal mix tool for live mixing, always user-controlled

---

**Document Status:** Current Product Reality  
**Next Review:** After runtime tempoRate implementation or evidence gathering from experimental surface

