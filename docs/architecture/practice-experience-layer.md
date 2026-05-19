# Practice Experience Layer

**Status:** Product/UX Concept Document  
**Last Updated:** 2024  
**Related Docs:** [quest-scenario-system.md](./quest-scenario-system.md), [takes-system.md](./takes-system.md)

---

## 1. Purpose

### 1.1 Separate Internal Architecture from User-Facing Experience

This document defines the **user-facing practice experience layer** — how learners perceive and interact with practice, independent of internal system architecture.

**Why separate:**
- Internal architecture (generators, programs, specs) is implementation detail
- User experience (scenes, cards, challenges) is product language
- Architecture can evolve without breaking user mental models
- Product language can evolve without breaking architecture

**Key principle:** Users don't think in "scenario programs" or "generator families" — they think in "practice sessions" and "challenges."

### 1.2 Document Scope

**This document covers:**
- User-facing practice concepts (scenes, cards, challenges)
- Learner mental models and language
- Experience principles and patterns
- MVP vs future enrichments

**This document does NOT cover:**
- Internal system architecture (see quest-scenario-system.md)
- Implementation details (see codebase)
- Visual design specifics (see design system)


---

## 2. Practice Scene Doctrine

### 2.1 User Enters a Practice Scene, Not Just a Mode

**Core principle:** Practice is a **scene** — a dedicated space with its own rules, visuals, and interactions.

**Not:** "Switch to practice mode" (implies same space, different behavior)  
**Yes:** "Enter practice scene" (implies dedicated space, immersive experience)

**Scene characteristics:**
- Canvas-first layout (waveform, lyrics, takes dominate)
- Dedicated controls (record, compare, tempo)
- Immersive focus (minimal chrome, no distractions)
- Clear entry/exit (transition in, transition out)

