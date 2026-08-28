---
status: FINAL (consolidated from MAC S7 §7, revised per 009 gate) · 2026-08-25 · agent: 007_Hub (Near Light)
basis: MAC S7 (5aa6487) + 002 adversarial + arch-scout design + 009 DOC-CHECK
APPLIES ONLY AT FULL LIGHT: E1 done (VALID) + canon 313/769 GREEN + 009 GO.
---

# MICRO-PACK-B-SLICE · FINAL

## Scope
Fix only the **2 FAIL** from 002 adversarial: **E5** (cascade re-zero) + **E8** (StemChain double-writer).
- **E1 predicate** applied SEPARATELY first (single writer `src/main.tsx:148`, 28 sites, VALID).
- **R1 zombie-window** → escalated to **Ц3**, OUT of this pack.
- **E6** (reconciliation H4.1) INCLUDED: remove volume guard-wrappers so revived writers are not swallowed.

## Edits (NON-FROZEN only)

### 1. `src/main.tsx` — delegateSync monkey-patch (~lines 131-151)
BEFORE the `_v3Active` flag branch, add unconditional master-volume block:
```ts
if (method === 'setInstrumentalVolume' || method === 'setVocalsVolume') {
  warn('[delegateSync] master-volume blocked');
  return;
}
```
Authorized UI-master writes go via direct `ae.*` after E6 (bypass channel) — unaffected. Closes cascade at `main.tsx:237-238` (switch-to-V3 calls delegateSync volume=0 BEFORE flag set). Expect console: **3× `[delegateSync] master-volume blocked`** at cage watchdog (×3).

### 2. `src/main.tsx` — E6 reconciliation (:290-291)
Remove the two guard wrappers:
```ts
__guardAeMethod('setInstrumentalVolume');
__guardAeMethod('setVocalsVolume');
```
(`setStemVolume`/`setStemsEnabled` guards stay). Reason: after revival these are live writers; the wrapper swallows legit UI writes (ControlDeck/TakesPanel).

### 3. `src/audio/engine-v3/pipeline/StemChain.ts`
- `setStemVolume` (~:80-83) → **rejecting stub**: `warn('[StemChain] disabled (E8b): use pipeline.setStemVolume')`; keep signature, no `stem.volume` write.
- `muteStem` (~:74-77) → same rejecting stub.
- `_applySolo` (~:95-103) → **REMOVE direct `stem.volume` writes**; keep mask bookkeeping (`_soloed.add/delete`) + `isSoloActive()/isStemAudible()`. Single writer stays `_applyEffectiveGain` (`HybridPipelineService.ts:631-638`) which already recomputes all gains reading the mask.

### 4. `src/audio/engine-v3/pipeline/HybridPipelineService.ts` (:552-556)
Doc comment: `soloStem` loop only `chainA` (pre `_chainB.outputNode`). No logic change.

### 5. `src/audio/engine-v3/pipeline/__tests__/BusFader18.test.ts`
- Edit `installGuard` (:365-381): guard list → only `'setStemVolume'`, `'setStemsEnabled'`.
- Edit case (:393): narrow to two methods; add `ae.setInstrumentalVolume(0.9); expect(origInst).toHaveBeenCalledTimes(2)`.
- Replace case (:424) with inverted contract: `delegateSync('setInstrumentalVolume',0)` does NOT reach forwarder; `delegateSync('setStemMute',...)` does; direct `ae.setInstrumentalVolume(1)` reaches original.
- **+2 cases**: (a) master-zero via delegateSync at `__v3Active=false` NOT reaching forwarder; (b) `_busVolumes` unchanged by blocked cascade.

## FROZEN — DO NOT TOUCH
`AudioEngineV2.ts`, `patchV1.ts`, `src/bridges/*`, `track.orchestrator.ts`, `_`-prefixed privates.
Parity read of `src/bridges/lyrics.bridge.ts:118-128` for `[GUARD]` is assessment only (no edit).

## Verify (Near Light)
- `npx tsc --noEmit` → 0 new errors (baseline 313).
- `npx vitest run` → 769 pass; BusFader18 green.
- Console (`VITE_ENGINE=v3`): exactly **3× `[delegateSync] master-volume blocked`** at cage activation; **ZERO** `[№18-BUS] ae.set*Volume ignored` for revival members (E6 removal ensures this).
- `window.__belive.pipeline` present (E1 guarantees single AudioContext via `main.tsx:100` + `HPS.get ctx()`).

## Order
**E1 (separate, VALID) → this B-slice (E5+E6+E8) → R1 (Ц3).**
Operator applies only at full light (Far+Near ready + canon GREEN + 009 GO). Base must be CLEAN (no uncommitted `MonitorRouter`/`HybridPipelineService` F-2 overlap + PC v-Mix hunks) before apply.
