# 448-REPORT · №17 ROOT CAUSE FOUND + №17-C ПРИМЕНЁН → Ц3

## КОНТЕКСТ
№17-B2 (445) применился чисто (tsc 314 / vitest 749/749), но browser-proof юзера показал: **прыжок на след. блок живёт**. Звук тейка при этом здоров ([PLAY-TAKE]→[GEN-GUARD:133] PASS→[GEN-SRC-START] gain=1→natural-end ×2), isReady=true сразу после коммита (N2/441 живы).

## ПОЛНАЯ ИНВЕНТАРИЗАЦИЯ ДВИГАТЕЛЕЙ БЛОКА (урок 442 применён ДО выреза)
| # | Механизм | Вердикт |
|---|---|---|
| 1 | ~~exercise-events.ts:39~~ onStepCompleted на stop записи | убит B2 (445) |
| 2 | ~~TakesControlStrip.tsx:365~~ advanceToNextStep | убит 442 |
| 3 | **TakesPanel.tsx:687-695 «Block auto-follow»** rAF ~4Hz | 🔴 ГЛАВНЫЙ: после стопа записи следует за плейхедом → `setActiveBlock(блок-playhead)` → панель прыгает на пустые слоты след. блока. Гварды `activeExercise/completionMoment` не спасают в practice-потоке |
| 4 | WagonTrain.tsx:106 setActiveBlock | ручной клик по чипу — легальная навигация, НЕ трогаем |
| 5 | **RehearsalLyrics.tsx:480 PS Travel** читает `ae?.getCurrentTime?.()` | 🔴 ЗАМОРОЖЕННЫЕ V2-часы при активном V3 (**E1-family**, нет `__v3Active`-фолбэка; TakesPanel получил его в C21/418, этот файл — нет) → `triggered` сбрасывается на каждом re-run эффекта → мгновенный визуальный выстрел (лог юзера: fired СРАЗУ после REC ARM при ct=24.835, хотя triggerTime ≈ конец блока ~30с) |
| 6 | ExerciseStrip:107 / skipStep / exercise-events:23 | явные/другой скоуп (решение Ц3 по :23 в силе) |

## ДИРЕКТИВА ЮЗЕРА + GO
«Зафиксировать состояние, когда пишется Take! После записи он должен остановиться ТАМ ЖЕ» → GO выдан юзером напрямую.

## 447-MICRO-PACK · №17-C — ПРИМЕНЁН ОПЕРАТОРОМ (4/4 ✅)
1. **TakesPanel.tsx** (+`blockPinRef`): PIN при постановке записи (`blockPinRef = activeBlockIdRef.current` на arm); UNPIN только при смене трека (`activeBlockId → null`); гвард auto-follow дополнен `!blockPinRef.current`. Ручная навигация чипами работает поверх пина (setActiveBlock напрямую), авто-follow остаётся заблокирован до смены трека — панель не улетает от плейхеда.
2. **RehearsalLyrics.tsx:480**: PS Travel получил V3-часы — `ct = __v3Active && __belive.currentTime !== undefined ? __belive.currentTime : ae.getCurrentTime()` (дословный паттерн C21/418). Текст теперь путешествует по реальному времени V3, а не мгновенно от замороженных часов.

**Канон А4:** `tsc --noEmit` = **314** (diff IDENTICAL) · `vitest` files 61 passed | 2 failed (legacy load-error), tests **749/749**.
Коммитов нет; frozen не тронут; WagonTrain/ExerciseStrip/exercise-events не тронуты.

## ОЖИДАЕМОЕ ПОВЕДЕНИЕ (для browser-proof)
- Запись → стоп → **панель ОСТАЁТСЯ на блоке записи** (зелёный best, играется), сколько бы трек ни играл дальше.
- Текст НЕ улетает мгновенно; PS Travel ходит по реальному времени V3.
- Чип-клики работают и «стоят» там, куда кликнули.
- Прогрессия квеста без записи жива (ExerciseStrip/skip).
- Смена трека сбрасывает пин.

## E1-ИНВЕНТАРЬ +1
RehearsalLyrics.tsx PS Travel clock — новое член семейства «V2-API молча stale/no-op под V3» (C29-C32, C21). Пополнить при ревью 425.

## НУЖНО ОТ Ц3
1. Санакция №17-C постфактум-ревью (GO был прямой от юзера как product-owner, директива дословная).
2. Подтвердить семантику пина: unpin только на смене трека (авто-follow отключается после первой записи до смены трека) — компромисс против «hands-free following», осознанный.
3. А1/А2/А4 — отвечены в 446 (повтор: bus-множитель V2 подтверждён frozen-read; A2 cleanup → B-slice; А4 канон зафиксирован).

*007 · координатор/упаковщик.*
