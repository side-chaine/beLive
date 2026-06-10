# Exercises System Architecture

## Implementation Status
- ✅ Implemented: StepAction/ExerciseGoal/ExerciseRepeat schema, 7 recipes (echo, repeat3, callAndResponse, backingOnly, acappellaBoss, tempoLadder, trade), generator architecture, ExercisePhase state machine, RoundCaptureState, CompletionMoment, ScenarioMixOverride
- 🧭 Vision (Not Yet Implemented): Prompt/Response/Goal/Success grammar (§6), Evidence/Mastery/Momentum progress model, successCriteria/rewards in Quest model
- ⚠️ Note: §6 Exercise Grammar describes a PLANNED schema that differs from current implementation. Current schema uses ExerciseStep(action), ExerciseGoal(type), ExerciseRepeat(mode). Do NOT code against §6 grammar — use exercise.types.ts as source of truth.

## 1. Purpose

This document defines the architecture for the **Exercises** system in beLive—a quest-based learning layer that sits on top of the existing Takes infrastructure. It serves as:

- **Architecture anchor**: Single source of truth for exercise design decisions
- **Scope guard**: Explicit boundaries to prevent over-engineering
- **Future handoff**: Clear onboarding for contributors implementing exercises

---

## 2. Product Statement

**beLive Exercises** transform vocal practice into structured, repeatable quests. Users select a recipe (e.g., "Master Pre-Chorus Harmony"), complete guided exercises within specific song sections, and track progress across sessions. Teachers can author custom recipes and guide students through personalized learning paths.

---

## 3. Why Exercises Matter for beLive

Takes captures performances. **Exercises build the skills** that make those performances better.

- **Deliberate practice**: Focused repetition on specific challenges (range, pitch, timing)
- **Measurable progress**: Track improvement across sessions, not just takes
- **Guided discovery**: Recipes provide structure without prescribing rigid methodology
- **Teacher empowerment**: Educators author custom exercises for their students' needs
- **AI readiness**: Structured schema enables future AI-powered exercise generation
- **Protected execution**: Exercise execution lock prevents interference during active phases (listening, pre-recording, recording)
- **Freedom-first doctrine**: Blanket lock rejected; interruption model accepted (exit/cancel/Esc pathways documented)
- **Committed evidence survives**: Blobs saved, progress recorded even on intentional abandonment

---

## 4. Relationship to Takes

**Exercises live ON TOP OF Takes, they do NOT replace it.**

| Takes | Exercises |
|-------|-----------|
| Capture performances | Build skills through repetition |
| Compare takes A-B | Track progress across sessions |
| Record → Select Best | Attempt → Evaluate → Repeat |
| Performance-focused | Learning-focused |
| Single session context | Multi-session progression |

**Implementation:**
- Separate domain: `src/exercises/` (not `src/takes/exercise/`)
- Uses Takes as substrate: recording, blocks, lineRange
- **Hidden runtime host**: Exercise orchestration lives in TakesPanel/TakesControlStrip (not separate UI surface)
- No ownership of transport/audio engine
- Metadata layer on top of existing infrastructure
- **Execution lock protection**: All interference surfaces blocked during listening/pre-recording/recording phases
- **Interruption model**: Practice session interrupt handler registered, cleanup explicit, evidence persists

**Integration points:**
- Exercises use Takes recording infrastructure
- Exercise attempts stored as metadata on takes
- Quest completion triggers take playback/comparison
- Same block/lineRange scope system

**Domain Boundary:**
```typescript
// src/exercises/ - Pure exercise domain
├── exercise.types.ts      // Grammar & schema types
├── exercise.recipes.ts    // Recipe library
├── exercise.runtime.ts    // Pure helpers
└── exercise.store.ts      // Orchestration only

// src/takes/ - Recording substrate
├── takes.store.ts         // Take management
├── audio-engine.ts        // Recording/playback
└── blocks/                // Scope system
```

---

## 5. Frozen Direction

These decisions are **ARCHITECTURAL CONSTANTS**. Revisit only if product strategy fundamentally changes.

### 5.1 Recipe-First UX

Users interact with **recipes**, not raw exercise grammar. A recipe is a curated sequence:
```
Warmup → Technique Drill → Application → Cool Down
```

**Why:** Reduces cognitive load. Users practice, they don't program.

**Implementation:**
- Default library of pre-built recipes
- Teacher recommendations
- No matrix view for default users
- Linear "next exercise" flow

### 5.2 Quest Wrapper

Exercises are packaged as **quests** with:
- Clear objective ("Master 3-part harmony in chorus")
- Success criteria (accuracy threshold, completion count)
- Progress tracking (attempts, streaks, mastery level)

**Why:** Gamification provides motivation without gimmicks.

**Critical Distinction:** Quest is a *motivational wrapper*, NOT base logic. The exercise grammar remains simple and composable underneath. Quest adds engagement without altering execution semantics.

**Architecture:**
```typescript
interface Quest {
  id: string;
  title: string;
  exercises: QuestStepRef[];  // References to exercises
  completionRule: 'all' | 'any-n';
}
// Quest wraps exercises, doesn't alter their execution
```

### 5.3 Small Grammar

