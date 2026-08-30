# 420-REPORT-C3-TAKES-V3-TIME (C22)

**Коммит:** C22 = `f5e3796` — `takes: единый V3-aware источник времени (getPlaybackTime/seekTo/isPlaying) — фикс записи take при V3-фоне`
**Ветка:** V3-finish_2
**Верификация:** tsc 314 (база) ✅ | vitest 746/749 (3 pre-existing) ✅ | frozen clean ✅

## Баг (со слов пользователя)
На вкладке Quest при записи take 1 «показала 30, какое-то значение» — take получался ~30с.

## Диагноз (007)
Вся takes-подсистема жила на V2-тайминге, а V3-фон (Cage) закейджил V2:
1. `V2Adapter.delegateSync('seekTo')` **блокировался** V2Interceptor'ом при активном V3 (`main.tsx:131-141`, в логе: `[V2Interceptor] 🚫 V2.seekTo() blocked — V3 is active`) → pre-roll seek не срабатывал, запись стартовала не с начала блока.
2. `ae.getCurrentTime()` **замерзал** (V2 закейджен) → countdown/trim неверны, timeCheck `ct >= blockEnd` не останавливал запись → запись резалась safety-timeout'ом `(blockDuration + 5) * 1000` → take ~30с. Live-трейл тоже мёртв (`ae.isPlaying` = false при V3).

**Как работало «до этого V2»:** V2Adapter.seekTo и ae.getCurrentTime были живыми, пока V2 был главным движком. С активным V3-фоном оба стали мёртвыми — takes-флоу сломался целиком (11 точек в 4 файлах).

## Решение (паттерн C21 + WaveformCanvas:438-446)
Новый `src/takes/takes.time.ts` — единый V3-aware источник:
- `getPlaybackTime()`: при `__v3Active` → `window.__belive.currentTime` (V3StatePublisher), иначе `ae.getCurrentTime()`
- `seekTo(t)`: при `__v3Active` → `TransportV3.seek(t)`, иначе `V2Adapter.seekTo`
- `isPlaying()`: при `__v3Active` → `transport.state === 'playing'`, иначе `ae.isPlaying`

Заменены 12 точек в 4 файлах:
- `TakesControlStrip.tsx` (5): pre-roll seek, countdown, trim-базис (engineNow), log, timeCheck + 3 таймера (479/533/566)
- `TakesPanel.tsx` (3): seek к блоку :1093, preview-таймер :1146, клик-канвас :1356 (фикс C21 :617-621 не тронут)
- `useTakesPlayback.ts` (2): seek к startTime :174, engineOffset :198
- `live-trail-controller.ts` (2): isPlaying-gate :190 (было `ae?.isPlaying` — при V3 трейл не рисовался), текущее время :204

## Ход работ
- MICRO-PACK 419 применён Оператором дословно; оператор честно доложил мою ошибку в шаге 5.3 (я не заметил использование `ae` на :190 — удаление объявления дало +1 TS2304 и +6 падений vitest).
- 007 довёл: добавил `isPlaying()` в хелпер, :190 → `isPlaying()`. Итог: база 314/746-749.

## Что проверить пользователю (живой тест)
1. Вкладка Quest, блок, нажать Take 1 → countdown 3-2-1 → запись стартует с начала блока (pre-roll seek работает).
2. Запись останавливается ровно в конце блока (timeCheck работает) — длительность take = длина блока, НЕ 30с.
3. Live-трейл рисуется во время записи при V3-фоне.
4. Плейбэк take и клик по канвасу (seek) — работают.

## COMMITS-REGISTRY
| SHA | Пак | Отчёт |
|---|---|---|
| f5e3796 | 419 (MICRO-PACK) | 420 (этот файл) |