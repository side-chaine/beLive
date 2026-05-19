# Quest/Scenario/Takes Roadmap

**Status:** Operational Roadmap  
**Date:** 2026-04-06  
**Purpose:** Clear team visibility into what's landed, what's current, and what comes next  
**Related Docs:** [quest-scenario-system.md](./quest-scenario-system.md), [scenario-stage-state-model.md](./scenario-stage-state-model.md), [tempo-scenario-current-truth.md](./tempo-scenario-current-truth.md), [takes-system.md](./takes-system.md)

---

## 1. Current Position (Landed)

### 1.1 Architecture Frozen

- ✅ **Quest concept freeze** — quest = ordered sequence of exercises, completion rules, progress tracking
- ✅ **Practice experience freeze** — scene-based, canvas-first, card contract (promise/method/win)
- ✅ **Stage-state runtime model** — scenarios = sequences of stage states, not mode bags
- ✅ **Generator family architecture** — families generate scenario programs from semantic specs

### 1.2 Surface & UX Landed

- ✅ **Quest entry surface** — card picker with promise/method/win, experimental/stable classification
- ✅ **Completion bridge baseline** — completion moment, evidence summary, next-action invitation
- ✅ **Canvas-first Takes surface** — waveform-first layout, hero take trio, top control line

### 1.3 Generator Families Extracted

- ✅ **Echo family** — stable, listen-echo pattern, 3 rounds, instrumental backing
- ✅ **3-Take Challenge** — stable, record 3 takes, compare, select best
- ✅ **Backing Ladder family** — experimental, progressive backing reduction (full → instrumental → silent)
- ✅ **Tempo Ladder family** — experimental, progressive tempo increase (70% → 100%), explicit stage generation
- ✅ **Call & Response** — special, alternation pattern, in-flight capture

### 1.4 Current Tempo Scenario Truth

- ✅ **Explicit stage generation** — ascending/descending ladder with 0.05 increments toward 100%
- ✅ **Previous-take preview** — separate review stage after record, not hijack of next listen
- ✅ **Training/final take classification** — marked in metadata, visible in take cards
- ✅ **Slot 0 overwrite doctrine** — current working behavior, known limitation
- ✅ **V-Mix remains user-controlled** — scenario cannot hijack, useful side effect in review

### 1.5 Takes System Stabilized

- ✅ **Standard visible take-sync substantially resolved** — trim clipping fix landed (TC-TSYNC-406)
- ✅ **Live orange trail** — imperative accumulator architecture, working runtime foundation
- ✅ **Exercise execution lock** — protects all interference surfaces during active phases
- ✅ **Canvas-first first-pass surface** — top control line, hero trio centered, global Solo unified
- ✅ **Compare foundation** — selected take = reference (gold), clicked take = active target (orange)

### 1.6 Known Observational Seams (Not Blockers)

- 🟡 **First-take early/lead residual** — occasional, cold start edge case, workaround exists
- 🟡 **Post-quest V-Mix/preview restore seams** — occasional, routing architecture nuanced, workaround exists

---

## 2. Immediate Next Waves

### Wave: Capability Gating (Priority 1)

**Goal:** Formalize entry requirements, runtime requirements, evidence enhancements for all families