**Why scene matters:**
- Sets expectations (this is practice time, not browsing)
- Enables immersion (full attention on singing)
- Supports flow state (no mode-switching confusion)
- Allows scene-specific UI (practice controls don't clutter other modes)

### 2.2 Canvas-First Scene

**Layout principle:** Practice scene is **canvas-first** — waveform and lyrics are primary, controls are secondary.

**Canvas elements:**
- Waveform (instrumental, vocal reference, recorded takes)
- Lyrics (block view, word highlight, active line)
- Playhead (current position)
- Block cue (next block preview)

**Control elements:**
- Transport (play, pause, seek)
- Record button (with countdown)
- Take cards (slots 0-5)
- Compare toggle (A/B mode)
- Tempo control (speed adjustment)

**Hierarchy:**
1. Canvas (80% of screen) — where practice happens
2. Controls (20% of screen) — how to practice
3. Chrome (minimal) — navigation, settings

### 2.3 Challenge/Journey Cards Live Inside This Scene

**Principle:** Practice cards (challenges, journeys) are **launched from within** the practice scene, not before entering.

**Flow:**
1. User enters practice scene (selects song, enters rehearsal/takes mode)
2. User sees canvas (waveform, lyrics, takes)
3. User clicks block or practice button
4. Card picker appears (overlay or popover)
5. User selects card (challenge or journey)
6. Card executes within scene (no scene exit)
7. Card completes, user returns to canvas

**Why inside scene:**
- Reduces friction (no pre-practice decision paralysis)
- Maintains context (canvas stays visible)
- Enables quick iteration (try card, adjust, try again)
- Supports flow (no scene transitions mid-practice)


---

## 3. User-Facing Card Contract

**Frozen principle:** Every learner-facing practice card must communicate three things clearly.

### 3.1 Promise

**What:** What will you achieve by completing this card?

**Examples:**
- "Master this chorus in 3 takes"
- "Build muscle memory through repetition"
- "Learn the melody by echoing the original"
- "Challenge yourself with no vocal guide"

**Why promise matters:**
- Sets expectations (learner knows what they're working toward)
- Motivates completion (clear goal is motivating)
- Enables choice (learner picks card based on promise)

**Anti-pattern:** Vague promises ("Practice this block", "Improve your singing")

### 3.2 Method

**What:** How will you practice? What's the structure?

**Examples:**
- "Listen to the original, then sing it back (3 rounds)"
- "Record 3 takes, then pick your best"
- "Alternate lines with the original singer"
- "Slow down to 85% speed, then speed up"

**Why method matters:**
- Reduces anxiety (learner knows what to expect)
- Builds confidence (clear structure is reassuring)
- Enables preparation (learner can mentally rehearse)

**Anti-pattern:** Hidden structure (learner discovers steps mid-practice)

### 3.3 Win Condition

**What:** How do you know when you're done?

**Examples:**
- "Complete 3 rounds"
- "Fill all 3 take slots"
- "Reach the end without stopping"
- "Match the original's tempo"

**Why win condition matters:**
- Provides closure (learner knows when to stop)
- Enables progress tracking (clear completion state)
- Supports mastery (learner can measure improvement)

**Anti-pattern:** Ambiguous completion ("Practice until you feel ready")

### 3.4 Card Contract Template

```
[Card Name]
[Icon]

Promise: [What you'll achieve]
Method: [How you'll practice]
Win: [How you know you're done]

[Start Button]
```

**Example:**

```
Echo Drill
🎧

Promise: Build muscle memory by echoing the original
Method: Listen, then sing it back (3 rounds)
Win: Complete all 3 rounds

[Start Challenge]
```


---

## 4. Accepted Experience Concepts

These concepts are **accepted and strong** — they guide product decisions and UX design.

### 4.1 Practice Scene

**Concept:** Dedicated immersive space for practice, canvas-first layout, clear entry/exit.

**Status:** Accepted strong concept  
**Current implementation:** Rehearsal mode, Takes mode (partial scene semantics)  
**Future evolution:** Stronger scene transitions, scene-specific chrome, scene state preservation

### 4.2 Challenge/Journey Card Idea

**Concept:** Practice sessions are presented as cards with promise/method/win contract.

**Status:** Accepted strong concept, naming candidates not final freeze  
**Naming candidates:**
- "Challenge" — short, focused, skill-building (e.g., Echo Drill, 3-Take Challenge)
- "Journey" — longer, progressive, mastery-building (e.g., Tempo Ladder, Full Song Journey)

**Current implementation:** Recipe cards (Echo Drill, 3-Take Challenge, Call & Response)  
**Future evolution:** Richer card metadata, card catalog, card authoring

**Naming note:** "Challenge" and "Journey" are strong candidates, not final freeze. May evolve based on user research.

### 4.3 Completion Moment

**Concept:** Clear, celebratory moment when practice card completes.

**Status:** Accepted strong concept  
**Current implementation:** "Complete!" message in ExerciseStrip  
**Future evolution:** Richer completion UI (animation, sound, evidence summary, next steps)

**Why completion matters:**
- Provides closure (learner knows they're done)
- Celebrates achievement (positive reinforcement)
- Enables reflection (what did I learn?)
- Suggests next steps (what's next?)

### 4.4 Advance / Hold / Simplify

**Concept:** Three post-completion actions learner can take.

**Status:** Accepted strong concept  
**Actions:**
- **Advance** — Try harder variation (faster tempo, less backing, longer scope)
- **Hold** — Repeat same card (build consistency)
- **Simplify** — Try easier variation (slower tempo, more backing, shorter scope)

**Current implementation:** Manual card selection (no automatic suggestions)  
**Future evolution:** System suggests advance/hold/simplify based on evidence


### 4.5 Post-Quest Compare Bridge

**Concept:** After completing practice card, learner is invited to compare takes.

**Status:** Accepted strong concept  
**Current implementation:** Manual compare toggle (no automatic invitation)  
**Future evolution:** Automatic compare invitation after card completion, guided comparison

**Flow:**
1. Card completes (completion moment)
2. System shows evidence summary (rounds completed, takes recorded)
3. System invites comparison ("Compare your takes?")
4. Learner accepts → enters compare mode (A/B toggle, reference + compare layers)
5. Learner selects best take → marks as selected
6. Learner exits compare → returns to canvas

**Why compare bridge matters:**
- Connects practice to outcome (practice produces takes, takes need selection)
- Encourages reflection (listen critically, choose best)
- Builds judgment (learner develops taste)

### 4.6 Optional Step Prompt Text

**Concept:** Practice cards can show optional instructional text during steps.

**Status:** Accepted strong concept  
**Current implementation:** Fixed instruction text in ExerciseStrip ("Listen carefully", "Your turn — sing it back")  
**Future evolution:** Richer prompt text (tips, encouragement, technique reminders)

**Examples:**
- "Listen carefully to the melody"
- "Focus on breath support"
- "Match the original's phrasing"
- "Don't worry about perfection, just sing"

**Why prompts matter:**
- Guides attention (what to focus on)
- Reduces anxiety (reassuring reminders)
- Teaches technique (embedded coaching)

### 4.7 Route/Progress-Ready Run Model

**Concept:** Practice cards can be organized into routes (sequences) with progress tracking.

**Status:** Accepted strong concept, not MVP  
**Current implementation:** None (single card execution only)  
**Future evolution:** Route authoring, route progress, route completion

**Route example:**
```
Chorus Mastery Route
├─ Step 1: Echo Drill (slow tempo)
├─ Step 2: Echo Drill (normal tempo)
├─ Step 3: 3-Take Challenge
└─ Step 4: No Training Wheels (instrumental only)
```

**Why routes matter:**
- Provides structure (clear progression path)
- Reduces decision fatigue (system suggests next step)
- Builds mastery (progressive difficulty)
- Enables tracking (see progress through route)


---

## 5. Internal vs External Language

**Principle:** Internal architecture language ≠ external product language.

### 5.1 Internal Language (Architecture)

**Used in:** Code, architecture docs, technical discussions

| Internal Term | Meaning |
|---------------|---------|
| Generator Family | Family-specific logic for generating scenario programs |
| Scenario Program | Executable step sequence with runtime contracts |
| Scenario Spec | Declarative specification of practice scenario |
| Quest Run | Runtime instance of quest execution |
| Evidence | Captured mastery signals |

**Why internal language matters:**
- Precise technical communication
- Stable across product evolution
- Enables architecture discussions

### 5.2 External Language (Product)

**Used in:** UI, marketing, user docs, support

| External Term (Candidate) | Meaning |
|---------------------------|---------|
| Pattern | Practice structure (echo, alternation, until-filled) |
| Challenge | Short, focused practice session |
| Journey | Longer, progressive practice sequence |
| Route | Curated sequence of challenges/journeys |

**Why external language matters:**
- Accessible to non-technical users
- Motivating and engaging
- Aligned with user mental models

**Naming status:** These are **candidate terms**, not final freeze. May evolve based on user research.

### 5.3 Translation Examples

| User sees | System executes |
|-----------|-----------------|
| "Echo Drill Challenge" | Echo Family generator → Scenario Program → Quest Run |
| "3-Take Challenge" | Until-Filled Family generator → Scenario Program → Quest Run |
| "Chorus Mastery Journey" | Route with 4 challenges → 4 Scenario Programs → 4 Quest Runs |

**Key principle:** Users never see "generator family" or "scenario program" — they see "challenge" and "journey."


---

## 6. Current Wave Boundaries

**Important:** These are **concept truths**, not all landed UI. Separates what's conceptually accepted from what's implemented.

### 6.1 Concept Truths (Accepted)

**These concepts are accepted as true, even if not fully implemented:**

1. **Practice is a scene** — dedicated space, canvas-first, immersive
2. **Cards have contracts** — promise/method/win must be clear
3. **Completion is a moment** — celebratory, reflective, actionable
4. **Compare is a bridge** — connects practice to outcome
5. **Routes enable progression** — structured paths reduce decision fatigue

### 6.2 Landed UI (Current Implementation)

**These concepts have current UI implementation:**

1. ✅ **Practice scene** — Rehearsal/Takes modes (partial scene semantics)
2. ✅ **Card picker** — RecipeCardPopover (minimal card metadata)
3. ✅ **Card execution** — ExerciseStrip (step display, progress dots)
4. ✅ **Completion message** — "Complete!" in ExerciseStrip
5. ✅ **Compare toggle** — A/B mode in TakesPanel

### 6.3 Not Yet Landed (Future Waves)

**These concepts are accepted but not yet implemented:**

1. ⏳ **Richer card metadata** — promise/method/win text in UI
2. ⏳ **Completion moment UI** — animation, sound, evidence summary
3. ⏳ **Compare invitation** — automatic post-quest compare prompt
4. ⏳ **Advance/hold/simplify** — system-suggested next steps
5. ⏳ **Routes** — curated sequences with progress tracking
6. ⏳ **Prompt text** — instructional text during steps

### 6.4 MVP vs Later Enrichments

**MVP candidates** (next wave):
- Richer card metadata (promise/method/win in UI)
- Completion moment UI (simple animation + evidence summary)
- Compare invitation (simple prompt after completion)

**Later enrichments** (future waves):
- Advance/hold/simplify suggestions (requires evidence + progression model)
- Routes (requires route authoring + progress tracking)
- Contextual prompts (requires prompt authoring + step metadata)


---

## 7. MVP Candidate Enrichments

**Status:** Concept candidates for next wave, not yet implemented.

### 7.1 Completion Moment

**Concept:** Richer completion UI with evidence summary and next steps.

**Current state:** Simple "Complete!" message in ExerciseStrip  
**MVP enrichment:**
- Completion animation (fade in, scale up)
- Evidence summary (rounds completed, takes recorded, time spent)
- Next step buttons (Try Again, Compare Takes, Pick New Challenge)

**Example UI:**
```
┌─────────────────────────────────┐
│  🎉 Challenge Complete!         │
│                                 │
│  3 rounds completed             │
│  3 takes recorded               │
│  2:34 practice time             │
│                                 │
│  [Try Again] [Compare Takes]   │
└─────────────────────────────────┘
```

### 7.2 Hold/Stay Stage

**Concept:** After completion, learner can choose to repeat same challenge or try new one.

**Current state:** Manual card selection (no hold/stay prompt)  
**MVP enrichment:**
- "Try Again" button in completion moment
- Preserves same card parameters (scope, tempo, backing)
- Quick restart (no card picker)

**Why hold/stay matters:**
- Builds consistency (repetition is key to mastery)
- Reduces friction (no need to re-select card)
- Supports flow (quick iteration)

### 7.3 Compare Invitation

**Concept:** After completion, system invites learner to compare takes.

**Current state:** Manual compare toggle (no invitation)  
**MVP enrichment:**
- "Compare Takes" button in completion moment
- Automatic entry to compare mode (A/B toggle enabled)
- Guided comparison (reference vs latest take)

**Flow:**
1. Challenge completes → completion moment appears
2. Learner clicks "Compare Takes"
3. System enters compare mode (A/B toggle on)
4. System shows reference (selected take) + compare (latest take)
5. Learner listens, adjusts, selects best
6. Learner exits compare → returns to canvas


### 7.4 Progress-Lane-Ready Run Model

**Concept:** Practice cards can display progress in a dedicated lane (not just dots).

**Current state:** Progress dots in ExerciseStrip (minimal progress visualization)  
**MVP enrichment:**
- Dedicated progress lane (horizontal bar or vertical strip)
- Shows current round, total rounds, completion percentage
- Visual feedback (color, animation) on progress

**Example UI:**
```
┌─────────────────────────────────┐
│  Echo Drill                     │
│  ●●○ Round 2/3                  │
│  ▓▓▓▓▓▓▓▓▓▓░░░░░░ 67%          │
└─────────────────────────────────┘
```

**Why progress lane matters:**
- Clear progress visualization (learner sees how far they've come)
- Motivates completion (visual progress is motivating)
- Reduces anxiety (know how much is left)

### 7.5 Prompt-Capable Steps

**Concept:** Practice steps can show instructional text to guide learner.

**Current state:** Fixed instruction text in ExerciseStrip  
**MVP enrichment:**
- Optional prompt text per step (defined in scenario spec)
- Prompt appears during step execution (overlay or strip)
- Prompt can include tips, encouragement, technique reminders

**Example prompts:**
- Listen step: "Focus on the melody and phrasing"
- Record step: "Sing with confidence, don't worry about perfection"
- Compare step: "Listen for pitch accuracy and timing"

**Why prompts matter:**
- Guides attention (what to focus on)
- Reduces anxiety (reassuring reminders)
- Teaches technique (embedded coaching)
- Personalizes experience (different prompts for different learners)

**Implementation note:** Prompts are optional — steps work without them, prompts enhance experience.


---

## 8. Later Wave Candidates

**Status:** Concept candidates for future waves, not MVP.

### 8.1 Ghost Layers

**Concept:** Visual overlays that show ideal performance (pitch, timing, phrasing).

**Example:** Pitch ghost layer shows target pitch curve during recording  
**Why later:** Requires pitch detection, pitch visualization, pitch target data  
**User value:** Visual feedback on pitch accuracy in real-time

### 8.2 Contextual Quest Hints

**Concept:** System suggests practice cards based on detected issues.

**Example:** "Detected pitch instability — try Pitch Focus Challenge"  
**Why later:** Requires evidence collection, issue detection, hint generation  
**User value:** Personalized practice suggestions based on performance

### 8.3 Block Mastery Heat Map

**Concept:** Visual representation of mastery level per block.

**Example:** Chorus shows green (mastered), verse shows yellow (in progress), bridge shows red (needs work)  
**Why later:** Requires mastery calculation, block-level evidence aggregation  
**User value:** See at-a-glance which blocks need practice

### 8.4 Session Intent

**Concept:** Learner declares intent before practice session (warm-up, focused practice, full run-through).

**Example:** "What's your goal today? [Warm Up] [Master Chorus] [Full Song]"  
**Why later:** Requires intent-based card filtering, session tracking  
**User value:** Tailored practice experience based on intent

### 8.5 Adaptive Difficulty

**Concept:** System automatically adjusts difficulty based on performance.

**Example:** After 3 successful rounds at 85% tempo, system suggests 100% tempo  
**Why later:** Requires evidence collection, mastery calculation, progression model  
**User value:** Automatic difficulty scaling without manual adjustment

**Note:** All later wave candidates require evidence collection + progression model infrastructure.


---

## 9. Relation to Outcome

**Core principle:** Practice exists to produce better takes. Takes feed downstream workflows.

### 9.1 Quests Exist to Produce Better Takes

**Flow:**
1. Learner enters practice scene
2. Learner selects practice card (challenge/journey)
3. Card executes (listen, record, repeat)
4. Card produces takes (recorded audio in slots)
5. Learner compares takes (A/B comparison)
6. Learner selects best take (marks as selected)

**Key insight:** Practice is not the end goal — better takes are the end goal. Practice is the method.

### 9.2 Better Takes Feed Compare

**Flow:**
1. Practice produces takes (multiple recordings per block)
2. Compare enables selection (A/B comparison, reference vs compare)
3. Selection marks best take (selected slot)
4. Selected take becomes reference for future practice

**Why compare matters:**
- Connects practice to outcome (practice → takes → selection)
- Builds judgment (learner develops taste)
- Enables iteration (compare → practice → compare)

**Current state:** Compare is manual (A/B toggle, no automatic invitation)  
**Future state:** Compare is automatic (post-quest invitation, guided comparison)

### 9.3 Later: Selected Takes May Feed PanoramaMix / Arrangement / Bounce

**Future flow:**
1. Practice produces takes (multiple recordings per block)
2. Compare enables selection (best take per block)
3. Selected takes feed PanoramaMix (multi-take audition with spatial positioning)
4. PanoramaMix feeds arrangement (selected takes → final mix)
5. Arrangement feeds bounce (final mix → exported audio)

**Why this matters:**
- Practice is part of larger workflow (practice → takes → mix → arrangement → export)
- Selected takes have downstream value (not just practice artifacts)
- Quality matters (better takes → better final mix)

**Current state:** Selected takes are practice-only (no downstream workflow)  
**Future state:** Selected takes feed PanoramaMix, arrangement, bounce

**Note:** PanoramaMix, arrangement, bounce are future features — not part of current practice experience.


---

## 10. Experience Principles

### 10.1 Canvas-First, Always

**Principle:** Practice scene prioritizes canvas (waveform, lyrics) over controls.

**Why:** Learner attention should be on singing, not UI.

**Implementation:**
- Canvas occupies 80% of screen
- Controls are secondary (20% of screen)
- Chrome is minimal (navigation, settings only)

### 10.2 Clear Entry, Clear Exit

**Principle:** Practice scene has clear entry/exit transitions.

**Why:** Sets expectations, enables immersion, supports flow.

**Implementation:**
- Entry: Transition from catalog/browse to practice scene
- Exit: Transition from practice scene back to catalog/browse
- No ambiguous states (always clear where you are)

### 10.3 Completion is Celebration

**Principle:** Completing practice card is a positive moment.

**Why:** Positive reinforcement motivates continued practice.

**Implementation:**
- Completion animation (fade in, scale up)
- Celebratory message ("Challenge Complete!")
- Evidence summary (what you achieved)
- Next steps (what's next?)

### 10.4 Compare is Bridge, Not Blocker

**Principle:** Compare is optional invitation, not required step.

**Why:** Some learners want to compare, others want to keep practicing.

**Implementation:**
- Compare invitation appears after completion (optional)
- Learner can skip compare (return to canvas)
- Learner can enter compare anytime (manual toggle)

### 10.5 Progress is Visible

**Principle:** Learner always knows where they are in practice card.

**Why:** Reduces anxiety, motivates completion, builds confidence.

**Implementation:**
- Progress dots (current round / total rounds)
- Progress lane (completion percentage)
- Step indicator (current step / total steps)

### 10.6 Interruption is Safe

**Principle:** Learner can interrupt practice anytime (Escape key).

**Why:** Reduces anxiety, enables experimentation, supports flow.

**Implementation:**
- Escape key interrupts practice (cancels in-progress recording)
- No data loss (completed takes are preserved)
- Clear return to canvas (no ambiguous state)


---

## 11. Naming Candidates (Not Final Freeze)

**Important:** These are **candidate terms**, not final naming freeze. May evolve based on user research.

### 11.1 Card Types

**Candidates:**
- **Challenge** — short, focused, skill-building (current favorite)
- **Drill** — repetitive, mechanical (too negative?)
- **Exercise** — clinical, gym-like (too formal?)
- **Session** — generic, vague (too broad?)

**Current lean:** "Challenge" for short cards, "Journey" for longer sequences

### 11.2 Card Categories

**Candidates:**
- **Pattern** — practice structure (echo, alternation, until-filled)
- **Method** — how you practice (listen-record, record-compare, etc.)
- **Approach** — practice strategy (repetition, variation, exploration)

**Current lean:** "Pattern" for internal architecture, user-facing category TBD

### 11.3 Completion Actions

**Candidates:**
- **Advance** — try harder variation (current favorite)
- **Level Up** — gamification language (too game-y?)
- **Progress** — generic (too vague?)
- **Next** — simple (too generic?)

**Current lean:** "Advance" for harder, "Hold" for repeat, "Simplify" for easier

### 11.4 Route/Sequence

**Candidates:**
- **Route** — path, journey (current favorite)
- **Path** — linear, structured (too rigid?)
- **Journey** — long-form, progressive (conflicts with card type?)
- **Program** — structured, formal (too technical?)

**Current lean:** "Route" for curated sequences, "Journey" for long-form cards

### 11.5 Evidence/Mastery

**Candidates:**
- **Progress** — generic, positive (current favorite)
- **Mastery** — achievement, skill (too formal?)
- **Growth** — development, improvement (too vague?)
- **Performance** — execution, quality (too clinical?)

**Current lean:** "Progress" for user-facing, "Mastery" for internal architecture

**Note:** All naming candidates subject to user research and testing.


---

## 12. Relation to Architecture

### 12.1 Experience Layer ≠ Architecture Layer

**Key separation:**
- **Experience layer** (this doc) — how users perceive and interact with practice
- **Architecture layer** (quest-scenario-system.md) — how system generates and executes practice

**Why separate:**
- Experience can evolve without breaking architecture
- Architecture can evolve without breaking experience
- Product language ≠ technical language

### 12.2 Mapping: Experience → Architecture

| Experience Concept | Architecture Concept |
|--------------------|---------------------|
| Challenge card | QuestCard (generated from ScenarioSpec) |
| Card execution | QuestRun (executes ScenarioProgram) |
| Pattern | Generator Family |
| Completion moment | Quest completion + evidence collection |
| Route | Sequence of QuestCards |

**Key insight:** Users see challenges and journeys, system executes scenario programs and quest runs.

### 12.3 No Contradiction with quest-scenario-system.md

**Compatibility check:**
- ✅ Experience layer uses product language (challenge, journey, route)
- ✅ Architecture layer uses technical language (generator, program, spec)
- ✅ Both layers agree on core concepts (cards, completion, evidence, progression)
- ✅ Experience layer does not dictate architecture implementation
- ✅ Architecture layer does not dictate experience presentation

**Shared principles:**
- Practice is structured (cards have clear promise/method/win)
- Completion is meaningful (evidence is collected)
- Progression is possible (mastery enables advancement)
- Interruption is safe (Escape key works)


---

## 13. Implementation Guidance

### 13.1 What to Implement First (MVP)

**Priority 1: Card contract in UI**
- Show promise/method/win text in card picker
- Clear card metadata (name, icon, description)
- Estimated duration

**Priority 2: Completion moment**
- Simple completion animation
- Evidence summary (rounds, takes, time)
- Next step buttons (Try Again, Compare Takes)

**Priority 3: Compare invitation**
- Automatic compare prompt after completion
- Guided comparison (reference vs latest)
- Quick return to canvas

**Why this order:**
- Card contract reduces confusion (learner knows what to expect)
- Completion moment provides closure (positive reinforcement)
- Compare invitation connects practice to outcome (takes → selection)

### 13.2 What to Defer (Later Waves)

**Defer to later:**
- Advance/hold/simplify suggestions (requires evidence + progression)
- Routes (requires route authoring + progress tracking)
- Contextual prompts (requires prompt authoring + step metadata)
- Ghost layers (requires pitch detection + visualization)
- Adaptive difficulty (requires mastery calculation + progression model)

**Why defer:**
- Requires infrastructure not yet built (evidence, mastery, progression)
- Adds complexity without core value
- Can be added incrementally without breaking existing experience

### 13.3 What NOT to Implement

**Anti-patterns:**
- Graph editor for card authoring (too complex for MVP)
- Overwhelming card catalog (show 2-3 stable cards only)
- Automatic progression without evidence (guessing is bad UX)
- Forced compare (compare should be optional invitation)
- Hidden card structure (promise/method/win must be clear)


---

## 14. Key Takeaways

### For Product Designers

1. **Practice is a scene** — dedicated space, canvas-first, immersive
2. **Cards have contracts** — promise/method/win must be clear
3. **Completion is celebration** — positive reinforcement matters
4. **Compare is bridge** — connects practice to outcome
5. **Progress is visible** — learner always knows where they are
6. **Interruption is safe** — Escape key works, no data loss

### For UX Designers

1. **Canvas-first layout** — waveform and lyrics dominate (80% of screen)
2. **Clear entry/exit** — practice scene has clear transitions
3. **Minimal chrome** — navigation and settings only
4. **Completion moment** — animation, evidence summary, next steps
5. **Compare invitation** — optional prompt after completion
6. **Progress visualization** — dots, lane, percentage

### For Implementers

1. **Experience ≠ Architecture** — product language ≠ technical language
2. **Card contract first** — promise/method/win in UI (MVP priority 1)
3. **Completion moment second** — animation + evidence (MVP priority 2)
4. **Compare invitation third** — automatic prompt (MVP priority 3)
5. **Defer complexity** — routes, adaptive difficulty, ghost layers (later waves)
6. **No contradiction** — experience layer compatible with architecture layer

### For Users (Learners)

1. **Practice is structured** — cards have clear goals and methods
2. **Progress is visible** — always know where you are
3. **Completion is positive** — celebrate achievements
4. **Compare is optional** — invitation, not requirement
5. **Interruption is safe** — Escape key works anytime
6. **Takes are outcome** — practice produces better recordings


---

## 15. Glossary

**Advance** — Try harder variation after completion (faster tempo, less backing, longer scope)

**Canvas** — Primary practice surface (waveform, lyrics, takes)

**Challenge** — Short, focused practice card (candidate term, not final freeze)

**Completion Moment** — Celebratory UI when practice card completes

**Compare Bridge** — Post-quest invitation to compare takes

**Hold** — Repeat same card after completion (build consistency)

**Journey** — Longer, progressive practice card (candidate term, not final freeze)

**Pattern** — Practice structure (echo, alternation, until-filled) — internal term

**Practice Scene** — Dedicated immersive space for practice, canvas-first layout

**Promise** — What learner will achieve by completing card

**Method** — How learner will practice (structure, steps)

**Route** — Curated sequence of challenges/journeys (candidate term, not final freeze)

**Simplify** — Try easier variation after completion (slower tempo, more backing, shorter scope)

**Win Condition** — How learner knows when card is complete

---

## 16. References

**Related Architecture Docs:**
- [Quest & Scenario System](./quest-scenario-system.md) — Internal architecture
- [Takes System](./takes-system.md) — Recording substrate
- [Exercises System](./exercises-system.md) — Current practice implementation

**Related Implementation:**
- `src/exercises/components/ExerciseStrip.tsx` — Current card execution UI
- `src/exercises/components/RecipeCardPopover.tsx` — Current card picker
- `src/components/RehearsalLyrics.tsx` — Practice scene composition
- `src/takes/components/TakesPanel.tsx` — Canvas and compare UI

**Future Docs:**
- Card Contract Design Guide (when MVP implemented)
- Completion Moment Spec (when MVP implemented)
- Route Authoring Guide (when routes implemented)

---

**Document Status:** Product/UX Concept Document  
**Next Review:** After MVP implementation (card contract + completion moment + compare invitation)

