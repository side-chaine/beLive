# Quest Authoring Flow

**Status:** Concept Freeze  
**Last Updated:** 2024  
**Related Docs:** [quest-scenario-system.md](./quest-scenario-system.md), [practice-experience-layer.md](./practice-experience-layer.md), [quest-entry-surface.md](./quest-entry-surface.md)

---

## 1. Purpose

### 1.1 Why Quest Authoring Needs Its Own Doctrine

Quest authoring is where teachers and advanced users **create custom practice paths** for learners. This is distinct from:

- **Internal generator architecture** (quest-scenario-system.md) — how the system generates scenario programs
- **Quest entry surface** (quest-entry-surface.md) — how learners discover and launch quests
- **Practice experience layer** (practice-experience-layer.md) — how learners perceive practice

**Why separate doctrine:**
- Authoring is creator-facing, not learner-facing
- Authoring has distinct UX concerns (composition, preview, sharing)
- Authoring must hide low-level complexity (generators, specs, programs)
- Authoring can evolve independently from entry surface and practice experience

### 1.2 Why Guided Composition Is Preferred Over Graph Editing

**Graph editing** (rejected for first generation):
- Requires understanding of nodes, edges, connections
- Exposes low-level orchestration logic
- High cognitive load for non-technical teachers
- Steep learning curve, low adoption
- Premature complexity before patterns are proven

**Guided composition** (preferred for first generation):
- Step-by-step form-based interface
- High-level semantic dimensions (objective, pattern, support, progression)
- Low cognitive load, accessible to non-technical teachers
- Gradual complexity (simple → advanced)
- Proven patterns before custom variations

**Key principle:** Teachers compose practice paths, not orchestration graphs.

---

## 2. Authoring Principle Freeze

These principles are **accepted and frozen** — authoring must follow these constraints.

### 2.1 User/Teacher Should Build a Practice Path

**Frozen principle:** Authoring is about building **practice paths** — sequences of practice activities with clear progression.

**Not:** Editing raw step graphs, writing raw JSON, managing low-level engine details  
**Yes:** Composing high-level practice paths with semantic dimensions

**Path characteristics:**
- Clear objective (what learner will achieve)
- Clear progression (easy → hard, or structured stages)
- Clear support (backing, guidance, review)
- Clear completion (rounds, slots, mastery threshold)

**Implication:** Authoring interface shows practice paths, not step sequences or generator families.

### 2.2 Not Edit Raw Step Graphs

**Frozen principle:** Teachers never see or edit raw step graphs.

**Why:**
- Step graphs are implementation detail
- Teachers don't think in "steps" (listen, record, compare, wait)
- Step graphs are generated, not authored
- Exposing steps couples authoring to implementation

**Implication:** Authoring interface hides step generation. Teachers see high-level path, system generates steps.

### 2.3 Not Write Raw JSON

**Frozen principle:** Teachers never write or edit raw JSON specs.

**Why:**
- JSON is technical, not accessible
- JSON is error-prone (syntax, validation)
- JSON is not human-readable for non-technical users
- JSON is implementation detail

**Implication:** Authoring interface is form-based, not text-based. System serializes to JSON internally.

### 2.4 Not Manage Low-Level Engine Details

**Frozen principle:** Teachers never manage low-level engine details (transport, recording modes, interruption policies).

**Why:**
- Engine details are implementation concern
- Teachers don't understand transport semantics
- Engine details are orthogonal to practice design
- Exposing engine details adds unnecessary complexity

**Implication:** Authoring interface hides engine details. Teachers see high-level controls (rounds, tempo, backing).

---

## 3. Core Authoring Flow

### 3.1 Intended Future Flow

**Status:** Concept candidates, not final implementation

**Step 1: Choose Target/Objective**
- What will learner achieve?
- Examples: "Master the chorus", "Build speed", "Fix pitch accuracy"
- User selects from predefined objectives or creates custom

**Step 2: Choose Block/Scope**
- What portion of song to practice?
- Examples: "This block", "This song", "Custom range"
- User selects block or defines custom time range

**Step 3: Choose Pattern/Family**
- What practice structure?
- Examples: "Echo drill", "Fill & compare", "Tempo ladder"
- User selects from available patterns (filtered by capability)

