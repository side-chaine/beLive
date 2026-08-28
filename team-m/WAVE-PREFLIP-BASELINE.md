# 📊 PRE-FLIP BASELINE · срезка Легаси (замер 2026-08-26, Hub 007)
> Опорная точка «ДО» для гейта каждой волны. Источник истины: живой репо на ветке `backup/win-V3-finish_2-2026-08-23`.

## Канон
- tsc ошибок: **306**
- vitest passed: **772** (2 legacy-файла вне канона = прежние)
- PARITY: `npm run verify:parity` (scripts/verify-bridge-parity.ts) — инфраструктура ЕСТЬ, статус см. прогон.
- Frozen-guard: `node team-m/bLb/frozen-guard.mjs` — исправлен (ESM `__dirname`→`import.meta.url`), см. результат ниже.

## SHA256 frozen-файлов (ДО)
Полный список сохранён: `/tmp/opencode/frozen-baseline-sha.txt`
Контрольные (ключевые frozen-файлы):
- `src/audio/core/AudioEngineV2.ts`  c5311543…ed6f92
- `src/audio/compat/patchV1.ts`      0e599c34…924a30
- `src/services/track.orchestrator.ts` b8818e66…199bd
- `src/bridges/lyrics.bridge.ts`     059944b4…34aa7
- `src/bridges/live-guard.ts`        a87b3fd2…86ba8
(полный список 19 файлов в /tmp-файле; при исполнении волн SHA256 ДО/ПОСЛЕ должен совпадать побайтово)

## Frozen-guard baseline (26.08)
🔴 **RED — 5 нарушений (вне allowlist)** = BAC-105 V2-глобал ридеры (цель WAVE1/WAVE5):
1. `src/audio/featureFlag.ts:3` → `window.audioEngine`
2. `src/foundation/event-bus/wrappers/audio-events.ts:16` → `window.audioEngine`
3. `src/foundation/reactions/stem-engine-sync.ts:58` → `window.audioEngine`
4. `src/main.tsx:454` → `window.lyricsDisplay`
5. `src/Rehearsal/bridge/rehearsal-trigger.bridge.ts:119` → `window.audioEngine`

## Pre-wave grep-аудит (baseline counts, «ДО»)
| Маркер | Сейчас | Якорь в паке Мака | Волна |
|---|---|---|---|
| `tryActivateV2` (src) | 3 | 0 | W1 |
| `patchV1` в featureFlag.ts | 2 | 0 | W1 |
| `delegateSync` файлов (non-test) | 11 | 0 | W2 |
| `V2Adapter` файлов (после def/barrel) | 18 | 0 | W2/W4 |
| `track.orchestrator` живых импортёров | 3 (MixerPanel:180, QuickActions:214, track.actions:7) | 0 | W4 |
| `window.*` V2-глобалов (true reach) | 62 файла / ~250+ точек чтения (audioEngine~40, lyricsDisplay~22, trackCatalog~17, markerManager~17, app~9, waveformEditor~6, liveMode~1, __belive~1) | 0 | W1/W5 |
| `__restoreV2Engine` | 2 | 0 | W5 |
| `live-mode.stub`/`waveformEditor.stub` | 2 | 0 (BAC-107) | W5 |
| `__switchToV3`/`V2AudioCage`/`ResurrectionDetector` | 29 | 0 | W3 |

> ⚠️ СТАРЫЕ СЧЁТЧИКИ (delegateSync 23, V2Adapter 27, глобалы 9/12, orchestrator 7) = **grep-артефакт** прямого `window.X`. **АУДИТ 26.08 (REPORT-MIGRATION-AUDIT-2026-08-26.md):** delegateSync 11 (non-test), V2Adapter 18, глобалов **62 файла/~250+ точек**, orchestrator 3 живых. **Гейт волн = `grep → 0`**, не точное число. Завершение волн — ТОЛЬКО по исправленным гейтам (иначе False-Green DONE).

## TODO (Phase-0, Hub)
- [x] (i) SHA256 baseline снят
- [x] (iii) PARITY инфра существует (verify:parity)
- [x] (iv) шаблон отчёта Ц3 — `WAVE-C3-REPORT-TEMPLATE.md`
- [x] прочитать 5 wave-паков Мака
- [x] починить Frozen-guard (ESM)
- [x] pre-wave grep-аудит + baseline-doc
- [ ] (ii) boot-smoke CDP V1/V5 harness (Playwright в devDeps — построить)
- [ ] (v) освежить списки файлов в wave-паках под живые числа
