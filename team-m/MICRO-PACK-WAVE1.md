# 🌊 MICRO-PACK-WAVE1 · activation cut + V2-globals re-point · handoff (design, FIXED per 009)
> Источник: FINAL-ROADMAP-draft.md §2 + вериф. 009 (26h). Применяет: Hub(007) post-M3-GO. Frozen: НЕ трогать.
> Якоря: канон 306/772; frozen read-only; Frozen-guard GREEN после пака.

## ЦЕЛЬ
Leaves-first, ДВА блока сразу (REGISTRY §7:29: глобалы + бутстрап = ПЕРВЫЕ):
1. **Cut branch** V2-активации: `App.tsx:93–101 → featureFlag.ts → patchV1.ts → AudioEngineV2.ts` (Босс подтвердил CUT, не glush).
2. **BAC-105:** ре-поинт 12 ридеров V2-глобалов (`window.audioEngine/.app/.trackCatalog/.liveMode/.lyricsDisplay/.markerManager/.waveformEditor`) на V3-state/E1-предикат — СРАЗУ после среза бутстрапа. Иначе после W1 глобалы `undefined` → краш boot-smoke волн 2–4.

## ПРАВИТЬ (SAFE)
- `src/App.tsx:93–101` — убрать `tryActivateV2()`.
- `src/audio/featureFlag.ts:6` — удалить импорт `→ patchV1`.
- `src/audio/engine-v3/legacy/*` НЕТ — см. W4. 12 ридеров V2-глобалов (точный список grep'ом при исполнении; известные: `mode-switch.service`, `block-scene.service`, `track.actions`, `FullAvatar`, `useStemWaveform`, `useBackgroundManagers`, `trigger-visual`, `MonitorMixPanel`, `upload.service`, …) → заменить на V3-state/через `E1`-предикат/env, либо удалить чтение глобала.

## НЕ ТРОГАТЬ (Frozen)
`patchV1.ts`, `AudioEngineV2.ts`, `bridges/*`, `track.orchestrator.ts` — read-only.

## ГЕЙТ
1. канон 306/772 + PARITY PASS.
2. boot-smoke CDP V1/V5 (V3 стартует, глобалы не читаются как undefined).
3. SHA256 frozen ДО/ПОСЛЕ идентичен.
4. ⛔-отчёт Ц3.
5. `grep -rnF "tryActivateV2" src` → 0; `grep -rnF "patchV1" src/audio/featureFlag.ts` → 0.
6. `grep -rnE "window\.(audioEngine|app|trackCatalog|liveMode|lyricsDisplay|markerManager|waveformEditor)" src` среди SAFE → 0.

## ТЕСТЫ
- App в 'v3', V2-бутстрап мёртв, 12 ридеров не падают на undefined.
- Frozen-guard: 0 новых (track.actions/QuickActions/MixerPanel ещё в allowlist до W4).

## СТАТУС
Дизайн (FIXED). Применение — post-M3-GO (R6).
