# Quest Entry Surface

**Status:** Concept Freeze  
**Last Updated:** 2024  
**Related Docs:** [quest-scenario-system.md](./quest-scenario-system.md), [practice-experience-layer.md](./practice-experience-layer.md), [takes-system.md](./takes-system.md)

---

## 1. Purpose

### 1.1 Why Quest Entry Needs a Dedicated Surface Doctrine

The quest entry surface is where learners **discover, browse, and launch** practice challenges inside beLive. This is distinct from:

- **Internal generator architecture** (quest-scenario-system.md) — how the system generates scenario programs
- **Practice experience layer** (practice-experience-layer.md) — how learners perceive practice once inside a session

**Why separate doctrine:**
- Entry surface is user-facing, not implementation detail
- Entry surface has distinct UX concerns (discovery, browsing, selection)
- Entry surface must remain compatible with canvas-first practice scene
- Entry surface can evolve independently from generator architecture

### 1.2 Why This Is Different from Internal Generator Architecture

**Internal architecture** (quest-scenario-system.md):
- Defines how generators create scenario programs from specs
- Defines semantic dimensions (scope, tempo, backing, etc.)
- Defines family-specific orchestration logic
- Technical language, implementation-focused

**Entry surface** (this doc):
- Defines how learners discover and select quests
- Defines card anatomy and visibility policy
- Defines grouping and navigation patterns
- User-facing language, experience-focused

**Key principle:** Users never see "generator families" or "scenario specs" — they see quest cards with clear promises, methods, and win conditions.

---

## 2. Entry Surface Doctrine

### 2.1 User Enters a Quest Surface, Not Raw Recipe Internals

**Core principle:** Quest entry is a **dedicated surface** — a distinct UI space where learners browse and select practice challenges.

**Not:** Exposing raw generator internals (family names, semantic dimensions, spec parameters)  
**Yes:** Presenting curated quest cards with clear promise/method/win contracts

**Surface characteristics:**
- Card-based layout (grid or scrollable list)
- Clear card metadata (name, icon, description, difficulty)
- Visibility policy (stable, experimental, special)
- Grouping/navigation (by objective, pattern, difficulty, etc.)
- Strong art/emblem support (icons, colors, visual identity)

### 2.2 Quest Entry Lives Inside the Practice Scene Ecosystem

**Core principle:** Quest entry is **not detached** from the practice scene — it's part of the same musical environment.

**Flow:**
1. Learner enters practice scene (selects song, enters rehearsal/takes mode)
2. Learner sees canvas (waveform, lyrics, takes)
3. Learner clicks block or practice button
4. Quest entry surface appears (overlay or popover)
5. Learner browses and selects quest card
6. Quest executes within scene (no scene exit)
7. Quest completes, learner returns to canvas

**Why inside scene:**
- Maintains musical context (canvas stays visible)
- Reduces friction (no pre-practice decision paralysis)
- Enables quick iteration (try quest, adjust, try again)
- Supports flow (no scene transitions mid-practice)

### 2.3 Current Canvas-First Takes Direction Must Remain Compatible

**Core principle:** Quest entry surface must **not break** the canvas-first takes direction.

**Canvas-first principle:**
- Waveform and lyrics are primary (80% of screen)
- Controls are secondary (20% of screen)
- Chrome is minimal (navigation, settings only)

**Quest entry compatibility:**
- Entry surface appears as overlay or popover (does not replace canvas)
- Entry surface is dismissible (Escape key returns to canvas)
- Entry surface does not consume primary canvas space
- Entry surface can be accessed from within canvas (no scene exit)

**Anti-pattern:** Full-screen quest launcher that replaces canvas, detaches from musical environment

---

## 3. Surface Form Candidates

### 3.1 Current Preferred Direction

**Status:** Concept candidates, not final visual implementation

**Primary candidate: Full-screen quest surface / modal-like scene**
- Appears as modal overlay on top of practice scene
- Occupies most of screen (but canvas may be visible behind)
- Dismissible (Escape key, close button)
- Feels like dedicated space for quest selection
- Supports rich card layout and metadata

**Secondary candidates:**
- Card grid layout (3-4 columns, scrollable)
- Scrollable catalog (vertical list, infinite scroll)
- Popover/sidebar (side panel, does not cover canvas)

