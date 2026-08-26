# 🌊 WAVE-FROZEN-INVARIANTS · byte-identical frozen + safe-scope per wave (FIXED per 009)
> Автор: 007_Мак (Far Light). Спека проверок для верификации цепью 001→002→009. Опирается на MICRO-PACK-WAVE1..5.md (исправлены по вердикту 009, 26h).

## FROZEN-СПИСОК (SHA256 ДО/ПОСЛЕ — идентичен на КАЖДОЙ волне)
Любая волна НЕ правит frozen. `live-guard` НЕ перемещать (файл остаётся под `src/bridges/`).
- `src/audio/core/AudioEngineV2.ts`
- `src/audio/compat/patchV1.ts`
- `src/services/track.orchestrator.ts`
- `src/bridges/**` (все файлы, вкл. `live-guard`, `audio-reactive.bridge`, `blocks.bridge`, `__tests__/*`)
- `_`-поля внутри frozen-файлов.

Проверка: `find src/audio/core/AudioEngineV2.ts src/audio/compat/patchV1.ts src/services/track.orchestrator.ts src/bridges -type f | xargs sha256sum` → сравнить ДО/ПОСЛЕ. Расхождение = нарушение R6.

---

## WAVE 1 · activation cut + BAC-105 (V2-globals re-point)
- **Frozen byte-identical:** `patchV1.ts`, `AudioEngineV2.ts` (+ всё выше).
- **Safe-scope:** `src/App.tsx` (93–101, `tryActivateV2`); `src/audio/featureFlag.ts` (6, импорт patchV1); **12 ридеров V2-глобалов** (точный список grep'ом; известные: mode-switch.service, block-scene.service, track.actions, FullAvatar, useStemWaveform, useBackgroundManagers, trigger-visual, MonitorMixPanel, upload.service, …) → V3-state/E1-предикат.
- **Invariant:** `tryActivateV2`→0; `patchV1` в featureFlag→0; `window.<V2-global>` в SAFE → 0. frozen SHA256 неизменен.

## WAVE 2 · delegateSync (21) + V2Adapter (17) re-point
- **Frozen byte-identical:** `track.orchestrator.ts`.
- **Safe-scope:** 21 caller `delegateSync` + 17 импортёров `V2Adapter` (main.tsx:129–136, MonitorRouter.ts:266, DuckGuardV3.ts:27, foundation/*, components/*, hooks/*, takes.time, legacy/*, WaveformCanvas, …) → V3-surface. `V2Interceptor-wrap` + `V2Adapter.ts` НЕ удалять (до последнего caller).
- **Invariant:** `delegateSync`→V3-surface (0 на V2-wrap кроме deprecated); `grep -rln "V2Adapter" src` → только сам файл (импортёров 0, готов к W4). frozen SHA256 неизменен.

## WAVE 3 · demolition
- **Frozen byte-identical:** все.
- **Safe-scope:** `__switchToV3`, `wrap`, `V2AudioCage`, `ResurrectionDetector` (удалить); `src/main.tsx:186` restore-ветка → crash-modal (зависит FALLBACK-pack b13de92); `ae-guard` (подтвердить НЕ в bridges/* до правки) → V3/удалить; `BusFader18 §9` АННОТАЦИЯ (не удаление).
- **Invariant:** `__switchToV3/V2AudioCage/ResurrectionDetector`→0; BusFader18 §9 annotated. frozen SHA256 неизменен.

## WAVE 4 · orchestrator re-point + legacy(8)/V2Adapter delete
- **Frozen byte-identical:** `track.orchestrator.ts`, `patchV1.ts`, `AudioEngineV2.ts`, `src/bridges/**` (live-guard НА МЕСТЕ, не moved).
- **Safe-scope:** 6 потребителей `track.actions.ts:7` (re-point); `MixerPanel.tsx:180` + `QuickActions.tsx:214` dyn-import orchestrator (удалить); `track.actions.ts` (перестаёт звать orchestrator); `V2Adapter.ts` УДАЛИТЬ ТОЛЬКО если `grep -rln "V2Adapter" src`→0; `src/legacy/engine-v3/*` (**8 файлов**, BAC-112) удалить.
- **Invariant:** safe→frozen импорты (track.orchestrator/patchV1) → 0; `V2Adapter` grep→0 (файл удалён); `src/legacy/engine-v3/*` удалён; frozen SHA256 неизменен (live-guard на месте).

## WAVE 5 · finalization + BAC-107
- **Frozen byte-identical:** все (комментарии-V2 = retain-класс).
- **Safe-scope:** **BAC-107** — удалить `live-mode.stub`/`waveformEditor.stub` (`main.tsx:9–10`) + закрыть `facade.ts:51` FIXME; `main.tsx` `__restoreV2Engine` stub → удалить; фасад `audio-facade-v3.js` ОСТАВИТЬ; доки (BAC-111). BAC-105 уже в W1.
- **Invariant (Этап 4):** runtime-imports frozen → 0; `__restoreV2Engine`→0; BAC-107 stubы удалены; frozen SHA256 неизменен; тег `v3-only`.

## ОБЩИЙ GATE (каждой волны)
канон 306/770 + PARITY PASS + boot-smoke CDP V1/V5 + `sha256sum` frozen ДО/ПОСЛЕ совпал + ⛔-отчёт Ц3 + Frozen-guard GREEN (0 новых).
