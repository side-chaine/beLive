# Scenario Stage-State Runtime Model

**Status:** 🗄️ STALE / ARCHIVED CONCEPT  
**Reason:** Code implemented action-based 3-phase model via `practice-session.store.ts`, not the StageState model described here. See `practice-experience-layer.md` for current implementation.  
**Last Updated:** 2026-04-06 (archived 2026-06-10)  
**Related Docs:** [quest-scenario-system.md](./quest-scenario-system.md), [practice-experience-layer.md](./practice-experience-layer.md), [takes-system.md](./takes-system.md), [tempo-scenario-current-truth.md](./tempo-scenario-current-truth.md)

---

## 1. Purpose

### 1.1 Why Scenarios Are Stage-State Sequences, Not Mode Bags

**Core principle:** A scenario is not a collection of independent "modes" or "settings." A scenario is a **sequence of stage states** — each stage state defines what the user hears, sees, records, and how progression behaves at that moment in the practice session.

**Why this matters:**

- **Modes are static:** "Practice mode" implies a fixed configuration that doesn't change
- **Stage states are dynamic:** Each stage (prep, listen, countdown, record, review) has its own audio mix, visual presentation, and progression rules
- **Composition:** Scenarios compose stages into sequences, enabling progression models (tempo ladder, backing ladder, scope expansion)
- **Clarity:** Stage-state model makes it explicit what the user experiences at each point in practice

**Why this is central for beLive:**

1. **AudioQuest:** Scenarios orchestrate audio state across stages (listen backing ≠ record backing)
2. **Tempo Ladder:** Progression is stage-based (stage 1 at 70%, stage 2 at 85%, stage 3 at 100%)
3. **Alternation:** Call-response requires distinct stages (guide sings, user sings, compare)
4. **Future:** Stage-state model becomes the language for AI-driven scenario control

### 1.2 Stage-State vs Mode Confusion

**Anti-pattern:** Treating scenario as a single "mode" with global settings

```
❌ WRONG: "Echo Drill Mode"
   - Backing: instrumental
   - Tempo: 0.85x
   - Scope: chorus
   (all settings apply everywhere)

✅ CORRECT: "Echo Drill Scenario" = sequence of stages
   - Stage 1 (Listen): backing=full, tempo=0.85x, scope=chorus
   - Stage 2 (Record): backing=instrumental, tempo=0.85x, scope=chorus
   - Stage 3 (Compare): backing=full, tempo=0.85x, scope=chorus
   (each stage has its own state)
```

---

## 2. Core Definition Freeze

### 2.1 Scenario = Sequence of Stage States

**Frozen definition:**

```
A scenario is an ordered sequence of stage states.
Each stage state defines:
  - What the user hears (audio mix state)
  - What the user sees (visual presentation state)
  - What the user records (recording target and mode)
  - How progression behaves (completion criteria, advancement rules)
```

**Schema:**

```typescript
interface Scenario {
  id: string;
  name: string;
  stages: StageState[];
  progressionModel: ProgressionModel;
}

interface StageState {
  id: string;
  name: string;
  audioMixState: AudioMixState;
  tempoState: TempoState;
  scopeState: ScopeState;
  takeFlowState: TakeFlowState;
  reviewState: ReviewState;
  progressionState: ProgressionState;
}
```

### 2.2 Stage State Lifecycle

**Frozen lifecycle:**

```
Scenario Start
    ↓
Stage 1 (Prep/Listen)
    ↓
Stage 2 (Countdown/Pre-Record)
    ↓
Stage 3 (Recording)
    ↓
Stage 4 (Review/Compare)
    ↓
Stage 5 (Completion/Progression)
    ↓
Next Round or Scenario End
```

**Key principle:** Each stage is distinct, with its own state. Stages do not share state — each stage is a fresh application of its stage-state definition.

---

## 3. Stage-State Layers

### 3.1 Audio Mix State

**Purpose:** Define what audio stems are active and at what volume