### 3.2 Card Grid Layout

**Candidate form:** Grid of quest cards (3-4 columns, scrollable)

**Characteristics:**
- Cards arranged in grid (responsive to screen size)
- Each card shows: name, icon, description, difficulty, duration
- Scrollable vertically (infinite scroll or pagination)
- Hover/tap reveals additional metadata (promise, method, win)
- Click to select and launch

**Advantages:**
- Compact (shows many cards at once)
- Scannable (visual grid is easy to browse)
- Responsive (adapts to screen size)

**Disadvantages:**
- Small card size (limited metadata per card)
- Requires scrolling (may miss cards)
- Dense layout (can feel overwhelming)

### 3.3 Scrollable Catalog

**Candidate form:** Vertical scrollable list of quest cards

**Characteristics:**
- Cards arranged vertically (one per row or stacked)
- Each card shows: name, icon, description, difficulty, duration, promise/method/win
- Scrollable vertically (infinite scroll or pagination)
- Click to select and launch

**Advantages:**
- Large card size (room for full metadata)
- Clear hierarchy (one card per row)
- Easy to read (vertical scrolling is natural)

**Disadvantages:**
- Tall layout (requires more scrolling)
- Less compact (shows fewer cards at once)
- May feel slow (lots of scrolling)

### 3.4 Strong Art/Emblem Support

**Principle:** Quest cards should have strong visual identity through art and emblems.

**Visual elements:**
- Icon/emblem (represents quest type or pattern)
- Color (represents difficulty or category)
- Background art (optional, supports visual identity)
- Badge (stable/experimental/special indicator)

**Why art matters:**
- Visual scanning (learners can browse by visual pattern)
- Emotional engagement (art creates motivation)
- Brand identity (beLive has distinctive visual language)
- Accessibility (icons + text support multiple learning styles)

**Not final visual implementation:** This doc specifies concept, not pixel-perfect design.

---

## 4. Card Anatomy Freeze

### 4.1 Mandatory Card Contract

**Frozen principle:** Every quest card must communicate three things clearly.

**Promise:** What will you achieve by completing this quest?
- Example: "Master this chorus in 3 takes"
- Example: "Build muscle memory through repetition"
- Example: "Learn the melody by echoing the original"

**Method:** How will you practice? What's the structure?
- Example: "Listen to the original, then sing it back (3 rounds)"
- Example: "Record 3 takes, then pick your best"
- Example: "Alternate lines with the original singer"

**Win Condition:** How do you know when you're done?
- Example: "Complete 3 rounds"
- Example: "Fill all 3 take slots"
- Example: "Reach the end without stopping"

**Card contract template:**
```
[Quest Name]
[Icon/Emblem]

Promise: [What you'll achieve]
Method: [How you'll practice]
Win: [How you know you're done]

[Launch Button]
```

### 4.2 Likely Secondary Metadata

**Status:** Likely to be shown, not frozen

**Duration:** Estimated time to complete
- Example: "5-10 minutes"
- Example: "15 minutes"
- Helps learner decide if they have time

**Difficulty:** Relative difficulty level
- Example: "Beginner", "Intermediate", "Advanced"
- Helps learner choose appropriate challenge

**Support Level:** What features are required/available
- Example: "Pitch detection available"
- Example: "Word-sync required"
- Helps learner understand what they'll get

**Outcome Tag:** What type of outcome this quest produces
- Example: "Builds accuracy"
- Example: "Builds consistency"
- Example: "Builds confidence"
- Helps learner understand what they'll improve

**Availability / Capability Reason if Disabled:** Why quest is unavailable
- Example: "Requires word-sync (not available for this song)"
- Example: "Requires backing stems (not available for this song)"
- Helps learner understand why they can't access quest

### 4.3 Card Anatomy Example

```
┌─────────────────────────────────────┐
│  🎧 Echo Drill                      │
│  ⭐⭐⭐ Beginner                      │
│                                     │
│  Promise: Build muscle memory by    │
│  echoing the original               │
│                                     │
│  Method: Listen, then sing it back  │
│  (3 rounds)                         │
│                                     │
│  Win: Complete all 3 rounds         │
│                                     │
│  Duration: 5-10 min                 │
│  Outcome: Builds accuracy           │
│                                     │
│  [Launch Challenge]                 │
└─────────────────────────────────────┘
```

