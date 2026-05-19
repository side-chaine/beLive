# Onboarding Route 2.1

**Status:** Fast-entry operational guide for new architects and senior specialists  
**Owner:** Center1.3 / Agent 007  
**Last updated:** 2026-03-19  
**Related:**  
- `architecture-map-2.1.md`
- `interaction-schema-2.1.md`
- `audio-engine.md`
- `sync-system.md`
- `reactive-lyrics-foundation.md`
- `styles-system.md`
- `performance-quality-system.md`
- `scene-engine-vision.md`

---

## 1. Purpose

This document is the **fast entry route** for a new architect or senior specialist entering beLive.

It exists to prevent three common failures:

1. reading the project as unresolved migration chaos  
2. reopening already closed architectural decisions  
3. wasting time in the wrong frontier

This route is designed to help a newcomer become useful quickly.

It does not try to explain everything in full depth.
It tells you:

- what to understand first
- what not to misunderstand
- where authority lives
- which files to inspect first
- which seams are still open
- how to perform safe early recon

---

## 2. What beLive Is Right Now

beLive is **not** a project stuck in migration rescue.

It is now a structured hybrid product runtime with:

- preserved boot/boundary globals
- React/TypeScript product surfaces
- `AudioEngineV2` transport authority
- marker-driven line sync backbone
- additive word-sync layer
- trigger-driven reactive lyric runtime
- shared playback visual scheduler
- separate performance policy domain
- durable track artifacts in IndexedDB

### The correct one-line mental model

**beLive is a mature hybrid runtime with preserved legacy identities and React-owned product logic.**

If you start with that assumption, you will read the code correctly.

---

## 3. What You Must Understand Before Touching Code

A new specialist should internalize these truths immediately.

### 3.1 The system already has real boundaries
The remaining legacy files are mostly:
- identity shells
- boot boundaries
- compatibility surfaces

They are not proof that the old layer still owns the product.

### 3.2 Authority is intentionally split
beLive separates:
- transport authority
- line sync authority
- word timing authority
- loop intent ownership
- style intent
- performance budget
- bridge mirroring

Do not collapse these into one imagined “central state.”

### 3.3 Stores are not automatically sources of truth
Many Zustand stores are:
- mirrors
- selectors
- intent containers
- UI-facing state layers

They are not all authoritative.

### 3.4 Bridges are architecture, not temporary glue
In this project, bridges are real operating infrastructure.

### 3.5 The sync frontier is no longer plumbing
The main open frontier is not:
- “can we persist alignment?”
- “can we render words?”
- “can the app consume word sync?”

Those are already proven.

The real open frontier is:
- quality source
- engine selection
- confidence shaping
- productization sequencing

---

## 4. What You Must Not Reopen

Do **not** reopen these areas unless there is strong new evidence.

### 4.1 Frozen enough to treat as settled
- `AudioEngineV2` as transport authority
- preserved `window.audioEngine` identity
- marker-driven current line backbone
- additive word-sync architecture
- separate `lineMap`
- separate `alignmentData`
- orchestrator-driven sync hydration
- provider boundary
- persistence + reload durability
- trigger layer as a separate domain
- shared playback visual scheduler as publication plane
- performance as a separate top-level policy domain

### 4.2 Closed and intentionally not worth revisiting
- mock timing tuning
- “does hydration work at all?”
- “can app consume alignment at all?”
- replacing line sync with word sync
- rebuilding the frontend for purity
- deleting boundary globals first

### 4.3 Dangerous beginner mistakes
Do not assume:
- “global = owner”
- “store = truth”
- “legacy file = still main implementation”
- “multiple event surfaces = chaos”
- “scheduler owns timing”
- “reactive lyrics means sync editor and runtime paths must already be unified”

---

## 5. First Reading Order

This is the recommended reading route before deep recon.

### Step 1 — whole-system shape
Read:
1. `docs/architecture/architecture-map-2.1.md`
2. `docs/architecture/interaction-schema-2.1.md`

### Step 2 — core truth domains
Read:
3. `docs/architecture/audio-engine.md`
4. `docs/architecture/sync-system.md`

