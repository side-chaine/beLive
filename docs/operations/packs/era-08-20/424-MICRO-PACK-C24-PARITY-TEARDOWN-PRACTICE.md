# MICRO-PACK C24 — микро-строки Ц3 (М3-parity, М2-teardown) + practice-тест-фикс (атрибуция)

## Контекст
Ц3 в релее по C23: две микро-строки + атрибуция practice-гейта (3 красных теста). Все три предмета — в одном паке.

### Атрибуция practice-гейта (уже найдена)
`src/stores/__tests__/practice-session.store.test.ts` — 3 падения с причиной:
`Error: [vitest] No "getScenario" export is defined on the "../../practice/practice-scenarios" mock.`
**Мок-дрифт:** `vi.mock('../../practice/practice-scenarios', ...)` на строке 45 экспортирует только `BLOCK_TYPE_NAMES / PracticeScenarioId / PracticeContext / PracticeProgress`, но НЕ `getScenario`. Реальный модуль `src/practice/practice-scenarios.ts:233` экспортирует `getScenario`, и store вызывает его (`practice-session.store.ts:247`). Не баг прода — устаревший мок.

---

## Шаг 1 — `src/stores/__tests__/practice-session.store.test.ts`

Заменить блок vi.mock на строках 45-50:
```ts
vi.mock('../../practice/practice-scenarios', () => ({
  BLOCK_TYPE_NAMES: {},
  PracticeScenarioId: {},
  PracticeContext: {},
  PracticeProgress: {},
}));
```
на:
```ts
vi.mock('../../practice/practice-scenarios', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    BLOCK_TYPE_NAMES: {},
    PracticeScenarioId: {},
    PracticeContext: {},
    PracticeProgress: {},
  };
});
```
(сохраняем реальный `getScenario`/сценарии, переопределяем типы/константы как было).

## Шаг 2 — `src/takes/components/TakesControlStrip.tsx`

**2a. М3-parity — убрать setRate(1) из handleStop.**
Строка 637: `setRate(1); // М3: восстановить rate после записи (V3 и V2)` заменить на:
```ts
    // М3-parity: НЕ сбрасываем rate здесь — V2 в handleStop rate не трогал.
    // Восстановление делает exercise-флоу (TakesPanel:901-913 savedPlaybackRate → setPlaybackRate(savedPlaybackRate)).
```
(для не-tempo записи rate уже 1 — handleRecord:167 setRate(1); для tempo-записи восстановление — обязанность exercise-флоу — тот же механизм, что в V2).

**2b. М2-teardown — разбираем recorder при abort.**
В countdown-аборт-ветке (сейчас строки ~231-232):
```ts
              useTakesStore.getState().cancelRecording();
              onRecordAbort?.(`Синхронизация pre-roll не удалась. Попробуй ещё раз.`);
              return;
```
заменить на:
```ts
              useTakesStore.getState().cancelRecording();
              // М2-teardown: разбираем recorder/analyser — не оставляем тёплый микрофон
              recorderRef.current?.cancel();
              recorderRef.current = null;
              onRecorderAnalyserChange?.(null);
              clearActiveRecordingTimers();
              onRecordAbort?.(`Синхронизация pre-roll не удалась. Попробуй ещё раз.`);
              return;
```

---

## Верификация (007)
- `npx tsc --noEmit` → 314.
- `npx vitest run` → **746/749 → 749/749** (3 практика-теста чинятся).
- Frozen: только `src/takes/` + тест — чисто.
- Коммит: `C24: М3-parity (rate restore через exercise-флоу), М2-teardown (recorder.cancel), practice-тест-фикс getScenario (мок-дрифт)` + `(424-REPORT)` в message.