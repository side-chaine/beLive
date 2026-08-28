---
status: DRAFT candidate (research/brief — NOT applied) · 2026-08-25 · agent: 007_Hub
basis: arch-scout B1 run (v3 event-emission survey)
decision: DECIDED by Ц3 25.08 — emit from router per V2 etalon (AudioEngineV2.ts:1553-1557)
---

# MICRO-PACK-B1 — v3 missing V2 CustomEvent emitters

## Problem (P1, actionable — non-frozen)
Under `VITE_ENGINE=v3`, V2 document-CustomEvents have NO emitter for exactly 3 events:
- `track-stem-ready` — only in frozen `AudioEngineV2.ts:175,994`
- `track-fully-loaded` — only in `AudioEngineV2.ts:204,953,1017` (v3 emits `track-loaded`, a DIFFERENT name)
- `vocalmix-state-changed` — only in `AudioEngineV2.ts:1554`

Consumers that go silent under V3-only: `src/bridges/audio.bridge.ts:160` (onStemReady), `:109/:217` (applyStemsMute/onFullyLoaded), `:220` (onVocal), `PitchTab.tsx:270`.

VERIFIED: v3 DOES re-emit `playback-state-changed` (V3StatePublisher.ts:109,131), `loop-set`/`loop-cleared` (TransportV3.ts:264,281), `loopcompleted` (V3StatePublisher.ts:159), `track-loaded` (V3DataInterceptor.ts:206,212). So this is NOT a full break — only these 3 names.

## Fix (additive dispatch, non-frozen)
In `src/audio/engine-v3/integration/V3DataInterceptor.ts` `loadTrack()` (after the `track-loaded` dispatch ~:206/:212):
- dispatch `window.CustomEvent('track-stem-ready', {detail})` when stems become ready;
- dispatch `window.CustomEvent('track-fully-loaded', {detail})` after load completes (bridge-compat alias of track-loaded).
For `vocalmix-state-changed` (Ц3 DECIDED 25.08): V3 HAS vocal-mix = v-Mix (TASK-015 ✅, закрыто ушами). Эмиттер = ВЛАДЕЛЕЦ состояния = MonitorRouter (не ControlDeck, не V3DataInterceptor). Зеркалим V2-эталон 1:1 (`AudioEngineV2.ts:1553-1557`): `document.dispatchEvent(new CustomEvent('vocalmix-state-changed', { detail: { enabled: on } }))` — вызывать в `MonitorRouter.setVMix(on)`. Через `document.dispatchEvent`, чтобы `audio.bridge.ts:220` (`addEventListener`) работал 1:1 без правок bridge. payload = `{ enabled: boolean }` (event-bus/types.ts:22).

## FROZEN — DO NOT TOUCH
`AudioEngineV2.ts` (frozen) — we only ADD emitters in v3 integration layer, never edit V2.

## Verify
- `audio.bridge` onStemReady / onFullyLoaded / onVocal fire under `VITE_ENGINE=v3`.
- `npx tsc --noEmit` → 0 new (baseline 313); `npx vitest run` → 769.

## Decision (Ц3 25.08 — все три DECIDED)
- `track-stem-ready` + `track-fully-loaded`: применять безусловно (additive, bridge-compat) из V3DataInterceptor (per E2).
- `vocalmix-state-changed`: применять — эмиттить из `MonitorRouter.setVMix(on)` (владелец состояния), payload `{enabled:on}` 1:1 с V2-эталоном, через `document.dispatchEvent`. Bridge-консьюмер `audio.bridge.ts:220` работает без правок.
- Frozen: НЕ трогаем AudioEngineV2; только additive эмиттеры в V3-слое.
