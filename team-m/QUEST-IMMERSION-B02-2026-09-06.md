# 🛡 [B02] Quest — ПОЛНОЕ ПОГРУЖЕНИЕ · agent-quest · 06.09 2026

**Модель: agent-quest = Big Pickle Zen · ПК · Linux · HEAD `26e9256` (клон-канон: tsc 184 · vitest 812/68). Зона по PULSE-ZONES.yaml: `src/takes/**` + `src/practice/practice-scenarios.ts`. Фактическая территория — ТРИ слоя (см. §1). src/ не тронут (read-only, 0 байт).**

---

## 0. Выжимка для Никиты (30 секунд)

Зона Quest = **«тренажёрный зал вокалиста»**: запись тейков по блокам песни (3 слота/блок), управляемые упражнения с шагами (послушай → запиши → сравни → повтори ×N раундов) с разными бэкинг-режимами (full/instrumental/guide/silent/vocals-only), сценические квесты с карточками Promise/Method/Win и моментом завершения. Кнопка «Quest» в доке (deck/modules.ts:61-70, label='Quest') лениво монтирует TakesPanel — главный кокпит зоны.

**Главная структурная находка: в зоне ДВЕ независимые системы практики** (exercises vs practice) с разными архитектурами — см. §5, вопрос №1.

---

## 1. Территория зоны (заявленное vs фактическое)

| Слой | Файлов | LOC | Что это |
|---|---|---|---|
| `src/takes/` | 22 | ~2300 | тейки: стор, ассеты, рекордер, время, duck, кокпит-компоненты, хуки, live-волна |
| `src/practice/` | 3 | 560 | Билли-сценарии (bpm-ramp/focus-mix/section-breakdown) + action-runner + messages |
| `src/exercises/` | 28 | ~3800 | упражнения: типы, рецепты, 7 генераторов, стор 458, рантайм, interruption, компоненты (QuestEntrySurface = «Quest Room») |

**PULSE-ZONES.yaml занижает зону:** объявлены только takes + practice-scenarios.ts. Фактически `src/exercises/` — ядро квестов (QuestEntrySurface, exercise.store, генераторы) и `src/practice/` целиком (billy-action-runner, practice-messages) — в зоне патруля, но не в yaml. **Требуется правка yaml (не src/) — фронт 007**, по аналогии с находкой B08 (SyncWaveform).

---

## 2. Слой тейков (`src/takes/`)

### 2.1 Домен-модель
- **TakeMeta** (takes.types.ts:10-37): id=`take-${blockId}-${slot}`, blockId, slot 0|1|2 (фиксированные 3 слота), mimeType, duration, status `recording→processing→ready|error`, peaksReady, trimStartSec (выравнивание старта с движком), lateStartOffsetSec (телеметрия опоздания), tempoRate (контекст тренировки, напр. 0.8), takeKind `training|final`.
- **BlockTakes**: takes[3] + selectedSlot (для баунса).
- **PreviewMode** `context|solo` · **ViewMode** `inst|voc|mix` (I/V/M).
- **Хранение — СЕССИОННОЕ, только память** (takes.assets.ts:1-10): метаданные в Zustand, тяжёлые Blob/AudioBuffer/peaks — в singleton-реестре ВНЕ стора (анти-реактивный оверхед), objectURL лениво, полная чистка на смену трека (cleanup → takeAssets.clear()). НИЧЕГО не пишется в IDB/localStorage — тейки умирают со сессией. Это проектное решение (заголовок takes.types.ts:2-4 «Session-only»).

### 2.2 Запись (takes.recorder.ts)
TakesRecorder — MediaRecorder-обёртка: V3-путь `__belive.micSource.acquire()` (мик ВЫШЕ плейбек-pipeline, F-1/431; ошибки типизированы: permission-denied|no-device|stream-fail|mic-source-unavailable), V2-fallback через ae.getMicrophoneStream('raw'). Формат webm/opus + audio/mp4 Safari. AnalyserNode-tap (1024 fft) для живой волны, НЕ в выходе. REC-SYNC·COMMIT-лог на stop.

### 2.3 Время/duck (V3-aware, frozen-чисто)
- **takes.time.ts** — единый источник: время из TransportV3 clock (без 50мс-кэша), seek через getTransport().seek, rate через TransportV3. V2-ветки — через audioEngine-обёртки. Frozen-файлы НЕ трогает (engine-v3 — живой слой).
- **takes.duck.ts** — duck/restore: v3+stems → bus volumes; v3 no-stems → muteStem('instrumental'); v2 → legacy ae.set*. 

