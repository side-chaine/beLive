# 🌊 WAVE-FROZEN-INVARIANTS · byte-identical frozen + safe-scope per wave
> Автор: 007_Мак (Far Light). Задача Hub (26g Task 2). read-only спека проверок для верификации цепью 001→002→009 при исполнении волн. Опирается на MICRO-PACK-WAVE1..5.md.

## FROZEN-СПИСОК (SHA256 ДО/ПОСЛЕ — идентичен на КАЖДОЙ волне)
Любая волна НЕ правит frozen. Инвариант: `sha256sum` каждого файла ДО == ПОСЛЕ.
- `src/audio/core/AudioEngineV2.ts`
- `src/audio/compat/patchV1.ts`
- `src/services/track.orchestrator.ts`
- `src/bridges/**` (все файлы под `src/bridges/`, включая `live-guard`, `audio-reactive.bridge`, `blocks.bridge`, `__tests__/*`)
- `_`-поля внутри frozen-файлов (часть тех же файлов, отдельно не хэшируются)

Проверка: `find src/audio/core/AudioEngineV2.ts src/audio/compat/patchV1.ts src/services/track.orchestrator.ts src/bridges -type f | xargs sha256sum` → сравнить ДО/ПОСЛЕ волны. Расхождение = нарушение R6/Фrozen-блока.

---

## WAVE 1 · activation chain cut
- **Frozen byte-identical:** `patchV1.ts`, `AudioEngineV2.ts` (и всё выше).
- **Safe-scope правки:** `src/App.tsx` (строки 93–101, ветка `tryActivateV2`), `src/audio/featureFlag.ts` (строка 6, импорт `./compat/patchV1`).
- **Invariant:** `grep -rnF "tryActivateV2" src` → 0; `grep -rnF "patchV1" src/audio/featureFlag.ts` → 0; frozen SHA256 неизменен.

## WAVE 2 · delegateSync re-point
- **Frozen byte-identical:** `track.orchestrator.ts` (не правим, только перестают звать).
- **Safe-scope правки:** 13 caller-файлов `delegateSync` (точный список снять grep'ом на момент исполнения); `V2Interceptor-wrap` — НЕ удалять, пока жив хоть один caller (пометить `@deprecated`).
- **Invariant:** все оставшиеся `delegateSync`-вызовы указывают на V3-surface (0 на V2-interceptor-wrap, кроме осознанного deprecated); frozen SHA256 неизменен.

## WAVE 3 · demolition
- **Frozen byte-identical:** все (ветка режет SAFE V2-классы).
- **Safe-scope правки:** `__switchToV3`, `wrap`, `V2AudioCage`, `ResurrectionDetector` (удалить); `src/main.tsx:186` restore-ветка → crash-modal/reload (А18); `ae-guard` переориентировать/удалить; `BusFader18 §9` — АННОТАЦИЯ (не удаление, Д-4).
- **Invariant:** `grep -rnE "(__switchToV3|V2AudioCage|ResurrectionDetector)" src` → 0; BusFader18 §9 annotated (контракт-зеркало-тест green); frozen SHA256 неизменен.

## WAVE 4 · orchestrator/bridges/legacy
- **Frozen byte-identical:** `track.orchestrator.ts`, `patchV1.ts`, `AudioEngineV2.ts`, `src/bridges/**` (ВСЕ, read-only; `live-guard` переносится осознанно ВНЕ frozen).
- **Safe-scope правки:** 6 потребителей `src/services/track.actions.ts:7` (re-point на V3); `src/components/MixerPanel.tsx:180` + `src/components/QuickActions.tsx:214` (dyn-import orchestrator → удалить/заменить); `src/services/track.actions.ts` (перестаёт звать orchestrator); `src/audio/engine-v3/legacy/*` + `src/audio/engine-v3/V2Adapter.ts` (УДАЛИТЬ — последний вызыватель умер в Волне 2, Д-3).
- **Invariant:** `grep -rlE "(import|from).*(track\.orchestrator|patchV1)" src` среди SAFE → 0; `V2Adapter.ts` удалён (`grep -rn "V2Adapter" src` → 0); frozen SHA256 неизменен (КРИТИЧНО: bridges/* не тронуты).

## WAVE 5 · finalization
- **Frozen byte-identical:** все (комментарии-V2 в frozen = retain-класс, не блокер).
- **Safe-scope правки:** 12 ридеров V2-глобалов (`mode-switch.service`, `block-scene.service`, `track.actions`, `FullAvatar`, `useStemWaveform`, `useBackgroundManagers`, `trigger-visual`, `MonitorMixPanel`, `upload.service`, …) → заменить на V3-state/E1-предикат; `src/main.tsx` stub `__restoreV2Engine` → удалить; фасад `audio-facade-v3.js` ОСТАВИТЬ; доки (BAC-111).
- **Invariant (Этап 4):** `grep -rlE "(import|from).*(AudioEngineV2|patchV1|track\.orchestrator|V2Adapter)" src --include='*.ts*'` → 0 runtime-imports; `grep -rn "__restoreV2Engine" src js` → 0; frozen SHA256 неизменен; тег `v3-only`.

## ОБЩИЙ GATE (каждой волны, для 009)
канон 306/770 + PARITY PASS + boot-smoke CDP V1/V5 + `sha256sum` frozen ДО/ПОСЛЕ совпал + ⛔-отчёт Ц3 + Frozen-guard GREEN (0 новых).