### Step 3 — product runtime layers
Read:
5. `docs/architecture/reactive-lyrics-foundation.md`
6. `docs/architecture/styles-system.md`
7. `docs/architecture/performance-quality-system.md`
8. `docs/architecture/takes-system.md` ← **NEW: Takes recording/compare subsystem**
9. `docs/architecture/exercises-system.md` ← **NEW: Quest-based practice layer on top of Takes**

### Step 4 — growth direction
Read:
8. `docs/architecture/scene-engine-vision.md`

### Interpretation
This reading order matters.

If you read only code first, you may misclassify:
- shells as owners
- mirrors as truth
- event topology as accidental
- **Takes and Exercises as separate unrelated systems** (they are not — Exercises sit on top of Takes)

The docs exist to prevent that mistake.

---

## 6. Fast Code Route

After reading docs, use this code route.

---

### 6.1 Boot and host layer
Read first:
- `index.html`
- `src/main.tsx`
- `src/App.tsx`

#### Why
This gives you:
- legacy boot order
- global identities
- host stub creation
- where patching happens
- where runtime bridges are activated

---

### 6.2 Transport authority
Then read:
- `js/audio-engine.js`
- `src/audio/featureFlag.ts`
- `src/audio/compat/patchV1.ts`
- `src/audio/core/AudioEngineV2.ts`

#### Why
This shows:
- preserved legacy identity
- v2 activation
- in-place patching
- actual runtime transport authority

---

### 6.3 Track load flow
Then read:
- `src/services/track.actions.ts`
- `src/services/track.orchestrator.ts`

#### Why
This gives you the canonical product load path:
- clear/reset
- content prep
- audio load
- marker apply
- word-sync hydration
- autoplay
- sync-editor open policy

---

### 6.4 Marker / line sync path
Then read:
- `src/bridges/markers.bridge.ts`
- `src/bridges/lyrics.bridge.ts`
- `src/stores/markers.store.ts`
- `src/stores/lyrics.store.ts`

#### Why
This gives you:
- marker mirroring
- active line publication
- reverse-sync to legacy line consumers
- current line backbone truth

---

### 6.5 Loop surfaces
Then read:
- `src/stores/loop.store.ts`
- `src/bridges/loop.bridge.ts`
- `src/components/WagonTrain.tsx`
- `src/sync/components/WaveformCanvas.tsx`

#### Why
This gives you the two-loop reality:
- TrackMap loop
- Sync Editor loop

A newcomer must understand early that these are separate ownership systems.

---

### 6.6 Word-sync and align flow
Then read:
- `src/stores/wordSync.store.ts`
- `src/sync/word-sync/services/ai-lyrics-sync.service.ts`
- `src/sync/word-sync/services/alignment-cache.service.ts`
- `src/sync/word-sync/services/alignment-request.builder.ts`
- `src/sync/word-sync/services/lyrics-align.service.ts`
- `src/sync/components/SyncEditorPanel.tsx`
- `src/sync/components/SyncLyrics.tsx`

#### Why
This shows:
- structural sync artifacts
- cache verdicts
- cue vs fill split
- align execution path
- persistence write-back
- separate sync-editor display path

---

### 6.7 Trigger / scheduler / reactive publication
Then read:
- `src/playback/playback-visual-scheduler.ts`
- `src/triggers/trigger.bridge.ts`
- `src/triggers/trigger.engine.ts`
- `src/triggers/detectors/word-line.detector.ts`
- `src/triggers/WordHighlightLine.tsx`

#### Why
This reveals the most modernized runtime path:
- shared scheduler
- trigger signal production
- CSS var batching
- reusable word rendering consumers

---

### 6.8 Style / performance split
Then read:
- `src/stores/textStyle.store.ts`
- `src/bridges/textStyle.bridge.ts`
- `src/performance/performance.store.ts`
- `src/performance/performance.bridge.ts`
- `src/performance/performance.hooks.ts`
- `src/components/RehearsalLyrics.tsx`

#### Why
This shows:
- style intent domain
- performance budget domain
- bridge to legacy lyricsDisplay style shell
- reactive consumers using resolved visual budget