Exercise grammar is **minimal and composable**:
- `scope`: Where in the song (block + lineRange)
- `prompt`: What to do (text/audio instruction)
- `response`: How to respond (sing, listen, compare)
- `repeat`: How many times
- `goal`: Target metric (pitch accuracy %, timing window)
- `success`: Completion condition

**Why:** Simple grammar = easier authoring, clearer mental model.

### 5.4 Guided Teacher Composer

Teachers author exercises through a **guided composer**, not a DSL editor or text parser:
- Select block type (verse, chorus, etc.)
- Choose line range
- Pick exercise template from library
- Customize parameters (tempo, target notes, repeats)
- Save as recipe

**Why:** Lowers barrier to entry. Teachers focus on pedagogy, not syntax.

**Implementation:**
- Visual builders, not text parsing
- Template-driven composition
- Preview before publishing
- Share via private link or public library
- No raw JSON exposure to users

### 5.5 AI-Ready Schema Under the Hood

Exercise schema designed for **future AI generation** without requiring AI-first UX today.

**Characteristics:**
- Structured JSON representation (internal only)
- Clear success metrics
- Machine-readable prompts/goals
- Separation of intent vs. presentation

**Why:** Enables AI-powered exercise generation without redesign. Users see guided UI, AI sees structured data.

### 5.6 Progress Minimum = Session / Track / Block

Progress tracked at three granularities:
- **Session**: Single practice session snapshot
- **Track**: Aggregated across all sessions for one song
- **Block**: Granular progress for specific song section

**Later enhancement:** Line-level, phrase-level, word-level

**Why:** Start coarse, refine later. Block-level is sufficient for MVP.

### 5.7 Initial Scope = Block + LineRange

V1 scope granularity:
- **Block type**: verse, chorus, prechorus, bridge, intro, outro
- **LineRange**: Array of line indexes within block

**Example:**
```typescript
{
  blockId: "chorus-1",
  lineRange: [0, 1, 2, 3]  // First 4 lines
}
```

**Later:** Phrase-level, word-level, individual note targeting

**Why:** Block-level matches existing Takes infrastructure. No new scope system needed.

### 5.8 Pitch-Free V1 Goals

V1 exercises use **pitch-free goals**:
- Timing accuracy
- Rhythm matching
- Completion tracking
- Streak counting

**Pitch detection:** Optional enhancement in E2/E3

**Why:** Reduces initial complexity. Validates exercise mechanics without pitch analysis dependency.

### 5.9 Lightweight for MacBook 2013

Performance target: **Runs smoothly on MacBook Pro 2013** (dual-core i7, 8GB RAM, integrated graphics)

**Constraints:**
- No extra hot render loop
- Reuse existing animation frames
- Session data < 10KB per session
- Exercise transitions < 500ms
- No heavy real-time analytics

**Why:** If it runs on 2013 hardware, it runs anywhere. Forces discipline.

### 5.10 Alternation Mode Pattern Model (Future)

**Special modes like Call & Response use semantic role patterns, not raw numeric truth.**

**Pattern Model Characteristics:**
- Guide/user alternation across block lines (not fixed step sequences)
- Semantic role labels (`guide`, `response`) instead of line indices alone
- Configurable pattern types (line-pair, phrase-pair, custom)
- Visual pattern preview before exercise start
- Flexible backing mode assignment per role type

**Schema Example:**
```typescript
interface AlternationPattern {
  blockId: string;
  patternType: 'line-pair' | 'phrase-pair' | 'custom';
  roles: Array<{
    lineIndex: number;
    role: 'guide' | 'response';      // Semantic meaning
    backingMode: 'full' | 'instrumental' | 'silent';
  }>;
}
```

**Why Semantic Roles:**
- Clearer mental model ("I sing response lines" vs "I sing lines 1,3,5")
- Easier teacher authoring (assign roles, not indices)
- More flexible pattern definitions (override individual lines)
- Better AI generation hooks (role-based exercise synthesis)
- Supports phrase-level grouping (multiple lines per role unit)

**Implementation Notes:**
- Internal schema uses semantic role labels
- UI displays role-based pattern visualization
- Pattern configuration happens before exercise start
- Separate entry point from stable Drill launcher
- Code remains in exercises domain but requires dedicated configuration surface

**Why:** Enables sophisticated alternation patterns without complicating simple Drill recipes. Preserves ability to express complex guide/response relationships while keeping learner-facing surface simple.

### 5.11 Interruption Model Doctrine

**Blanket lock rejected as final architecture.** Current direction embraces **freedom-first + interruption model**:

**Key principles:**
- Practice session treated as first-class concept
- Exit/cancel/Esc pathways accepted and documented
- User can leave exercise mid-stream (intentional abandonment)
- Committed evidence must survive interruption (blobs saved, progress recorded)
- Lock protects active execution, not imprisonment
- Practice session interrupt handler registered in TakesControlStrip
- Cleanup on interrupt: cancels countdown, clears timers, stops recorder, exposes analyser

**Interrupt practice API:**
```typescript
import { interruptPracticeSession } from '../../exercises/exercise.interruption';

onClick={(e) => {
  interruptPracticeSession(() => {
    // actual action here
  });
}}
```

**Philosophy:** Lock shields user from accidental self-sabotage during focused execution, but escape hatches remain available for intentional course-correction. Evidence committed before interruption persists (recorded takes saved, round progress tracked).