**Step 4: Choose Support/Progression**
- How should difficulty progress?
- Examples: "3 rounds at normal speed", "Slow → medium → fast", "Full support → instrumental only"
- User adjusts backing, tempo, rounds, review mode

**Step 5: Preview Route**
- See human-readable generated route
- Examples: "Listen → Record → Review ×3", "Slow → Medium → Full Speed"
- User can adjust parameters if preview doesn't match intent

**Step 6: Save/Share**
- Save as quest card (personal library)
- Share with others (exchange card/spec definitions)
- User provides name, description, icon

### 3.2 Flow Diagram

```
┌─────────────────────────────────────┐
│ 1. Choose Objective                 │
│ (Master chorus / Build speed / etc) │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│ 2. Choose Block/Scope               │
│ (This block / This song / Custom)   │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│ 3. Choose Pattern/Family            │
│ (Echo / Fill & Compare / Tempo)     │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│ 4. Choose Support/Progression       │
│ (Backing / Tempo / Rounds / Review) │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│ 5. Preview Route                    │
│ (Human-readable generated path)     │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│ 6. Save/Share                       │
│ (Name / Description / Icon)         │
└─────────────────────────────────────┘
```

---

## 4. Objective Layer Examples

### 4.1 Candidate Objectives

**Status:** Candidates, not frozen

**Imitate / Echo**
- Objective: "Learn the melody by echoing the original"
- Pattern: Echo drill (listen → record)
- Support: Full backing, vocal guide
- Progression: 3 rounds at normal speed
- Example: "Echo Drill - Chorus"

**Fill Takes and Choose Best**
- Objective: "Record multiple takes and pick your best"
- Pattern: Fill & compare (record until filled, then compare)
- Support: Full backing, optional review
- Progression: Fill 3 slots, then compare
- Example: "3-Take Challenge - Verse"

**Build Speed**
- Objective: "Master this section at full speed"
- Pattern: Tempo ladder (progressive tempo increase)
- Support: Start with backing, reduce as speed increases
- Progression: 70% → 85% → 100% tempo
- Example: "Speed Builder - Bridge"

**Reduce Support**
- Objective: "Practice without vocal guide"
- Pattern: Backing ladder (progressive backing reduction)
- Support: Full → instrumental → a cappella
- Progression: 1 round each stage
- Example: "No Training Wheels - Chorus"

**Fix a Hard Spot**
- Objective: "Master a difficult section"
- Pattern: Isolation + repetition (focus on problem area)
- Support: Slow tempo, full backing, optional pitch guide
- Progression: 5 rounds at 70% speed
- Example: "Fix the Bridge - Difficult Section"

**Alternation Later**
- Objective: "Practice with a partner"
- Pattern: Call-response or phrase-echo (special family)
- Support: Duet mode, role assignment
- Progression: Alternate lines or phrases
- Example: "Duet Practice - Verse" (future)

### 4.2 Objective Selection

**User experience:**
- Dropdown or card picker showing objectives
- Each objective has description and icon
- User selects objective or creates custom
- System suggests patterns based on objective

---

## 5. Pattern / Family Layer

### 5.1 How User Selects High-Level Pattern

**Frozen principle:** Users select from high-level **patterns**, not low-level **generator families**.

**Why:**
- "Pattern" is user-friendly language
- "Generator family" is technical implementation detail
- Patterns are discoverable, families are not
- Patterns can be renamed/reorganized without breaking authoring

**Pattern candidates:**
- **Echo** — listen → record pattern (foundational)
- **Fill & Compare** — record until filled, then compare (proven)
- **Tempo Ladder** — progressive tempo increase (experimental)
- **Backing Ladder** — progressive backing reduction (experimental)
- **Repair / Isolation** — focus on problem area (future)
- **Alternation** — call-response, phrase-echo (special, future)

### 5.2 Pattern Selection UI

**User experience:**
- Pattern picker showing available patterns
- Each pattern has name, description, icon
- Patterns filtered by capability (word-sync, backing stems, etc.)
- User selects pattern
- System shows pattern-specific parameters