---

### 6.9 Secondary surfaces
Then read:
- `src/hooks/useBackgroundManagers.ts`
- `src/bridges/live-guard.ts`
- `src/bridges/monitor.bridge.ts`
- `src/stores/recording.store.ts`
- `src/takes/takes.store.ts`
- `src/takes/takes.bridge.ts`
- `src/takes/components/TakesControlStrip.tsx` ← take recording/preview UI
- `src/takes/components/TakesCanvas.tsx` ← waveform rendering with live trail
- `src/exercises/exercise.store.ts` ← quest state management
- `src/exercises/exercise.bridge.ts` ← lifecycle and track-change cleanup
- `src/exercises/exercise.recipes.ts` ← recipe definitions (Echo Drill, 3-Take Challenge, etc.)
- `src/exercises/components/ExerciseStrip.tsx` ← active exercise step display
- `src/exercises/components/RecipeCardPopover.tsx` ← block-scoped recipe launcher
- `src/blocks/bridge/blockEditor.bridge.ts`

#### Why
This reveals the second interaction ring:
- mode-coupled backgrounds
- live activation gating
- monitor hydration
- recording policy
- **takes subsystem** — block-based recording, preview, compare engine
- **exercises quest layer** — recipe-driven practice workflows on top of Takes substrate
- block-editor proxy pattern

---

## 7. What to Look For During First Recon

A new specialist should not grep randomly.
The first recon should answer specific questions.

### 7.1 Boot questions
- Who creates global identities first?
- Who patches them later?
- Which globals are shell-only?
- Which globals host real runtime-facing methods?

### 7.2 Authority questions
- Who owns transport?
- Who owns current line?
- Who owns word-level FX timing?
- Who owns each loop surface?
- Who owns persistence?

### 7.3 Event questions
- Which target is used: `window` or `document`?
- Who dispatches?
- Who listens?
- Is the event an active runtime path or compatibility residue?

### 7.4 Seam questions
- Is this a real bug or a known split-model?
- Is this a boundary-sensitive surface or a core authority problem?
- Is this product-facing, or just internal compatibility complexity?

### 7.5 Takes/Exercises questions
**Critical for new Center:**
- Are Exercises separate from Takes? **NO** — Exercises sit on top of Takes substrate
- Is all recipe surface stable? **NO** — stable learner-facing drills have priority over hidden/special lanes
- Is `Call & Response` a finished generic drill? **NO** — it's a special alternation mode under redesign requiring separate entry point

---

## 8. The First 30 Minutes

If you have only 30 minutes, do this:

### Read
- `architecture-map-2.1.md`
- `interaction-schema-2.1.md`

### Inspect
- `index.html`
- `src/main.tsx`
- `src/App.tsx`
- `src/audio/compat/patchV1.ts`
- `src/audio/core/AudioEngineV2.ts`
- `src/services/track.orchestrator.ts`

### Goal
By the end of 30 minutes, you should be able to say:

- how boot works
- where audio authority lives
- what the orchestrator does
- why globals still exist
- why the project is not migration-chaos

If you cannot answer those, do not move into deeper code yet.

---

## 9. The First 2 Hours

If you have 2 focused hours, add this:

### Inspect
- `src/bridges/lyrics.bridge.ts`
- `src/stores/wordSync.store.ts`
- `src/triggers/trigger.bridge.ts`
- `src/playback/playback-visual-scheduler.ts`
- `src/components/RehearsalLyrics.tsx`
- `src/sync/components/SyncEditorPanel.tsx`
- `src/sync/components/WaveformCanvas.tsx`

### Goal
By the end of 2 hours, you should be able to explain:

- marker backbone vs word-sync overlay
- cue path vs fill path
- why scheduler exists
- why trigger bridge owns scheduler lifecycle
- why Sync Editor loop and TrackMap loop are different

If you cannot explain those, you are not yet ready to propose architecture changes.

---

## 10. The First Half-Day

If you have half a day, complete the system picture.