**Host-breaking actions:**
Current exercise runtime lives on top of Takes host surfaces. When user breaks host (navigation, track change, explicit cancel):
- Interrupt handler fires
- In-progress transactions cancelled cleanly
- Committed evidence survives (blobs stored, metadata saved)
- No zombie state accumulation (countdowns cleared, analyser references released)
- Session snapshot persisted where applicable

**Why:** Trust through control. User always has explicit out, but work isn't lost arbitrarily.

---

## 6. Exercise Grammar

The **atomic unit** of an exercise. All exercises share this core schema.

### 6.1 Scope

Defines **where** in the song the exercise applies.

```typescript
{
  blockId: string,           // e.g., "chorus-1"
  lineRange: [number, number] // e.g., [0, 3] = first 4 lines
}
```

**Initial scope:** Block-level granularity (verse, prechorus, chorus, bridge, intro, outro)

**Later:** Phrase-level, word-level, individual note targeting

### 6.2 Prompt

Defines **what** the user should do.

```typescript
{
  text: string,              // "Sing the melody softly"
  audioUrl?: string,         // Optional demo recording
  visualCue?: 'piano' | 'waveform' | 'lyrics'
}
```

### 6.3 Response

Defines **how** the user responds.

```typescript
{
  type: 'sing' | 'listen' | 'compare' | 'tap',
  constraints?: {
    maxDurationSec?: number,
    minPitch?: number,       // MIDI note number
    maxPitch?: number
  }
}
```

### 6.4 Repeat

Defines **repetition structure**.

```typescript
{
  count: number,             // e.g., 3
  mode: 'fixed' | 'until-success' | 'until-mastery'
}
```

### 6.5 Goal

Defines **success metrics**.

```typescript
{
  type: 'pitch-accuracy' | 'timing' | 'completion' | 'rhythm',
  threshold: number,         // e.g., 0.85 = 85% accuracy
  window?: number            // e.g., 0.1 = ±10 cents for pitch
}
```

**V1 Focus:** Pitch-free goals first (timing, completion, rhythm)

**Why:** Reduces initial complexity. Pitch detection can be added later as optional enhancement.

### 6.6 Success

Defines **completion condition**.

```typescript
{
  condition: 'all' | 'best-of' | 'streak',
  target: number             // e.g., 3 successful attempts
}
```

---

## 7. Recipe Model

A **recipe** is a curated sequence of exercises forming a complete practice session.

```typescript
interface Recipe {
  id: string;
  title: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  durationMin: number;
  
  exercises: Exercise[];     // Ordered sequence
  
  // Metadata
  authorId?: string;
  tags: string[];            // ['harmony', 'range', 'warmup']
  version: string;
}
```

**Recipe types:**
- **Warmup**: Prepares voice (breathing, gentle humming)
- **Technique**: Builds specific skill (vibrato, belting, falsetto)
- **Application**: Applies technique to song section
- **Cool-down**: Returns voice to resting state

**Key principle:** Recipes are **discovered**, not created by most users. Default library + teacher recommendations.

---

## 8. Quest Model

A **quest** wraps a recipe with gamified progression.

```typescript
interface Quest {
  id: string;
  recipeId: string;
  title: string;
  objective: string;         // "Master 3-part harmony"
  
  successCriteria: {
    completionCount: number, // Complete recipe N times
    accuracyThreshold: number,
    streakRequired: number
  };
  
  rewards?: {
    badges: string[],
    unlockNextQuest: boolean
  };
  
  progress: QuestProgress;   // User-specific
}
```

**Quest features:**
- Daily/weekly challenges
- Progressive difficulty (bronze → silver → gold)
- Social sharing (optional)
- Unlock system (complete Quest A to access Quest B)

---

## 9. Progress Model

Track progress at **three levels**: session, track, block.

### 9.1 Session

Single practice session snapshot.

```typescript
interface SessionProgress {
  sessionId: string;
  timestamp: number;
  recipeId: string;
  questId?: string;
  
  exercises: {
    exerciseId: string;
    attempts: AttemptResult[];
    completed: boolean;
  }[];
}
```

### 9.2 Track

Aggregated progress across all sessions for one song.

```typescript
interface TrackProgress {
  trackId: string;
  totalSessions: number;
  questsCompleted: number;
  
  byBlock: {
    [blockId: string]: BlockProgress;
  };
  
  trends: {
    pitchAccuracy: number[],  // Session-by-session averages
    consistency: number[]
  };
}
```

### 9.3 Block

Granular progress for specific song section.

```typescript
interface BlockProgress {
  blockId: string;
  exercisesAttempted: number;
  bestAccuracy: number;
  streak: number;
  lastAttemptAt: number;
}
```

### 9.4 Line (Later)

Future enhancement: drill down to individual line progress.

```typescript
interface LineProgress {
  lineIndex: number;
  attempts: number;
  accuracyHistory: number[];
}
```

---

## 10. Teacher Authoring Model

Teachers author exercises through a **guided composer**, not a code editor.

### 10.1 Guided Recipe Composition Flow

