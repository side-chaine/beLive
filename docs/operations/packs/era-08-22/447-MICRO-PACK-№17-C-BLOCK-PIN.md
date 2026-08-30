# 447-MICRO-PACK · №17-C · БЛОК-ПИН TAKE-СЕССИИ + PS TRAVEL V3-ЧАСЫ

**Директива юзера:** «Зафиксировать состояние, когда пишется Take! После записи он должен остановиться ТАМ ЖЕ». 
**Root cause (полный инвентарь двигателей блока, урок 442 применён):**
1. **TakesPanel.tsx:687-695 «Block auto-follow»** — rAF ~4Hz: после стопа записи (`isRecordingRef=false`) следует за плейхедом → `setActiveBlock(блок-где-playhead)` → панель прыгает на ПУСТЫЕ слоты след. блока. Гварды `activeExercise/completionMoment` не спасают в practice-потоке.
2. **RehearsalLyrics.tsx:480 PS Travel** — читает `ae?.getCurrentTime?.()` = **ЗАМОРОЖЕННЫЕ V2-часы** при активном V3 (E1-family; TakesPanel получил фолбэк в C21/418, а этот файл — НЕТ) → `triggered` сбрасывается на каждом re-run эффекта → мгновенный выстрел (лог: fired сразу после REC ARM при ct=24.835, хотя triggerTime ≈ конец блока).

Оба файла НЕ frozen. Оба фикса = прецеденты: пин по семантике C31 (commit-on-interrupt), часы = дословный паттерн C21/418.

---

## EDIT 1 · src/takes/components/TakesPanel.tsx — добавить ref

OLD:
```
  const activeExerciseRef = React.useRef(activeExercise);
  const completionMomentRef = React.useRef(completionMoment);
```
NEW:
```
  const activeExerciseRef = React.useRef(activeExercise);
  const completionMomentRef = React.useRef(completionMoment);
  // №17-C: пин блока take-сессии — после записи остаёмся на блоке записи
  // (директива юзера). Снимается только сменой трека (activeBlockId → null).
  const blockPinRef = React.useRef<string | null>(null);
```

## EDIT 2 · src/takes/components/TakesPanel.tsx — эффекты pin/unpin

OLD:
```
  React.useEffect(() => {
    completionMomentRef.current = completionMoment;
  }, [completionMoment]);
```
NEW:
```
  React.useEffect(() => {
    completionMomentRef.current = completionMoment;
  }, [completionMoment]);

  // №17-C: PIN при постановке записи (arm) — фиксируем блок take-сессии.
  React.useEffect(() => {
    if (isRecording) {
      blockPinRef.current = activeBlockIdRef.current;
    }
  }, [isRecording]);

  // №17-C: UNPIN только при смене трека (takes.store сбрасывает activeBlockId в null).
  // Ручная навигация по чипам (WagonTrain setActiveBlock) работает ПОВЕРХ пина,
  // авто-follow остаётся заблокирован до смены трека — панель не улетает от плейхеда.
  React.useEffect(() => {
    if (!activeBlockId) {
      blockPinRef.current = null;
    }
  }, [activeBlockId]);
```

## EDIT 3 · src/takes/components/TakesPanel.tsx — гвард в rAF-цикле

OLD:
```
      if (!isRecordingRef.current && !activeExerciseRef.current && !completionMomentRef.current && followCount % 15 === 0) {
```
NEW:
```
      if (!isRecordingRef.current && !blockPinRef.current && !activeExerciseRef.current && !completionMomentRef.current && followCount % 15 === 0) {
```

## EDIT 4 · src/components/RehearsalLyrics.tsx — V3-часы для PS Travel

OLD:
```
      const ct = ae?.getCurrentTime?.() ?? 0;

      if (ct >= triggerTime && ct <= triggerTime + effectivePreset.timing.triggerWindow) {
```
NEW:
```
      // №17-C: V2-clock заморожен при активном V3 (E1-family; parity с C21/418 TakesPanel)
      const v3t = (window as any).__belive?.currentTime;
      const ct = (window as any).__v3Active && v3t !== undefined ? v3t : (ae?.getCurrentTime?.() ?? 0);

      if (ct >= triggerTime && ct <= triggerTime + effectivePreset.timing.triggerWindow) {
```

---

## ЧТО НЕ ТРОГАЕМ
- `WagonTrain.tsx:106` setActiveBlock — ручная навигация по чипам (легальная).
- `ExerciseStrip:107` advanceToNextStep, `skipStep`, `exercise-events.ts:23` (Track before-change) — явные/другой скоуп (решение Ц3).

## ОЖИДАЕМОЕ ПОВЕДЕНИЕ ПОСЛЕ ФИКСА
- Во время записи: блок зафиксирован (было и так).
- **После стопа записи: панель ОСТАЁТСЯ на блоке записи** (слоты с зелёным best), сколько бы трек ни играл дальше.
- Текст (PS Travel) больше не улетает мгновенно — путешествует по реальному времени V3.
- Клик по чипу другого блока — работает (панель идёт туда и СТОИТ там).
- Смена трека — всё сбрасывается (unpin).

## VERIFICATION (канон А4)
- `tsc --noEmit` = 314 (diff IDENTICAL).
- `vitest` files 61/63 (2 legacy load-error), tests 749/749.
- **Browser-proof (юзер):** запись → стоп → стоим на блоке, зелёный best, играется; текст не улетает; чип-клики работают; прогрессия квеста без записи жива.

## FROZEN-OK
TakesPanel.tsx, RehearsalLyrics.tsx — не frozen.
