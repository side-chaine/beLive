# 442-MICRO-PACK · №17 (Вар.B, DECIDED) · Не двигать блок на остановке записи

> Статус: РЕШЕНО Ц3 (релей 443) — Вар.B. №17 → DECIDED (v3.3-дельта). Юзер подписал desired.
> Инвариант Ц3: «Остановка записи не двигает активный блок. Прогрессия шагов упражнения — остаётся самостоятельным механизмом, управляемым явными действиями.»

## Root (эталон-чек V2, доп4 + релей 443)
- V3 auto-advance = `exercise.store.advanceToNextStep()`, вызывается из `TakesControlStrip.tsx:365` (`handleIntermediateWindowEnd`) как ПОБОЧНЫЙ эффект остановки записи.
- Гейт `if (!exercise) return` внутри `advanceToNextStep` (exercise.store.ts:207) — про отсутствие квеста, НЕ про режим. Не трогаем.
- V2 оставался на блоке (эталон-чек, доп4). V3-introduced, НЕ регрессия.

## Fix (для Оператора)
Файл: `src/takes/components/TakesControlStrip.tsx`
В `handleIntermediateWindowEnd` (около :365) — УБРАТЬ побочный вызов и его комментарий:
- БЫЛО:
```
    // move exercise forward, but keep recorder session alive
    useExerciseStore.getState().advanceToNextStep();
```
- СТАЛО (комментарий заменить, вызов удалить):
```
    // keep recorder session alive (advance is explicit user action, not a side effect of stop)
```
Т.е. `handleIntermediateWindowEnd` больше НЕ двигает блок при остановке записи. Прогрессия шагов упражнения остаётся на `onStepCompleted` (exercise.store.ts:359) / `skipStep` (:290) / `ExerciseStrip` onClick (:107) — явные действия юзера.

## Proof-of-change (две половины, ОБЕ обязательны — стандарт Ц3)
- Половина 1 (юзер, браузер): запись → стоп → UI остался на блоке, зелёный best горит (TASK-009), клик играет тейк — БЕЗ посторонних действий.
- Половина 2 (код-аудит + юзер): обычный пошаговый квест БЕЗ записи прогрессирует как раньше (onStepCompleted/skipStep/ExerciseStrip ещё зовут advanceToNextStep). Фикс, ломающий прогрессию, должен упасть на proof-стадии, не в проде.
  - Код-аудит (007, grep): `advanceToNextStep` ещё вызывается в exercise.store.ts:291 (skipStep), :360 (onStepCompleted) и ExerciseStrip.tsx:107 (onClick). Явная прогрессия жива. ✅

## FROZEN-верификация (норма §4а: метод + файлы)
- Затронутый файл: 1 — `src/takes/components/TakesControlStrip.tsx`.
- Не входит в §2.1 frozen (AudioEngineV2, patchV1, bridges/*, track.orchestrator, private _).
- `src/bridges/lyrics.bridge.ts`, `src/audio/compat/patchV1.ts` — ТОЛЬКО чтение (эталон-чек V2, доп4). Не правились.

## Verification (Оператор)
- tsc --noEmit = 314; vitest run = 749/749.
- Половина 1 proof = браузер-ретест юзера (запись → остаёмся на блоке, тейк зелёный, проигрывается).
