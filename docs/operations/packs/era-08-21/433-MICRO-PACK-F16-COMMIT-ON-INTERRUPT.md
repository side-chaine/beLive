# 433-MICRO-PACK-F16 — COMMIT-ON-INTERRUPT: тейк больше не выбрасывается на границе блока

**Диагноз (432-репорт пользователя, квест):** запись блока доходит до конца → автопереход квеста дёргает `interruptPracticeSession()` (активная практика) → `handlePracticeInterrupt`: **шаг 3** чистит `timeCheckRef` (автостоп убит), **шаг 4** делает `recorder.cancel()` — «Do NOT commit partial blob» → блоб выброшен, слот пуст, ноль ошибок. Детерминированная потеря тейка при каждом блоке квеста.

**Семантика фикса:** прерванная запись КОММИТИТСЯ через штатный `handleStop` (тот же путь blob→decode→ready). Частичный тейк лучше потерянного. Вне активной практики поведение не меняется (handlers не вызываются).

**Ловушка (причина раннего return):** шаги 5–7 хендлера синхронно стирают analyser и `recordingSlot`, а коммит в `handleStop` асинхронен и читает `recordingSlot` ПОСЛЕ `await recorder.stop()` → если шаги выполнить, тейк снова теряется. Поэтому при делегировании в `handleStop` — немедленный `return`.

---

## EDIT 1 — `src/takes/hooks/usePracticeInterrupt.ts`: опция handleStopRef

1а. В интерфейс `UsePracticeInterruptOptions` после строки:

```ts
  recorderRef: React.MutableRefObject<any>;
```
добавить:

```ts
  handleStopRef?: React.MutableRefObject<() => void>;
```

1б. В деструктуризации параметров функции после:

```ts
  recorderRef,
```
добавить:

```ts
  handleStopRef,
```

## EDIT 2 — `src/takes/hooks/usePracticeInterrupt.ts`: шаг 4 → коммит

Блок:

```ts
    // 4. Cancel active recorder if recording is in progress
    // Do NOT commit partial blob - just cancel
    if (recorderRef.current?.isRecording) {
      recorderRef.current.cancel();
      recorderRef.current = null;
    }
```
заменить на:

```ts
    // 4. Recording in progress: COMMIT через штатный handleStop (F-1.6, 433).
    // Раньше здесь был cancel() без сохранения блоба: на границе блока в квесте
    // автопереход дёргал interrupt раньше автостопа (шаг 3 уже убил timeCheck)
    // и тейк терялся целиком. Коммит идёт через ту же ветку blob→decode→ready.
    // ⚠️ Делегирование = немедленный return: шаги 5-7 ниже синхронно стирают
    // analyser/recordingSlot, которые асинхронный коммит ещё прочитает.
    if (recorderRef.current?.isRecording) {
      if (handleStopRef?.current) {
        try {
          handleStopRef.current(); // async: сам остановит рекордер, занулит ref, закоммитит take
        } catch {
          try { recorderRef.current?.cancel(); } catch {}
          recorderRef.current = null;
        }
        return;
      }
      try { recorderRef.current.cancel(); } catch {}
      recorderRef.current = null;
    }
```

## EDIT 3 — `src/takes/components/TakesControlStrip.tsx`: передать handleStopRef

В вызове хука (после строки `recorderRef,` в объекте опций, ~:108) добавить:

```ts
    handleStopRef,
```

---

## ВЕРИФИКАЦИЯ (формула А4)
1. `npx tsc --noEmit` → 314; diff error sets vs HEAD — IDENTICAL.
2. `npx vitest run` → files 61/63 (2 legacy load-error), tests 749/749.
3. Отчёт: файлы, числа, отклонения (анкор не нашёлся — СТОП).

## ОЖИДАЕМЫЙ ЭФФЕКТ (проверит пользователь)
1. Квест: записал блок → автопереход → вернулся → Take 1 кликабелен и играется (даже если запись прервалась чуть раньше конца — сохранится частичный).
2. Ручной уход (клик по вагону) во время записи → тейк сохраняется частичным вместо исчезновения.
3. Вне квеста поведение без изменений.

## ВНЕ СКОУПА
- Персистентность тейков между перезагрузками страницы (in-memory by design) — отдельное решение Ц3.
- Vocal-fade countdown v3 no-op — backlog (432).