**Scope:**
- Explicit capability matrix per family (what's required to enter, what's required to run, what's optional evidence)
- Gating rules (which families require which capabilities)
- Evidence collection baseline (what gets tracked per family)

**Deliverable:** `capability-gating-matrix.md` (already drafted, needs formalization)

**Blast radius:** Medium (affects entry surface, runtime guards, evidence collection)

**Success criteria:** Team can answer "can learner X run family Y?" with clear yes/no

### Wave: Tempo Polish / Hold / Advance / Simplify (Priority 2)

**Goal:** Make Tempo Scenario progression system user-friendly and evidence-informed

**Scope:**
- Implement hold/advance/simplify UI (user can repeat stage, advance to next, or simplify to easier)
- Integrate with evidence system (system can suggest hold/advance/simplify based on take quality)
- Formalize V-Mix routing architecture during scenario review
- Runtime tempoRate application (listen steps actually play at declared tempo)

**Deliverable:** Working Tempo Scenario with evidence-based progression suggestions

**Blast radius:** Medium (exercise runtime, evidence collection, V-Mix routing)

**Success criteria:** User can complete Tempo Scenario with clear progression path, system suggests next move

### Wave: Experimental Scenario Lab Testing (Priority 3)

**Goal:** Gather evidence from experimental families (Backing Ladder, Tempo Ladder, Call & Response)

**Scope:**
- Deploy experimental surface to test learners
- Collect evidence on completion rates, take quality, user satisfaction
- Identify which families are ready to stabilize vs need redesign
- Document learner feedback on progression, difficulty, clarity

**Deliverable:** Evidence report on experimental families

**Blast radius:** Low (testing only, no code changes)

**Success criteria:** Clear data on which families work, which need iteration

### Wave: Compare Lane Tightening (Priority 4, if needed)

**Goal:** Refine compare semantics based on evidence

**Scope:**
- Evaluate current compare model (selected take = reference, clicked take = target)
- Test mixed-tempo compare (compare 70% take with 100% take)
- Decide on multi-slot recording per tempo vs take history vs other model
- Formalize compare UI/UX

**Deliverable:** Refined compare semantics, updated Takes surface if needed

**Blast radius:** Medium (Takes surface, recording model)

**Success criteria:** Compare is intuitive, users understand what they're comparing

---

## 3. Near-Term Waves

### Wave: X-Axis Evidence Foundation (Priority 1)

**Goal:** Implement evidence collection infrastructure for all families

**Scope:**
- Define evidence schema (what gets collected per family, per take, per quest)
- Implement evidence collection in exercise runtime
- Store evidence in quest progress
- Expose evidence in completion moment

**Deliverable:** Evidence collection working end-to-end

**Blast radius:** Medium (exercise runtime, quest storage, completion UI)

**Success criteria:** Evidence is collected, stored, and visible in completion moment

### Wave: X-Axis MVP (Priority 2)

**Goal:** Implement mastery-based progression for at least one family

**Scope:**
- Define mastery criteria for one family (e.g., Tempo Ladder: 3 consecutive takes at 100% with good timing)
- Implement mastery detection in exercise runtime
- Implement mastery-gated advancement (user cannot advance until mastery reached)
- Show mastery progress in UI

**Deliverable:** One family with mastery-based progression

**Blast radius:** Medium (exercise runtime, progression logic, UI)

**Success criteria:** User can see mastery progress, system enforces mastery gate

### Wave: Quest Authoring Implementation (Priority 3)

**Goal:** Enable teachers/coaches to create custom quests

**Scope:**
- Implement quest authoring UI (select exercises, set completion rules, configure evidence)
- Implement quest persistence (save/load custom quests)
- Implement quest sharing (share quests with other teachers)
- Implement quest versioning (track changes, rollback if needed)

**Deliverable:** Quest authoring surface, persistence, sharing

**Blast radius:** High (new surface, new persistence layer, new sharing model)

**Success criteria:** Teacher can create, save, share custom quest

---

## 4. Later Waves

### Wave: Y-Axis / Pitch Integration (Priority 1)

**Goal:** Integrate pitch tracking into evidence and progression

**Scope:**
- Collect pitch data during recording (already have pitch engine)
- Analyze pitch accuracy, consistency, range
- Show pitch evidence in completion moment
- Use pitch evidence for mastery detection and progression

**Deliverable:** Pitch-aware evidence collection and progression

**Blast radius:** Medium (evidence schema, mastery detection, UI)

**Success criteria:** Pitch evidence is collected, visible, and affects progression

### Wave: PanoramaMix Lane (Priority 2)

**Goal:** Implement advanced mixing surface for power users

**Scope:**
- Design PanoramaMix surface (multi-stem mixing, live effects, recording)
- Implement stem isolation (user can mute/solo individual stems)
- Implement live effects (reverb, delay, compression)
- Integrate with Takes (record mixed output)

**Deliverable:** PanoramaMix surface, stem isolation, live effects

**Blast radius:** High (new surface, audio engine changes, recording model)

**Success criteria:** Power users can mix stems, record mixed output

### Wave: Visual Engine Implementation Track (Priority 3)

**Goal:** Implement visual effects and animations for practice

**Scope:**
- Implement word FX (highlight, glow, scale, color)
- Implement block FX (entrance, exit, transition)
- Implement progress FX (progress bar, stage badges, completion animation)
- Integrate with exercise runtime (FX triggered by exercise phases)

**Deliverable:** Visual engine with FX system

**Blast radius:** High (new rendering system, new animation system)

**Success criteria:** Visual FX enhance practice experience, no performance regression

### Wave: Sharing/Persistence Implementation (Priority 4)

**Goal:** Enable learners to share takes, quests, progress

**Scope:**
- Implement take sharing (share take with link, embed in social media)
- Implement quest sharing (share quest with link, import shared quest)
- Implement progress sharing (share progress snapshot with teacher)
- Implement persistence (save progress to cloud, sync across devices)

**Deliverable:** Sharing and persistence infrastructure

**Blast radius:** High (new backend, new sharing model, new sync model)

**Success criteria:** Learners can share takes/quests, progress persists across sessions

### Wave: Richer Progression Systems (Priority 5)

**Goal:** Implement advanced progression models beyond mastery gates

**Scope:**
- Implement adaptive difficulty (system adjusts difficulty based on performance)
- Implement learning paths (system suggests sequence of quests based on learner profile)
- Implement spaced repetition (system suggests when to revisit previous quests)
- Implement peer comparison (system shows how learner compares to peers)

**Deliverable:** Advanced progression and recommendation system

**Blast radius:** High (new recommendation engine, new analytics)

**Success criteria:** System provides personalized learning paths, learners feel guided

---

## 5. Parallel Track: Visual Engine

**Status:** Concept frozen, separate implementation track

**Current position:**
- ✅ Reactive lyrics foundation (Phase 1 complete)
- ✅ Word FX pack (basic modes working)
- ✅ Styles system (font, theme, line controls)

**Next steps:**
- Suppress residual line glow for Progress mode
- Connect line level controls to rendering
- Implement block FX (entrance, exit, transition)
- Integrate with exercise runtime

**Note:** Visual engine remains separate from Quest/Scenario/Takes, but concept is frozen enough to proceed in parallel.

---

## 6. What We Are Explicitly NOT Doing Now

### Not Doing

- ❌ **Broad learner expansion** — focus on core families first, evidence-based expansion later
- ❌ **Final naming freeze** — names may change based on learner feedback
- ❌ **Fake V-Mix claims** — V-Mix routing is nuanced, not claiming full architecture yet
- ❌ **Mixed-tempo compare semantics** — comparing 70% take with 100% take is future work
- ❌ **AI-first flow** — AI recommendations are future, not blocking current work
- ❌ **Multi-slot recording per tempo** — slot 0 overwrite is current, multi-slot is future
- ❌ **Automatic previous-take preview** — preview is optional, not automatic
- ❌ **Formal V-Mix routing architecture** — routing is implicit, formalization is future

### Why Not

- **Evidence first:** Need evidence from experimental families before expanding
- **Learner research:** Need learner feedback before finalizing names, UX, progression
- **Honest architecture:** Not claiming finality where nuance remains
- **Focused scope:** Deliver core families well before adding advanced features
- **Parallel tracks:** Visual engine and other systems proceed independently

---

## 7. Decision Ladder

**If Capability Gating wave passes:**
→ Next strongest move is **Tempo Polish / Hold / Advance / Simplify** (enables evidence-based progression)

**If Tempo Polish wave passes:**
→ Next strongest move is **Experimental Scenario Lab Testing** (gather evidence on all families)

**If Lab Testing shows strong evidence:**
→ Next strongest move is **X-Axis Evidence Foundation** (formalize evidence collection)

**If Evidence Foundation lands:**
→ Next strongest move is **X-Axis MVP** (implement mastery-based progression)

**If Mastery MVP lands:**
→ Next strongest move is **Y-Axis / Pitch Integration** (add pitch to evidence and progression)

**If Pitch Integration lands:**
→ Next strongest move is **Quest Authoring Implementation** (enable teacher customization)

**If Quest Authoring lands:**
→ Next strongest move is **Sharing/Persistence Implementation** (enable learner sharing and sync)

---

## 8. Risk Mitigation

### Known Risks

| Risk | Mitigation | Owner |
|------|-----------|-------|
| Tempo Scenario runtime tempoRate not implemented | Implement in Tempo Polish wave or disable family | Exercise Runtime |
| V-Mix routing architecture nuanced | Formalize in Tempo Polish wave, document seams | Audio Engine |
| First-take residual occasional | Gather telemetry, investigate in future wave | Takes System |
| Multi-slot recording not supported | Document limitation, plan for future wave | Takes System |
| Evidence collection not formalized | Implement in X-Axis Evidence Foundation wave | Exercise Runtime |
| Learner feedback may require redesign | Plan for iteration, gather evidence early | Product |

### Mitigation Strategy

- **Evidence first:** Gather evidence from experimental families before committing to architecture
- **Honest documentation:** Document known seams, limitations, future work clearly
- **Parallel tracks:** Visual engine and other systems proceed independently, don't block each other
- **Focused scope:** Deliver core families well before adding advanced features
- **Learner research:** Conduct user research early to validate assumptions

---

## 9. Success Criteria

### By End of Immediate Waves

- ✅ Capability gating is formalized and documented
- ✅ Tempo Scenario has evidence-based progression suggestions
- ✅ Experimental families have been tested with learners
- ✅ Compare semantics are refined based on evidence

### By End of Near-Term Waves

- ✅ Evidence collection is working end-to-end
- ✅ At least one family has mastery-based progression
- ✅ Teachers can create and share custom quests

### By End of Later Waves

- ✅ Pitch evidence is integrated into progression
- ✅ Visual FX enhance practice experience
- ✅ Learners can share takes and progress
- ✅ System provides personalized learning paths

---

## 10. Glossary

**Capability gating** — Entry requirements, runtime requirements, evidence enhancements per family

**Evidence** — Data collected during practice (take quality, timing, pitch, completion time, etc.)

**Family** — Generator family (Echo, Backing Ladder, Tempo Ladder, Call & Response, etc.)

**Mastery** — User has demonstrated sufficient skill to advance (e.g., 3 consecutive takes with good timing)

**Progression** — How user advances through stages/rounds (manual, mastery-gated, adaptive, etc.)

**Quest** — Ordered sequence of exercises with completion rules and progress tracking

**Scenario** — Sequence of stage states (listen, record, review, etc.)

**Stage state** — Complete state definition for a stage (audio mix, tempo, scope, take-flow, review, progression)

**V-Mix** — Vocal mix tool for live mixing, always user-controlled

---

**Document Status:** Operational Roadmap  
**Next Review:** After Capability Gating wave completion