1. **Select scope**: Choose block type + line range
2. **Pick template**: Library of exercise patterns
3. **Customize**: Adjust tempo, target notes, repeats
4. **Sequence**: Arrange exercises into recipe flow
5. **Preview**: Test recipe before publishing
6. **Assign**: Share with students or publish to library

### 10.2 Template Library

Pre-built exercise templates:
- **Pitch matching**: Sing along with reference
- **Rhythm clapping**: Tap timing before singing
- **Call and response**: Echo short phrases
- **Harmony layers**: Build multi-part arrangement
- **Range extension**: Gradually expand vocal range

### 10.3 Sharing Model

- **Private**: Teacher's own exercises
- **Shared**: Shared with specific students/classes
- **Public**: Published to community library (optional moderation)

---

## 11. AI-Ready Schema Direction

Exercises designed for **future AI generation** without requiring AI-first UX today.

### 11.1 Structured Representation

All exercises stored as JSON:
```json
{
  "grammar": "exercise-v1",
  "scope": { "blockId": "chorus-1", "lineRange": [0, 3] },
  "prompt": { "text": "Sing with breathy tone", "audioUrl": "/samples/breathy.mp3" },
  "response": { "type": "sing", "constraints": { "maxDurationSec": 8 } },
  "repeat": { "count": 3, "mode": "fixed" },
  "goal": { "type": "pitch-accuracy", "threshold": 0.8, "window": 0.15 },
  "success": { "condition": "best-of", "target": 3 }
}
```

### 11.2 AI Generation Hooks

Schema supports future AI enhancements:
- **Prompt generation**: AI suggests prompts based on song analysis
- **Goal calibration**: AI adjusts thresholds based on user skill
- **Adaptive sequencing**: AI reorders exercises based on performance
- **Personalization**: AI recommends recipes based on weak areas

### 11.3 Separation of Concerns

- **Schema**: Machine-readable structure (AI-friendly)
- **Presentation**: Human-readable UI (designer-friendly)
- **Logic**: Exercise execution engine (developer-friendly)

**Why:** Enables swapping AI models without breaking UX.

---

## 12. What Is Explicitly Out of Scope

Protect against over-engineering. These are **NON-GOALS** for v1.

### 12.1 No Transport Rewrite

- Uses existing Takes recording infrastructure
- No changes to audio engine, mic handling, or file storage
- Exercises are **metadata layer** on top of takes
- No new hot render loop
- Fits current dock/Takes surface
- **Transport ownership remains with Takes**
- No playback/pause/stop control changes

### 12.2 No Pitch-First Mandatory Architecture

- V1 supports pitch-free exercises (timing, rhythm, completion)
- Pitch detection is optional enhancement (later)
- Default exercises don't require pitch analysis
- Validates mechanics before adding complexity

### 12.3 No Matrix-First Primary UX

- Primary interface: **Recipe player**, not exercise matrix/grid
- Matrix view exists for teachers/advanced users only
- Default user sees linear "next exercise" flow
- No complex navigation patterns

### 12.4 No Giant Editor

- No complex DAW-like interface
- No multi-track arrangement view
- Simple card-based exercise presentation
- Lightweight modal or inline overlay
- No timeline editing
- No waveform manipulation tools

### 12.5 No Raw DSL User-Facing Editor

- Teachers use **guided composer**, not text-based DSL
- No syntax to memorize, no parsing errors
- Visual builders for all parameters
- JSON schema is internal representation, not user-facing
- No code editors exposed to users

### 12.6 No Backend-First Lesson System

- No LMS integration required
- No curriculum mapping database
- Local-first progress tracking
- Optional cloud sync later
- No classroom management features
- No grading system

### 12.7 No Phrase/Word-Level (Initially)

- Initial scope: **Block-level** (verse, chorus, etc.)
- Phrase-level refinement comes in E2/E3
- Word/note targeting is advanced feature (later)
- LineRange is finest granularity for MVP

### 12.8 No Social/Classroom/Backend

- Exercises are **solo practice** tool
- Teacher feedback is asynchronous (review progress, leave comments)
- No duet mode, no simultaneous recording
- No classroom management features
- No social media integration (v1)
- No live collaboration

### 12.10 No Broad Learner Expansion Before Trust

- Default learner-facing practice surface remains minimal (stable-2 only)
- Smoke/experimental recipes hidden from default popover
- Call & Response remains hidden special alternation lane (dedicated entry point required)
- Next major learner-facing deepening happens through:
  - Clearer layer model (composable I/V/T separation)
  - Timing feedback lane (X-axis evidence)
  - NOT through more mode exposure or recipe proliferation
- Trust built through stability, not feature count

### 12.9 No Advanced Analytics Dashboard

- Basic progress tracking: session count, accuracy trends
- No heatmaps, no detailed statistical analysis (v1)
- Keep lightweight for MacBook 2013
- Simple progress UI: rounds completed, streaks, badges
- No machine learning insights (yet)

### 12.10 No Broad Learner Expansion Before Trust

- Default learner-facing practice surface remains minimal (stable-2 only)
- Smoke/experimental recipes hidden from default popover
- Call & Response remains hidden special alternation lane (dedicated entry point required)
- Next major learner-facing deepening happens through:
  - Clearer layer model (composable I/V/T separation)
  - Timing feedback lane (X-axis evidence)
  - NOT through more mode exposure or recipe proliferation