### Inspect
- `src/bridges/mode-switch.bridge.ts`
- `src/bridges/mode.bridge.ts`
- `src/bridges/audio.bridge.ts`
- `src/performance/performance.bridge.ts`
- `src/bridges/monitor.bridge.ts`
- `src/blocks/bridge/blockEditor.bridge.ts`
- `js/track-catalog.js`
- `js/marker-manager.js`
- `js/lyrics-display.js`
- `js/monitor-mix.js`

### Goal
By the end of half a day, you should be able to classify every major file into one of these buckets:

- authority
- bridge
- shell
- mirror
- persistence
- publication
- product surface
- secondary surface
- growth/vision

That classification skill is more important than memorizing file names.

---

## 11. False Assumptions to Kill Early

A newcomer should explicitly kill these assumptions.

### 11.1 “React owns everything now”
False.

React owns the product layer, but not all boundary identities.

### 11.2 “Legacy files should be deleted next”
False.

Most remaining legacy files are now compatibility boundaries.

### 11.3 “Multiple sync layers mean architecture confusion”
False.

Line sync and word sync are intentionally separate.

### 11.4 “Scheduler means centralized truth”
False.

Scheduler coordinates publication, not timing truth.

### 11.5 “If a store updates, it must be an authority”
False.

Many stores are mirrors or intent holders.

### 11.6 "Two loop systems means bug"
False.

It means two product surfaces with different semantics.

### 11.7 "Exercises and Takes are separate unrelated systems"
False.

**Exercises sit on top of Takes substrate**, not as a replacement. Exercises provide:
- quest wrapper around takes recording
- recipe-driven step sequences
- automated backing changes per step
- goal tracking (rounds, filled slots)

Takes provides:
- block-scoped recording canvas
- take preview/compare engine
- waveform rendering with live trail
- raw record/preview actions

### 11.8 "All visible recipes are stable finished drills"
False.

Recipe surface is classified into three categories:
- **Stable** — Echo Drill, 3-Take Challenge (runtime-confirmed, learner-visible)
- **Experimental** — No Training Wheels, A Cappella Boss (working but under redesign, hidden from default surface)
- **Special** — Call & Response (alternation mode requiring semantic patterns, separate entry point)

### 11.9 "Call & Response is just another stable drill recipe"
False.

`Call & Response` is **NOT** a stable generic drill. It is:
- first member of special alternation mode family
- requires semantic role labels (`guide`, `response`)
- needs dedicated pattern configuration UI before start
- requires separate entry point from stable Drill launcher
- under active redesign, not yet ready for general learner surface

---

## 12. What a Good First Report Looks Like

A new architect should not dump random findings.
A good first report should be structured like this:

### 12.1 Confirmed truths
Example:
- AudioEngineV2 is transport authority
- current line remains marker-driven
- word-sync hydration is orchestrator-driven

### 12.2 Open seams
Example:
- mode policy duplication
- currentTime publication distribution
- monitor compat sensitivity

### 12.3 Residual surfaces
Example:
- `sync-editor-closed`
- historical `app.js` comments

### 12.4 Recommendations
Only after truth collection:
- what should be frozen as-is
- what needs a tiny cleanup
- what is not worth touching now

---

## 13. What a Bad First Report Looks Like

Avoid reports like:

- “there are still many globals”
- “the project mixes legacy and React”
- “there are too many events”
- “stores should probably own more”
- “we should refactor for cleanliness”

Those are not findings.
Those are premature reactions.

beLive requires **truth reports**, not aesthetic discomfort reports.

---

## 14. Safe First Recon Topics

If a new specialist wants to be useful quickly, the safest first recon topics are:

### Good first recons
- current runtime authority map
- event topology verification
- loop ownership verification
- persistence write/read path verification
- scheduler participant map
- product flow reconstruction
- mode switch side-effect mapping
- boundary shell classification

### Bad first recons
- frontend rewrite concepts
- replacing legacy identities
- backend-first proposals
- abstract state unification fantasies
- mock-route tuning
- rethinking additive sync from scratch

---

## 15. First Questions Worth Asking

After onboarding, these are good questions.