**Example:**
```
┌─────────────────────────────────────┐
│ Choose Practice Pattern             │
│                                     │
│ ☑ Echo Drill                        │
│   Listen, then sing it back         │
│   ⭐⭐⭐ Beginner                     │
│                                     │
│ ☐ Fill & Compare                    │
│   Record multiple takes, pick best  │
│   ⭐⭐⭐ Beginner                     │
│                                     │
│ ☐ Tempo Ladder                      │
│   Progressive tempo increase        │
│   ⭐⭐ Intermediate (experimental)   │
│                                     │
│ ☐ Backing Ladder                    │
│   Progressive backing reduction     │
│   ⭐⭐ Intermediate (experimental)   │
│                                     │
│ [Next]                              │
└─────────────────────────────────────┘
```

### 5.3 Pattern Language Note

**Status:** "Pattern" is candidate external language, not final freeze

**Candidates:**
- "Pattern" — practice structure (current favorite)
- "Method" — how you practice
- "Approach" — practice strategy
- "Type" — practice type

**Rationale:** "Pattern" is clear, discoverable, and distinct from "generator family" (internal language).

---

## 6. Support / Progression Layer

### 6.1 How Author Adjusts Support and Progression

**Frozen principle:** Authors adjust practice difficulty through high-level **support** and **progression** controls.

**Support controls:**
- **Backing mode** — full, instrumental, vocals-only, none
- **Review mode** — compare, self-assess, none
- **Guidance level** — full guide, pitch guide, no guide

**Progression controls:**
- **Rounds** — how many repetitions (1-10)
- **Tempo stages** — progressive tempo increase (70% → 85% → 100%)
- **Backing stages** — progressive backing reduction (full → instrumental → a cappella)
- **Progress gate** — completion criteria (rounds, slots, mastery threshold)

### 6.2 Support/Progression UI

**User experience:**
- Sliders and dropdowns for each control
- Real-time preview of generated route
- Sensible defaults based on pattern
- Advanced options for power users

**Example:**
```
┌─────────────────────────────────────┐
│ Configure Support & Progression     │
│                                     │
│ Backing Mode:                       │
│ [Full] [Instrumental] [Guide] [None]│
│                                     │
│ Rounds: [3] (1-10)                  │
│                                     │
│ Tempo Progression:                  │
│ ☐ Progressive (70% → 85% → 100%)   │
│ ☑ Fixed (85%)                       │
│                                     │
│ Review Mode:                        │
│ [Compare] [Self-Assess] [None]      │
│                                     │
│ [Preview Route]                     │
└─────────────────────────────────────┘
```

---

## 7. Route Preview

### 7.1 Need for Human-Readable Generated Route Preview

**Frozen principle:** Route preview is **mandatory** — authors must see human-readable generated route before saving.

**Why:**
- Authors can verify intent (does preview match what I wanted?)
- Authors can adjust parameters if preview doesn't match
- Authors gain confidence (clear understanding of what will execute)
- Reduces errors (catch mistakes before saving)

### 7.2 Route Preview Examples

**Echo Drill (3 rounds, normal speed, full backing):**
```
Listen → Record → Review ×3
```

**Tempo Ladder (3 stages, full backing):**
```
Stage 1: Listen → Record ×2 (70% speed)
Stage 2: Listen → Record ×2 (85% speed)
Stage 3: Listen → Record ×2 (100% speed)
```

**Backing Ladder (3 stages, normal speed):**
```
Stage 1: Listen → Record ×2 (Full backing)
Stage 2: Listen → Record ×2 (Instrumental only)
Stage 3: Listen → Record ×2 (A cappella)
```

**Fill & Compare (3 slots, normal speed, full backing):**
```
Record until 3 slots filled → Compare best take
```

### 7.3 Preview Interaction

**User experience:**
- Preview appears after step 4 (support/progression)
- Preview is human-readable (not JSON, not step graph)
- Preview updates in real-time as user adjusts parameters
- User can click "Adjust" to go back and modify
- User can click "Looks Good" to proceed to save

---

## 8. Save / Share Doctrine

### 8.1 Frozen Principles

**Frozen principle:** Sharing exchanges **card/spec definitions**, not runtime state.

**Not:** Sharing runtime runs, temporary store state, raw implementation snapshots  
**Yes:** Sharing quest card + scenario spec (portable, versionable, portable)

**Why:**
- Card/spec is declarative, portable, versionable
- Runtime state is ephemeral, not portable
- Implementation snapshots are coupled to version
- Card/spec enables future improvements without breaking shares

### 8.2 Save Flow

**User experience:**
1. Author completes authoring flow
2. System generates quest card + scenario spec
3. Author provides metadata (name, description, icon, difficulty)
4. System saves to personal library
5. Author can edit, delete, or share

