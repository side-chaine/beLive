# beLive Architecture Doctrine

**Status:** ❄️ frozen doctrine — version-independent, survives repo moves and refactors.
**Extracted from:** `architecture-map-2.1.md` + `interaction-schema-2.1.md` (both superseded as fact sources; kept as historical record).
**Rule of this document:** no file paths, no line numbers, no counters. Doctrine here; facts live in machine-verifiable registries and the v3 doc set.

---

## 0. How to Read This Document

Badge system (applies to every statement in beLive documentation):

| Badge | Meaning |
|-------|---------|
| ✅ | Confirmed by code scan |
| ❄️ | Frozen decision — do not change without explicit architectural decision |
| ⚠️ | Open seam |
| 🧭 | Strategic direction |
| 🕰️ | Historical context |
| 🚫 | No-go |

If a statement has no badge, treat it as architectural interpretation based on confirmed evidence.

Editorial convention for all docs:
- **Architecture Map / registries** explain *what exists and why*.
- **Interaction Schema** explains *who talks to whom, in what order, and under whose authority*.
- **Doctrine (this doc)** explains *what must never be broken and how to decide*.

---

## 1. System Statement

🧭 beLive is a hybrid PWA for vocalists: real-time synchronized lyrics across rehearsal, karaoke, concert, and live performance modes.

Core truths:
- ✅ The React/TS layer owns product behavior.
- ✅ Legacy JS survives only as compact boundary shells, not business-logic centers.
- ❄️ Markers are the canonical line-sync backbone.
- ❄️ Word sync is an additive overlay; it never replaces the line backbone.
- ✅ Trigger/reactive word layer and visual word consumers are live runtime, not future work.
- ✅ Performance is a first-class policy domain.
- ⚠️ The main risks are contract inconsistencies, not missing architecture.

What this system is NOT:
- Not a legacy rescue project.
- Not a frontend-only app (it has an offline batch pipeline).
- Not dependent on a real-time backend for core sync.
- Not a single-authority system (intentional split models exist).

---

## 2. Three Contours

🧭 The product is three contours that meet at track load:

- **Contour A — Manual line-sync.** User uploads stems + lyrics → block structure → manual marker placement → durable track bundle. This is the foundation and remains active.
- **Contour B — Batch word-sync pipeline.** External/offline forced alignment produces per-word timing artifacts against a frozen artifact contract. Additive over Contour A.
- **Contour C — App runtime.** Track load orchestration applies markers (from A) and hydrates word-sync artifacts (from B).

❄️ Offline/batch-prepared artifacts are a legitimate product lane, not a workaround.

---

## 3. Staged Boot Mental Model

✅ The boot is a **hybrid staged boot**, not chaos:

> Legacy globals first → TS boot patch layer second → React runtime bridges third → product flows on top.

React may mount BEFORE legacy compatibility is complete. This single fact explains every retry/polling/delayed pattern in the bridge layer. Do not "clean up" these patterns without understanding the staging.

---

## 4. Authority Doctrine

❄️ **Not every object that participates in a flow is an authority.**

Layers can: mirror, patch, observe, coordinate, publish, persist. Only some layers own truth.

- ❄️ Stores are not automatically authorities. Many stores are mirrors, selectors, or intent holders. A store write is not transport truth just because the store exists.
- ❄️ The visual scheduler is **publication-only**: truth-blind, timing-blind, domain-neutral. It coordinates readers/detectors/writers and batched publication; it owns no timing, sync, or data truth.
- ❄️ **One truth, many publication paths.** Playback time and active line each reach the UI through several synchronization surfaces (events, optimistic patches, polling, frame readers). State in a mirror is not the truth; the authority is what the paths publish FROM.
- ❄️ Authority separation is the health of the system: transport, line sync, word sync, loop intent, style intent, and performance budget do not all live in one place. Preserve this separation.

Role taxonomy (use these words in reviews): **authority / mirror / publication path / policy owner**.

---

## 5. Identity Boundaries

❄️ Preserved global objects are **identity anchors, compatibility surfaces, boot boundaries, and bridge endpoints** — not proof that the project is still legacy-owned.

They remain because they solve real runtime constraints: cached references, legacy event contracts, boot timing, DOM/bootstrap sequencing, compatibility with still-existing JS modules.

🚫 Do not remove boundary shells for purity. Do not swap object identities. Do not merge all bridges into stores. That would destroy the actual mature shape of the system.

---

## 6. Split Models (Intentional)

❄️ These splits are **by design**. Do not unify without explicit architectural decision.