- Trust built through stability, not feature count

---

## 13. Minimal Rollout Plan

Staged delivery to validate assumptions before over-building.

### Current Status (Recovery Truth)

**Visible Drill Surface:** Temporarily restricted to runtime-confirmed stable recipes only.

- **Visible recipes** (E1 MVP):
  - `Echo Drill` — Listen, then sing it back
  - `3-Take Challenge` — Record 3 takes and pick the best

- **Hidden from learner surface** (under dedicated recovery/redesign):
  - `Call & Response` — **Special alternation mode lane**. No longer treated as a generic stable Drill recipe for current learner surface. Being redefined as a dedicated configuration-driven mode with pattern-based control (guide/user alternation across block lines). Will later use dedicated entry point (button or modal), separate from stable Drill launcher. Remains hidden until backing semantics and alternation patterns are re-locked.
  - `A Cappella Boss` — Product-open until backing semantics are re-locked. Hidden from current Drill launcher.
  - `No Training Wheels` — Hidden until dedicated execution wave lands.

**Current repository status:** This repo remains the recovery base. All recipes remain in the codebase library (`exercise.recipes.ts`) but are selectively hidden from the user-facing Drill launcher via runtime allowlist.

**Implementation:**
```typescript
// src/exercises/components/RecipeCardPopover.tsx
const visibleRecipeIds = [
  'triple-take',    // 3-Take Challenge
  'echo-drill',     // Echo Drill
];
// unstable/specialized recipes stay hidden until dedicated execution wave lands
```

**Why this restriction:**
- Ensures learner-facing surface contains only **runtime-confirmed stable** patterns
- Allows specialized/unstable recipes to remain in codebase without user-facing exposure
- Provides clean separation between "ready for learners" vs "under development"
- Enables future activation waves without code changes (just allowlist updates)
- **Call & Response specifically**: Requires dedicated configuration UI (pattern selection, role assignment) that differs fundamentally from simple stable recipes like Echo Drill or 3-Take Challenge

---

### Call & Response: Special Alternation Mode Direction

**Strategic Reclassification:**

`Call & Response` is no longer classified as a generic Drill recipe. It is being redesigned as a **special alternation mode** with the following characteristics:

**Key Differences from Stable Drill Recipes:**

| Aspect | Stable Drill Recipes | Call & Response (Special Mode) |
|--------|---------------------|-------------------------------|
| **Entry Point** | RecipeCardPopover (simple card click) | Dedicated button or configuration modal |
| **Configuration** | None (immediate start) | Pattern selection, role assignment required |
| **Pattern Model** | Fixed step sequence | Dynamic guide/user alternation pattern |
| **Semantic Roles** | Static (always listen → record) | Context-dependent (which lines are guide vs. response) |
| **Complexity** | Low (single flow) | High (requires pattern visualization, preview) |
| **Learner Surface** | Visible (Echo Drill, 3-Take) | Hidden (separate specialized entry) |

**Future Implementation Direction:**

1. **Dedicated Entry Point** (not via RecipeCardPopover):
   ```typescript
   // Separate from stable Drill launcher
   <button onClick={() => openAlternationModeConfig(blockId)}>
     🔀 Call & Response
   </button>
   ```

2. **Pattern Configuration Modal**:
   - Select alternation pattern (line-pair, phrase-pair, custom)
   - Visualize pattern on block lyrics before starting
   - Assign semantic roles (guide lines vs. response lines)
   - Configure backing mode per role type

3. **Semantic Role Schema** (not raw numeric indices):
   ```typescript
   interface AlternationPattern {
     blockId: string;
     roles: Array<{
       lineIndex: number;
       role: 'guide' | 'response';  // Semantic meaning
       backingMode: 'full' | 'instrumental' | 'silent';
     }>;
     patternType: 'line-pair' | 'phrase-pair' | 'custom';
   }
   ```

4. **Internal Schema Design**:
   - Use semantic role labels (`guide`, `response`) instead of raw numeric truth
   - Support flexible pattern definitions (not hardcoded line pairs)
   - Enable phrase-level grouping (multiple lines per alternation unit)
   - Preserve ability to override individual line roles

**Why Separate from Stable Drill:**
- Requires pre-exercise configuration (pattern selection)
- More complex mental model (alternating roles vs. single action)
- Needs visual pattern preview before commitment
- Different success criteria (pattern coherence, not just completion)
- Potentially different UI surface (pattern editor, not simple card)

**Current Status:**
- Code remains in `src/exercises/exercise.recipes.ts` (for reuse when ready)
- Hidden from learner-facing Drill launcher via `visibleRecipeIds` allowlist (evolved: now uses `surface` + `visibility` props instead)
- Under active redesign as special alternation mode lane
- No timeline for learner surface inclusion (depends on backing semantics re-lock)

---

### E0: Foundation (Proof of Concept)

**Goal:** Prove exercise grammar works

- Implement exercise schema (JSON)
- Manual exercise definition (hardcoded)
- Single exercise type: pitch matching
- Basic attempt tracking (local storage)
- No quest wrapper, no teacher tools

**Success:** Can complete 5 pitch exercises in a row

### E1: Recipe Player (MVP)

**Goal:** Validate recipe-first UX