---

## 5. Visibility Policy

### 5.1 Three Visibility Tiers

**Frozen principle:** Quest entry surface must distinguish between stable, experimental, and special quests.

**Stable:** Production-ready, learner-safe, recommended for all learners
- Example: Echo Drill, 3-Take Challenge
- Always visible in default entry surface
- No warnings or disclaimers needed

**Experimental:** In testing, may change, not recommended for all learners
- Example: Tempo Ladder, Exploration Mode
- Visible in entry surface, but marked as experimental
- May have warnings ("This feature is experimental")
- May be hidden by default (opt-in to see)

**Special:** Specialized use cases, separate entry point, not in default catalog
- Example: Alternation patterns (call-response, phrase-echo)
- Not visible in default entry surface
- Accessible via separate lane or advanced menu
- May require special conditions (e.g., duet mode enabled)

### 5.2 Default Learner-Safe Cards

**Principle:** Default entry surface shows minimal stable set (2-3 quests).

**Why minimal:**
- Overwhelming learners with 20+ quests is bad UX
- Most learners want "just practice this block" with minimal choice
- Advanced users can access full catalog via separate UI

**Default stable set candidates:**
1. Echo Drill (listen → record, 3 rounds)
2. 3-Take Challenge (record until filled, 3 slots)
3. (Optional) No Training Wheels (instrumental only, 1 round)

**Rationale:**
- Echo Drill is foundational (most learners start here)
- 3-Take Challenge is proven (learners understand slot-based practice)
- No Training Wheels is optional (advanced learners only)

### 5.3 Hidden/Smoke Cards

**Principle:** Experimental and special quests are hidden by default, accessible via opt-in.

**Hidden cards:**
- Tempo Ladder (experimental, requires tempo change during quest)
- Exploration Mode (experimental, free-form practice)
- Alternation patterns (special, requires duet mode)

**Visibility control:**
- Checkbox: "Show experimental quests"
- Checkbox: "Show special quests"
- Advanced menu: "Browse all quests"

**Why hidden:**
- Reduces cognitive load (default surface is simple)
- Protects learners from unfinished features
- Enables gradual rollout (experimental → stable → default)

### 5.4 Special Lanes (e.g., Alternation)

**Principle:** Special quests (e.g., alternation patterns) have separate entry point.

**Alternation lane example:**
- Separate button: "Practice with a partner"
- Opens dedicated entry surface for alternation quests
- Shows call-response, phrase-echo, verse-chorus patterns
- Requires duet mode or partner selection

**Why separate lane:**
- Alternation is fundamentally different (requires 2 singers)
- Separate entry point makes it discoverable
- Reduces confusion (not mixed with solo quests)
- Enables special UI (partner selection, role assignment)

---

## 6. Grouping / Navigation

### 6.1 Candidate Groupings

**Status:** Candidates, not all frozen

**By Objective:**
- "Master the Chorus"
- "Learn the Verse"
- "Full Song Challenge"
- Pros: Learner-focused, clear goal
- Cons: Requires manual curation

**By Pattern/Family:**
- "Echo Drills"
- "Take Challenges"
- "Alternation Patterns"
- Pros: Organized by practice structure
- Cons: Technical language (may confuse learners)

**By Difficulty:**
- "Beginner"
- "Intermediate"
- "Advanced"
- Pros: Clear progression path
- Cons: Requires difficulty calibration

**By Support Level:**
- "With Vocal Guide"
- "Instrumental Only"
- "A Cappella"
- Pros: Learner-focused, clear support
- Cons: Requires capability gating

**By Block Relevance:**
- "For This Block" (current block)
- "For This Song" (all blocks)
- "For All Songs"
- Pros: Context-aware, reduces scrolling
- Cons: Requires block/song context

### 6.2 Frozen vs Open Groupings

**Frozen:**
- Default entry surface shows "For This Block" (current block only)
- Rationale: Reduces cognitive load, maintains context