**Metadata:**
- Name (required)
- Description (required)
- Icon/emblem (optional)
- Difficulty (beginner/intermediate/advanced)
- Category (drill/challenge/journey)
- Tags (optional)

### 8.3 Share Flow (Future)

**Status:** Concept, not implemented

**User experience:**
1. Author selects quest to share
2. System generates shareable link or export file
3. Author shares link/file with others
4. Recipient imports quest card
5. Recipient can use, modify, or re-share

**Share unit:** Quest card + scenario spec (JSON serializable)

**Not shared:** Runtime state, temporary data, implementation details

---

## 9. Teacher vs Learner Scope

### 9.1 Teacher Authoring (First Generation)

**Status:** Concept, not implemented

**Teacher capabilities:**
- Create custom practice paths
- Adjust all support/progression controls
- Save to personal library
- Share with other teachers
- Moderate/curate library (future)

**Teacher access:**
- Full pattern selection
- Full support/progression controls
- Advanced options (power users)
- Library management

### 9.2 Learner Authoring (Later)

**Status:** Future, not first generation

**Learner capabilities:**
- Create simple custom paths (limited patterns)
- Adjust basic controls (rounds, tempo, backing)
- Save to personal library
- Share with friends (limited)

**Learner access:**
- Subset of patterns (stable only)
- Basic controls (rounds, backing)
- No advanced options
- Limited library management

### 9.3 Graph Editor (Out of Scope)

**Frozen principle:** Graph editor is **out of scope** for first authoring generation.

**Why:**
- Guided composition must prove value first
- Graph editor adds complexity without proven need
- Graph editor can be added later if demand exists
- Guided composition serves 80% of use cases

**Future:** Graph editor may be added for advanced users after guided composition is proven.

---

## 10. Frozen Decisions

These decisions are **accepted and frozen** — implementation must follow these constraints.

### 10.1 Guided Composition First

**Decision:** First authoring generation uses guided composition (forms, dropdowns, sliders).

**Rationale:**
- Accessible to non-technical teachers
- Low cognitive load
- Proven patterns before custom variations
- Gradual complexity

**Implication:** Authoring interface is form-based, not graph-based.

### 10.2 Graph Editor Later or Never

**Decision:** Graph editor is out of scope for first generation.

**Rationale:**
- Guided composition must prove value first
- Graph editor adds complexity without proven need
- Can be added later if demand exists

**Implication:** First authoring generation does not include graph editor.

### 10.3 Generator Family Hidden Under User-Friendly Pattern Language

**Decision:** Generator families are hidden from authoring interface.

**Rationale:**
- "Pattern" is user-friendly, "generator family" is technical
- Patterns are discoverable, families are not
- Patterns can be renamed without breaking authoring

**Implication:** Authoring interface shows patterns, not families. System maps patterns to families internally.

### 10.4 Route Preview Mandatory

**Decision:** Route preview is mandatory before saving.

**Rationale:**
- Authors verify intent
- Authors adjust if preview doesn't match
- Reduces errors
- Builds confidence

**Implication:** Authoring flow includes preview step. Authors cannot save without previewing.

### 10.5 Share Unit Later = Card/Spec Bundle

**Decision:** Sharing exchanges quest card + scenario spec, not runtime state.

**Rationale:**
- Card/spec is portable, versionable
- Runtime state is ephemeral, not portable
- Card/spec enables future improvements

**Implication:** Sharing infrastructure serializes cards/specs, not runs/programs.

### 10.6 Authoring Lives on Top of Takes/Scenario Architecture

**Decision:** Authoring is built on top of Takes and Scenario systems, not outside them.

**Rationale:**
- Authoring generates scenario specs
- Scenario system generates scenario programs
- Takes system executes programs
- Clear separation of concerns

**Implication:** Authoring does not bypass or replace Takes/Scenario architecture.

---

## 11. Open Decisions

These decisions are **not yet frozen** — require further design, research, or implementation experience.

### 11.1 Exact Teacher vs User Permissions

**Question:** What permissions do teachers vs learners have?

**Current candidates:**
- Teachers: Full pattern selection, all controls, library management
- Learners: Subset of patterns, basic controls, limited library

**Uncertainty:** Requires user research, permission model design  
**Resolution criteria:** Permissions must be clear, enforceable, discoverable