**Dimensions:**
- `instrumentalVolume: 0.0-1.0` — backing instrumental level
- `vocalsVolume: 0.0-1.0` — reference vocal level
- `microphoneVolume: 0.0-1.0` — user's microphone input level
- `vocalMixEnabled: boolean` — whether V-Mix (vocal mix) is active

**Examples:**
- Listen stage: `{ instrumental: 1.0, vocals: 1.0 }` — full reference
- Record stage: `{ instrumental: 1.0, vocals: 0.0 }` — instrumental only
- Guide stage: `{ instrumental: 1.0, vocals: 0.25 }` — pitch guide
- A cappella stage: `{ instrumental: 0.0, vocals: 0.0 }` — silence

### 3.2 Tempo State

**Purpose:** Define playback speed for difficulty scaling

**Dimensions:**
- `playbackRate: number` — playback speed multiplier (0.7, 0.85, 1.0)
- `tempoStage: number` — current stage in tempo progression (1, 2, 3...)
- `tempoLadder: number[]` — available tempo stages (e.g., [0.7, 0.85, 1.0])

**Examples:**
- Slow practice: `{ playbackRate: 0.7 }`
- Standard practice: `{ playbackRate: 0.85 }`
- Full speed: `{ playbackRate: 1.0 }`
- Tempo ladder: `{ tempoLadder: [0.7, 0.85, 1.0], tempoStage: 1 }`

### 3.3 Scope / Line-Order State

**Purpose:** Define what portion of the song is active and in what order

**Dimensions:**
- `scopeType: 'block' | 'line-range' | 'full-song'` — scope granularity
- `scopeId: string` — which block/range (e.g., "chorus-1")
- `lineOrder: string[]` — order of lines (for alternation scenarios)
- `highlightedLines: string[]` — which lines are visually highlighted

**Examples:**
- Single block: `{ scopeType: 'block', scopeId: 'chorus-1' }`
- Line range: `{ scopeType: 'line-range', scopeId: 'verse-1:1-4' }`
- Call-response: `{ lineOrder: ['guide', 'user', 'guide', 'user'] }`

### 3.4 Take-Flow State

**Purpose:** Define how recording is captured and stored

**Dimensions:**
- `recordingMode: 'standard' | 'in-flight' | 'continuous'` — capture strategy
- `targetSlot: number | 'next-empty'` — which take slot to record into
- `captureWindow: TimeRange` — when to start/stop recording
- `preRollSeconds: number` — pre-roll duration before recording

**Examples:**
- Standard: `{ recordingMode: 'standard', targetSlot: 'next-empty', preRollSeconds: 3 }`
- In-flight: `{ recordingMode: 'in-flight', targetSlot: 'next-empty' }`
- Specific slot: `{ recordingMode: 'standard', targetSlot: 2 }`

### 3.5 Review State

**Purpose:** Define post-recording review behavior

**Dimensions:**
- `reviewMode: 'compare' | 'self-assess' | 'none'` — review type
- `compareReference: 'original' | 'previous' | 'best'` — what to compare against
- `autoPlayback: boolean` — whether to auto-play after recording
- `comparisonLayers: string[]` — which layers to show (waveform, pitch, timing)

**Examples:**
- Auto-compare: `{ reviewMode: 'compare', compareReference: 'original', autoPlayback: true }`
- Self-assess: `{ reviewMode: 'self-assess' }`
- No review: `{ reviewMode: 'none' }`

### 3.6 Progression State

**Purpose:** Define how the scenario progresses (rounds, advancement, completion)

**Dimensions:**
- `roundNumber: number` — current round (1, 2, 3...)
- `totalRounds: number` — total rounds in scenario
- `completionCriteria: 'rounds' | 'filled-slots' | 'mastery-threshold'` — how to complete
- `advancementRule: 'auto' | 'user-choice' | 'mastery-gated'` — how to advance to next stage
- `holdBehavior: 'pause-on-error' | 'continue' | 'retry'` — error handling

