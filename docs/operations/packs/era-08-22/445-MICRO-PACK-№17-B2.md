# 445-MICRO-PACK · №17-B2 (GO Ц3)

**Цель:** убрать побочный авто-advance при остановке записи (Вар.B, Ц3 GO релей). Прогрессия шагов остаётся ЯВНОЙ через `ExerciseStrip.tsx:107` (onClick `advanceToNextStep`) / `skipStep` / ручной `onStepCompleted`.

**Урок 442 (петка-норма #3, поведенческая):** перед вырезом перечислены ВСЕ триггеры причинного действия (`grep onStepCompleted/advanceToNextStep`): живые коллеры = `exercise-events.ts:23` (Track before-change, НЕ трогать — отдельный скоуп) и `:39` (recording-stop — цель B2). `TakesControlStrip.tsx:365` уже удалён 442 (безвредно).

## File
`src/foundation/event-bus/wrappers/exercise-events.ts` — НЕ frozen (правка допустима).

## Edit
Удалить блок `:37-40` (комментарий + if):
```
    // recording → completed step
    if (prevIsRecording && !isRecording && exercise.phase === 'recording') {
      exercise.onStepCompleted()
    }

```
(NEW = пусто, т.е. удалить целиком). Сохранить:
- `:19-24` (Track before-change `onStepCompleted`) — НЕ трогать (решение Ц3).
- `:32-35` (pre-recording → recording: `exercise.setPhase('recording')`).
- `:42` (`prevIsRecording = isRecording`).

## Rationale
`prevIsRecording` по-прежнему отслеживает переход для `:32-35`. Блок `:37-40` был единственным побочным вызовом `advanceToNextStep` на остановке записи → прыжок на след. блок. Его удаление = прогрессия только по явному действию юзера (ExerciseStrip / skip / onStepCompleted-ручной). `grep` подтверждает: после удаления живых коллеров `onStepCompleted` на остановке записи не остаётся (`TakesControlStrip:365` уже убран 442).

## Verification (канон А4)
- `tsc --noEmit` = 314 (diff IDENTICAL).
- `vitest` files 61/63 (2 legacy load-error), tests 749/749.
- **Proof-of-change (гейт Ц3, ОБЕ половины обязательны, ретест юзера в браузере):**
  1. Запись → стоп → UI **остаётся на том же блоке**, зелёный best горит, тейк играется кликом.
  2. Обычная пошаговая прогрессия квеста **БЕЗ записи** работает (клик «далее»/skip двигает шаги). Вторая половина обязательна (B-вариант существовал ради сохранения прогрессии).

## FROZEN-OK
`exercise-events.ts` не в frozen-списке (`AudioEngineV2` / `patchV1` / `bridges/*` / `track.orchestrator` / private `_`).