- 3 pre-built recipes (warmup, technique, application)
- Linear recipe flow (exercise 1 → 2 → 3...)
- Session progress tracking
- Basic success/failure feedback
- Quest wrapper (single quest per recipe)

**Success:** Users complete full recipe sessions voluntarily

### E2: Teacher Composer (Alpha)

**Goal:** Validate guided authoring

- Visual recipe builder (drag-drop exercises)
- Template library (5-7 exercise types)
- Share with students (private links)
- Student progress view for teachers
- Block-level scope selector

**Success:** Teachers create 10+ custom recipes without documentation

### E3: Progress & Quests (Beta)

**Goal:** Validate gamification

- Multi-quest progression system
- Streak tracking, badges
- Track-level aggregation
- Accuracy trend charts
- Community recipe library (curated)

**Success:** 30% of users return for daily quests

### E4+: Advanced Features (Post-Validation)

**Candidates:**
- Phrase/word-level exercises
- AI-powered exercise generation
- Social challenges / leaderboards
- Advanced analytics dashboard
- Duet/collaboration modes

**Decision criteria:** Only build if E1-E3 show engagement

---

## 14. Release Gates

Exercises progress through three gates before appearing in learner-facing surfaces:

### 14.1 Stable Drill Trust Gate

**Criteria for inclusion in visible recipe allowlist:**
- ✅ Runtime execution confirmed (no red screen on start)
- ✅ Backing semantics locked (full/instrumental/silent behavior defined)
- ✅ Success criteria unambiguous (user knows when complete)
- ✅ Recovery path validated (fails gracefully, no dead ends)
- ✅ Performance budget met (MacBook 2013)
- ✅ **Exercise execution lock compatible** (no interference during listening/pre-recording/recording)

**Current members:**
- `Echo Drill` — Listen, then sing it back
- `3-Take Challenge` — Record 3 takes and pick the best

**Gate keeper:** Runtime allowlist in `RecipeCardPopover.tsx` (`surface === 'stable'` filter)

### 14.2 Fast Feedback Trust Gate

**Criteria for rapid iteration cycles:**
- ✅ Attempt → Result loop < 2 seconds
- ✅ Clear visual feedback (waveform/overlay appears immediately)
- ✅ No modal maze (single overlay, not nested dialogs)
- ✅ One-click retry (no re-navigation required)
- ✅ Progress auto-saved (no manual "save" button)

**Validation method:** Manual timing during development sessions

### 14.3 Advanced Lane Entry Gate

**Criteria for special modes (Call & Response, A Cappella Boss, etc.):**
- ✅ Dedicated configuration UI (not simple card click)
- ✅ Pattern visualization before start (semantic roles, not indices)
- ✅ Backing mode assignment per role type
- ✅ Separate entry point from stable Drill launcher
- ✅ Explicit scope documentation (which blocks/lines supported)
- ✅ **Execution lock integration** (blocks all interference surfaces during active phases)

**Current status:**
- `Call & Response` — Under redesign as alternation mode (special surface, dedicated entry point required)
- `A Cappella Boss` — Hidden until backing semantics re-locked (smoke surface)
- `No Training Wheels` — Hidden until dedicated execution wave (smoke surface)

---

## 15. Recipe Surface Classification

All recipes classified into three categories for learner surface visibility:

### 15.1 Stable

**Definition:** Runtime-confirmed, backing-locked, safe for general learner surface.

**Characteristics:**
- Execution path validated (no runtime errors)
- Backing semantics fully defined (full/instrumental/silent)
- Success criteria clear to user
- Recovery path tested
- Performance budget met (MacBook 2013)

**Current members:**
- `Echo Drill` — Simple listen → echo pattern (3 rounds, instrumental backing)
- `3-Take Challenge` — Record 3 takes, compare, select best (until-filled mode)

**Visibility:** Shown in RecipeCardPopover default launcher (stable-2 surface only)

### 15.2 Smoke / Experimental

**Definition:** Working code, but backing semantics or success criteria under active redesign. NOT included in default learner surface.

**Characteristics:**
- Code exists in `exercise.recipes.ts`
- Runtime execution may have edge cases
- Backing semantics partially defined or context-dependent
- Requires dedicated configuration UI (not simple card)
- Needs explicit teacher guidance or documentation
- Not yet included in stable execution lock validation

**Current members:**
- `No Training Wheels` (backing-only) — Instrumental-only challenge
- `A Cappella Boss` (acappella-boss) — Progressive full → instrumental → vocals-only

**Visibility:** Hidden from default learner popover, accessible via future teacher tools or advanced surface

### 15.3 Special

**Definition:** Alternation modes requiring semantic role patterns, dedicated configuration UI, and separate entry point. NOT generic drill recipes.

**Characteristics:**
- Uses semantic role labels (`guide`, `response`) instead of fixed step sequences
- Requires pattern configuration before start (line-pair, phrase-pair, custom)
- Visual pattern preview mandatory before commitment
- Separate entry point from stable Drill (dedicated button/modal)
- Context-dependent backing assignment per role type
- Requires dedicated execution lock validation (different interaction patterns)

**Current members:**
- `Call & Response` — First member of alternation family (requires pattern configuration)

**Visibility:** Completely separate surface, NOT shown in RecipeCardPopover, requires dedicated configuration UI

---

