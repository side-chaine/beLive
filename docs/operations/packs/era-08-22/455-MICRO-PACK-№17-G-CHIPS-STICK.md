# 455-MICRO-PACK · №17-G · ЧИПЫ СТИКАТ + ЧЕСТНЫЕ ЧАСЫ ПАНЕЛИ

**Симптом (ретест 22.08, лог):** война `[SET-BLOCK] WagonTrain ↔ tick:489` — ручной выбор чипа снапится назад авто-follow'ом за ≤250мс. Плюс тик панели ест кэш `__belive.currentTime`, который ЗАМЕРЗАЕТ на паузе (находка 006, TASK-010) → все решения follow/unpin/playhead принимаются на протухшем времени.

**Фикс (два подпункта, один файл):**
- **G/A — честные часы в rAF-тике панели:** `t` = `TransportV3.currentTime` (паттерн 451-D), кэш/V2 только fallback. Убивает зависимость от freeze-on-pause для playhead/unpin/follow.
- **G/B — follow только на пересечении границы при непрерывном движении:** следящая логика переключает блок ТОЛЬКО когда `prevT` был внутри диапазона активного блока, а `t` вышел за его конец, и сдвиг мал (непрерывное проигрывание, не seek). ⇒ Ручной выбор чипа СТИКИТ (скачок времени не переключает), войны нет. Семантика №17 (1-стоп-2-вижу-3-следую) сохранена полностью.

## EDIT 1 · src/takes/components/TakesPanel.tsx — импорт getTransport
В секции импортов добавить (рядом с другими импортами из audio/engine-v3, если есть; иначе новой строкой после последнего import):
```
import { getTransport } from '../../audio/engine-v3';
```

## EDIT 2 · src/takes/components/TakesPanel.tsx — ref для прошлой позиции
Найти комментарий `// Playhead rAF loop (direct engine read, NO store subscription)` и ПЕРЕД ним вставить:
```
  // №17-G: прошлая позиция тика — для детекции непрерывного пересечения границы блока
  const prevTickTimeRef = React.useRef(-1);

```

## EDIT 3 · src/takes/components/TakesPanel.tsx — источник t в tick
OLD:
```
      const ae = (window as any).audioEngine;
      // 007/418: V3-фон закейджил V2 → ae.getCurrentTime() замёрз. Когда V3 активен —
      // берём время из V3StatePublisher (__belive.currentTime, 20fps); иначе V2 (как раньше).
      const v3t = (window as any).__belive?.currentTime;
      const t: number = (window as any).__v3Active && v3t !== undefined ? v3t : (ae?.getCurrentTime?.() ?? 0);
```
NEW:
```
      const ae = (window as any).audioEngine;
      // №17-G/A: кэш __belive.currentTime ЗАМЕРЗАЕТ на паузе (пишется тик-лупом только
      // при playing — 006/TASK-010). Честное время = TransportV3.currentTime (паттерн 451-D);
      // кэш и V2 — только fallback.
      const t3 = getTransport()?.currentTime;
      const t: number = (window as any).__v3Active && typeof t3 === 'number'
        ? t3
        : ((window as any).__belive?.currentTime ?? ae?.getCurrentTime?.() ?? 0);
```

## EDIT 4 · src/takes/components/TakesPanel.tsx — follow на пересечение границы
OLD (блок целиком, после №17-F вставки):
```
      // Block auto-follow (throttled: every ~15 frames ≈ 4Hz)
      if (!isRecordingRef.current && !blockPinRef.current && !activeExerciseRef.current && !completionMomentRef.current && followCount % 15 === 0) {
        const currentBlockRange = blockRangesRef.current.find(
          br => t >= br.startTime && t < br.endTime
        );
        if (currentBlockRange && currentBlockRange.blockId !== activeBlockIdRef.current) {
          setActiveBlock(currentBlockRange.blockId);
        }
      }
      followCount++;
```
NEW:
```
      // №17-G/B: follow ТОЛЬКО на непрерывном пересечении конца активного блока.
      // Скачок времени (seek/ручная навигация чипом) панель НЕ переключает —
      // выбор юзера стикает (война tick↔WagonTrain из ретеста 22.08 устранена).
      const prevT = prevTickTimeRef.current;
      prevTickTimeRef.current = t;
      if (
        !isRecordingRef.current && !blockPinRef.current &&
        !activeExerciseRef.current && !completionMomentRef.current &&
        prevT >= 0 && Math.abs(t - prevT) < 1.0 && followCount % 15 === 0
      ) {
        const cur = blockRangesRef.current.find(br => br.blockId === activeBlockIdRef.current);
        if (cur && prevT >= cur.startTime && prevT < cur.endTime && t >= cur.endTime) {
          const nxt = blockRangesRef.current.find(br => t >= br.startTime && t < br.endTime);
          if (nxt && nxt.blockId !== activeBlockIdRef.current) {
            setActiveBlock(nxt.blockId);
          }
        }
      }
      followCount++;
```
Блок №17-F (релиз пина) ВЫШЕ — не трогать: на честных часах он теперь работает корректно.

## VERIFICATION (канон А4)
- tsc --noEmit = 314 (diff IDENTICAL)
- vitest files 61/63 (2 legacy load-error), tests 749/749
- FROZEN-OK: TakesPanel.tsx не frozen; движок НЕ трогаем (№17-E отложена до стабилизации, решение 007 после синка с 006).

## ОЖИДАЕМЫЙ РЕТЕСТ
1. Запись на куплете → стоп → стоим, best играет ✅
2. Песня пересекает границу → всё уходит в Pre-Chorus вместе ✅
3. **Клик чипа Verse 1 при остановленной/играющей песне где угодно → панель ПОКАЗЫВАЕТ VERSE 1 И ОСТАЁТСЯ** (никто не снапает назад) ✅
4. Волна в доке всегда соответствует выбранному чипом блоку ✅