**Open:**
- Exact grouping tabs/categories (may vary by context)
- Exact grouping order (may vary by learner preference)
- Exact grouping labels (may vary based on user research)

---

## 7. Progress Presentation

### 7.1 Conceptual Treatment of Challenge Completion

**Principle:** Quest entry surface should show completion state for each quest.

**Completion states:**
- Not started (default)
- In progress (currently active)
- Completed (finished, may show best take or score)
- Mastered (completed multiple times, high score)

**Visual indicators:**
- Badge: "Completed" or checkmark
- Badge: "In Progress" or progress bar
- Badge: "Mastered" or star
- Color: Gray (not started), Blue (in progress), Green (completed), Gold (mastered)

### 7.2 Best Take Presentation

**Principle:** Quest entry surface may show best take or score for completed quests.

**Candidates:**
- Show best take score (e.g., "Best: 92%")
- Show completion count (e.g., "Completed 3 times")
- Show last completed date (e.g., "Last: 2 days ago")
- Show mastery badge (e.g., "Mastered")

**Status:** Candidates, not frozen. Requires evidence collection infrastructure.

### 7.3 Stage Progression

**Principle:** Multi-stage quests (e.g., Tempo Ladder) should show progression.

**Example: Tempo Ladder**
- Stage 1: 70% tempo (not started)
- Stage 2: 85% tempo (not started)
- Stage 3: 100% tempo (not started)

**Visual representation:**
- Progress bar (stages completed / total stages)
- Stage badges (completed stages highlighted)
- Stage labels (current stage, next stage)

**Status:** Candidates, not frozen. Requires multi-stage quest support.

### 7.4 Route/Progress-Ready Card Language

**Principle:** Quest entry surface should support route/sequence language.

**Route example:**
```
Chorus Mastery Route
├─ Step 1: Echo Drill (slow tempo) ✓ Completed
├─ Step 2: Echo Drill (normal tempo) ⏳ In Progress
├─ Step 3: 3-Take Challenge ○ Not Started
└─ Step 4: No Training Wheels ○ Not Started
```

**Visual representation:**
- Route card (shows all steps)
- Step badges (completed, in progress, not started)
- Progress bar (steps completed / total steps)
- Next step highlight (what to do next)

**Status:** Candidates, not frozen. Requires route support infrastructure.

### 7.5 Completion Bridge into Compare

**Principle:** Quest entry surface should facilitate transition from quest completion to compare.

**Flow:**
1. Quest completes (completion moment appears)
2. Learner sees evidence summary (rounds, takes, time)
3. Learner clicks "Compare Takes" (optional)
4. Compare mode activates (A/B toggle, reference vs latest)
5. Learner selects best take
6. Learner returns to quest entry surface (or canvas)

**Status:** Concept, not frozen. Requires completion moment UI + compare invitation.

---

## 8. Relation to Practice Scene

### 8.1 Quest Entry Is Not Detached from Song World

**Core principle:** Quest entry surface is **part of** the practice scene, not separate from it.

**Not:** Detached "mini-game menu" feeling (separate from song context)  
**Yes:** Integrated quest picker (inside practice scene, maintains song context)

**Why integration matters:**
- Maintains musical context (learner stays focused on song)
- Reduces friction (no context switching)
- Supports flow (seamless practice iteration)
- Enables quick adjustment (try quest, adjust, try again)

### 8.2 Challenge Surface Still Belongs to Same Musical Environment

**Principle:** Quest entry surface should feel like part of the same musical environment.

**Visual continuity:**
- Same color scheme (matches practice scene)
- Same typography (matches practice scene)
- Same art style (matches practice scene)
- Same interaction patterns (matches practice scene)

**Audio continuity:**
- Background music may continue (optional)
- Learner can hear canvas audio (if entry surface is popover)
- No jarring audio transitions

**Why continuity matters:**
- Reduces cognitive load (familiar environment)
- Maintains immersion (no jarring transitions)
- Supports flow (seamless experience)

### 8.3 Visual Engine May Later Decorate It, But Logic Does Not Depend on Visual Engine

**Principle:** Quest entry surface logic is **independent** of visual engine.

**Current state:** Quest entry is simple card picker (no visual engine dependency)

**Future state:** Visual engine may decorate entry surface (animations, effects, spatial positioning)

