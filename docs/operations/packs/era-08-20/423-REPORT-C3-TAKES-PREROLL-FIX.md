# 423-REPORT-C3-TAKES-PREROLL-FIX (C23)

**Коммит:** C23 = `53ddc3d` — `takes: 422 — recorder до seek, countdown по свежему engine-time, staleness-гвард, setRate, REC-бейдж`
**Верификация:** tsc 314 (база) ✅ | vitest 746/749 (3 pre-existing) ✅ | frozen clean ✅
**Пак:** 422-MICRO-PACK-TAKES-PREROLL-FIX.md

---

## Что сделано (М1–М5, все условия Ц3)

| # | Условие | Реализация |
|---|---|---|
| М1 | Countdown по engine-time; wall-clock только страховка | `getPlaybackTime()` теперь читает **свежий** `TransportV3.currentTime` (геттер, clock) вместо 50мс-кэша `__belive.currentTime` (fallback на кэш → 0). Wall-clock — только safety-timeout `(preRoll/rate + 2.5с)` → abort+toast, никогда источник цифры |
| М2 | Гвард bounded: один re-seek + toast при втором | `stalenessStrikes` / `maxStalenessStrikes=1`: если на тике `ct > startTime + 0.05` → 1-й раз: re-seek на preRollStart + рестарт цикла; 2-й раз: cancelRecording + `onRecordAbort('Синхронизация pre-roll не удалась…')` — никогда молча |
| М3 | tempoRate через takes.time.ts; сброс rate=1 на стопе | Новый `setRate(rate)`: `__v3Active` → `TransportV3.setPlaybackRate`, иначе `ae.setPlaybackRate`. `handleRecord` → `setRate(tempoRate ?? 1)` (вместо двух V2-веток). `handleStop` → `setRate(1)` — восстановление в обоих движках |
| М4 | Аудит двойного getUserMedia + телеметрия | **Вывод: двойного запроса НЕТ** — `enableMicrophone()` единственный (:177, до seek); `recorder.start()` его пропускает (enabled=true). **Реальный виновник 4.8с — `recorder.start()` (cold init MediaRecorder/stream-tap) ПОСЛЕ seek.** В паке: recorder перенесён ДО seek+play + телеметрия (`recorderInitMs`, `seekMs`, `v3Active` в TRIM-BASIS) для точного замера на живой сессии |
| М5 | REC-бейдж на канвасе | Полноэкранный оверлей: красный пульс-круг + «REC» (top-right, zIndex 30) при `isRecording` + плашка abort-уведомления (top-center, автоскрытие 3.5с) |
| М6 | Реестр-дельта не требуется | освобождение зафиксировано (источник времени не имеет задержки) |
| М7 | Протокол | план-до → оператор → diff → tsc 314 → vitest 746/749 → frozen → коммит C23 → этот отчёт |

## Ключевой архитектурный сдвиг
**Порядок старта записи** (TakesControlStrip.handleRecord):
```
БЫЛО:  enableMicrophone → seekTo(preRoll) → play → await recorder.start() ← 4.8с! → countdown(устаревший кэш) → тихий старт
СТАЛО: enableMicrophone → await recorder.start() → recorderStartedAt → seekTo(preRoll) → play → countdown(свежий clock) → точный старт
```
`recorderStartedAt` остаётся сразу после `recorder.start()` — trim-база blob корректна (лишние секунды записи до seek автоматически обрезаются формулой `wallDeltaSec - engineProgressSec`).

## Инцидент в паке (2-й раз петка сработала)
Мой промах в 422: `TransportV3.getCurrentTime()` — не существует (метод есть только у `this.clock`). Оператор применил дословно, доложил TS2551 (+1 к tsc). 007 исправил на геттер `currentTime` — база восстановлена. **Урок:** геттеры/методы TransportV3 сверять до пака — но протокол уже доказал свою ценность дважды (5.3 → 190-я строка; 1a → геттер).

## Что проверить пользователю (живой тест, бандл строка 7)
1. Вкладка Quest, блок, Take 1 → **countdown 3-2-1 виден** → запись стартует точно с начала блока
2. Длительность take = длина блока (не 30с, не тихий старт)
3. **REC-бейдж** горит во время записи; live-трейл рисуется с начала
4. После записи плейбэк take + клик по канвасу работают
5. В консоли: `[TRIM-BASIS]` с новыми полями `recorderInitMs`/`seekMs`/`v3Active` — прислать 007 (замер 4.8с)

## COMMITS-REGISTRY
| SHA | Пак | Отчёт |
|---|---|---|
| 53ddc3d | 422 (MICRO-PACK) | 423 (этот файл) |
| f5e3796 | 419 (MICRO-PACK) | 420 |