## 16. Progress Types

Progress tracking explicitly separated into three distinct types:

### 16.1 Evidence

**What:** Raw session data — attempts, recordings, accuracy metrics

**Stored:**
```typescript
interface Evidence {
  sessionId: string;
  timestamp: number;
  exerciseId: string;
  attemptResults: Array<{
    audioBlob?: Blob;      // Recording
    accuracyScore?: number; // 0.0 - 1.0
    durationSec: number;
    completed: boolean;
  }>;
}
```

**Purpose:** Objective record of what happened

**Retention:** Session-only (cleared on track change unless explicitly saved)

### 16.2 Mastery

**What:** Aggregated skill metrics across sessions

**Stored:**
```typescript
interface Mastery {
  blockId: string;
  bestAccuracy: number;     // Best single attempt
  averageAccuracy: number;  // Session average
  streak: number;           // Consecutive successful attempts
  totalAttempts: number;
  lastAttemptAt: number;
}
```

**Purpose:** Long-term skill progression tracking

**Retention:** Persistent (saved to localStorage, survives reloads)

### 16.3 Momentum

**What:** Session-to-session trend indicators

**Stored:**
```typescript
interface Momentum {
  trackId: string;
  sessions: Array<{
    date: string;           // YYYY-MM-DD
    exercisesCompleted: number;
    averageAccuracy: number;
    streakStarted: boolean;
  }>;
  trends: {
    pitchAccuracy: number[];  // Session-by-session averages
    consistency: number[];
    engagementScore: number;  // Derived metric
  };
}
```

**Purpose:** Motivation and engagement feedback

**Retention:** Persistent but pruned (keep last 30 days max)

---

## 17. Alternation Modes

**Call & Response** is the first member of a **special alternation family**, NOT a generic stable drill recipe.

### 17.1 What Makes It Special

**Stable Drill Recipes:**
- Fixed step sequence (listen → record → done)
- Single flow, no configuration required
- Visible in RecipeCardPopover default launcher
- Immediate start on card click

**Alternation Modes:**
- Dynamic guide/user alternation pattern across block lines
- Semantic role labels (`guide`, `response`) instead of raw line indices
- Requires pre-exercise configuration (pattern selection, role assignment)
- Separate entry point (dedicated button or modal)
- Visual pattern preview before commitment

### 17.2 Pattern Model Schema

```typescript
interface AlternationPattern {
  blockId: string;
  patternType: 'line-pair' | 'phrase-pair' | 'custom';
  roles: Array<{
    lineIndex: number;
    role: 'guide' | 'response';      // Semantic meaning
    backingMode: 'full' | 'instrumental' | 'silent';
  }>;
}
```

**Why Semantic Roles:**
- Clearer mental model ("I sing response lines" vs "I sing lines 1,3,5")
- Easier teacher authoring (assign roles, not indices)
- More flexible pattern definitions (override individual lines)
- Better AI generation hooks (role-based exercise synthesis)
- Supports phrase-level grouping (multiple lines per role unit)

### 17.3 Future Alternation Family Members

- `Call & Response` — Line-pair alternation (guide sings line N, user sings line N+1)
- `Phrase Echo` — Phrase-pair alternation (guide sings phrase A, user repeats phrase A)
- `Harmony Stack` — Multi-track layering (guide sings melody, user adds harmony)
- `Question & Answer` — Custom pattern (teacher-defined call/response mapping)

**Implementation Notes:**
- Internal schema uses semantic role labels
- UI displays role-based pattern visualization
- Pattern configuration happens before exercise start
- Separate entry point from stable Drill launcher
- Code remains in exercises domain but requires dedicated configuration surface

---

## 18. Mode Capability Table

| Mode | Stable | Uses Listen | Uses In-Flight | Uses LineRange | Learner Visible | Notes |
|------|--------|-------------|----------------|----------------|-----------------|-------|
| **Echo Drill** | ✅ Yes | ✅ Yes | ❌ No | ✅ Yes | ✅ Yes | Simple listen → echo pattern (stable-2 surface) |
| **3-Take Challenge** | ✅ Yes | ❌ No | ❌ No | ✅ Yes | ✅ Yes | Record 3 takes, compare, select best (stable-2 surface) |
| **Call & Response** | ⚠️ Special | ✅ Yes | ✅ Yes | ✅ Yes | ❌ No | Alternation mode, dedicated entry point, NOT in default popover |
| **A Cappella Boss** | ⚠️ Smoke | ❌ No | ✅ Yes | ✅ Yes | ❌ No | Backing semantics under redesign, hidden from default |
| **No Training Wheels** | ⚠️ Smoke | ❌ No | ✅ Yes | ✅ Yes | ❌ No | Awaiting dedicated execution wave, hidden from default |
| **Tempo Lane** | ⚠️ Experimental | ✅ Yes | ❌ No | ✅ Yes | ⚠️ Teacher-only | Guide-first under frozen contracts |
| **Instant Review** | ⚠️ Experimental | ❌ No | ❌ No | ✅ Yes | ⚠️ Teacher-only | One-shot post-record loop playback |

**Legend:**
- ✅ Yes = Fully implemented and validated
- ⚠️ Special/Experimental/Hidden = Not in stable drill allowlist
- ❌ No = Not used by this mode