**Examples:**
- 3-round scenario: `{ roundNumber: 1, totalRounds: 3, completionCriteria: 'rounds' }`
- Mastery-gated: `{ completionCriteria: 'mastery-threshold', advancementRule: 'mastery-gated' }`
- User choice: `{ advancementRule: 'user-choice' }`

---

## 4. User Baseline vs Scenario Stage State vs Effective Runtime State

### 4.1 The Formula (Frozen)

```
Effective Runtime State = User Baseline + Scenario Stage State + Phase Rules
```

### 4.2 User Baseline

**Definition:** The user's preferred audio settings before entering a scenario

**Captured at scenario start:**
```typescript
userBaseline = {
  instrumentalVolume: audioStore.instrumentalVolume,
  vocalsVolume: audioStore.vocalsVolume,
  playbackRate: audioStore.playbackRate,
  vocalMixEnabled: audioStore.vocalMixEnabled,
  microphoneVolume: audioStore.microphoneVolume,
}
```

**Restored at scenario end:**
```typescript
audioStore.instrumentalVolume = userBaseline.instrumentalVolume;
audioStore.vocalsVolume = userBaseline.vocalsVolume;
// ... etc
```

**Purpose:** Preserve user preferences across scenario execution

### 4.3 Scenario Stage State

**Definition:** The audio/visual/progression state defined by the current stage

**Example (Record stage of Echo Drill):**
```typescript
stageState = {
  audioMixState: {
    instrumentalVolume: 1.0,
    vocalsVolume: 0.0,  // No reference during record
  },
  tempoState: {
    playbackRate: 0.85,
  },
  scopeState: {
    scopeType: 'block',
    scopeId: 'chorus-1',
  },
  takeFlowState: {
    recordingMode: 'standard',
    targetSlot: 'next-empty',
  },
  reviewState: {
    reviewMode: 'compare',
  },
  progressionState: {
    roundNumber: 1,
    totalRounds: 3,
  },
}
```

### 4.4 Phase Rules

**Definition:** Runtime rules that apply based on the current phase (prep, countdown, recording, review)

**Examples:**
- **Prep phase:** User can adjust sliders, scenario state is not yet applied
- **Countdown phase:** Scenario state is applied, but user can still adjust (delta model)
- **Recording phase:** Scenario state is locked, user cannot adjust
- **Review phase:** Scenario state is released, user can adjust

### 4.5 Effective Runtime State Calculation

**Example: Record stage, countdown phase**

```
User Baseline:
  instrumentalVolume: 0.8 (user prefers quieter backing)
  vocalsVolume: 0.3 (user prefers some reference)

Scenario Stage State:
  instrumentalVolume: 1.0 (record stage wants full instrumental)
  vocalsVolume: 0.0 (record stage wants no reference)

Phase Rules (Countdown):
  User can adjust relative to scenario state (delta model)

User Adjustment During Countdown:
  Drags vocal slider to +0.25 (wants a little reference)

Effective Runtime State:
  instrumentalVolume: 1.0 (scenario base)
  vocalsVolume: 0.0 + 0.25 = 0.25 (scenario base + user delta)
```

---

## 5. Phase Boundaries (Frozen)

### 5.1 Core Runtime Phases

**Frozen phase definitions:**

```
Prep Phase
  ├─ User enters scenario
  ├─ Scenario state is NOT yet applied
  ├─ User can adjust sliders freely
  └─ User baseline is captured

Countdown Phase (Pre-Take Prep)
  ├─ Countdown overlay appears (3-2-1)
  ├─ Scenario state IS applied
  ├─ User can adjust relative to scenario (delta model)
  ├─ Backing is applied (record backing, not prep backing)
  └─ Recorder is armed (hidden)

Recording Phase (Actual Take)
  ├─ Countdown completes
  ├─ Visible recording state activates
  ├─ Scenario state is locked
  ├─ User cannot adjust (or adjustments are ignored)
  ├─ Live trail visualization appears
  └─ Audio is captured to take slot

Review Phase
  ├─ Recording completes
  ├─ Review state is applied (compare, self-assess, or none)
  ├─ User can listen to take
  ├─ User can compare against reference
  └─ User can select best take

Completion Phase
  ├─ Review completes
  ├─ Progression rules are evaluated
  ├─ User baseline is restored
  └─ Scenario ends or advances to next round
```