### 2.4 Кокпит (components + waveform)
- **TakesPanel.tsx (1686 строк, 58КБ)** — монолит-хаб зоны: canvas-волна TakesCanvas + live-trail overlay + ExerciseStrip (прогресс упражнения над волной) + countdown/REC-badge/abort/response-cue оверлеи + TakesToolbar (I/V/M, context/solo, AB-compare) + TakesControlStrip (hero trio внизу) + QuestEntrySurface (recipesOpen) + QuestCompletionMoment. Seek-по-клику с `interruptPracticeSession`-гвардом + data-no-seek селекторы. Playhead через rAF-трансформ.
- **TakesCanvas.tsx (209)** — 3 слоя пиков: база по viewMode (inst красный / voc синий / mix оба), reference contour (зелёный, guide), take compare (оранжевый) + response window (амбер-хайлайт) + REC-тинт. Пики через sync/canvas/peaks (500 баров). **Зум НЕ НАЙДЕН** (см. §7-Д).
- **TakesControlStrip.tsx (40КБ)** — самая тяжёлая логика записи: countdown, in-flight capture (roundCapture, response windows), re-record, live analyser.
- **waveform/** — императивный конвейер live-волны (zero React): LiveTrailController (rAF-оркестратор) → LiveWaveformAccumulator (данные) → LiveTrailRenderer (canvas) + waveform-skins (LiveTrailSkin) + waveform-tier-config (перф-тиры). 3 теста.

### 2.5 Хуки
- **useTakesPlayback** (268): preview-плей тейка с gen-гвардами (previewGenRef — гонки decode/stop), attachProgramSource на Program Bus (Wave R3), duck/solo, tempo-aware playback тренировочных тейков (setRate(tempoRate) + restore), deterministic start (§1.4 state-aware, F-1.8/436 re-acquire после interrupt-commit settle), GEN-BUMP/GEN-GUARD-трейсы. ⚠️ Компат-стык: `store.__playTakeFn/__stopPreviewFn` для скрытых потребителей (takes.bridge, previous-take compare).
- **usePracticeInterrupt**: регистрирует interrupt-handler (чистка countdown/таймеров/рекордера) в реестре exercise.interruption.
- **useTakeDelete**.

---

## 3. Слой Билли-сценариев (`src/practice/`)

- **practice-scenarios.ts (368)**: PracticeScenarioId = `'bpm-ramp' | 'focus-mix' | 'section-breakdown' | 'random-blocks'`. 3-фазная модель (startActions → perPassActions → isComplete → onCompleteActions / restoreActions). Реализованы 3 (bpm-ramp: 0.8→1.0 шаг 0.05 на loop; focus-mix: поочерёдный фокус musicStems, вокал всегда; section-breakdown: проход по всем блокам). **`random-blocks` — ФАНТОМ: есть в union-типе, отсутствует в реестре SCENARIOS и AVAILABLE_SCENARIO_IDS** (practice-scenarios.ts:19 vs :104-110, :243-247). Доступность через isScenarioAvailable — код защитился сам, но тип врёт.
- **billy-action-runner.ts (144)**: serial-исполнитель PracticeAction через `executeToolCall` из TrackInfoBoard/ai-tools — **зона гоняет Билли через общий AI-инструментарий** (стейк-стык с TrackInfoBoard/AiExpertPanel).
- **practice-messages.ts (48)**: детерминированные сообщения из подтверждённых ToolCallResults (не AI-текст).
- **Потребители**: practice-session.store (снапшот/restore, PracticeSessionCard в TrackInfoBoard), V3StatePublisher (упоминает practice), ai-expert-prompts (GPT-подсказки про сценарии).

---

## 4. Слой упражнений (`src/exercises/`)

### 4.1 Домен
- **ExerciseStep** (types:19-36): action `listen|record|compare|wait`, scope (blockId+lineRange), backing, slot `number|'next'`, visualCue `lyrics|waveform|piano`, captureMode `standard|in-flight`, roundCaptureMode (мульти-окно), responseWindowIndex/total, tempoRate, takeKind, listenSource `reference|previous-take`.
- **Exercise**: steps × ExerciseRepeat (count, mode fixed|until-filled) → ExerciseGoal (completion|filled slotCount|rounds count). difficulty, tags.
- **RoundCaptureState**: in-flight захват по окнам (lockedSlot, windowIndex/total, recorderArmed, responseActive) — механика «спой и поймай в момент».
- **SessionProgress**: exercisesCompleted, questsCompleted, blocksExercised, totalRounds.
- **CompletionMoment**: payload финального экрана.

### 4.2 Рецепты × генераторы (7)
echo-drill (слушай→спой) · triple-take (3-Take Challenge, fill-select) · call-response (дует с оригиналом) · backing-only · acappella-boss (без бэкинга) · tempo-ladder (через TempoSetupModal: старт-темп + preview между раундами) · trade-v1 (hidden, line-stage). Surface-политика: stable (ученик) | smoke (лаборатория) | special (дует). CapabilityMetadata: requiresVocalStem (карта живёт на audio.store.hasVocals).

### 4.3 Runtime-машина
- **exercise.store.ts (458)**: cursor-машина advanceToNextStep (round/step/completed), activateCurrentStep → phase `idle|listening|pre-recording|recording|comparing|waiting|round-complete|exercise-complete`, roundCapture-инициализация, scenarioMixOverride (микс-оверлей поверх бэкинга), снапшоты (savedVolumes/rate/vmix), sessionProgress, completionMoment. №17-TRACE стека на advance.
- **exercise.runtime.ts (143)**: чистые функции — resolveBackingVolumes (full 1/1 · instrumental 1/0 · guide 1/0.25 · silent 0/0 · vocals-only 0/1), cursor, progressDisplay, execution lock.
- **exercise.interruption.ts (180)**: ЦЕНТРАЛЬНАЯ семантика прерывания — реестр handler'ов, restore снапшотов громкостей (W4a: только stem.store — живой канал), cancelExercise сохраняет закоммиченные тейки, window-bridge `__belivePracticeInterruption`. Потребляется ControlDeck (3 точки: seek-клик, хоткеи, экшены), TakesPanel, usePracticeInterrupt.
- **UI**: QuestEntrySurface (420, «Quest Room» — fixed-оверлей, карточки Promise/Method/Win, stable+smoke unified, tempo-ladder → модалка), QuestCompletionMoment (195), ExerciseStrip (146, прогресс-лента), TempoSetupModal (125), RecipeCardPopover (17 — H-1c hold).

### 4.4 Тесты зоны: 12 файлов / 179 тестов — все 🟢 (5.31s)
pin-semantics · interruption · runtime (base/lock/mutation-lock/seek-guard/strip-guard/wagon-guard) · recipes.surface · live-trail (controller/renderer) · live-waveform-accumulator. Guard-тесты — контрактная сетка (мутации, seek, strip, wagon).

---

## 5. ⚠️ Главная структурная находка: ДВЕ системы практики

| | exercises (src/exercises/) | practice (src/practice/) |
|---|---|---|
| Вход | Кнопка Quest → QuestEntrySurface → startRecipe | Билли-чат → practice-session.store → runPracticeActions |
| Модель | Шаги/раунды, фазы, стор, UI-оверлеи | Action-списки через AI-инструменты (executeToolCall) |
| Сценарии | 7 рецептов-генераторов | 3 сценария (bpm-ramp/focus-mix/section-breakdown) |
| Пересечение | bpm-темп, loop, бэкинг-микс — ДУБЛИРУЮТ друг друга семантически | |

Оба слоя живы, оба в моей зоне, друг о друге не знают. Стык по стемам общий (useStemStore), по прерыванию — только у exercises (practice прерывается через свою логику в practice-session.store). **Вопрос №1 Никите: единая система или две роли?** (Напр.: exercises = интерактивный зал, practice = Билли-автопилот — тогда нужна шина между ними.)

---

## 6. Цифры ПУЛЬСа зоны (замер 14:0x, HEAD `26e9256`)

- **tsc = 184 (Δ0 с каноном)**; **зона несёт 23 ошибки (12.5% от всех)**: TakesControlStrip 7 (TS6133: неиспользуемые useAudioStore, onCompareModeChange, setRoundCaptureLockedSlot, PLAYING_REFERENCE_ID...) · TakesPanel 6 · backing-ladder.generator 2 · live-trail контроллер/рендерер/аккумулятор 1+1+1 · useTakesPlayback 1 · exercise.store 1 (currentRound) · QuestEntrySurface 1 ('visibility' declared-never-read — проп мёртв) · тесты runtime/lock ×2 (TS6196). Класс — почти весь TS6133/6196 (deadcode-класс, кандидат в батч Оператора).
- **vitest зоны: 12 файлов / 179 тестов — PASS** (5.31s).
- **reach: violations 0 · hold 51 общих, зона в hold 2**: `src/exercises/index.ts` (H-6 «0 импортёров, чистые трупы», until: снос-батч Д-2 по GO) · `src/exercises/components/RecipeCardPopover.tsx` (H-1c «достижимы только из тестов», until: решение по H-1c).
- **junction зоны: 0 пар** (в scripts/junction-registry.yaml зона не представлена).
- **Достижимость живого ядра**: TakesPanel ← deck/modules (lazy) ← ControlDeck ← App — живая цепочка.

---

## 7. Смерть/долг внутри зоны (решение — план/цепь, сам не трогаю)

- **А. random-blocks — фантом типа** (practice-scenarios.ts:19): не реализован, не вычищен. Либо реализация, либо срез из union.
- **Б. Компат-стык `__playTakeFn/__stopPreviewFn`** (useTakesPlayback:246-260): функции вешаются на стор для скрытых потребителей (takes.bridge, previous-take compare) — грязный window-стиль паттерн, кандидат на явный DI.
- **В. exercises/index.ts — H-6 труп** (0 импортёров): уже в holdlist до снос-батча Д-2 по GO — без действий, дожидается GO.
- **Г. RecipeCardPopover (17 строк) — H-1c**: живёт только в тестах.
- **Д. «Canvas-волна с зумом» из хэндоффа — зум НЕ НАЙДЕН**: TakesCanvas рисует фиксированное окно [blockStart..blockEnd], зум-контролей/масштабирования нет. Ставлю «НЕ ЗНАЮ»: либо зум в планах, либо хэндофф имел в виду окно блока как «зум» относительно полного трека.
- **Е. 23 TS-ошибки** — deadcode-класс (неиспользуемые декларации), микробатч Оператору по аналогии с 301/deadcode-#1.
- **Ж. PULSE-ZONES.yaml границы** — не включают src/exercises/** и остальной src/practice/** (факт-база этого досье) — правка yaml на фронте 007.
- **З. QuestEntrySurface 'visibility'** — проп передаётся ("all"), не читается: фильтрация по surface идёт напрямую (stableRecipes/experimentalRecipes) — мёртвый проп, микробатч.

---

## 8. Стыки с соседями (двухместные, по канону города)

- **B01-HUB (Rehearsal/ControlDeck)**: кнопка Quest = lazy-таб дока; ControlDeck×3 interruption-стайки; WagonTrain/RehearsalLyrics потребляют takes-стыки (useTakesStore). Редизайн ДОКа (3-колоночный GPT-контракт) двигает точку входа зоны.
- **B01-mixer (Studio)**: duck-громкости через pipeline.setBusVolume / stem.store — общий канал громкостей; scenarioMixOverride живёт поверх стем-микса.
- **B08 (Sync)**: пики из sync/canvas/peaks (TakesCanvas, useTakesPlayback) — зона импортирует пиковый движок Башни.
- **Билли/TrackInfoBoard**: billy-action-runner → executeToolCall (ai-tools); PracticeSessionCard, ai-expert-prompts — сценарии видны Билли.
- **PHONE (горизонталь)**: TakesPanel/TakesControlStrip не фигурировали в топ-5 боли PHONE-аудита, но mouse-only драги/фикс-панели зоны при 390px не проверялись — кандидат в фазу-2 PHONE.
- **event-bus**: wrappers/takes-events + exercise-events — зона на шине.

---

## 9. Вопросы Никите (на план развития)

1. **Две системы практики** (exercises vs practice) — объединять, разводить по ролям (интерактив vs Билли-автопилот) или замораживать одну?
2. **random-blocks** — что это должно быть? Реализовать или вычистить из типа?
3. **23 TS-ошибки зоны** (deadcode-класс) — микробатч Оператора в общей очереди?
4. **Зум волны** — в планах ли zoom/масштаб кокпита (в хэндоффе заявлен, в коде отсутствует)?
5. **Сессионность тейков** — подтверждить как финальное решение (сейчас всё умирает со сессией) или IDB-персистентность в планах?
6. **__playTakeFn-компат** — легализовать в явный API или снести при рефакторинге?
7. **Стейк Practice Plan / Suggested Exercise** (GPT-контракт ZONE 3, из доклада B01) — зона Quest естественный поставщик (suggestScenarios + QuestEntrySurface): моя ли это работа в 3-колоночном контракте?

**НЕ ЗНАЮ / НЕ ПРОВЕРЕНО:** рантайм-поведение in-flight capture на реальном треке · поведение duck при одновременном stems+scenarioMixOverride · замеры перфа live-trail на длинном треке · что имелось в виду под «кокпитом 006» в хэндоффе.

---

**СТОП.** Шаг-1 формулы (погружение) завершён. План развития — от Никиты.

— agent-quest [B02] · 06.09 14:0x · зал вскрыт, тейки живы, жду тренерского плана 🎤🛡
