# 🌊 MICRO-PACK-WAVE1 · activation chain cut · handoff (design)
> Источник: FINAL-ROADMAP-draft.md §2 Этап 3 Волна 1 (001, вериф. 002/009). Применяет: Hub(007) post-M3-GO. Frozen: НЕ трогать.
> Якоря: канон 306/770; frozen patchV1/AudioEngineV2 read-only; после пака — Frozen-guard GREEN (новых safe→frozen импортов нет).

## ЦЕЛЬ
Вырезать ветку V2-активации (leaves-first): `App.tsx:93–101 → featureFlag.ts → patchV1.ts → AudioEngineV2.ts`. Подтверждено Боссом (вопрос B): **CUT BRANCH**, не glush-by-engine-mode. Отдельный guard на `tryActivateV2` не нужен — режется вместе с цепью.

## ПРАВИТЬ (SAFE-файлы)
- `src/App.tsx:93–101` — убрать ветку `tryActivateV2()` (вызов `App.tsx:95/96`), оставить V3-only путь инициализации.
- `src/featureFlag.ts:6` — удалить импорт `→ patchV1` (и сам вызов V2-бутстрапа). featureFlag остаётся как переключатель режима, но без V2-ссылки.
- Этап 2 (флип, вариант «в») уже застабил `import.meta.env.VITE_ENGINE ??= 'v3'` в `src/test/setup.ts` — Wave 1 завершает вырез ветки в прод-коде.

## НЕ ТРОГАТЬ (Frozen)
`patchV1.ts`, `AudioEngineV2.ts` — только чтение. Никаких правок внутри.

## ГЕЙТ ВОЛНЫ
1. tsc=306 ∧ set-diff vs `scripts/known-ts-errors.txt`(144)=∅ ∧ vitest=770 passed ∧ `verify:ci` PARITY PASS.
2. boot-smoke CDP V1/V5 (V3 стартует, звук есть).
3. SHA256-инвентарь frozen ДО/ПОСЛЕ — идентичен (frozen не менялся).
4. ⛔-отчёт Ц3 (4 точки: featureFlag:10 вызов App:95, birth App:97/:99, autoplay-timer orchestrator:474–478 frozen read).
5. `grep -rnF "tryActivateV2" src` → 0; `grep -rnF "patchV1" src/featureFlag.ts` → 0.

## ТЕСТЫ
- App монтируется в 'v3' mode без вызова V2-бутстрапа.
- Frozen-guard: 0 новых нарушений (track.actions/QuickActions/MixerPanel не тронуты здесь).
- Регресс: ear-сессия (Этап 1) не сломана.

## СТАТУС
Дизайн готов. Применение — ТОЛЬКО post-M3-GO по санкции Босса (R6). До GO — только подготовка/ревью через 001/002/009.