### 5.2 Prep State ≠ Record State (Frozen)

**Critical distinction:**

```
❌ WRONG: "Prep and record states are the same"
   - User hears record backing during countdown
   - No meaningful prep context
   - Confusing transition

✅ CORRECT: "Prep and record states are distinct"
   - Prep state: User hears prep context (full backing, reference)
   - Countdown state: Scenario backing is applied, user can adjust
   - Record state: Scenario backing is locked, recording is visible
   - Clear progression: prep → countdown → record
```

**Frozen rule:** Prep state and record state have different audio mixes. Prep state provides meaningful context before recording begins.

---

## 6. AudioQuest Doctrine

### 6.1 When Backing Should Apply

**Frozen doctrine:**

- **Listen stage:** Full backing (instrumental + vocals) — user hears complete reference
- **Countdown stage:** Record backing is applied (scenario-defined) — user hears what they'll record to
- **Recording stage:** Record backing is locked — user cannot adjust
- **Review stage:** Full backing (for comparison) — user hears reference for comparison

**Rationale:** User needs to hear the backing they'll record to before recording starts, but not during prep.

### 6.2 Countdown/Prep Context is NOT Automatically Identical to Record Backing

**Frozen doctrine:**

```
❌ WRONG: "Countdown backing = record backing"
   - User hears record backing during countdown
   - No prep context
   - Confusing

✅ CORRECT: "Countdown backing = record backing (user can adjust)"
   - Scenario defines record backing
   - User can adjust relative to scenario (delta model)
   - User hears what they'll record to, with flexibility
   - Clear progression
```

**Rationale:** User needs to hear the record backing before recording starts (to prepare), but may want to adjust it for comfort.

### 6.3 V-Mix Remains User-Controlled Live Tool

**Frozen doctrine:**

- V-Mix (vocal mix) is **always user-controlled**, never hijacked by scenario
- V-Mix is orthogonal to scenario backing (backing controls stems, V-Mix controls mix)
- Scenario cannot disable or override V-Mix
- User can toggle V-Mix anytime, including during recording

**Rationale:** V-Mix is a live mixing tool for user comfort, not a practice orchestration concern. Scenarios should not hijack user control.

**Evidence:** `src/components/ControlDeck.tsx` — V-Mix toggle is always enabled, never disabled by exercise runtime.

**Product observation (Tempo Scenario):** During review phase after recording, V-Mix toggle provides useful effect — user can hear their take with or without reference vocals mixed in, enabling quick compare without explicit compare UI. This is a **side effect of V-Mix being user-controlled**, not a designed feature. V-Mix routing architecture during scenario review remains nuanced and not yet formally architected (see `tempo-scenario-current-truth.md` section 6.3-6.4).

### 6.4 Scenario Runtime May Suggest State, But User Comfort Must Remain Understandable

**Frozen doctrine:**

- Scenario suggests backing (e.g., "record stage wants instrumental-only")
- User can adjust relative to suggestion (delta model)
- User adjustment is visible and understandable (not hidden)
- User can always return to scenario suggestion (reset button)

**Rationale:** Adaptive practice requires user agency. User must understand what the scenario is suggesting and why, and must be able to adjust for comfort.

---

## 7. Tempo Ladder Doctrine

### 7.1 Current Accepted Truth

**Frozen doctrine (now proven in working Tempo Scenario):**

- **User chooses start slowdown stage:** User selects which tempo to start at (70%, 85%, 100%)
- **User may hold on a stage as long as needed:** User can repeat same tempo stage multiple times
- **Stage progression moves upward toward original tempo:** Each advancement moves to faster tempo
- **Original tempo is the final result stage:** 100% tempo is the goal, not intermediate stage
- **Pre-final slowed takes are training takes, not final output takes:** Takes at 70%, 85% are practice artifacts

