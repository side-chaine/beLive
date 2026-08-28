---
status: DRAFT candidate (research/brief — NOT applied) · 2026-08-25 · agent: 007_Hub
basis: arch-scout A1/A2 run (contract phantom methods)
severity: P2 (no production callers today; future mine)
---

# MICRO-PACK-A1A2 — V2PublicContract phantom methods

## Problem (P2, actionable — non-frozen)
`src/audio/engine-v3/IV2PublicContract.ts` declares methods that do NOT exist in frozen `AudioEngineV2.ts` (only live in `src/stem/stem.store.ts`):
- `setStemPan(stemId, pan)` — `IV2PublicContract.ts:33`, whitelisted `:90`
- `setStemsMode(mode)` — `:34`, whitelisted `:91`

`V2Adapter.delegateSync` (`:57`) does `(v2 as any)[method]?.(...)` — passes the PUBLIC_METHODS guard, then silently no-ops on a non-existent V2 method. `stem-engine-sync.ts:195,259` sends pan via `safeDelegate(v2,'setStemPan')` — lost silently (no throw, so even no warn). Contract header itself warns this is Tier-3 if method absent.

Bonus: `setStemsMode` signature mismatch (contract `'performance'|'studio'` vs store `boolean`).

No production caller of `store.setStemPan` exists (only a test); no `StereoPannerNode`/`.pan=` path exists anywhere in `src/audio` — so user loses nothing TODAY. But any future pan-slider becomes a silent no-op mine.

## Fix (contract hygiene, non-frozen)
Edit `src/audio/engine-v3/IV2PublicContract.ts`:
- remove `:33-34` (interface declarations);
- remove `:90-91` (PUBLIC_METHODS entries);
- mark `setStemsMode` retired (dup of `stemsEnabled`, wrong type) in a comment.
Keep pan store-only until `pipeline.setStemPan` exists (FR-007 immutable routing).

## FROZEN — none touched.

## Verify
- `npx tsc --noEmit` → 0 new (313); `src/stem/__tests__/stem.store.test.ts` green.

## Decision
Cheap 4-line hygiene; bundle into next pack batch. Escalate to P1 the moment a pan UI is added.
