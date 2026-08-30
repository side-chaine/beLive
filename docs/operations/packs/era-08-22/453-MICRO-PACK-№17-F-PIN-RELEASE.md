# 453-MICRO-PACK · №17-F · ПИН ОТПУСКАЕТ ПАНЕЛЬ ПРИ ЛЕГИТИМНОМ УХОДЕ ПЕСНИ

**Директива юзера (скриншот):** «Если [песня] перещёлкнула на другой блок — волна должна показывать АКТИВНЫЙ блок, а не предыдущий записанный».

**Итоговая семантика №17:**
1. Во время записи → панель на блоке записи ✅
2. Сразу после стопа → панель СТОИТ на блоке, тейк виден/играется ✅
3. Когда песня ЛЕГИТИМНО переходит в след. блок → пин снимается, панель следует за песней ← ЭТОТ ПАК

**Самокоррекция 007:** гипотеза дрейфа часов (доп14) ОТМЕНЕНА — публикатор читает transport.currentTime напрямую, «дрейф» был ловушкой соседних строк консоли (между ними юзер пел ~9-12с). Триггеры PS Travel стреляли точно. №17-E отменена, движок не трогаем.

## EDIT · src/takes/components/TakesPanel.tsx — авто-освобождение пина

OLD:
```
      // Block auto-follow (throttled: every ~15 frames ≈ 4Hz)
      if (!isRecordingRef.current && !blockPinRef.current && !activeExerciseRef.current && !completionMomentRef.current && followCount % 15 === 0) {
```
NEW:
```
      // №17-F: пин живёт только пока транспорт в пределах запиненного блока.
      // Легитимный уход песни в другой блок (вперёд или перемотка назад) снимает
      // пин — панель следует за активным блоком (директива юзера).
      if (!isRecordingRef.current && blockPinRef.current) {
        const pr = blockRangesRef.current.find(br => br.blockId === blockPinRef.current);
        if (pr && (t < pr.startTime - 0.5 || t >= pr.endTime)) {
          blockPinRef.current = null;
        }
      }

      // Block auto-follow (throttled: every ~15 frames ≈ 4Hz)
      if (!isRecordingRef.current && !blockPinRef.current && !activeExerciseRef.current && !completionMomentRef.current && followCount % 15 === 0) {
```

## КАК ЭТО РАБОТАЕТ
- `t` — уже вычисленное честное время транспорта в tick (та же переменная, что рисует playhead).
- Пока t внутри [startTime..endTime) запиненного блока → пин держится → юзер видит свой тейк.
- Песня пересекла границу вперёд (t >= endTime) ИЛИ юзер перемотал сильно назад (t < startTime - 0.5) → пин снят → существующий auto-follow в том же кадре/через ≤250мс переключает панель на активный блок.
- Во время записи (`isRecordingRef`) релиза нет — запись всегда держит блок.

## VERIFICATION (канон А4)
- tsc --noEmit = 314 (diff IDENTICAL)
- vitest files 61/63 (2 legacy load-error), tests 749/749
- FROZEN-OK: TakesPanel.tsx не frozen; движок НЕ трогаем (№17-E отменена).

## ОЖИДАЕМЫЙ РЕТЕСТ ЮЗЕРА
Запись тейка на куплете → стоп → стоим на куплете, зелёный best, играется ✅ → песня играет дальше → на границе (~37.98) чипы/текст/ПАНЕЛЬ+ВОЛНА уходят на Pre-Chorus ВМЕСТЕ ✅ → слоты Pre-Chorus пустые («• RECORD»), записанный куплетный тейк сохранён в Verse 1 (вернуться кликом чипа).