**Status:** This doctrine is now **partially proven in working Tempo Scenario implementation** (see `tempo-scenario-current-truth.md`). Stage-state model is not purely conceptual — it's demonstrated in real Tempo flow with explicit stage generation, training/final take classification, and previous-take preview as separate review stage.

### 7.2 Tempo Ladder Progression Model

**Frozen progression (current working implementation):**

```
Tempo Ladder Scenario (3 stages)
  ├─ Stage 1: 70% tempo (slow practice)
  │   ├─ Listen step (reference listen at 70%)
  │   ├─ Record step (record at 70%, slot 0, takeKind: 'training')
  │   ├─ Optional previous-take preview step (separate review stage)
  │   ├─ User can hold (repeat stage) or advance
  │   └─ Takes recorded at 70% are training takes
  │
  ├─ Stage 2: 85% tempo (medium practice)
  │   ├─ Listen step (reference listen at 85%)
  │   ├─ Record step (record at 85%, slot 0, takeKind: 'training')
  │   ├─ Optional previous-take preview step (separate review stage)
  │   ├─ User can hold (repeat stage) or advance
  │   └─ Takes recorded at 85% are training takes
  │
  └─ Stage 3: 100% tempo (full speed, final result)
      ├─ Listen step (reference listen at 100%)
      ├─ Record step (record at 100%, slot 0, takeKind: 'final')
      ├─ Optional previous-take preview step (separate review stage)
      ├─ User can hold (repeat stage) or complete
      └─ Takes recorded at 100% are final result takes
```

**Key implementation details:**

- **Explicit stage generation:** Generator creates ascending/descending ladder with 0.05 (5%) increments toward 100%
- **Previous-take preview is separate review stage:** Not a hijack of next reference listen, but an additional optional step after record
- **Slot 0 recording with overwrite:** All recording uses slot 0; recording at same tempo overwrites previous take at that tempo
- **Training/final classification:** Marked in take metadata (`takeKind: 'training'` or `'final'`), visible in take cards

### 7.3 Current One-Slot Overwrite Doctrine

**Current working behavior:**

- All recording uses **slot 0** (no multi-slot per tempo)
- Recording at same tempo **overwrites** previous take at that tempo
- When user advances to next tempo stage, the previous tempo's take is overwritten if user records again at that tempo
- Slowed takes (70%, 85%) are marked as `takeKind: 'training'` in metadata
- Final takes (100%) are marked as `takeKind: 'final'` in metadata

**Current limitation:** No take history per tempo stage. Only the most recent take is kept.

**Future possibilities:**

- Multi-slot recording per tempo (preserve multiple takes at each tempo)
- Take history across tempos (compare 70% take with 85% take)
- Evidence-based preservation (keep slowed takes for progression tracking)

**Important caveat:** This is current working behavior, not universal law for all scenarios. Future scenarios may have different recording/preservation policies.

### 7.4 Known Observational Seams (Not Primary Blockers)

**First-take early/lead residual:**

- **Observation:** On first take of a session, there is occasionally a slight early/lead residual in the recording
- **Status:** Under observation, not a primary blocker
- **Hypothesis:** Timing between recorder arm and engine play may have edge cases on cold start
- **Workaround:** Recording a second take typically resolves the issue
- **Tracking:** Telemetry fields added (`lateStartOffsetSec`) for future diagnostics

**Post-quest V-Mix/take preview restore seams:**

- **Observation:** After completing a Tempo Scenario quest, manually toggling V-Mix or previewing takes may have occasional audio routing seams
- **Status:** Under observation, not a primary blocker
- **Hypothesis:** V-Mix state restoration after scenario execution may not be fully deterministic
- **Workaround:** Toggling V-Mix again or restarting the scenario typically resolves the issue

**Current decision:** Continue with experimental surface while gathering evidence. These seams are known and accepted as part of experimental status.

---

## 8. Alternation / Line Order Doctrine