### Core product questions
- Is RU engine verdict fully frozen or still open?
- What is the final engine map?
- Are confidence thresholds still temporary-frozen?
- Is prepared catalog mode now the primary near-term product path?

### Runtime seam questions
- Which policy seams are worth cleanup before productization?
- Which compatibility surfaces are actively supported vs merely tolerated?
- Which event surfaces are canonical and which are residue-only?

### Good architectural behavior
Ask only about real open fronts.
Do not ask solved plumbing questions as if they were open.

---

## 16. Personal Working Rules for a New Architect

A strong newcomer in beLive should operate by these rules.

### Rule 1
First determine **authority**, then talk about refactor.

### Rule 2
First verify **dispatch/listener topology**, then talk about “buggy events.”

### Rule 3
First classify **shell vs owner**, then talk about deleting legacy.

### Rule 4
First understand **product surface semantics**, then talk about unification.

### Rule 5
First separate **frozen** from **open**, then propose architecture.

---

## 17. Practical Recon Checklist

Use this checklist during first scans.

### Boot
- [ ] verified `index.html` load order
- [ ] verified `main.tsx` host responsibilities
- [ ] verified `App.tsx` bridge activation

### Audio
- [ ] verified `window.audioEngine` patch-in-place
- [ ] verified `AudioEngineV2` transport authority
- [ ] verified master clock and vocal follower behavior

### Track flow
- [ ] verified orchestrator load order
- [ ] verified marker apply timing
- [ ] verified word-sync hydration placement

### Sync
- [ ] verified marker-driven line backbone
- [ ] verified additive word-sync
- [ ] verified cue/fill split
- [ ] verified align persistence write-back

### Loops
- [ ] verified TrackMap loop owner
- [ ] verified Sync Editor loop owner
- [ ] verified engine execution for both

### Triggers / visuals
- [ ] verified scheduler participants
- [ ] verified trigger lifecycle owner
- [ ] verified CSS-var hot-path publication

### Policy / style
- [ ] verified style intent store
- [ ] verified performance budget store
- [ ] verified DOM publication of tier and recording state

### Secondary surfaces
- [ ] verified background manager coupling
- [ ] verified live guard
- [ ] verified monitor bridge
- [ ] verified takes / recording split
- [ ] verified block editor proxy path
- [ ] **NEW** verified takes subsystem (recording, preview, compare, live trail)
- [ ] **NEW** verified exercises quest layer (recipes, steps, backing changes, goal tracking)
- [ ] **NEW** verified recipe surface classification (stable vs experimental vs special)
- [ ] **NEW** verified Call & Response as special alternation mode (not stable drill)

---

## 18. Recommended First Deliverable from a New Specialist

The first useful deliverable should usually be one of:

1. **Authority verification report**
2. **Event topology verification report**
3. **Boundary shell classification report**
4. **One seam report with raw proof**
5. **Product flow reconstruction report**

Not:
- giant rewrite proposal
- generic modernization plan
- cleanup wishlist

---

## 19. Final Onboarding Formula

A new specialist should enter beLive with this formula:

> **Do not rebuild the hybrid runtime.  
> First identify who owns truth, who mirrors it, who publishes it, and which seams are still genuinely open.**

### Critical current frontier understanding

**Takes and Exercises are now the active product frontier:**
- Takes subsystem is runtime-stabilized (W2D complete)
- Standard path sync fixed (TAKE-SYNC-TRUTH wave landed)
- Exercises quest layer sits on top of Takes substrate
- Stable learner-facing drill surface has priority over exposing all modes
- Hidden recipe rehab is active lane (Phase 1: No Training Wheels, Phase 2: A Cappella Boss)
- Special alternation modes (Call & Response) require separate entry point and pattern config

A new Center must read `takes-system.md` and `exercises-system.md` immediately after master docs.

---

## 20. One-Line Summary

**The fastest successful onboarding path in beLive is to read the system as a mature hybrid runtime, verify authority before aesthetics, focus early recon on real interaction truths rather than on legacy discomfort, and immediately understand Takes/Exercises as the current active product frontier with stable learner surface prioritized over hidden/special lanes.**
```

---