**Key constraint:** Entry surface logic must work without visual engine (graceful degradation)

**Why independence matters:**
- Enables parallel development (entry surface and visual engine can evolve independently)
- Supports multiple platforms (web, mobile, desktop)
- Reduces coupling (entry surface is not blocked by visual engine)

---

## 9. Frozen Decisions

These decisions are **accepted and frozen** — implementation must follow these constraints.

### 9.1 Challenge/Quest Entry Is a Separate User-Facing Surface

**Decision:** Quest entry is a dedicated UI surface, not embedded in other screens.

**Rationale:**
- Dedicated surface enables focused browsing
- Separate surface supports discovery and selection
- Dedicated surface can evolve independently

**Implication:** Quest entry has its own component/screen, not scattered across multiple screens.

### 9.2 Card Contract Is Mandatory

**Decision:** Every quest card must show promise/method/win contract.

**Rationale:**
- Clear contracts reduce confusion
- Learners know what to expect
- Learners can make informed choices

**Implication:** No quest card is shown without promise/method/win text.

### 9.3 Stable/Experimental/Special Visibility Split

**Decision:** Quest entry surface distinguishes between stable, experimental, and special quests.

**Rationale:**
- Protects learners from unfinished features
- Enables gradual rollout
- Reduces cognitive load (default surface is simple)

**Implication:** Experimental and special quests are hidden by default, accessible via opt-in.

### 9.4 Special Alternation Lane Separate from Default Cards

**Decision:** Alternation patterns (call-response, phrase-echo) have separate entry point.

**Rationale:**
- Alternation is fundamentally different (requires 2 singers)
- Separate entry point makes it discoverable
- Reduces confusion (not mixed with solo quests)

**Implication:** Alternation quests are not shown in default entry surface, accessible via "Practice with a partner" button.

### 9.5 Entry Surface Must Remain Compatible with Minimal Learner-Safe Default

**Decision:** Default entry surface shows minimal stable set (2-3 quests).

**Rationale:**
- Overwhelming learners with 20+ quests is bad UX
- Most learners want "just practice this block" with minimal choice
- Advanced users can access full catalog via separate UI

**Implication:** Default entry surface is simple and focused, full catalog is opt-in.

---

## 10. Open Decisions

These decisions are **not yet frozen** — require further design, research, or implementation experience.

### 10.1 Exact Naming (Quest / Challenge / Journey)

**Question:** What are the canonical user-facing names for practice sessions?

**Current candidates:**
- "Challenge" — short, focused, skill-building (current favorite)
- "Journey" — longer, progressive, mastery-building
- "Quest" — adventure, exploration, engagement
- "Drill" — repetitive, mechanical (less favorable)

**Uncertainty:** Names may change based on user research, learner feedback  
**Resolution criteria:** Names must be clear, motivating, teachable

### 10.2 Exact Full-Screen vs Modal Final Choice

**Question:** Should quest entry surface be full-screen or modal overlay?

**Current candidates:**
- Full-screen modal (occupies most of screen, canvas may be visible behind)
- Popover/sidebar (side panel, canvas remains visible)
- Inline picker (embedded in practice scene, no overlay)

**Uncertainty:** Requires UX testing, learner feedback  
**Resolution criteria:** Entry surface must not break canvas-first principle, must feel integrated

### 10.3 Exact Category Tabs/Grouping

**Question:** What are the exact grouping tabs/categories in quest entry surface?

**Current candidates:**
- By objective ("Master the Chorus", "Learn the Verse")
- By pattern ("Echo Drills", "Take Challenges")
- By difficulty ("Beginner", "Intermediate", "Advanced")
- By support level ("With Vocal Guide", "Instrumental Only")
- By block relevance ("For This Block", "For This Song")

**Uncertainty:** Requires user research, learner feedback  
**Resolution criteria:** Groupings must be clear, discoverable, reduce cognitive load

### 10.4 Exact Stats Shown Per Card

**Question:** What metadata should be shown on each quest card?