### 8.1 Line Order / Who Sings What is a Stage-State Concern

**Frozen doctrine:**

- Line order (who sings what) is defined per stage, not globally
- Different stages can have different line orders
- Call-response is a stage-state concern, not a separate "mode"

**Example (Call-Response Scenario):**

```
Stage 1 (Listen):
  lineOrder: ['guide', 'guide', 'guide']  (user listens to guide)

Stage 2 (Record - Call):
  lineOrder: ['guide', 'guide', 'guide']  (guide sings, user listens)

Stage 3 (Record - Response):
  lineOrder: ['user', 'user', 'user']     (user sings, guide is silent)

Stage 4 (Compare):
  lineOrder: ['guide', 'user', 'guide']   (compare guide vs user)
```

### 8.2 Not a Separate Generic Mode Taxonomy

**Frozen doctrine:**

```
❌ WRONG: "Alternation Mode" (separate from scenario)
   - Implies alternation is a global mode
   - Separate from other scenario concerns
   - Cannot compose with other dimensions

✅ CORRECT: "Alternation is a stage-state concern"
   - Defined per stage via lineOrder dimension
   - Composes with other dimensions (tempo, backing, scope)
   - Part of scenario stage-state definition
```

### 8.3 Call & Response / Trade Lines Later Uses This Stage-State Model

**Frozen doctrine:**

- Future call-response and trade-lines scenarios will use stage-state model
- Each stage defines its own line order
- No separate "alternation mode" — alternation is expressed via stage-state

---

## 9. Frozen Decisions

### 9.1 Scenario = Sequence of Stage States

**Decision:** Scenarios are modeled as ordered sequences of stage states, not as single "modes."

**Implication:** Each stage has its own audio mix, visual presentation, and progression rules.

### 9.2 Prep State Distinct from Record State

**Decision:** Prep phase and record phase have different audio mixes and progression rules.

**Implication:** User hears meaningful prep context before recording begins, then record backing is applied.

### 9.3 Stage-State Layers Are Orthogonal

**Decision:** Audio mix, tempo, scope, take-flow, review, and progression are independent dimensions of stage state.

**Implication:** Stages can be composed from any combination of these dimensions.

### 9.4 User Baseline + Scenario Stage + Phase Rules Formula

**Decision:** Effective runtime state is calculated as: User Baseline + Scenario Stage State + Phase Rules

**Implication:** User preferences are preserved, scenario state is applied, phase rules determine authority.

### 9.5 Tempo Ladder Progression Toward Original Tempo

**Decision:** Tempo ladder stages progress upward toward original tempo (100%), not downward.

**Implication:** User starts slow, advances to faster tempos, final result is at original tempo.

### 9.6 V-Mix Remains User-Controlled

**Decision:** V-Mix is always user-controlled, never hijacked by scenario.

**Implication:** Scenario cannot disable or override V-Mix.

### 9.7 Slowed-Stage Takes Are Training Artifacts (Current Direction)

**Decision:** Takes recorded at slowed tempos (70%, 85%) are discarded when advancing to final result (100%).

**Implication:** Only final result takes are kept for downstream workflows.

**Caveat:** This is current product direction, may evolve based on evidence/progression needs.

### 9.8 Stage-State Model is Future AI Control Language

**Decision:** Stage-state model will become the language for AI-driven scenario control.

**Implication:** Future AI systems will generate scenarios by composing stage states, not by hardcoding recipes.

---

## 10. Open Decisions

### 10.1 Exact Stage Naming and Count

**Question:** What are the canonical stage names and how many stages per scenario?

**Current candidates:**
- Prep, Listen, Countdown, Record, Review, Completion
- Or: Prep, Countdown, Record, Review, Completion (listen is part of prep)

**Uncertainty:** May vary by scenario type (echo vs alternation vs tempo ladder)

**Resolution criteria:** Stage names must be clear, consistent, and teachable.

### 10.2 Exact Delta Model Implementation

**Question:** How are user adjustments (deltas) tracked and applied during countdown phase?