### 11.2 Exact Authoring UI Surface

**Question:** What is the exact UI surface for authoring?

**Current candidates:**
- Modal dialog (step-by-step wizard)
- Sidebar panel (persistent, multi-step)
- Full-screen composer (dedicated space)
- Inline editor (embedded in practice scene)

**Uncertainty:** Requires UX testing, learner feedback  
**Resolution criteria:** Surface must be accessible, discoverable, not overwhelming

### 11.3 Exact Save/Share Flow

**Question:** What is the exact save/share flow?

**Current candidates:**
- Save to personal library (local storage)
- Save to cloud (server-side storage)
- Share via link (URL-based sharing)
- Share via export (JSON file)
- Share via library (curated catalog)

**Uncertainty:** Requires infrastructure design, user research  
**Resolution criteria:** Flow must be simple, secure, discoverable

### 11.4 Exact Parameter Depth Shown in First Version

**Question:** How many parameters should first version expose?

**Current candidates:**
- Minimal (rounds, backing, tempo only)
- Standard (rounds, backing, tempo, review, progression)
- Advanced (all parameters + expert options)

**Uncertainty:** Requires UX testing, user feedback  
**Resolution criteria:** Parameters must be useful, not overwhelming

### 11.5 Exact Moderation/Library Policy Later

**Question:** How should shared quests be moderated?

**Current candidates:**
- No moderation (all quests visible)
- Community moderation (users flag inappropriate)
- Curator moderation (team reviews before publishing)
- Hybrid (community + curator)

**Uncertainty:** Requires policy design, community feedback  
**Resolution criteria:** Policy must be fair, transparent, scalable

---

## 12. What Not To Do

These are **anti-patterns** — explicitly rejected approaches that violate authoring principles.

### 12.1 No Raw Graph Editor First

**Anti-pattern:** Building graph editor as first authoring UI.

**Why wrong:**
- Too complex for non-technical teachers
- Exposes low-level implementation details
- High cognitive load, low adoption
- Premature complexity before patterns proven

**Correct approach:** Start with guided composition (forms, dropdowns, sliders). Add graph editor later if demand exists.

### 12.2 No Raw JSON Editor

**Anti-pattern:** Asking teachers to write or edit raw JSON specs.

**Why wrong:**
- JSON is technical, not accessible
- JSON is error-prone (syntax, validation)
- JSON is not human-readable
- JSON is implementation detail

**Correct approach:** Form-based interface that serializes to JSON internally.

### 12.3 No Exposing Transport/Engine Knobs

**Anti-pattern:** Exposing low-level engine controls (transport semantics, recording modes, interruption policies).

**Why wrong:**
- Teachers don't understand engine details
- Engine details are orthogonal to practice design
- Exposing details adds unnecessary complexity
- Couples authoring to implementation

**Correct approach:** Hide engine details. Show high-level controls (rounds, tempo, backing).

### 12.4 No Freeform Spaghetti Assembly Before Pattern Discipline Proven

**Anti-pattern:** Allowing arbitrary assembly of steps/patterns before pattern discipline is proven.

**Why wrong:**
- Leads to inconsistent, confusing practice paths
- Violates pattern discipline
- Makes it hard to understand what's happening
- Couples authoring to implementation

**Correct approach:** Enforce pattern discipline. Authors compose from predefined patterns. Custom variations only after patterns proven.

---

## 13. Relation to Other Systems

### 13.1 No Contradiction with quest-scenario-system.md

**Compatibility check:**
- ✅ Authoring generates scenario specs (not programs)
- ✅ Authoring uses product language (pattern, objective, support)
- ✅ quest-scenario-system.md uses technical language (generator, program, spec)
- ✅ Authoring does not dictate architecture implementation
- ✅ Architecture does not dictate authoring presentation

**Shared principles:**
- Practice is structured (patterns have clear semantics)
- Completion is meaningful (evidence is collected)
- Progression is possible (support/progression controls enable advancement)
- Interruption is safe (Escape key works)

### 13.2 No Contradiction with practice-experience-layer.md

**Compatibility check:**
- ✅ Authoring creates cards that appear in entry surface
- ✅ Authoring respects card contract (promise/method/win)
- ✅ Authoring enables completion moment (evidence summary)
- ✅ Authoring facilitates compare bridge (optional compare)
- ✅ Authoring respects canvas-first principle