**Current candidates:**
- Duration (estimated time to complete)
- Difficulty (beginner/intermediate/advanced)
- Support level (what features are available)
- Outcome tag (what you'll improve)
- Completion state (not started/in progress/completed/mastered)
- Best score (if completed)
- Last completed date (if completed)

**Uncertainty:** Requires UX testing, learner feedback  
**Resolution criteria:** Stats must be useful, not overwhelming, support decision-making

### 10.5 Exact Completion-to-Next-Action Flow

**Question:** What happens after quest completion?

**Current candidates:**
- Show completion moment (animation, evidence summary)
- Invite compare (optional "Compare Takes" button)
- Suggest next quest (advance/hold/simplify)
- Return to entry surface (browse other quests)
- Return to canvas (continue practicing)

**Uncertainty:** Requires user research, learner feedback  
**Resolution criteria:** Flow must provide closure, enable reflection, suggest next steps

---

## 11. What Not To Do

These are **anti-patterns** — explicitly rejected approaches that violate entry surface principles.

### 11.1 No Giant Matrix-First Launcher

**Anti-pattern:** Showing all quests in a giant matrix (20+ cards, overwhelming layout).

**Why wrong:**
- Cognitive overload (too many choices)
- Decision paralysis (learner doesn't know where to start)
- Poor UX (requires lots of scrolling)
- Violates learner-safe principle (not minimal)

**Correct approach:** Show minimal stable set (2-3 quests) by default, full catalog via opt-in.

### 11.2 No Exposing Raw Generator Internals

**Anti-pattern:** Showing generator family names, semantic dimensions, or spec parameters in UI.

**Why wrong:**
- Confusing for learners (technical language)
- Violates user-facing principle (not product language)
- Breaks abstraction (exposes implementation detail)
- Poor UX (learners don't think in "generator families")

**Correct approach:** Show user-facing language (challenge, journey, pattern) with clear promise/method/win.

### 11.3 No Default Surface Broadening Just Because Code Exists

**Anti-pattern:** Adding every new quest to default entry surface just because it's implemented.

**Why wrong:**
- Violates learner-safe principle (not minimal)
- Causes cognitive overload (too many choices)
- Breaks discovery (important quests get lost)
- Poor UX (no curation)

**Correct approach:** Curate default surface (2-3 stable quests), add new quests to full catalog, promote to default only after validation.

### 11.4 No Detached "Mini-Game Menu" Feeling

**Anti-pattern:** Quest entry surface feels separate from practice scene (different colors, different layout, different interaction patterns).

**Why wrong:**
- Breaks immersion (jarring transition)
- Violates integration principle (not part of musical environment)
- Poor UX (context switching)
- Reduces flow (no seamless practice iteration)

**Correct approach:** Quest entry surface feels integrated (same colors, same layout, same interaction patterns as practice scene).

### 11.5 No Hidden Card Contracts

**Anti-pattern:** Quest cards don't show promise/method/win until after selection.

**Why wrong:**
- Violates card contract principle (must be clear)
- Causes confusion (learner doesn't know what to expect)
- Reduces informed choice (learner can't decide)
- Poor UX (learner discovers structure mid-practice)

**Correct approach:** Every quest card shows promise/method/win upfront, before selection.

---

## 12. Relation to Other Systems

### 12.1 No Contradiction with quest-scenario-system.md

**Compatibility check:**
- ✅ Entry surface uses product language (challenge, journey, pattern)
- ✅ quest-scenario-system.md uses technical language (generator, program, spec)
- ✅ Both systems agree on core concepts (cards, completion, evidence, progression)
- ✅ Entry surface does not dictate architecture implementation
- ✅ Architecture does not dictate entry surface presentation

**Shared principles:**
- Practice is structured (cards have clear promise/method/win)
- Completion is meaningful (evidence is collected)
- Progression is possible (mastery enables advancement)
- Interruption is safe (Escape key works)

### 12.2 No Contradiction with practice-experience-layer.md

**Compatibility check:**
- ✅ Entry surface is part of practice scene (not detached)
- ✅ Entry surface maintains canvas-first principle (does not replace canvas)
- ✅ Entry surface shows card contracts (promise/method/win)
- ✅ Entry surface enables completion moment (evidence summary, next steps)
- ✅ Entry surface facilitates compare bridge (optional compare invitation)

**Shared principles:**
- Practice is a scene (dedicated space, immersive)
- Cards have contracts (promise/method/win must be clear)
- Completion is celebration (positive reinforcement)
- Compare is bridge (connects practice to outcome)
- Progress is visible (learner always knows where they are)

### 12.3 Relation to Takes System

**Takes system provides:**
- Block-scoped recording sessions
- Take slot management (0-5 slots per block)
- Audio capture + trim + decode pipeline
- Take preview/compare infrastructure

**Quest entry surface uses:**
- Takes system to execute quests (quests produce takes)
- Takes system to show completion state (takes recorded)
- Takes system to facilitate compare (A/B comparison)

**Quest entry surface does NOT:**
- Manage take storage (that's Takes)
- Render waveforms (that's Takes)
- Handle audio engine (that's Takes)

---

## 13. Key Takeaways

### For Product Designers

1. **Quest entry is a dedicated surface** — not embedded in other screens
2. **Card contracts are mandatory** — promise/method/win must be clear
3. **Visibility policy protects learners** — stable/experimental/special split
4. **Default surface is minimal** — 2-3 stable quests, full catalog via opt-in
5. **Entry surface is integrated** — part of practice scene, not detached
6. **Special quests have separate lanes** — alternation patterns separate from solo quests

### For UX Designers

1. **Canvas-first compatibility** — entry surface must not break canvas-first principle
2. **Card anatomy is frozen** — promise/method/win + secondary metadata
3. **Visual continuity matters** — same colors, typography, art style as practice scene
4. **Grouping reduces cognitive load** — organize by objective, pattern, difficulty, or support
5. **Progress is visible** — show completion state, best score, stage progression
6. **Completion bridges to compare** — optional compare invitation after quest completion

### For Implementers

1. **Entry surface ≠ Architecture** — product language ≠ technical language
2. **Card contract first** — promise/method/win in UI (mandatory)
3. **Visibility policy second** — stable/experimental/special split (frozen)
4. **Grouping/navigation third** — organize by objective, pattern, difficulty, or support
5. **Progress presentation fourth** — show completion state, best score, stage progression
6. **No raw internals** — never expose generator families, semantic dimensions, or specs

### For Users (Learners)

1. **Quest entry is simple** — minimal stable set (2-3 quests) by default
2. **Cards have clear goals** — promise/method/win are always shown
3. **Quests are discoverable** — organized by objective, pattern, difficulty, or support
4. **Progress is visible** — see what you've completed, what's next
5. **Quests are integrated** — part of practice scene, not separate menu
6. **Special quests are accessible** — alternation patterns available via separate lane

---

## 14. Implementation Roadmap

### Phase 1: MVP (Minimal Viable Entry Surface)

**Priority 1: Card contract in UI**
- Show promise/method/win text on each card
- Show name, icon, description
- Show difficulty, duration

**Priority 2: Visibility policy**
- Show stable quests by default (2-3 cards)
- Hide experimental quests (opt-in via checkbox)
- Hide special quests (separate lane for alternation)

**Priority 3: Basic grouping**
- Group by "For This Block" (current block only)
- Optional: Group by difficulty (beginner/intermediate/advanced)

### Phase 2: Enhanced Entry Surface

**Priority 1: Progress presentation**
- Show completion state (not started/in progress/completed/mastered)
- Show best score (if completed)
- Show last completed date (if completed)

**Priority 2: Richer grouping**
- Add "For This Song" (all blocks)
- Add "By Pattern" (echo, take challenge, etc.)
- Add "By Support Level" (with guide, instrumental, a cappella)

**Priority 3: Completion bridge**
- Show completion moment (animation, evidence summary)
- Invite compare (optional "Compare Takes" button)
- Suggest next quest (advance/hold/simplify)

### Phase 3: Advanced Entry Surface

**Priority 1: Routes/sequences**
- Show route cards (multi-step quests)
- Show stage progression (current stage, next stage)
- Show route completion state

**Priority 2: Adaptive suggestions**
- Suggest next quest based on performance
- Suggest advance/hold/simplify based on evidence
- Personalized entry surface based on learner profile

**Priority 3: Full catalog**
- Browse all quests (not just stable set)
- Advanced filtering (by pattern, difficulty, support level, outcome)
- Search quests by name or description