---

## 19. Instant Review Clarification

**Instant Review** is a **one-shot post-record loop playback** pattern:

**Flow:**
1. User records take (standard Takes infrastructure)
2. Immediately after stop, take plays back automatically (no manual click)
3. Single loop only (not continuous repeat)
4. User can accept (move on) or reject (re-record)

**Not to be confused with:**
- **Continuous loop mode** — Repeats indefinitely until stopped
- **Multi-take comparison** — A/B comparison of multiple takes
- **Preview playback** — Manual play button on existing take

**Use case:** Rapid iteration cycles where user needs immediate auditory feedback without navigation overhead.

---

## 20. Tempo Lane Direction

**Tempo Lane** operates as a **guide-first practice lane** under current frozen contracts:

**Characteristics:**
- Guide track plays first (reference tempo/pitch)
- User follows along with guide
- No backing track manipulation (frozen contract: backing = instrumental or silent only)
- Uses existing monitor-mix.js infrastructure
- Tempo adjustments require full re-initialization of audio graph

**Limitation:** Cannot dynamically adjust tempo mid-exercise without breaking frozen contracts.

**Future enhancement:** Lower strip should evolve into **state-aware surface** that understands:
- Current exercise phase (pre-recording, recording, review)
- Active role (guide listening, user singing)
- Backing mode assignment (full, instrumental, silent)
- Tempo lane membership (if applicable)

This would enable dynamic UI adaptation without manual state management.

---

## 21. Success Criteria

### Speed & Simplicity

- **Useful exercise starts in under 5 seconds** — No complex setup, immediate engagement
- **Teacher creates useful exercise in under 30 seconds** — Guided composer, template library
- **No new modal maze** — Inline overlays, not nested dialog hell
- **Zero configuration** — Works out of the box with default recipes
- **Protected execution** — Exercise lock blocks all interference during listening/pre-recording/recording

### Technical Constraints

- **No transport ownership changes** — Uses existing Takes infrastructure
- **No extra hot render loop** — Reuses current animation frames
- **Exercises fit current dock/Takes surface** — No UI real estate expansion
- **Performance:** Exercise transitions < 500ms
- **Storage:** Session data < 10KB per session
- **Compatibility:** Runs smoothly on MacBook Pro 2013 (dual-core, 8GB RAM)
- **Offline:** Exercises playable without network (progress syncs later)
- **Execution Lock:** All 17 interference surfaces blocked during active phases (VERIFICATION-EXLOCK-101)

### User Engagement Metrics

- **Completion rate:** >60% of started recipes finished
- **Retention:** >40% of users return within 7 days
- **Teacher adoption:** >20% of teachers create custom recipes
- **Quest engagement:** >30% complete at least 3 quests

### Quality Metrics

- **Clarity:** Users understand exercise goals without help text
- **Flow:** No confusion about "what's next"
- **Feedback:** Clear success/failure signals
- **Motivation:** Users report feeling "progress"
- **Lightweight:** No performance degradation on older hardware

---

## 22. One-Line Summary

**Exercises transform beLive from a performance capture tool into a skill-building platform—using quest-based learning, teacher-guided recipes, comprehensive execution lock protection during active phases, freedom-first interruption model (exit/cancel/Esc pathways documented), and a minimal grammar that scales from solo practice to AI-powered personalization, while maintaining strict separation between stable learner-facing surface (stable-2 only) and hidden experimental/special modes, with committed evidence surviving interruption.**

---

## Appendix A: Glossary

| Term | Definition |
|------|------------|
| **Exercise** | Atomic practice unit (scope + prompt + response + goal) |
| **Recipe** | Curated sequence of exercises forming a practice session |
| **Quest** | Gamified wrapper around a recipe with objectives/rewards |
| **Grammar** | Formal schema defining exercise structure |
| **Template** | Pre-built exercise pattern for teacher customization |
| **Session** | Single practice session (one recipe completion) |
| **Block** | Song section (verse, chorus, bridge, etc.) |
| **LineRange** | Specific lines within a block |

## Appendix B: Example Exercise JSON

```json
{
  "id": "ex-pitch-chorus-001",
  "grammar": "exercise-v1",
  "scope": {
    "blockId": "chorus-1",
    "lineRange": [0, 3]
  },
  "prompt": {
    "text": "Match the reference pitch. Hold each note for 4 beats.",
    "audioUrl": "/samples/chorus-melody.mp3",
    "visualCue": "piano"
  },
  "response": {
    "type": "sing",
    "constraints": {
      "maxDurationSec": 12,
      "minPitch": 60,
      "maxPitch": 72
    }
  },
  "repeat": {
    "count": 3,
    "mode": "fixed"
  },
  "goal": {
    "type": "pitch-accuracy",
    "threshold": 0.85,
    "window": 0.1
  },
  "success": {
    "condition": "best-of",
    "target": 3
  }
}
```

## Appendix C: Related Documents

- **Takes System**: `/docs/architecture/takes-system.md` (if exists)
- **Sync/Monitor/Pitch**: `/docs/architecture/sync-monitor-pitch-integration.md`
- **Audio Engine**: `/docs/architecture/audio-engine.md`
- **Interaction Semantics**: `/docs/architecture/interaction-schema-2.1.md`