**Current approach:** User can adjust sliders during countdown, adjustments are applied as deltas to scenario base.

**Uncertainty:** Exact delta persistence scope (within stage? within round? within scenario?)

**Resolution criteria:** Delta model must be predictable, transparent, and resettable.

### 10.3 Exact Hold/Simplify Controls

**Question:** How does user hold on a stage or simplify to easier stage?

**Current approach:** Manual (user selects next scenario)

**Future approach:** System suggests hold/simplify based on evidence

**Uncertainty:** UI for hold/simplify, automatic vs manual, evidence-based vs user-choice

**Resolution criteria:** Controls must be discoverable, understandable, and effective.

### 10.4 Exact Review-State Automation

**Question:** When should review state automatically trigger (compare, self-assess)?

**Current approach:** Manual (user toggles compare)

**Future approach:** Automatic invitation after recording

**Uncertainty:** Timing, UI, user override capability

**Resolution criteria:** Automation must be helpful, not intrusive.

### 10.5 Exact Preservation Policy for Non-Final Takes

**Question:** What happens to takes recorded at non-final tempos/backings?

**Current direction:** Discard when advancing to final result

**Uncertainty:** Should they be preserved for evidence? For learner reflection? For family sharing?

**Resolution criteria:** Policy must balance storage efficiency with evidence/learning value.

### 10.6 Exact Relation to Future Evidence Overlays

**Question:** How do stage states relate to evidence collection and visualization?

**Current approach:** Evidence is collected per stage

**Future approach:** Evidence overlays show mastery signals per stage

**Uncertainty:** Exact overlay design, stage-level vs scenario-level evidence aggregation

**Resolution criteria:** Overlays must be informative, not overwhelming.

---

## 11. What NOT To Do

### 11.1 Treat Every Scenario as Separate Mode Blob

**Anti-pattern:** Creating a new "mode" for every scenario variation.

**Why wrong:** Leads to mode explosion, no composability, no progression model.

**Correct approach:** Use stage-state model to compose scenarios from orthogonal dimensions.

### 11.2 Collapse Prep and Record States

**Anti-pattern:** Using same audio mix for prep and record phases.

**Why wrong:** User hears record backing during countdown, no meaningful prep context.

**Correct approach:** Prep state provides meaningful context, record state applies scenario backing.

### 11.3 Silently Hijack V-Mix

**Anti-pattern:** Scenario disables or overrides V-Mix without user knowledge.

**Why wrong:** Violates user control, breaks user expectations, confusing UX.

**Correct approach:** V-Mix remains user-controlled, scenario cannot hijack it.

### 11.4 Hardcode Tempo Behavior Without Stage Semantics

**Anti-pattern:** Implementing tempo ladder as special case, not as stage-state composition.

**Why wrong:** Cannot generalize to other progression models, no composability.

**Correct approach:** Tempo ladder is expressed via stage-state model (each stage has tempo dimension).

### 11.5 Overfit Current Family Behavior Into Universal Law

**Anti-pattern:** Assuming current tempo ladder behavior applies to all scenarios.

**Why wrong:** Future scenarios may have different progression models, different preservation policies.

**Correct approach:** Document current direction as "current product direction," not universal law.

---

## 12. Relation to Other Architecture Docs

### 12.1 quest-scenario-system.md

**Relationship:** Stage-state model is the runtime execution model for scenario programs.

**quest-scenario-system.md defines:**
- ScenarioSpec (declarative specification)
- ScenarioGenerator (family-specific generation logic)
- ScenarioProgram (executable step sequence)

**scenario-stage-state-model.md defines:**
- StageState (runtime state at each stage)
- Phase boundaries (prep, countdown, record, review)
- Effective runtime state calculation

**No contradiction:** Stage-state model is the runtime manifestation of scenario programs.

### 12.2 practice-experience-layer.md

**Relationship:** Stage-state model is the internal architecture for user-facing practice experience.

**practice-experience-layer.md defines:**
- User-facing concepts (challenges, journeys, routes)
- Card contract (promise, method, win)
- Completion moment, compare bridge