| # | Split | Essence |
|---|-------|---------|
| 1 | Mode system | Command path (imperative switch) vs observer path (reactive mirror + policy) |
| 2 | Loop system | TrackMap loop (store-driven, block-based) vs Sync Editor loop (local, direct-to-engine, shift-drag) |
| 3 | Sync rendering | Cue path (early-feel, editor) vs Fill path (exact progress, triggers) |
| 4 | Runtime vs persistence | Runtime container shell vs durable persistence — both open the same DB independently |

---

## 7. Two-Layer Timing Model

❄️ **Layer 1 — marker-driven line sync** is the backbone: line progression, block timing, navigation anchors. REMAINS CANONICAL.

❄️ **Layer 2 — word-sync overlay** is additive: structural line map + per-word alignment + confidence-gated display + cache verdict. NEVER REPLACES Layer 1.

❄️ The three sync artifacts (markers / line map / alignment data) are separate layers. Keep them separate.

❄️ **Cue vs Fill:**
- Cue truth — early-feel highlight with lookahead, for responsive editor UX.
- Fill truth — exact word timing without lookahead, for progress FX and triggers.
- Different surfaces, different UX reasons. Do not collapse.

❄️ **Honest degradation:** bad or missing word alignment must degrade to line-only UX, never fabricate precision. Stale/mock data is rejected by cache verdict.

🕰️ Confidence thresholds are policy, not architecture: low → no word highlight, medium → repair candidate, high → safe display.

---

## 8. Architecture Invariants

These define what must remain true unless an explicit architectural decision changes them.

1. ❄️ **Identity boundaries remain preserved.** Boundary globals may be patched or mirrored, but their existence and identity continuity are part of the compatibility contract.
2. ❄️ **Transport authority belongs to the audio engine.** Stores and bridges may mirror state, publish optimistic UI, synchronize policies — but do not own seek/play execution, stem lifecycle, or loop execution.
3. ❄️ **Marker backbone remains canonical for active line.** Word sync may enhance display quality but may not replace line truth, block truth, or marker timing truth.
4. ❄️ **Word sync remains additive.** Line map, alignment data, and marker line sync stay separate layers. Bad alignment degrades to line-only UX, not fabricated precision.
5. ❄️ **Cue and fill semantics remain split.** Consumed by different surfaces for different UX reasons.
6. ❄️ **Bridges are permanent architecture.** The bridge layer is the synchronization fabric between React runtime, legacy globals, DOM event contracts, CSS-var publication, and policy propagation. Not migration trash. Do not purge for purity.
7. ❄️ **Performance remains orthogonal.** Budget policy stays separate from timing truth, style intent, and theme identity. Performance never alters timing truth.
8. ❄️ **Prepared catalog is a valid product lane.** The system must remain compatible with curated prepared tracks, artifact delivery without live alignment, and backend-later sequencing.

---

## 9. No-Go Zone

🚫 Do not touch without explicit architectural decision:

| Item | Why |
|------|-----|
| Loop system unification | Two surfaces serve different UX needs |
| Cue/fill unification | Split is intentional |
| Runtime container removal/inversion | Runtime still depends on it |
| Boot patch station reshuffle | Boot order matters, hidden timing dependencies |
| Bridge layer purge | Bridges ARE the permanent architecture |
| Blob-layering cleanup without measurement | Accepted reliability residue |
| Legacy wholesale removal | Boundary shells preserve identity contracts |
| Additive sync redesign | Proven and frozen |
| Transport rewrite | Hardened; needs instrumentation, not rewrite |
| Backend-first push | Prepared catalog mode comes first |

---

## 10. Misconceptions — What Must Not Be Rebuilt

Do not rebuild the system around these:

1. "We should remove all globals first." — **Wrong.** Globals serve as boundary identities.
2. "Stores should become the only truth everywhere." — **Wrong.** Some stores are mirrors, not authorities.
3. "Scheduler should own timing." — **Wrong.** Scheduler is publication only.
4. "Word sync should replace marker line sync." — **Wrong.** Word sync is additive.
5. "Sync Editor loop and TrackMap loop must be unified immediately." — **Wrong.** Separate product surfaces with different ownership semantics.
6. "Legacy shells prove migration is incomplete." — **Wrong.** They prove compatibility boundaries are consciously preserved.

---

## 11. Decision Doctrine

Every change is first classified into one of five categories:

1. **Contract fix** — event target mismatch, stale persistence path, compat getter exposure. Usually safest and highest-ROI.
2. **Boundary compat fix** — shell method completion, surface mismatch. Handle carefully: touches compatibility surfaces.
3. **Instrumentation-first issue** — drift anomalies, suspected publication races. Do not refactor before measuring.
4. **Product lane completion** — catalog, artifact bundling, delivery. Strategic completeness, not bug fixing.
5. **No-go speculative cleanup** — loop unification, bridge removal, container inversion. Reject unless product or evidence strongly forces it.

❄️ Default rule: **if the issue is already known and product-visible, prefer a contract fix. If the issue is only suspected, prefer instrumentation.**

---

## 12. First Questions Before Coding

A specialist should not start by "cleaning things up". Answer first:

1. Who is the authority for this behavior?
2. Is this path transport truth, data truth, or a publication path?
3. Is this split model intentional?
4. Is this boundary shell still actively consumed?
5. Is this a contract fix, a compat fix, or a measurement problem?
6. Is there already a prepared/offline path solving this externally?

If these are not clear, more recon is needed before code changes.

---

## 13. Hot-Path & Publication Doctrine

- ❄️ High-frequency progress flows through CSS variables outside the React tree; low-frequency snapshots go to stores. Keep the hot path out of store churn.
- ❄️ Event target discipline: window events coordinate host/runtime lifecycle; document events coordinate track/content/boundary synchronization. Emit/listen targets must match — target drift is a contract bug.
- ❄️ Recording-safe clamp: during recording, decorative FX budgets are reduced. Policy reacts to session context without touching timing truth.
- ⚠️ Known coupling: the publication scheduler's start/stop lifecycle is owned by a single bridge; if it does not start, all publication participants are dead. Instrument before restructuring.

---

## 14. Product Doctrine

- 🧭 **Guest-first:** the user starts creating instantly; conversion happens through value, not through a fence.
- ❄️ **Three orthogonal domains:** timing truth / style intent / visual budget. Never merge them.
- ❄️ **Two recording systems** (global recording vs takes recording) are related but not identical. Do not collapse them into one boolean.
- 🧭 **Exercises are a quest wrapper over takes.** Stable recipes are visible; experimental ones stay hidden; special lanes get separate entry points. Default learner surface stays intentionally minimal.
- ❄️ **Semantics of absence:** an empty parse result means "this format has no such blocks", NOT "the user deleted them". User-created data tied to the track survives version changes of source content. (Pattern for every future format.)
- 🧭 **Preserve the entry, redirect inside:** when migrating a surface, keep the old entry point and redirect into the new runtime; keep the surrounding ecosystem stable.

---

## 15. Final Interpretation

The biggest mistakes are no longer "missing subsystem" or "unmigrated legacy core". The biggest mistakes now would be:

- touching frozen split models without recognizing them
- breaking boundary identity contracts
- confusing mirrors with authorities
- treating offline artifact production and runtime consumption as one layer
- rewriting strong foundations instead of fixing ambiguous contracts

Current complexity lives at the seams (policy seams, compatibility-sensitive surfaces, multi-surface ownership edges), not at the center. Growth — catalog productization, backend services, richer scenes, deeper performance tiers — should be layered ON TOP of the authority model, not achieved by resetting it.

---

## 16. System One-Liner

> **beLive is a mature hybrid runtime where preserved legacy globals provide identity and boundary compatibility, while the React/TypeScript layer owns real product behavior through orchestrators, bridges, stores, scheduler publication, and durable synchronized track artifacts.**

---

## 17. Glossary

| Term | Meaning |
|------|---------|
| **Identity boundary** | Legacy global object preserving identity while the new runtime owns behavior |
| **Runtime authority** | The actual decision-maker in live runtime |
| **Publication path** | How truth reaches store/UI/DOM |
| **Policy owner** | Who owns intent/rules (not raw state) |
| **Split model** | Intentional dual-surface design serving different needs |
| **Protective residue** | Preserved compatibility element — scan before removing |
| **Accepted residual layering** | Non-ideal but tolerable implementation layer |
| **Fill-truth** | Exact word timing for progress FX (no lookahead) |
| **Cue-truth** | Early-feel word timing for responsive highlight |
| **Block Cue** | First line of the NEXT block (not "next line" in flow) |
| **Settled** | Past words shown as quiet history, not competing with active |
| **Prepared catalog** | Batch-processed tracks with pre-baked sync artifacts |
| **Staged boot** | Legacy globals → patch layer → React bridges → product flows |

---

*Doctrine extracted 2026-08-28. Sources frozen as 🕰️ historical record; facts migrate to machine-verifiable registries.*