**Shared principles:**
- Practice is a scene (authoring creates scenes)
- Cards have contracts (authoring enforces contracts)
- Completion is celebration (authoring enables celebration)
- Compare is bridge (authoring enables compare)
- Progress is visible (authoring enables progress tracking)

### 13.3 No Contradiction with quest-entry-surface.md

**Compatibility check:**
- ✅ Authoring creates quest cards (shown in entry surface)
- ✅ Authoring respects visibility policy (stable/experimental/special)
- ✅ Authoring respects card anatomy (promise/method/win)
- ✅ Authoring respects grouping/navigation
- ✅ Authoring respects progress presentation

**Shared principles:**
- Quest entry is dedicated surface (authoring creates cards for surface)
- Card contracts are mandatory (authoring enforces contracts)
- Visibility policy protects learners (authoring respects policy)
- Entry surface is integrated (authoring creates integrated cards)

### 13.4 Relation to Takes System

**Takes system provides:**
- Block-scoped recording sessions
- Take slot management (0-5 slots per block)
- Audio capture + trim + decode pipeline
- Take preview/compare infrastructure

**Authoring uses:**
- Takes system to execute authored quests
- Takes system to show completion state
- Takes system to facilitate compare

**Authoring does NOT:**
- Manage take storage (that's Takes)
- Render waveforms (that's Takes)
- Handle audio engine (that's Takes)

---

## 14. Key Takeaways

### For Product Designers

1. **Authoring is composition, not graph editing** — guided forms, not nodes/edges
2. **Patterns are user-friendly, families are technical** — hide families, show patterns
3. **Route preview is mandatory** — authors verify intent before saving
4. **Guided composition first** — graph editor later or never
5. **Authoring respects card contract** — promise/method/win must be clear
6. **Sharing exchanges specs, not state** — portable, versionable, future-proof

### For UX Designers

1. **Form-based interface** — dropdowns, sliders, toggles (not graph editor)
2. **Step-by-step flow** — objective → block → pattern → support → preview → save
3. **Real-time preview** — authors see generated route as they adjust
4. **Sensible defaults** — reduce cognitive load, enable quick authoring
5. **Advanced options** — power users can access deeper controls
6. **Clear language** — use product language (pattern, objective, support), not technical language

### For Implementers

1. **Authoring ≠ Architecture** — product language ≠ technical language
2. **Authoring generates specs** — not programs, not runs
3. **Patterns map to families** — authoring shows patterns, system maps to families
4. **Route preview is mandatory** — authors cannot save without previewing
5. **Share unit is card/spec** — not runtime state, not implementation snapshots
6. **Authoring lives on top** — uses Takes/Scenario architecture, doesn't bypass it

### For Teachers/Authors

1. **Authoring is simple** — step-by-step guided flow
2. **No graph editing** — compose from patterns, not nodes
3. **No JSON writing** — form-based interface
4. **Route preview** — see what will execute before saving
5. **Save & share** — save to library, share with others
6. **Patterns are discoverable** — clear names, descriptions, icons

---

## 15. Implementation Roadmap

### Phase 1: MVP (Minimal Viable Authoring)

**Priority 1: Core authoring flow**
- Objective selection (predefined objectives)
- Block/scope selection (current block only)
- Pattern selection (Echo, Fill & Compare)
- Basic support controls (rounds, backing)
- Route preview (human-readable)
- Save to personal library

**Priority 2: Metadata**
- Name, description, icon
- Difficulty, category, tags
- Save/load from library

**Priority 3: Basic sharing**
- Export quest card as JSON
- Import quest card from JSON

### Phase 2: Enhanced Authoring

**Priority 1: Advanced patterns**
- Tempo Ladder
- Backing Ladder
- Repair/Isolation

**Priority 2: Advanced controls**
- Tempo stages
- Backing stages
- Progress gates
- Review modes

**Priority 3: Library management**
- Browse personal library
- Edit saved quests
- Delete quests
- Organize by category/tags

### Phase 3: Advanced Authoring

**Priority 1: Teacher permissions**
- Teacher-only patterns
- Teacher-only controls
- Library curation

**Priority 2: Community sharing**
- Share via link
- Share via library
- Community moderation

**Priority 3: Graph editor (future)**
- Advanced users can edit graphs
- Custom pattern composition
- Expert-level controls