**scenario-stage-state-model.md defines:**
- Internal stage-state model that enables user experience
- How stages map to user-facing concepts
- How progression works internally

**No contradiction:** Practice experience layer is built on stage-state model.

### 12.3 takes-system.md

**Relationship:** Stage-state model orchestrates Takes operations.

**takes-system.md defines:**
- Recording sessions, take slots, audio capture
- Take preview, compare, waveform visualization

**scenario-stage-state-model.md defines:**
- When to record (which stage)
- Which slot to target (take-flow state)
- When to compare (review state)

**No contradiction:** Stage-state model is the orchestration layer on top of Takes substrate.

---

## 13. Key Takeaways

### For Architects

1. **Stage-state model is the runtime execution model** for scenarios
2. **Prep and record states are distinct** — different audio mixes, different progression rules
3. **User baseline + scenario stage + phase rules** — formula for effective runtime state
4. **Tempo ladder is stage-state composition** — not special case, not hardcoded
5. **V-Mix remains user-controlled** — scenario cannot hijack it
6. **Stage-state model is future AI control language** — will enable AI-driven scenario generation

### For Implementers

1. **Implement phase boundaries** — prep, countdown, record, review, completion
2. **Implement delta model** — user can adjust relative to scenario base during countdown
3. **Implement stage-state layers** — audio mix, tempo, scope, take-flow, review, progression
4. **Implement effective runtime state calculation** — baseline + stage + phase rules
5. **Implement V-Mix protection** — scenario cannot override V-Mix

### For Designers

1. **Think in stages, not modes** — each stage has its own state
2. **Prep context matters** — user needs meaningful context before recording
3. **User adjustment is valid** — delta model allows user to adjust for comfort
4. **Progression is stage-based** — tempo ladder, backing ladder, scope expansion
5. **V-Mix is user-controlled** — never hijack it

### For Teachers/Scenario Authors

1. **Compose scenarios from stage states** — not from hardcoded recipes
2. **Define each stage explicitly** — audio mix, tempo, scope, take-flow, review, progression
3. **Use orthogonal dimensions** — audio mix, tempo, scope are independent
4. **Think about progression** — how does user advance from stage to stage?
5. **Preserve user agency** — user can adjust, hold, simplify

---

## 14. Glossary

**Audio Mix State** — Definition of what audio stems are active and at what volume (instrumental, vocals, microphone)

**Countdown Phase** — Pre-recording phase where countdown overlay appears, scenario backing is applied, user can adjust

**Delta Model** — User adjustments are applied as deltas (offsets) to scenario base values

**Effective Runtime State** — Calculated as: User Baseline + Scenario Stage State + Phase Rules

**Line Order** — Sequence of who sings what (for alternation scenarios)

**Phase** — Runtime phase (prep, countdown, record, review, completion)

**Phase Rules** — Runtime rules that apply based on current phase (e.g., user can adjust during countdown, cannot during record)

**Prep Phase** — Pre-scenario phase where user baseline is captured, scenario state is not yet applied

**Progression State** — Definition of how scenario progresses (rounds, completion criteria, advancement rules)

**Record State** — Recording phase where scenario backing is locked, user cannot adjust

**Review State** — Definition of post-recording review behavior (compare, self-assess, none)

**Scenario** — Ordered sequence of stage states

**Scope State** — Definition of what portion of song is active and in what order

**Stage** — Single state in scenario sequence (e.g., listen, record, review)

**Stage State** — Complete state definition for a stage (audio mix, tempo, scope, take-flow, review, progression)

**Take-Flow State** — Definition of how recording is captured and stored (recording mode, target slot, capture window)

**Tempo State** — Definition of playback speed for difficulty scaling

**User Baseline** — User's preferred audio settings before entering scenario

**V-Mix** — Vocal mix tool for live mixing, always user-controlled

---

**Document Status:** Concept Freeze  
**Next Review:** After Phase 2 (Generator Extraction) implementation
