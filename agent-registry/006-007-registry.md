# 006 <-> 007 · INTERNAL REGISTRY (beLive · V3-finish_2)

**Назначение:** постоянный канал координации между 007 (координатор/упаковщик) и 006 (research-специалитет). 006 исследует код (read/grep), при необходимости поднимает скаутов (explore/general через Task), складывает отчёты в OUTBOX. 007 читает OUTBOX и принимает решения.

**КТО ТАКОЙ 006 (важно, чтобы не путать):** Реальный 006 — это ОТДЕЛЬНАЯ сессия OpenCode, которую юзер запускает вручную («go»). 007 НЕ может активировать её автоматически: Task-тул спавнит лишь эфемерных субагентов внутри сессии 007, которые 006 НЕ являются. Любой субагент, запущенный 007 для проверки, в логах помечается `007-TEST-SUBAGENT` и НЕ атрибутируется реальному 006. Исследовательские задачи 007 ВСЕГДА оставляет в INBOX для реального 006; своих research-субагентов для них не поднимает.

**008 (vision-аналог 006):** параллельная сессия OpenCode (запускает юзер, как 006), НО умеет читать скриншоты/фото (007/006 не могут). Пишет отчёты в `agent-registry/008-*.md`; исходники не правит; скрины удаляет после фиксации. Координация — те же INBOX/OUTBOX через реестр. 007 читает 008-отчёты (не спавнит субагентом).

**ПРАВИЛА**
- 007 пишет задачи в ## INBOX (тег [OPEN]). 006 берёт, исследует, пишет в ## OUTBOX под тем же TASK-ID, ставит задаче [DONE], добавляет строку в ## STATUS-LOG.
- 006 — ТОЛЬКО чтение/исследование. НЕ модифицирует исходники. FROZEN (чтение разрешено, правка — нет): src/audio/core/AudioEngineV2.ts, src/audio/compat/patchV1.ts, src/bridges/*, src/services/track.orchestrator.ts, приватные _.
- Все выводы 006 — с file:line ссылками. Гипотезы помечать [@@HYP]; факты — [@@FACT].
- Канон А4 не нарушать смыслом (006 не коммитит, не пишет код).

---

## INBOX

### TASK-014 · Мик-тумблер ControlDeck мёртв в v3 (легаси-заглушка) · [PROPOSAL READY → agent-registry/006-PROPOSAL-TASK-014-MIC-TOGGLE.md · ждёт SYNC-OK 007]
**Симптом юзера:** кнопка 🎤 ON/OFF в ControlDeck кликается, но ничего не делает («неактивная»); микрофон в микшере выбран и работает системно.
**ROOT:** ControlDeck.tsx:386-389 — в v3 тихий return (заглушка эпохи ДО MicSourceV3, 430-REPORT). Запись тейков работает — takes.recorder ходит на MicSourceV3 напрямую, МИМО тумблера.
**Живой API:** MicSourceV3.acquire()/release() (refcount, общий с рекордером). enableMicrophone жив только в замейдженном V2.
**Вопросы к спеке 006:** Q1: ON→acquire()+micEnabled=true; OFF→release(). Как с общим refcount (держать +1 постоянно ок?). Q2: слайдер громкости микра — какой сеттер живой в v3? Q3: мониторинг себя при включении — MonitorRouter:195 или F-2?
[@PROPOSAL patch] жду от 006; 007 dispatch по SYNC-OK.


### TASK-013 · [INIT·007] Параллельная модель: готовь будущее + спека красного фейдера · [SPEC v3.1 ГОТОВА → agent-registry/006-SPEC-MICROPACK-№18-BUS-FADER-v3.md · DOC-CHECK#3 CONDITIONAL PASS, правки внесены · ждёт нумерацию+dispatch 007]
**Модель (директива юзера):** 007 жжёт настоящее с Оператором; 006 прорабатывает следующие шаги — задел на будущее.
**GO ПОЛУЧЕН: красный фейдер.** Твоя рекомендация принята юзером: `Inst-фейдер → setBusVolume('music-bus')` при __v3Active+hasMusicStems, явная декларация смены контракта.
**Твои деливераблы (твоя зона):**
1. Внести 5 правок плана №18-BUS из CHAIN-REPORT + AMEND красного фейдера в R4 (документация — твоя зона).
2. Прогнать третий DOC-CHECK цепочкой 009 → PASS/FAIL строкой сюда.
3. Готовую спеку MICRO-PACK красного фейдера (точные файлы/строки/формулы) положить в INBOX → я dispatch Оператора.
4. **Задел на будущее:** брифинг следующего шага F-2 — мик-маршрут G14 (0мс на проводном) детали + v-Mix стерео-разводка по эталону VocalMix.ts (frozen-read: vocals→L, mic→R, music→center, MASTER). Плюс карта cleanup сырых publishSeek дубликатов (после E: TransportBar:45/:51, WaveformCanvas:443/:448, ручные вызовы) и handoff TakesPanel ~1050-1210.
5. Ответ A2 для Ц3 одной строкой в доку пака: «двойной writer существовал (coldSync :227 effective→raw; resyncV3 мёртв), устранён Шагом 0».
**Пока ты работаешь — 007 ждёт твою спеку фейдера, ничего не dispatch'ит по нему (four-eyes §3).**

### TASK-012 · Студийная синхронизация записи (voice↔минус ±мс) + точность волны · [OPEN]
**Симптом (юзер):** записанный тейк при воспроизведении звучит РАНЬШЕ, чем был спет относительно минуса. Первые тейки после загрузки страницы кривее, затем нормализуются (warm-up?). Требование: голос на минус миллисекунда-в-миллисекунду; волна отрисовывает буфер точно.
**Якоря 007:** TakesControlStrip.tsx:298/325 TRIM-BASIS `rawDeltaSec ≈ -0.045..-0.048` (arm РАНЬШЕ blockStart — by design?); takes.recorder.ts v3-ветка (MicSourceV3 acquisition C29); useTakesPlayback.ts:219-227 `startOffset = trimStart + engineOffset` (трим срезает голову буфера!); RTL§H baseLatency .01 / outputLatency .043 @48kHz; StretchInstance latency 60ms ×7 пул; preroll seek −3s; MicSourceV3 R9 {EC,NS,AGC:false}.
**Вопросы (file:line обязателен):**
Q1: полная карта таймингов capture→буфер→trim→store→playback — каждый сдвиг в мс с источником значения.
Q2: кто сегодня владеет компенсацией латентностей? Гипотезы 007: H2 — startOffset срезает голову буфера ⇒ вокал смещается РАНЬШЕ ровно на срез; H1 — outputLatency не компенсируется нигде (тянет в «поздно»); живые данные юзера скажут, что доминирует.
Q3: механизм warm-up первых тейков (AudioWorklet init / MicSourceV3 stream ramp / StretchPool cold?).
Q4: где ПРАВИЛЬНО компенсировать — сдвиг содержимого при commit ИЛИ коррекция startOffset при плейбеке? Дух single-writer Ц3.
Q5: волна: peaks из декодированного буфера (useTakesPlayback:129-133) — подтвердить, что проблема ТОЛЬКО в origin буфера, не в отрисовке.
**Ограничения:** read-only; [@PROPOSAL patch] через TASK-012-dialogue.md; инструментация (НЕ фикс!) — первым паком 007 (уроки L2/L3).

### TASK-010 · Quest auto-jump root hunt №3 (параллельно с 007) · [DONE · 006-отчёт → agent-registry/007-BRIEFING-TASK-010-SYNC.md + OUTBOX ниже]
**Симптом (юзер-логи post-445+447):** в квесте после записи тейка и natural-end превью — транспорт САМ делает `seek(37.98)` (= ровно старт следующего блока auto-block-1), панель тейков уже на след. блоке (пустые слоты). Прыжок происходит НЕ в момент стопа записи, а ПОЗЖЕ — похоже, когда программа пересекает границу шага/блока. Уже убиты: exercise-events:39 (B2), TakesControlStrip:365 (442), auto-follow запинен (447 blockPinRef), PS Travel переведён на V3-часы (447).
**Найти ВЕСЬ писатель, который в квест-потоке меняет activeBlockId/шаг и/или секает транспорт на старт след. блока. file:line обязателен.**
1. **TakesPanel.tsx ~1040-1200**: эффекты хэндоффа шагов (`shouldContinuousHandoff`, `listenSource === 'previous-take'`, `nextStep?.scope`) — зовут ли setActiveBlock/seek при смене currentExerciseStep?
2. **exercise.store / движок квеста**: внутренние таймеры/окна шага (round-capture, intermediateWindow, step window по времени блока) — что авто-двигает шаг БЕЗ наших убитых коллеров? Кто планирует, что вызывает (advanceToNextStep? seek? publishSeek?).
3. **handleIntermediateWindowEnd (TakesControlStrip ~:365, тело ПОСЛЕ 442)**: что осталось кроме убранного advanceToNextStep; кто вызывает; секает ли транспорт / пишет блок.
4. **GLOBAL grep `setActiveBlock|getState\(\)\.setActiveBlock`** по ВСЕМУ src вне takes/WagonTrain — скрытые писатели.
5. **useTakesPlayback.ts**: возвратный seek после превью — от какого blockId считается (activeBlockIdRef?) — может «догонять» уже переключённый блок.
6. **exercise.interruption.ts**: полная карта побочных эффектов interruptPracticeSession.
**Доставить:** OUTBOX c call-graph + ВИНОВНИК file:line + минимал-фикс предложение. READ-ONLY, frozen-чтение ок. Тег [@@FACT]/[@@HYP].

**ДОПОЛНЕНИЕ 007 (22.08 · после трейса 449/450 и фикса 451-D) — фокус сузился, проверь ЭТО:**
Установлено цифрами: транспорт на 20.014, а `__belive.currentTime` = 28.89→37.69 (+8.9…+17.7 дрейф). После 451-D PS Travel стреляет верно (tt=36.98 ct=36.99 при границе 37.98 ✅). НО панель тейков держится пином, а юзер хочет: панель следует за активным блоком при легитимном движении песни.
1. **[@@FACT проверить] V3StatePublisher**: как вычисляется `currentTime` кэша (`__belive`), где base-time сбрасывается; подтвердить, что `publishSeek()` зовётся ТОЛЬКО из WagonTrain.tsx:99 (клик чипа) и НЕ зовётся из `HybridPipelineService.seek()` / REC-preroll / возврата после превью. file:line обоих путей.
2. **[@@FACT] Полный инвентарь потребителей `__belive.currentTime`** по всему src (grep) — кто ещё ест дрейфующий кэш (известен: TakesPanel playhead/follow C21-паттерн :666-668; найти остальных).
3. **[@@HYP оценить] Дизайн №17-E**: добавить `getStatePublisher()?.publishSeek(newTime)` внутрь `HybridPipelineService.seek()` (или TransportV3.seek — где единая точка?). Риски: дубль-publish при клике чипа (WagonTrain уже зовёт publishSeek ПОСЛЕ transport.seek → будет ли двойной вызов безвреден?); влияние на positionSync/monitor-events обёртки. Предложить точную локацию + сигнатуру.
4. **[@@HYP] Семантика ослабления пина blockPinRef (TakesPanel 447)**: снять пин когда транспорт ФАКТИЧЕСКИ вошёл в другой блок (по честному времени после №17-E). Предложить условие (граница блока по blockRanges vs transport.currentTime) + куда встроить.
5. **[@@FACT] Подтвердить/опровергнуть**: исходный «мгновенный прыжок панели после стопа записи» (до 447) был вызван тем же дрейфом (follow читал +13с вперёд → считал плейхед уже в след. блоке). Если да — вся сага №17 = один корень.
Доставить: OUTBOX TASK-010 с ответами 1-5, file:line, вердикт [@@FACT]/[@@HYP], рекомендация по №17-E. READ-ONLY.

### TASK-009 · Take-highlight/selection state audit (коммит vs Space) — [DONE]
**Бриф (юзер/007):** Исследовать store-состояния, управляющие ПОДСВЕТКОЙ/ВЫДЕЛЕНИЕМ слота тейка в TakesControlStrip/TakeSlot. Симптом (юзер, после N2-фикса 440): после записи тейка и возврата на блок — тейк НЕ подсвечен; подсветка только после Space/Play. Голос при клике есть (isReady ок, N2 закрыт). Значит подсветка — отдельное состояние от isReady.
**Рекон 007:** N2-фикс (440-MICRO-PACK, Оператор, tsc 314 / vitest 749/749) сделал blockTakes/isReady реактивным (слот появляется), но подсветка всё ещё только по Space. 006 TASK-004: слоты ре-рендерятся только на playingTakeId (пробел). Гипотеза: подсветка/selected = playingTakeId (или selectedTakeId), НЕ выставляется при commit, только при Space/Play (keyboard handler).
**Что сделать 006 (read-only + документ):**
1. В takes.store.ts (+ TakesControlStrip/TakeSlot) найти состояние подсветки (playingTakeId? selectedTakeId? isThisRec? другое) — file:line.
2. Где оно ВЫСТАВЛЯЕТСЯ при Space/Play (useKeyboardShortcuts.ts:74? TakesControlStrip onPlay?) — file:line.
3. Где тейк КОММИТИТСЯ (handleStop/commit в takes.recorder/store) — выставляется ли highlight-состояние.
4. Микро-фикс: выставлять highlight при commit ИЛИ деривить подсветку от «тейк существует и последний записан»; риски конфликта с playingTakeId при проигрывании/auto-advance.
5. (опц.) Коротко N3-β эталон-чек V2: оставался ли V2 на блоке после записи тейка или auto-advance (frozen-read lyrics.bridge.ts / V2 takes flow).
**Доставить:** OUTBOX с file:line + рекоменд. микро-фикс (2-3 строки) + риски. 006 НЕ правит код.

**Ц3 инвариант (релей 439b):** коммит записи САМ выставляет `selectedTakeId` (и `playingTakeId` при автоплей-превью, если сценарий есть) на свежезаписанный тейк. Space работает, т.к. play-путь трогает эти поля, commit-путь — нет. Proof-of-change (стандарт Ц3): после фикса запись → тейк **подсвечен сразу**, без Space (трейс-строкой или скрином).

---

### TASK-001 · v-Mix эталон-чек V2 (Ц3 рулинг §3) · [DONE]
**Бриф:** Ц3 переопределил v-Mix как СТЕРЕО-РАЗВОДКУ (vocals->L, mic->R), не громкость. Нужен точный эталон по V2, чтобы воспроизвести парити, а не по памяти.
**Найти и прочитать (frozen-ЧТЕНИЕ ок):** VocalMix.ts (V2-мерджер vocals->L/R), monitor-mix.js (v-Mix путь в мониторе). Локации — через grep по репозиторию.
**Вопросы для ответа (с file:line):**
1. Vocals только влево (pan=-1) ИЛИ vocals с остальной программой, а мик — отдельно вправо? Уточнить точную панораму каждого источника.
2. Где физически происходит разводка — в основном выходе (master) ИЛИ в монитор-миксе (наушники)? Есть ли отдельный монитор-путь?
3. Используются ли StereoPannerNode / ChannelMergerNode / задержки? Есть ли latency между L и R (должно быть 0)?
4. Активен ли v-Mix без живого микрофона (по эталону) — т.е. разводка program-vocals влево работает и без мика? Или весь L/R завязан на наличие мика?
5. Какие стемы идут влево, какие вправо, что по-центру?
**Принятие:** 006 возвращает факты с file:line + схему маршрутизации. Ц3 ждёт этот эталон перед имплементацией v-Mix (которая едет с F-2, не с B-slice).

---

### TASK-002 · N1 lifecycle call-graph (статически) · [DONE]
Бриф §5: все `previewGenRef++`, вызовы stopPreview, registerPracticeInterruptHandler. **Решение 006:** см. OUTBOX TASK-002 — наивная гипотеза «interrupt гасит новый превью» статически НЕ подтверждается (action зовётся ПОСЛЕ хендлера, gen-гварды :196/:203 защищают новый source). N1-корень — в audio-пути превью, не в lifecycle. Рекомендован микро-фикс шага 8 (не дёргать stopPreview, т.к. handlePlayTake сам stop+restart). Ждём живой C⁺-трейс.

---

### TASK-003 · B-slice фасад: аудит вызовов · [DONE]
Бриф §5: члены фасада + grep всех вызовов + caller-matrix + гард __v3Active. **Решение 006:** см. OUTBOX TASK-003. Члены `audioContext`/`isPlaying` отсутствуют, `setVocalsVolume`/`setInstrumentalVolume`/`enableVocalMix`/`disableVocalMix` no-op. ⚠️ Ц3 B-first-slice пропустил enableVocalMix/disableVocalMix (v-Mix зовёт их + early-return ControlDeck:329-333). V2AudioCage._zeroAllVolumes (:106-107) после B-slice замьютит V3-стемы → нужен гард.

---

### TASK-006 · __v3Active готовность · [DONE]
Бриф §5: grep __v3Active, где читать флаг для гарда. **Решение 006:** см. OUTBOX TASK-006. Флаг в main.tsx:129/147, читается 49 сайтами. Гард — в V2Adapter.delegateSync (V2Adapter.ts:51) единая точка: пропускать V2-делегирование громкости/play при `__v3Active`.

---

### TASK-004 · N2: слот не перерисовывается до пробела · [DONE] → RESOLVED-BY-440 (007)
Бриф §5: найти подписку TakesPanel/TakeSlot на bumpAssetRevision vs только play-state. **Статус:** DONE (см. OUTBOX). Рут = TakesControlStrip.tsx:38 сабскрайб функции getBlockTakes (не данных); микро-фикс = сабскрайб blockTakesMap[activeBlockId] (или assetRevision).

---

### TASK-005 · _applySolo cleanup (справка) · [DONE]
Бриф §5: в AudioEngineV2 (frozen-чтение) найти _applySolo stomp + benign-same-tick. **Статус:** DONE (см. OUTBOX). `_applySolo` реально в V3 StemChain.ts:95-103 (не frozen AudioEngineV2); benign-same-tick подтверждён; утверждённый Ц3 cleanup уже субсумирован / нужно переуказать.

---

### TASK-007 · F-2 mic->v-Mix маршрутизация · [DONE]
Бриф §5: MonitorRouter (micInput, _micDelay, _monitorGain, _defaultBranch→ctx.destination) + MicSourceV3 refcount → стерео-пан v-Mix (program-vocals→L, mic→R). **Статус:** DONE (см. OUTBOX). MonitorRouter: мик только в monitorStream, vocals внутри programInput; v-Mix требует vocalsInput + mic→main stereo bus (зеркалить V2 master).

---

### TASK-008 · V3 instrumental-vs-stems «на атомы» (предпосылка v-Mix) · [DONE]
**Бриф (юзер/Ц3):** понять текущее поведение V3 re: instrumental vs stems, чтобы корректно сконфигурить v-Mix (music center, vocals L, mic R, выход MASTER). Наблюдения юзера:
- При загрузке трека «инструментал загружается сначала, а уже потом с темы»; инструментал «изолируется», юзер его «не видит».
- На V2 инструментал был отдельным фейдером; звучало ЛИБО instrumental, ЛИБО stems (stems = сумма музыки). В V3 нужно понять, что реально играет и где instrumental в UI/роутинге.
**Вопросы (с file:line, frozen-чтение ок):**
1. MX-01 (V3DataInterceptor.ts:75): «If individual stems exist, skip instrumental master (would cause phasing)» — подтвердить: instrumental MASTER audio реально НЕ играет, когда есть отдельные стемы? Тогда «music center» в v-Mix = сумма music-стемов (drums/bass/keys/guitar/backing/other), instrumental-мастер молчит?
2. Позиция instrumental: MASTER_CLOCK_STEM_ID='instrumental' (V3DataInterceptor.ts:20, clock-anchor), StemChain Bus B (HybridPipelineService.ts:5 drums/other/instrumental), _hasSeparateStems removed (HybridPipelineService.ts:51 — instrumental всегда в Bus A stretch). Это clock-стем (тиминг) но audio-skipped?
3. setInstrumentalVolume (IV2PublicContract.ts:38, V2AudioCage.ts:88/106) — что контролирует сейчас, когда instrumental-master skipped? Почему юзер «не видит» instrumental (фейдер/UI)? Где instrumental в UI (TakesPanel/ControlDeck/MixerPanel)?
4. Загрузка: V3DataInterceptor.ts:33 «Decode order: PARALLEL, not instrumental-first» — опровергает наблюдение юзера «instrumental сначала». Есть ли оставшийся FR-004 timing-сигнал или UI-порядок, из-за которого юзер видит instrumental первым? (grep loadTrack, ensureInstrumentalBuffer, TrackRecord.instrumentalData, V3StatePublisher)
5. Для v-Mix: «music center» = сумма music-стемов (без vocals). Подтвердить, что vocals — отдельный стем 'vocals' (StemOrchestrator/StemChain), тапаемый отдельно (см. TASK-007: нужен vocalsInput). И instrumental (когда НЕТ отдельных стемов) тоже центр?
**Доставить:** атомарную схему загрузки+роутинга instrumental/stems в V3 + ответы на 5 вопросов. Питает конфиг v-Mix (F-2) и, возможно, видимость instrumental-фейдера.

---

## OUTBOX

### TASK-001 · v-Mix эталон V2 — [DONE]

**Файлы:** `src/audio/core/VocalMix.ts` (V2 мерджер), `js/monitor-mix.js` (самомонитор, НЕ v-Mix).

**1. Панорама (VocalMix.ts:35-82, `updateRouting`)**
- Music (все стемы кроме vocals) → **BOTH L и R** (ON :55-58, OFF :69-72) → центр. [@@FACT]
- Vocals → **L only** (`vocalsGain.connect(merger,0,0)` :60-62) → влево. [@@FACT]
- Mic → **R only** (`micGain.connect(merger,0,1)` :64-66) → вправо. [@@FACT]

**2. Где разводка.** `merger.connect(destination)` (:50); `destination` = `audioContext.destination` (master output). Значит v-Mix — на **основном выходе**, НЕ в мониторе. monitor-mix.js — отдельный фича-самомонитор (BT/наушники, delay-компенсация, F-2), к v-Mix отношения не имеет. [@@FACT]

**3. Узлы / latency.** `ChannelMergerNode(2)` (:10,14). **StereoPannerNode НЕТ. Delay НЕТ** → L/R latency = 0. [@@FACT]

**4. Без живого мика?** `micGain` может быть `null` (:64 `if (micGain)`). Тогда music+vocals всё равно разводятся (L=vocals+music, R=music, R-канал тихий). → **program-vocals-left работает БЕЗ мика.** [@@FACT]

**5. Итог L/R/центр.** L = vocals + music; R = music + mic(когда вкл); центр = music (дублирован оба канала равной громкостью). [@@FACT]

**Схема:**
```
musicGains ─┬─(L)─┐
            ├─(R)─┤→ merger(2ch) → destination (MASTER)
vocalsGain ──(L)──┤
micGain ─────(R)──┘        [ChannelMergerNode, без delay, latency 0]
```
**Вывод для Ц3:** v-Mix (стерео-разводка, переопределение Ц3) = ровно логика VocalMix.ts на master-выходе. Эталон готов; имплементация едет с F-2 (MonitorRouter), НЕ с B-slice.

---

### TASK-002 · N1 lifecycle call-graph (статически) — [DONE]

**Провязка клика (file:line):**
- `TakeSlot.onPlay` (TakeSlot.tsx:49) = `interruptPracticeSession(() => handlePlayTake(takeId))` (TakesControlStrip.tsx:917-921). [@@FACT]
- `interruptPracticeSession` (exercise.interruption.ts:72):
  - нет активной практики → `action()` сразу (:78-81).
  - есть → `interruptHandlerRegistry.forEach(handler)` (:85-91); хендлер = `handlePracticeInterrupt` (HANDLER_ID `'takes-control-strip'`, usePracticeInterrupt.ts:124).
  - затем restore volumes (:94-110), `cancelExercise()` (:114), **потом** `action()` (:117-119) → `handlePlayTake`. [@@FACT]
- `handlePracticeInterrupt` (usePracticeInterrupt.ts:40): если `recorderRef.isRecording` → commit + `return` (:71-83). Иначе шаги 5-7 (чистка), шаг 8: `if (playingTakeId) stopPreview({pauseEngine:true})` (:101-103). [@@FACT]
- `handlePlayTake` (useTakesPlayback.ts:105): `stopPreview()` (:108, бамп gen :65 + stop src :68) → `++previewGenRef` (:109) → decode (:115-126) → source (:154) → `source.start` (:201) → `setPlayingTakeId` (:202). [@@FACT]

**gen-гварды:** :133 `if(!ctx) return`; :196 `if(gen!==previewGenRef.current) return` (до source.start); :203 onended защищён. [@@FACT]

**Критический вывод (статически):** новый source создаётся `handlePlayTake` **ПОСЛЕ** того, как отработал interrupt-хендлер (action вызывается на :117 после forEach на :85). gen, захваченный на :109, используется на :196 для пропуска start. stopPreview из хендлера (шаг 8) лишь бампает gen и гасит **СТАРЫЙ** source — он НЕ мешает созданию нового source после хендлера. → наивная гипотеза «interrupt убивает новый превью» **статически НЕ подтверждается**. [@@FACT]

**@@HYP:** реальная тишина N1 — в audio-пути превью, а не в lifecycle прерывания: (а) `source.start(ctx.currentTime+0.01, trimStart+engineOffsetSec)` (:201) — offset в буфер; если `engineOffsetSec` ≥ duration при возврате на блок → старт за концом → тишина; (б) `ctx.state` suspended в момент превью; (в) буфер пустой. Совпадает с находкой 007: `getAudioContext()` общий со V3-движком, резюмится через `transport.play()` (:188). Живой C⁺-трейс (GEN-BUMP/GEN-GUARD:133/GEN-SRC-START/GEN-ONENDED) — арбитр.

**Рекомендация B:**
- B-i (тегировать действие): хендлер не гасит превью, если прерывающее действие = старт превью. Требует API-изменения (`interruptPracticeSession` не передаёт action в хендлер).
- B-ii (разделить владельцев): commit-settle не трогает preview-gen; stop из хендлера гасит только source, созданные ДО входа в interrupt. **Уже фактически выполнено** gen-гвардами :196/:203.
- **Оценка 006:** тяжёлый рефактор владельцев (B-ii) ИЗБЫТОЧЕН — gen-гвард уже защищает новый source. N1-фикс принадлежит audio-трейсу, не lifecycle. Для жёсткости инварианта Ц3 («interrupt не гасит превью, которое не он стартовал») — микро-фикс: в шаге 8 (`usePracticeInterrupt.ts:101`) НЕ звать `stopPreview`, т.к. `handlePlayTake` сам делает stop+restart на :108 (двойной бамп бесполезен). Безопасно, т.к. любой onPlay-клик идёт через `handlePlayTake`, который всегда stopPreview'ит первым. Ждём живой трейс для подтверждения.

---

### TASK-003 · B-slice фасад: аудит вызовов — [DONE]

**Члены `js/audio-facade-v3.js` и их заглушки:**
- `get audioContext()` — **ОТСУТСТВУЕТ** (нет геттера). Все `ae.audioContext` в v3 = undefined: TakesControlStrip:259 (vocal-fade countdown), pitch-engine:48, audio-reactive.bridge:23/25/30, recording.store:37, useWaveformData:62, FullAvatar:52, rehearsal-trigger:281/283. [@@FACT]
- `get isPlaying()` — **ОТСУТСТВУЕТ**. Читатели: TakesPanel:1141/1188 (`if(!ae.isPlaying) play()` — ВСЕГДА играет), useTakesPlayback:101 (`if(ae.isPlaying) pause()` — НИКОГДА не паузит → автопауза мертва), MonitorMixPanel:392, PitchTab:260/347. [@@FACT]
- `setVocalsVolume`/`setInstrumentalVolume` — no-op (:33). Callers: ControlDeck:186/198/252/264, VolumeControls:76/82, TakesPanel:766-927 (solo/prep/restore), SyncEditorPanel:461/464, main.tsx:226-227, patchV1:32-33. [@@FACT]
- `enableVocalMix`/`disableVocalMix` — no-op (:37). Callers: ControlDeck:327/334 (НО V3 early-return :330-332!), VolumeControls, TakesPanel:990-1017. [@@FACT] ⚠️ Ц3 B-first-slice из 434-REPORT **пропустил** эти два — v-Mix зовёт именно их, плюс надо снять early-return в ControlDeck:329-333.
- `attachProgramSource`/`detachProgramSource` — no-op (:39). Callers: useTakesPlayback:73/160, MonitorRouter:205, patchV1:47-49.

**Caller-matrix (риск при no-op→live):**
| Член | Сайты | Риск |
|---|---|---|
| setInstrumentalVolume/setVocalsVolume | ControlDeck, VolumeControls, TakesPanel:766-927, SyncEditorPanel, main.tsx:226-227, patchV1 | V2AudioCage (:106-107) оживит → замьютит V3-стемы (см. TASK-006). TakesPanel solo пишет 0→restore — оживит duck (V2-парити), риск двойной аппликай с stem.store (audio.store.ts:23: сеттеры удалены из store → фасад должен бить в pipeline/router, не в store) |
| isPlaying | TakesPanel:1141/1188, useTakesPlayback:101, MonitorMixPanel:392, PitchTab | после оживления stopPreview реально паузит движок (автопауза оживёт) — риск нежданной паузы в других сайтах |
| enableVocalMix/disableVocalMix | ControlDeck:327/334 + снять early-return :329-333 | без early-return + live — v-Mix заработает (стерео-разводка едет с F-2) |
| get audioContext | 7 сайтов выше | оживит сразу все `ae.audioContext`-читатели (frozen-safe) |

**Гард-флаг:** нужен `__v3Active` (см. TASK-006) вокруг оживлённых сеттеров.

---

### TASK-006 · __v3Active готовность — [DONE]

**Где определён/сетится:** `main.tsx:129` (`__v3Active=false` init), `main.tsx:147` (`__v3Active=active` в V3-loader). [@@FACT]
**Кто читает:** useKeyboardShortcuts, TransportBar, MixerPanel, TakesPanel, WaveformCanvas, triggers/trigger-visual.service, WagonTrain, position-sync, audio-events, loop-events, stem-engine-sync, takes.time, и др. (49 совпадений grep). [@@FACT]

**Рекомендация гарда (единая точка):** `V2Adapter.delegateSync` (V2Adapter.ts:51-58) — единственный chokepoint, зовущий `window.audioEngine[method](...)`. Добавить в начало: `if ((window as any).__v3Active && VOLUME_PLAY_METHODS.has(method)) return;` — пропускать V2-делегирование громкости/play пока V3 активен, чтобы оживлённые сеттеры фасада (роутящие в V3 pipeline) были единственными писателями. Покрывает и `main.tsx:226-227` (`delegateSync('setInstrumentalVolume',0)`), и `V2AudioCage._zeroAllVolumes` (:106-107) — иначе после B-slice они замьютят V3-стемы. [@@REC]
Альтернатива: гард в `V2AudioCage._safeDelegate` (V2AudioCage.ts:111) — но delegateSync чище (одна точка). monitor-mix.js/VocalMix.ts — V2-эра, переписываются в F-2, B-slice их не трогает.

---

### TASK-004 · N2: слот не перерисовывается до пробела — [DONE] → RESOLVED-BY-440 (007 применил 440-MICRO-PACK через Оператора; текущее дерево уже сабскрайбит blockTakesMap — DRIFT закрыт)

> **007 VERIFY (21.08):** Якоря `:38`/`:78` НЕ совпадают с текущим деревом (см. STATUS-LOG). Вероятно, N2 уже пофикшен C32 — требуется повторная проверка 007 перед действием.

**Рут (file:line):** `TakesControlStrip.tsx:38` сабскрайбит **функцию** `getBlockTakes`:
`const getBlockTakes = useTakesStore(s => s.getBlockTakes);` — селектор возвращает стабильную ссылку на функцию, поэтому компонент НЕ ре-рендерится при изменении содержимого `blockTakesMap`.
`TakesControlStrip.tsx:78`: `const blockTakes = getBlockTakes(activeBlockId);` — пересчитывает данные ТОЛЬКО при ре-рендере. [@@FACT]

Стор при коммите тейка апдейтит `blockTakesMap` + `bumpAssetRevision` (takes.store.ts:17/20/86-139), но TakesControlStrip на эти слайсы не подписан. Ре-рендерит только когда меняется ДРУГОЙ подписанный слайс — напр. `playingTakeId` (useTakesPlayback) при нажатии пробела. → тейк невидим, пока не нажмёшь пробел. **Точное совпадение с N2.** [@@FACT]

**Микро-фикс (для Оператора, 006 не правит):** заменить функцию-селектор на подписку к данным:
`const blockTakes = useTakesStore(s => s.blockTakesMap[activeBlockId]) ?? emptyBlockTakes(activeBlockId);`
(либо добавить `useTakesStore(s => s.assetRevision)`). Тогда слоты перерисуются сразу при коммите тейка. ~2-3 строки. TakeSlot сам чист (TakeSlot.tsx:32-51), вина — в родителе.

---

### TASK-005 · _applySolo cleanup (справка) — [DONE]

**Коррекция брифа:** `_applySolo` НЕТ в frozen `AudioEngineV2.ts` (grep → 0). Метод реально в **V3** `src/audio/engine-v3/pipeline/StemChain.ts:95-103` (НЕ frozen-зона). Бриф ошибся про «frozen AudioEngineV2». [@@FACT]

**Поведение (StemChain.ts:95-103):** `_soloed.size === 0` → всем `stem.volume = 1` (:97). Иначе синхронный проход: soloed=1, остальные=0 (:100-101). **benign-same-tick ПОДТВЕРЖДЁН:** атомарный цикл пишет поле `stem.volume` (не GainNode), частичное состояние не экспонируется; применение к gain — в effectiveGain single-writer (C27). Аудио-глитча в тике нет. [@@FACT]

**Рекомендация:** Ц3 (§5.2) одобрил «3-строчный cleanup benign-same-tick стомпа». Как написано, `_applySolo` уже чист, двойного апплая нет → cleanup СКОРЕЕ УЖЕ СУБСУМИРОВАН (no-op) либо бриф целился в другой метод (effectiveGain re-apply контекста C27). **006 флагует:** пусть 007 переукажет утверждённый cleanup на реальный метод или закроет как already-clean. Править frozen `AudioEngineV2` не требуется (метод там отсутствует).

---

### TASK-007 · F-2 mic->v-Mix маршрутизация (формализация) — [DONE]

**Текущий граф MonitorRouter.ts (file:line):**
- MASTER (ctx.destination): `programInput → _defaultBranch → ctx.destination` (:89-91). `programInput` = МОНО-сумма всех стемов (music+vocals), gain 1.0. Вокал внутри суммы, отдельно не пануется. [@@FACT]
- MIC: `micInput → _micDelay → _monitorGain → _monitorMaster → monitorStream` (:112-114). **Мик ТОЛЬКО в мониторе, НЕ на master.** [@@FACT]
- Вокал-холл: отдельный `vocalHallInput` (:81) → `_vocalHallGain` → `_mainDelay` (:108-109) — hall-send, не main-program vocals. [@@FACT]
- Latency: `_micDelay.delayTime.value = 0` (:57); `setDelayMs` → `_micDelay=0`, `_mainDelay=v` (:176); `setCompensateTarget('main')` → `_micDelay=0` (:184). В v-Mix-режиме мик-задержка = 0. [@@FACT]

**Что нужно для v-Mix (vocals L / mic R на MAIN, эталон VocalMix.ts→destination, TASK-001):**
1. Извлечь vocals в отдельный L-панный узел на main (сейчас vocals внутри programInput). Нужен `vocalsInput` (как vocalHallInput) → ChannelMerger L.
2. Музыка → оба канала (center).
3. Мик → НА MAIN (сейчас только monitorStream) пан R. → **мик должен быть и в основном выходе для v-Mix** (зеркалим V2-эталон: VocalMix роутил в destination). [@@REC]
4. Добавить stereo v-Mix bus (ChannelMerger 2ch) на main, НЕ деля `_mainDelay` с vocal-hall (иначе vocals-L задержится на `_mainDelay`=v при compensate-on-main → L/R skew). Собственный zero-delay. [@@REC/FLAG]

**Флаги разрывов:** ⚠️ мик не на master (нужен mic→main v-Mix bus); ⚠️ vocals не тапается отдельно на main (нужен vocalsInput); ⚠️ latency-скев через `_mainDelay`. ❓ Подтвердить у Ц3: v-Mix выход = MASTER (speakers, как V2) ИЛИ MONITOR (headphones)? Рекомендую зеркалить V2 = master.

**Вывод:** путь возможен поверх MonitorRouter (micInput/_micDelay есть, gain 0→1 через setMicEnabled :196), но требует vocalsInput + stereo v-Mix bus на main. Питает имплементацию v-Mix с F-2 (не с B-slice).

---

### TASK-008 · V3 instrumental-vs-stems «на атомы» — [DONE]

**Атомарная схема загрузки + роутинга (V3):**
```
TrackRecord(IDB): instrumentalData / vocalsData / stemsData{…}
   │
V3DataInterceptor.loadTrack (:63)
   hasStems = stemsData && keys>0                                   (:76)
   jobs = [vocals] + ( hasStems ? musicStems(≤6) : [instrumental] )  (:75-87) ← MX-01
   decode ВСЕ parallel (Promise.all)                                (:92-102)
   → orchestrator.addStem / pipeline.loadStem                        (:120-137)
   → cage.activate + __setV3Active(true) + transport.play(0)         (:146-164)
   │
HybridPipelineService: instrumental→Bus A stretch (всегда, :51); music→Bus A/B; vocals→отдельно
   → pipeline.outputNode → router.programInput → _defaultBranch → ctx.destination (MASTER)  (MonitorRouter.ts:89-91; main.tsx:160)
   │
stem-volume: useStemStore.setStemVolume(id) → stem-engine-sync → pipeline gain
   FR-014: music-стемы muted по умолчанию (stem-engine-sync.ts:27); instrumental=1, vocals=1
   │
UI-фейдер instrumental: ControlDeck.tsx:56/187, VolumeControls.tsx:69/77, MixerPanel.tsx:337(always-visible), SyncEditorPanel.tsx:107/462
Waveform: useWaveformData.ts:74 / useWaveformRender.ts:82-86 рисуют из instrumentalData (ВСЕГДА)
```

**Ответы на 5 вопросов:**

**1. MX-01 подтверждён.** `V3DataInterceptor.ts:75-87`: при `hasStems` instrumental-мастер НЕ попадает в jobs → не декодируется, не играет (фазинг). «music center» в v-Mix = сумма music-стемов (drums/bass/keys/guitar/backing/other). Когда стемов НЕТ — instrumental-мастер И есть music-center. [@@FACT]

**2. instrumental = clock-стем, audio-skipped при стемах.** `MASTER_CLOCK_STEM_ID='instrumental'` (:20); `TransportV3(ctx,'instrumental')` (engine-v3/index.ts:40) — якорь времени/duration. `HybridPipelineService.ts:51` — слот Bus A под instrumental выделен всегда, но буфер не грузится (hasStems) → слот пуст/тих. Т.е. timing есть всегда, audio — только без стемов. [@@FACT]

**3. setInstrumentalVolume / почему юзер «не видит» instrumental.** Реальный V3-контроль громкости = `useStemStore.setStemVolume('instrumental',v)` (stem.store), применяется через stem-engine-sync к gain пайплайна. Фасад `setInstrumentalVolume` сейчас no-op (B-slice, TASK-003). UI-фейдер ЕСТЬ (ControlDeck «Inst», MixerPanel always-visible :337). Но при `hasStems` instrumental-буфер MX-01-скипнут → фейдер НЕ имеет аудио-эффекта (no-op на звук). При Stems OFF + hasStems юзер слышит ТОЛЬКО vocals (instrumental скипнут, music muted FR-014); при Stems ON — music-стемы, instrumental всё равно скипнут. Отсюда «instrumental изолирован, не слышно». [@@FACT]

**4. Декод НЕ instrumental-first (наблюдение юзера опровергнуто).** `V3DataInterceptor.ts:33` + `:92 Promise.all` — PARALLEL, без FR-004 timing-сигнала (HybridClock = performance.now). Откуда иллюзия «instrumental сначала»: (а) UploadPanel.tsx:27 instrumental `required:true`, показан первым в UI; (б) **волна трека рисуется из `instrumentalData`** (useWaveformData.ts:74, useWaveformRender.ts:82-86) ВСЕГДА, даже когда audio скипнутт → юзер ВИДИТ instrumental, но он тихий; (в) когда стемов нет, instrumental — единственный загруженный аудио (играет сразу). Это perception, не порядок декода. [@@FACT/@@HYP]

**5. v-Mix «music center» = music-стемы; vocals отдельный стем; instrumental=center только без стемов.** `vocals` — отдельный стем (V3DataInterceptor.ts:81-83, всегда если vocalsData) → подтверждает TASK-007 (нужен vocalsInput-тап). «music center» в v-Mix = сумма music-стемов (hasStems) ИЛИ instrumental-мастер (нет стемов). На практике (hasStems) = music-стемы. Выход v-Mix = **MASTER** (закрыто юзером, см. STATUS-LOG:215). [@@FACT/@@REC]

**Вывод для Ц3/007:** конфиг v-Mix (F-2) = vocals(отдельный стем)→L, music-стемы-сумма→center, mic→R, MASTER. instrumental-мастер в v-Mix НЕ участвует при наличии стемов (MX-01) — его можно игнорировать в v-Mix-шине. Видимость instrumental-фейдера при стемах — кандидат на UI-скрытие/disabled (опционально, не блокирует v-Mix).

---

### TASK-009 · Take-highlight/selection state audit (коммит vs Space) — [DONE]

**Симптом (юзер):** после записи тейка и возврата на блок — тейк НЕ подсвечен; «подсветка» появляется только после Play (клик/space по тейку). Голос есть (isReady ок, N2 закрыт).

**1. Состояния подсветки (где рендерятся) — `TakeSlot.tsx`:**
- `isBest` = `blockTakes?.selectedSlot === slot` (TakesControlStrip.tsx:889) → зелёная рамка `rgba(0,200,83,0.55)` + зелёный фон (:94/:101). Это «best/Ref/selected»-подсветка. [@@FACT]
- `isPlaying` = `playingTakeId === take?.id` (TakesControlStrip.tsx:891) → inset box-shadow (:104-108). Это «играет сейчас»-подсветка. [@@FACT]
- `isThisRec` = `isRecording && recordingSlot===slot` (:890) — только во время записи.
- Дефолт (ни best, ни playing) = оранжевая рамка `rgba(255,140,0,0.55)` (:96/:103). Именно его юзер и видит после записи.

**2. Где isBest/isPlaying ВЫСТАВЛЯЮТСЯ:**
- `isBest` (selectedSlot): ТОЛЬКО в `selectTake(activeBlockId, slot)` (takes.store.ts:122-131), вызывается из `onStar` (TakesControlStrip.tsx:934-939). Больше НИГДЕ. [@@FACT]
- `isPlaying` (playingTakeId): ТОЛЬКО в `handlePlayTake` → `setPlayingTakeId(takeId)` (useTakesPlayback.ts:228), вызывается из `onPlay` (TakesControlStrip.tsx:917-923) ← `TakeSlot.handleClick` (:47-50). [@@FACT]
- ⚠️ **Коррекция рекона 007:** предполагалось «Space/keyboard handler выставляет playingTakeId». ФАКТ: Space-хандлер `useKeyboardShortcuts.ts:72-97` зовёт `transport.play()/pause()` (трек-transport), он НЕ трогает `playingTakeId`/`selectedSlot` (grep: 0 упоминаний takes в этом файле). «Подсветка после Play» реально приходит от **клика по тейку** (onPlay→handlePlayTake:228), а не от Space. [@@FACT]

**3. Где тейк КОММИТИТСЯ — выставляется ли highlight?**
- `finishRecording(meta)` (takes.store.ts:77-91): ставит `isRecording=false`, `recordingSlot=null`, новый `blockTakesMap` (с take). **`selectedSlot` и `playingTakeId` НЕ трогает.** [@@FACT]
- Коллеры: TakesControlStrip.tsx:684 (`status:'processing'`) и :701 (`status:'ready'`) — оба идут через `finishRecording`. После них `selectedSlot`/`playingTakeId` НЕ выставляются (проверено :678-705). → коммит НЕ даёт подсветки. **Точное совпадение с симптомом.** [@@FACT]

**4. Микро-фикс (для Оператора, 006 не правит):** выставить `selectedSlot` на свежезаписанный тейк внутри `finishRecording` (одна точка покрывает оба коллера :684/:701):
```ts
// takes.store.ts · finishRecording (внутри set, ~:86)
blockTakesMap: {
  ...state.blockTakesMap,
  [meta.blockId]: { ...bt, takes: newTakes, selectedSlot: meta.slot },
},
```
`meta.slot` и `meta.blockId` валидны (используются на :79/:88). → после коммита `isBest===true` → зелёная «best»-подсветка сразу, без Play. Совпадает с инвариантом Ц3 (relay 439b: коммит САМ выставляет selectedTakeId). [@@REC]
- `playingTakeId` из стора НЕ выставлять (это локальный стейт `useTakesPlayback`, не из стора; autopreview-сценария нет — см. риски). Если позже захотят autopreview, это отдельный хук-колбэк, не в сторе.

**5. Риски:**
- selectedSlot становится «best/Ref» сразу после записи — по Ц3 ок. Если в блоке уже был застаренный take, новый перехватывает best — приемлемо.
- Нет конфликта с `playingTakeId`: selectedSlot (store) и playingTakeId (hook) независимы; auto-advance гасит `playingTakeId` в `onended` (useTakesPlayback.ts:229-235), selectedSlot живёт. [@@FACT]
- Двойной вызов finishRecording (processing→ready): фикс идемпотентен (selectedSlot один и тот же slot). Во время `'processing'` слот уже «best» но не ready — визуально ок (рамка зелёная, контент грузится).
- Старая гипотеза «Space выставляет highlight» — неверна (см. п.2); не править keyboard-хандлер.

**(опц.) N3-β V2-эталон-чек:** пропущен (опционально). V2 takes-flow — frozen-чтение (`AudioEngineV2.ts`, `lyrics.bridge.ts`), не исследовано; скажи, если нужно для N3. Не блокирует TASK-009.

**Вывод для Ц3/007:** рут N9 = коммит `finishRecording` не выставляет `selectedSlot` → `isBest` ложно → тейк оранжевый (не «best»). Фикс: 1 строка в `takes.store.ts:86`. Proof-of-change: запись → тейк зелёный (best) сразу. FROZEN-комплаенс: только чтение (takes.store.ts/TakeSlot/TakesControlStrip/useTakesPlayback/useKeyboardShortcuts — НЕ frozen).

---

### TASK-010 · Quest auto-jump root hunt №3 — [DONE] (006, 22.08)

**ПОЛНЫЙ ОТЧЁТ:** `agent-registry/007-BRIEFING-TASK-010-SYNC.md` (все file:line, ответы 1–5). Якоря TakesPanel — ПОСЛЕ приземления 453/№17-F (файл вырос до 1694 строк, сдвиг +10).

TL;DR:
1. **[@@FACT]** Единственный писатель `__belive.currentTime` = тик-луп V3StatePublisher.ts:145-157 (:153-154), гейт playing :121, троттл 50мс. **На паузе кэш замерзает навсегда.** `publishSeek()` (:77-81) кэш НЕ пишет.
2. **[@@FACT]** publishSeek зовётся из 5 сайтов (НЕ только WagonTrain): WagonTrain:101/:126, TransportBar:45 (+raw-дубль :51), WaveformCanvas:443 (+raw :448), useKeyboardShortcuts:53. НЕ зовётся из REC-preroll (TakesControlStrip:202/223), превью-возврата (useTakesPlayback:189) и HybridPipelineService.seek.
3. **[@@FACT+HYP]** Единая точка seek = TransportV3.seek (:203-237; через него идут и takes.time.seekTo:26). 17-E ставить ТУДА, сразу после clock.seek :211 (dispatch CustomEvent('seek') по образцу statechange; publisher подписывается в конструкторе, цикла нет). **Обязательно**: publishSeek должен ДОБАВИТЬ запись `__belive.currentTime` — иначе заморозка кэша на паузе не лечится. Дубль-publish безвреден: единственный слушатель position-sync.ts:71-77 идемпотентен; дубли уже есть сегодня (TransportBar:45+:51, WaveformCanvas:443+:448).
4. **[@@FACT]** Потребители кэша всего 3: TakesPanel:686 (follow), RehearsalLyrics:487, takes.time.ts:16 (fallback). Скрытых писателей setActiveBlock вне takes/WagonTrain НЕТ (writers: takes.store:69, TakesPanel:660/722, WagonTrain:108).
5. **[@@FACT]** Один корень подтверждён: превью ГОНЯЕТ основной транспорт через блок (useTakesPlayback:189 seek на старт блока + :202 play + :227 буфер поверх); natural-end = пауза НА МЕСТЕ у границы (:229-236 → stopPreview pauseEngine → transport.pause ~:107-109), кэш замирает ~37.x → follow ест призрак. [@@HYP] «Дрейф 20.014 vs 28.89→37.69» = сравнение V2-заморозки с живым V3-clock, НЕ порча кэша.

⚠️ **РИСК №17-F (уже в дереве)**: unpin-условие TakesPanel:709-714 читает ТОТ ЖЕ кэш (:686). Если последний тик перед паузой приземлился за endTime блока записи → ложный unpin → симптом вернётся на natural-end. Ставить 17-E В ПАРУ с 17-F.

---

### CHAIN-REPORT №17-E · 001→002→001*→009* · [DONE] (006 координировал цепочку через general-спавны, 22.08)

**Контекст запуска:** юзер приказал прогнать боевую цепочку агентов по назначению. Воркараунд спавна: кастомные agent-файлы через Task падают (`Insufficient balance`, платформенный косяк opencode), поэтому роли грузились промптом «прочитай .opencode/agent/NNN.md» на встроенном `general`. Этапы 3–4 (ревизия 001 / верификация 009) НЕ спавнились — юзер разрешил экономию токенов, синтез и якорь-верификацию выполнил сам 006 (все OLD-блоки 457 сверены с деревом лично: TransportV3.ts:210-211, V3StatePublisher.ts :41-43/:77-81/:113-116/:70-74 — совпадение 1:1).

**Участники:** 001 CEO → DECISION v1 (D1-D5+P1); 002 Stress-Test → атаки A6(MED)+A7-A11(LOW)+чистые зоны; финальную ревизию сверил 006.

**ВЕРДИКТ ЦЕПОЧКИ на 457-MICRO-PACK (007): `REVIEW: AGREE`** — EDIT 1-5 точно реализуют D1/D2/D3; cleanup корректно отложен в отдельный пак (D4 Phase B); D5 подтверждён появлением №17-G/A в дереве (TakesPanel.tsx:688-694 честное время вперёд — проверено grep'ом 006).

**Поправки (не блокируют dispatch):**
- AMEND-1 (P1-lite, рекомендую тем же паком отдельным хунком): запись кэша `__belive.currentTime` также в `_onStateChange` (~V3StatePublisher.ts:101). Дыра: natural-end превью паузит БЕЗ seek (useTakesPlayback:107-109), idle→play(initialOffset) обходит событие (TransportV3.ts:132, гейт :204 молча отбрасывает — A6/MED от 002). Побочка A7/LOW: после stop() кэш станет 0 вместо замороженного — fallback-читатели переваривают (`getPlaybackTime()||startTime`: useTakesPlayback:219-220, TakesControlStrip:283).
- AMEND-2 (док, одна строка): «единая точка всех app-seek'ов» → смягчить: точек входа clock.seek три, из idle-seeks невидимы и сегодня (не регрессия).

**Чистые зоны (атаки 002 не вскрыли):** гонки generation-vs-event (событие проигравшего всегда precedes победителя), реентрантность dispatchEvent (event-bus.ts:46-49 snapshot), single-writer кэша сохранён (греп .ts+.js — один писатель V3StatePublisher.ts:154), dispose-симметрия тривиальна, идемпотентность position-sync.ts:71-77, тесты совместимы (V3StatePublisher.test.ts:30-39 инвариантен; wiring seek→publishSeek НИЧЕМ не покрыт — добавить кейс по возможности).

**Граница ответственности:** пак пишет ТОЛЬКО Оператор через 007 (директива юзера). После применения — live browser-proof за юзером: (1) REC на блоке у границы → natural-end превью → панель ДОЛЖНА остаться; (2) клики чипов → канвас волны следует за активным блоком (наблюдение юзера 22.08, кандидат TASK-011); (3) lyrics строка прыгает по internal seeks без тика.

---

### CHAIN-REPORT №18-BUS · 001→002→001→009 (полная цепочка) · [DONE · CONDITIONAL PASS] (006 автономно, 22.08)

**Миссия юзера:** пока 007+Оператор закрывают №17-I (458; семантика юзера: после записи ОСТАЁМСЯ на блоке записи, авто-релиз пина запрещён), подготовить СЛЕДУЮЩИЙ пак дорожной карты через полную боевую цепочку. Цель выбрана 006: **№18-BUS** (шина громкости, часть F-2; факты A1 свежие).

**Участники:** 001 CEO (DECISION v1: D1-D5) → 002 Stress-Test (атаки A1-A19; блокеры **A9/A12/A13 CRIT**) → 001 ревизия (**FINAL v2**, R1-R5) → 009 Independent Verification (таблица V1-V9 + вердикт).

**Ядро FINAL v2:**
- Шина = скалярные множители `music-bus`/`vocal-bus` БЕЗ аудио-графа; единственный writer гейна сохранён (_applyEffectiveGain HybridPipelineService.ts:561-567).
- **Шаг 0 обязателен — гигиена raw-слота** (A9): писателей _stemRawVolumes четыре, coldSync (stem-engine-sync.ts:227) пишет EFFECTIVE в RAW → формула raw×bus поверх отравленных данных = мусор.
- busOf(unknown)=music-bus (паритет V2 AudioEngineV2.ts:1152); master/instrumental исключён из fan-out (clock-tap инвариант A2.25).
- Красный фейдер ОСТАЁТСЯ stem-volume фейдером (контракт AudioEngineV2.ts:1212-1218); в V3-stems инертен для мастер-микса — осознанный контракт до B-slice. Двухрежимность v1 ОТЗЫВАЕТСЯ.
- Гард main.tsx:132-142 на volume НЕ расширяется (сломал бы cage re-zero — подтверждено независимо 002 атакой и 009 защитой); вместо него volume-gate.ts хелпер + миграция 8 источников сброса backing И мини-гард 4 громкостных методов ae.* в bootAether (self-contained).
- Crash-guard двусторонний (ramp→0 :218-227 И resurrection play():272/seek():349); NaN guards store (:216-219)+pipeline (:482-485); pre-attach replay очередь setBusVolume.

**Верификация 009:** V1 ✅ (resyncV3=dead code, N2/HIGH) · V2 ✅ · V3 ❌ опровергнуто в рантайме (.env v3 → patchV1 не вызывается, App.tsx:91; но ordering риск N3/MED) · V4 ✅ · V5 ✅ (main.tsx:302/:235) · V6 ✅ (+resurrection) · V7 ✅ · V8 частично (легально файлово) · V9 частично (A13 обоснование неверно при v3-env, архитектура верна). Новые: N4 MED Effect 2d≡2f дубль (TakesPanel:849/:901), N5/N6/N7 LOW, N8 INFO реестр писателей неполон (ControlDeck.tsx:186).

**ВЕРДИКТ: CONDITIONAL PASS.** Обязательные правки перед MICRO-PACK:
1. resyncV3 убрать как живой вектор (мёртвый код), оставить coldSync:226-227+зеркала;
2. обёртка self-contained без делегирования в фасад-no-op (patchV1 мёртв при v3-env);
3. зафиксировать assumption `VITE_ENGINE=v3` / защита от перезаписи patchV1WithV2;
4. флаг crash двусторонний;
5. дополнить реестр писателей (ControlDeck dual-calls, diffAndApply:147).
После правок 1-5 → третий DOC-CHECK (009) → MICRO-PACK пишет 007 для Оператора (dispatch только через 007).

**Ценность цикла:** пойманы 3 CRIT дефекта дизайна ДО dispatch (отравленный raw дал бы сломанную математику шины; неполный гейт воскресил бы симптом 37→100 на pre-recording/конце упражнения; ложь про no-op фасада открыла бы окно double-playback). ❄️ Frozen не затронуты планом ни в одной стадии.

#### ДОПОЛНЕНИЕ (review Санета · диагностик/со-архитектор · передано юзером 22.08)
1. **A9 = эхо старого вопроса A2 (эра C27).** Ц3 спрашивал 007 после сведения _chainA в single-writer: «старый двойной writer убран или заброшен рядом?» — ответа не было (второе напоминание). Цепочка нашла ровно это: coldSync :227 пишет effective в raw. **Действие:** в пак №18-BUS включить ЯВНОЕ закрытие A2 — «Ответ на вопрос Ц3 (C27/A2): двойной writer существовал и жил в sync-слое; устраняется Шагом 0 гигиены raw. Вопрос закрыт.»
2. **КРАСНЫЙ ФЕЙДЕР — вопрос вслух, ОТВЕТ 006: НЕТ.** После №18-BUS v2 движение Inst-фейдера («Inst 45», жалоба юзера «не могу опустить минус») в Quest НЕ изменит слышимый уровень бэкинга. Механика: фейдер пишет setStemVolume('instrumental') → но при hasStems instrumental-instance в пайплайне отсутствует (грузятся только vocals/bass/drums/guitar/keys — лог юзера; MX-01) → _applyEffectiveGain('instrumental') = no-op без звукового следа. «Инертен до B-slice» = кнопка так и останется бесполезной в этом режиме.
3. **КОНФЛИКТ, требующий решения Ц3/юзера (одним словом GO):** FINAL v2 отменил двухрежимность v1 (фейдер→music-bus при стемах) под давлением атаки A13, НО 009 опроверг A13 в рантайме (patchV1 мёртв при v3-env) → основание отката ослабло. При этом: (а) рулинг Ц3 уже был «красный фейдер = шина music-стемов»; (б) жалоба юзера требует именно этого. **Рекомендация 006:** вернуть в паковую область минимальную связку «Inst-фейдер → setBusVolume('music-bus') при __v3Active+hasMusicStems» с ЯВНОЙ декларацией смены контракта (что и требовала атака A2 — декларация, а не отказ). Атака A1 закрыта busOf(unknown)=music-bus; A3 (backing-only треки) — задокументировать ячейку. Ждёт GO — иначе третий DOC-CHECK фиксирует инертность как контракт.

---

## STATUS-LOG

- 21.08.2026: 007 создал реестр, посеял TASK-001 (v-Mix эталон V2). 006 не запущен.
- 21.08.2026: 006 (full agent, plan-mode снят) запущен. Исследовал VocalMix.ts, monitor-mix.js, exercise.interruption.ts, usePracticeInterrupt.ts, useTakesPlayback.ts, audio-facade-v3.js, V2Adapter.ts, V2AudioCage.ts.
- 21.08.2026: TASK-001 [DONE] → OUTBOX: v-Mix = VocalMix.ts stereo-split на MASTER (vocals L / mic R / music center, ChannelMergerNode, latency 0, работает без мика). monitor-mix.js — отдельный самомонитор (F-2).
- 21.08.2026: TASK-002 [DONE] → OUTBOX: статический call-graph; гипотеза «interrupt гасит превью» НЕ подтверждена (action после хендлера, gen-гварды :196/:203). N1-корень — audio-путь превью (offset/ctx/buffer), не lifecycle. Рекомендован микро-фикс шага 8.
- 21.08.2026: TASK-003 [DONE] → OUTBOX: аудит фасада; audioContext/isPlaying отсутствуют, enableVocalMix/disableVocalMix no-op (Ц3 пропустил их для v-Mix). Риск V2AudioCage замьютит V3 после B-slice.
- 21.08.2026: TASK-006 [DONE] → OUTBOX: __v3Active в main.tsx:129/147; гард в V2Adapter.delegateSync (единая точка).
- 21.08.2026: TASK-004/005/007 оставлены [OPEN] — возьмёт 006 следующим ходом (приоритет Ц3: сначала 001/002, затем 003/006 — выполнены).
- 21.08.2026: 007-TEST-SUBAGENT (эфемерный субагент 007, НЕ реальная сессия 006) повторно верифицировал TASK-001 против исходников. VocalMix.ts:10/14/50-66,52-66 (vocals L :61, mic R :65, music both :55-58), AudioEngineV2.ts:548/631 (destination=ctx.destination=MASTER), monitor-mix.js:9/737 (MonitorMix = наушники/BT только, НЕ v-Mix). Все факты OUTBOX подтверждены (ChannelMergerNode, нет StereoPanner/delay, latency 0, micGain nullable → работает без мика). TASK-001 остаётся [DONE]. ПРИМЕЧАНИЕ: это была ОДНОРАЗОВАЯ проверка спавна 007; реальная сессия 006 выполнила TASK-001/002/003/006 выше. Впредь 007 НЕ спавнит research-субагентов для задач 006 (только пишет INBOX, юзер жмёт go в 006).
- 21.08.2026: 006 (full agent) доисследовал TASK-004/005/007. TASK-004 [DONE]: N2-рут = TakesControlStrip.tsx:38 сабскрайб функции getBlockTakes (не данных) → слоты не ре-рендерятся при коммите тейка, только на playingTakeId (пробел). Микро-фикс: сабскрайб blockTakesMap[activeBlockId]. TASK-005 [DONE]: _applySolo реально в V3 StemChain.ts:95-103 (не frozen AudioEngineV2); benign-same-tick подтверждён; cleanup Ц3 уже субсумирован/нужно переуказать. TASK-007 [DONE]: MonitorRouter — мик только в monitorStream, vocals внутри programInput; v-Mix требует vocalsInput + mic→main stereo bus (зеркалить V2 master). Все 7 TASK закрыты.
- 21.08.2026: 006 RE-VERIFY по просьбе юзера (устранить путаницу после failed autonomous spawn). Перепроверил VocalMix MASTER-вывод против AudioEngineV2.ts:544-548/627-631 (updateRouting(..., ctx.destination) → MASTER) — факт TASK-001 ПОДТВЕРЖДЁН, совпадает с выводом субогента. Реестр очищен от противоречий: INBOX-«Статус» для 004/005/007 приведён в соответствие с OUTBOX [DONE]. Итог: все 7 TASK консистентны, дублей/конфликтов нет.
- 21.08.2026: 007 добавил TASK-008 (V3 instrumental-vs-stems «на атомы», предпосылка v-Mix) в INBOX. Якоря: MX-01 skip instrumental-master (V3DataInterceptor.ts:75), MASTER_CLOCK_STEM_ID (V3DataInterceptor.ts:20), параллельный декод (V3DataInterceptor.ts:33), setInstrumentalVolume (IV2PublicContract.ts:38 / V2AudioCage.ts:88/106). Цель: разобрать, что играет (music-стемы vs instrumental-master) и где instrumental в UI. Ждёт go юзера. Открытый вопрос 006 (MASTER vs MONITOR) ЗАКРЫТ юзером: vocals L / mic R / music center, выход MASTER.
- 21.08.2026: 006 (full agent) исследовал TASK-008 [DONE] → OUTBOX: атомарная схема load+route. MX-01 ПОДТВЕРЖДЁН (V3DataInterceptor.ts:75-87): при hasStems instrumental-мастер не грузится/не играет → «music center» = music-стемы. instrumental = clock-стем (timing всегда, audio только без стемов). Фейдер instrumental есть в UI (ControlDeck/MixerPanel/VolumeControls/SyncEditor) но no-op на звук при hasStems. «instrumental сначала» опровергнуто: декод PARALLEL; иллюзия — из волны useWaveformData/useWaveformRender (рисуют instrumentalData) + UploadPanel instrumental required. vocals = отдельный стем (:81-83) → подтверждает TASK-007 vocalsInput. Конфиг v-Mix: vocals→L, music-стемы→center, mic→R, MASTER; instrumental-мастер в v-Mix игнорируется при стемах. ВСЕ 8 TASK закрыты.
- 21.08.2026: 006 RE-CHECK TASK-008 (second pass). Перепроверены якоря против исходников: index.ts:40 (TransportV3 clock='instrumental') ✅; HybridPipelineService.ts:51-52 («В FULL мастер не грузить» = дубль MX-01) ✅; MonitorRouter.ts:89-91 (programInput→_defaultBranch→ctx.destination = MASTER) ✅; MonitorRouter.ts:112-114 (mic→только monitorStream, НЕ MASTER) ✅ = подтверждает флаг TASK-007 (v-Mix нужен mic→MASTER). Дрейфа нет, TASK-008 стоит.
- 21.08.2026: 007 VERIFY-PASS всей OUTBOX 006 (независимая сверка якорей с текущим деревом, FROZEN-комплаенс ок — 006 только читал). Итог: TASK-001/002/003/005/006/007/008 — CONFIRMED; **TASK-004 — DRIFT**. Детали: (1) TASK-001 ✅ VocalMix.ts stereo-MASTER (ранее + MonitorRouter.ts:89-91 MASTER в этой сессии). (2) TASK-002 ✅ ядро подтверждено: usePracticeInterrupt.ts:101 `if(playingTakeId) stopPreview({pauseEngine:true})` — шаг 8 зовёт stopPreview; call-graph консистентен. (3) TASK-003 ✅ audio-facade-v3.js: НЕТ getters audioContext/isPlaying; setVocalsVolume/setInstrumentalVolume no-op (:33); enableVocalMix/disableVocalMix no-op (:37); attachProgramSource/detachProgramSource no-op (:39). (4) **TASK-004 ⚠️ DRIFT**: заявлено «:38 сабскрайб функцию getBlockTakes, :78 getBlockTakes(activeBlockId)». ФАКТ по текущему дереву: TakesControlStrip.tsx:38 = `const blockTakesMap = useTakesStore(s => s.blockTakesMap)` (сабскрайб ДАННЫХ); :78 = `blockTakesMap[activeBlockId] ?? getBlockTakes(...)`. takes.store.ts:86/111/126 коммиты делают НОВЫЙ объект blockTakesMap (иммутабельно) → компонент ре-рендерится на коммит. Описанный 006 рут НЕ воспроизводится → N2 вероятно УЖЕ пофикшен (C32). Рекомендация 007: переоткрыть TASK-004, перепроверить N2 на живом дереве; если симптома нет — закрыть как resolved-by-C32, иначе искать рут в другом месте (не :38). (5) TASK-005 ✅ StemChain.ts:95-103 точь-в-точь (solo→stem.volume поле, benign-same-tick). (6) TASK-006 ✅ __v3Active main.tsx:129(init)/147(set) подтверждено; НО частичный гард УЖЕ есть в main.tsx:132-142 (блокирует play/seekTo/setCurrentTime при __v3Active, НЕ volume) — рекомендация 006 «добавить гард в V2Adapter.ts:51» верна по сути, но надо ПРОДЛИТЬ существующий гард на volume-методы, а не создавать с нуля. (7) TASK-007 ✅ MonitorRouter.ts:89-91 MASTER, :112-114 mic→только monitorStream. (8) TASK-008 ✅ (эта сессия).
- 21.08.2026: 006 (full agent) исследовал TASK-009 [DONE] → OUTBOX: N9-рут = коммит `finishRecording` (takes.store.ts:77-91) НЕ выставляет `selectedSlot` → `isBest` ложно → тейк оранжевый (не «best») после записи. `isBest` выставляется ТОЛЬКО в `selectTake` (store :122-131, коллер onStar TakesControlStrip.tsx:934-939); `isPlaying` — ТОЛЬКО в `handlePlayTake`→`setPlayingTakeId` (useTakesPlayback.ts:228, коллер onPlay :917). ⚠️ Коррекция рекона: Space-хандлер useKeyboardShortcuts.ts:72-97 играет transport, НЕ трогает takes — «подсветка после Play» реально от клика по тейку, не от Space. Микро-фикс: 1 строка в finishRecording — `selectedSlot: meta.slot` (покрывает оба коллера :684/:701), совпадает с инвариантом Ц3 439b. Риски: нет конфликта с playingTakeId (независимые); идемпотентно при double-commit. FROZEN-комплаенс ок (чтение takes.store/TakeSlot/TakesControlStrip/useTakesPlayback/useKeyboardShortcuts).
- 21.08.2026 (доп 007): TASK-004 DRIFT ЗАКРЫТ → RESOLVED-BY-440. Уточнение к VERIFY-PASS: N2 пофикшен НЕ C32 (C32 = audioContext, F-1.7), а 440-MICRO-PACK (007→Оператор), который сделал сабскрайб blockTakesMap на :38/:78. 006 verify подтвердил по текущему дереву; юзер-ретест подтвердил isReady/голос. «Подсветка только по Space» — НЕ N2, а отдельное состояние → TASK-009 (активна). TASK-006: гард ПРОДЛИТЬ существующий main.tsx:132-142 на volume-методы (НЕ дублировать в V2Adapter.ts:51) — уточнение B-slice скоупа.
- 21.08.2026 (доп 007b · TASK-009 DONE): 006 VERIFY-PASS, 007 независимо прочитал takes.store.ts:77-91 → подтверждено. Root N9: finishRecording НЕ выставляет selectedSlot → isBest ложно → тейк оранжевый после записи. Поле selectedSlot живёт в blockTakesMap, выставляется только selectTake (:122-131, коллер onStar). Коррекция брифа: Space-хандлер (useKeyboardShortcuts.ts:72-97) играет transport, НЕ трогает playingTakeId/selectedSlot. Фикс (441-MICRO-PACK): в finishRecording :88 добавить selectedSlot: meta.slot → тейк зелёный (best) сразу без Play. Совпадает с инвариантом Ц3 (relay 439b). FROZEN-OK (takes.store.ts не frozen). Оператор dispatched.
- 21.08.2026 (доп 007c · TASK-009 PROOF + №17): БРАУЗЕР-РЕТЕСТ юзера ПОДТВЕРДИЛ зелёный best сразу при записи → TASK-009 ЗАКРЫТ с proof-of-change. Юзер подтвердил (β): после записи прыжок на след. блок («не должно быть переключения») = №17 (подписан). 442-MICRO-PACK (DRAFT, Вар.A/B) на подпись Ц3. FROZEN-OK.
- 21.08.2026 (доп 007d · Ц3 релей 443): №17 = Вар.B DECIDED. 442 финализирован (убрать advanceToNextStep из handleIntermediateWindowEnd :365; прогрессия жива через onStepCompleted/skipStep/ExerciseStrip). Оператор dispatched. НОРМЫ: §4а frozen-вериф = метод+файлы; §4б убрать «GitHub SSH готов» из отчётов. GO: 442→B-slice→F-2→mic-уши. 440/441 закоммитить в 442-коммите (push 🔒). 443-FULL-REPORT записан+буфер.
- 21.08.2026: ⚠️ STANDING DIRECTIVE (от юзера, после потери в апдейте): ВСЕ отчёты для Ц3/SA (любой *-REPORT / итог 007) → НЕМЕДЛЕННО копировать в буфер по умолчанию (WSL: `iconv -f UTF-8 -t UTF-16LE <file | clip.exe`, с BOM), НЕ дожидаясь явной команды «в буфер» на каждый отчёт. Юзер пересылает архитектору (Центр и SA). 439-REPORT-N1-RETEST уже закинут в буфер ✅.
 - 21.08.2026: N2 микро-фикс ПРИМЕНЁН (440-MICRO-PACK, Оператор): TakesControlStrip.tsx:38/78 → подписка на blockTakesMap (данные, не функция). tsc 314 / vitest 749/749 ✅. Голос подтверждён юзером (isReady ок). ОСТАТОК: тейк не подсвечен сразу после коммита (только Space/Play) — отдельное состояние от isReady; делегировано 006 (TASK-009, аудит store-состояний подсветки/выделения). N3(β) auto-advance ещё не фиксили (ждёт эталон-чек V2). V-Mix/инструментал-уровень — №18, дизайн после F-2.
 - 21.08.2026 (доп · 008 VISION INTEGRATED): 008 = vision-агент, параллельная сессия (как 006), читает скриншоты, пишет agent-registry/008-*.md, удаляет скрины после фиксации. 008-vision-report.md: №17 визуально ПОДТВЕРЖДЁН (прыжок на Pre-Chorus после записи Verse1); №18 конкретизирован (Inst-фейдер dead-layer при стемах + сброс 37→100 на смене блока). 007 нашёл №17 ВТОРОЙ триггер exercise-events.ts:39 (442 в неверном месте:365) — коррекция №17-B2 на GO Ц3 (444-REPORT-№17-CORRECTION-008VISION-Ц3.md).
 - 21.08.2026 (доп · №17-B2 ПРИМЕНЁН + А1): Оператор применил 445-MICRO-PACK — exercise-events.ts:37-40 удалён; tsc 314 / vitest 749/749 ✅. Урок 442 (петка-норма #3): grep onStepCompleted/advanceToNextStep ДО выреза. Browser-proof (обе половины) ЗА ЮЗЕРОМ. А1 (frozen-read V2): bus-множитель ЕСТЬ (AudioEngineV2.ts:1154 `stemVolume * busVolume` + setBusVolume:1059); V3 HybridPipelineService:560 НЕТ ×busVolume ⇒ V3 потеряла шину. №18 = ВОССТАНОВЛЕНИЕ ПАРИТИ V2 (не новая фича); красный фейдер = шина music-стемов. А2 cleanup → B-first-slice; А4 канон vitest зафиксирован. Буфер Ц3: 446-REPORT-№17B2-DONE-A1-ANSWER-Ц3.md.
 - 21.08.2026 (доп · №17 ROOT CAUSE + 447-№17-C): B2-proof FAILED (прыжок живёт). Инвентаризация двигателей: 🔴 TakesPanel.tsx:687 auto-follow следует за плейхедом после стопа записи → панель прыгает; 🔴 RehearsalLyrics.tsx:480 PS Travel на замороженных V2-часах (E1-family) → мгновенный визуальный выстрел; WagonTrain:106 = ручной чип (не трогаем). Директива юзера «после записи стоять ТАМ ЖЕ» + GO → 447-MICRO-PACK-№17-C-BLOCK-PIN применён Оператором (blockPinRef pin/unpin + гвард follow; PS Travel V3-часы parity C21/418). tsc 314 / vitest 749/749 ✅. Буфер Ц3: 448-REPORT.
- 22.08.2026: 006 (реальная сессия, восстановлен контекст) закрыл TASK-010 [DONE] → OUTBOX + полный брифинг `agent-registry/007-BRIEFING-TASK-010-SYNC.md` для синхронизации с параллельным копанием 007. Ядро: кэш `__belive.currentTime` пишет ТОЛЬКО тик-луп при playing (V3StatePublisher:145-157) и замерзает на паузе навсегда; publishSeek (:77-81) кэш НЕ пишет; внутренние seeks takes-флоу (TakesControlStrip:202/223, useTakesPlayback:189 через takes.time.seekTo:26) идут без публикации. Рекомендация 17-E: dispatch 'seek' из TransportV3.seek после clock.seek :211 + добавить запись кэша в publishSeek; дубль-publish безвреден (единственный слушатель position-sync:71-77 идемпотентен; дубли уже есть: TransportBar:45+:51, WaveformCanvas:443+:448). ⚠️ Во время исследования параллельно приземлился 453/№17-F — unpin TakesPanel:709-714 ест тот же кэш; риск ложного unpin на natural-end → ставить 17-E В ПАРУ с 17-F. Один корень всей саги подтверждён ([@@FACT] механизм; [@@HYP] арифметика исторического «дрейфа» = V2-freeze vs живой V3-clock).
- 22.08.2026 (SYNC · 006 chain): прогнана боевая цепочка 001→002→001*→009* (*=синтез 006 вместо спавна, экономия токенов по директиве юзера). Вердикт на 457-MICRO-PACK: REVIEW: AGREE + 2 поправки (AMEND-1 P1-lite кэш в _onStateChange; AMEND-2 док про «единую точку»). Полный отчёт: OUTBOX «CHAIN-REPORT №17-E». Обнаружено: в дереве уже №17-G/A (TakesPanel:688-694) — 007 применил пак по брифингу 006, синхронизация работает. Оператора dispatch'ит только 007 (директива юзера). Live-proof пункты для юзера — в CHAIN-REPORT.
- 22.08.2026 (автономно · 006 chain №18-BUS): пока 007 закрывает №17-I, прогнана ПОЛНАЯ цепочка 001→002→001→009 по следующему шагу дорожной карты — пак №18-BUS (шина громкости, F-2). Итог: CONDITIONAL PASS + 5 обязательных правок плана до MICRO-PACK (см. OUTBOX «CHAIN-REPORT №18-BUS»). Цепочка поймала 3 CRIT: отравленный raw-слот (coldSync/resyncV3 пишут effective в raw), неполный гейт источников сброса backing (Effects 2d/2f/4), ложь про no-op фасада после бута (patchV1 мёртв при v3-env — опровергнуто 009 в рантайме). Красный фейдер остаётся stem-фейдером (двухрежимность отозвана). Гард на volume не расширяется — cage re-zero приоритетнее; вместо него volume-gate.ts + мини-гард bootAether. Оператора dispatch'ит только 007. После правок → третий DOC-CHECK 009.
- 22.08.2026 (SYNC · review Санета): диагностик/со-архитектор прочитал CHAIN-REPORT №18-BUS, дал 2 пункта. (1) A9 = эхо неотвеченного вопроса Ц3 «A2» эпохи C27 (двойной writer убран или заброшен?) → в пак включить ЯВНОЕ закрытие A2. (2) КРАСНЫЙ ФЕЙДЕР: ответ 006 на вопрос «юзер услышит минус тише после №18-BUS?» = **НЕТ** — фейдер инертен при стемах (instrumental-instance отсутствует, MX-01 + лог юзера). Обнаружен конфликт: FINAL v2 отменил dual-mode по атаке A13, которую 009 опроверг в рантайме; рулинг Ц3 («фейдер = шина music-стемов») и жалоба юзера требуют обратного. Рекомендация 006: вернуть Inst-фейдер→music-bus с декларацией контракта. ЖДЁТ GO юзера/Ц3 до третьего DOC-CHECK. Полностью: OUTBOX «ДОПОЛНЕНИЕ review Санета».
- 22.08.2026 (SYNC · 006): сводный брифинг для 007 по ВСЕМ открытым вопросам → `agent-registry/007-BRIEFING-OPEN-DECISIONS-22.08.md`. Ядро: 🔴 БЛОКЕР — красный фейдер GO/NO-GO (ответ на вопрос Санета = НЕТ, инертен; рекомендация вернуть music-bus связку, т.к. A13 опровергнута 009 в рантайме); №17-E ждёт окна после №17-I; №18-BUS CONDITIONAL PASS (5 правок до MICRO-PACK + третий DOC-CHECK); закрыть вопрос Ц3 «A2» строкой в паке; TASK-011 кандидат (канвас↔чипы). Оператора dispatch'ит только 007.
- 22.08.2026 (006 · помощь по №17 прыжку): статический аудит текущего дерева ПОСЛЕ применения 458(I)+459(J). ВЕРДИКТ: авто-прыжок на след. блок после записи СТАТИСТИЧЕСКИ НЕВОЗМОЖЕН. Инвентарь писателей setActiveBlock: (1) TakesPanel:660 self-heal → только в ПЕРВЫЙ блок при null/stale; (2) TakesPanel:730 G/B follow → заперт !blockPinRef && !activeExercise && !isRecording + требует непрерывный кросс |t-prevT|<1.0s; (3) WagonTrain:108/:134 — только ручные клики {fromUser:true}. Пин: component blockPinRef (arm при isRecording) + store pinnedBlockId (startRecording :87) — снимается ТОЛЬКО кликом чипа (clearPinnedBlock внешних вызовов нет). PS Travel загейчен (RehearsalLyrics:501 isRecording||pinnedBlockId → молчит). ГИПОТЕЗА №1: провальный тест юзера был ДО применения I/J (паки легли минуты назад — Оператор только что прогнал J). ПРОТОКОЛ РЕТЕСТА для юзера: свежий лог консоли при воспроизведении — takes.store:75 логирует [SET-BLOCK] СО СТЕКОМ на КАЖДУЮ смену → стек мгновенно назовёт виновника. Ожидаемые стеки: startRecording (arm, норма) / WagonTrain handleClick (ручной клик, норма) / tick (БАГ — прислать мне) / self-heal (БАГ). Нюанс для юзера: после первой записи текст/панель держат блок ДОСРОЧНО до ручного клика чипа — это ФИЧА по его же директиве, не баг.
- 22.08.2026 (006 · TASK-013): спека MICRO-PACK «№18-BUS+FADER» v3.1 ГОТОВА и прошла третий DOC-CHECK (009): таблица V1-V9 все OK, вердикт CONDITIONAL PASS → 3 правки внесены дословно (тест TC-005 синхронно с resyncV3; гард !__v3 на ae-вызов фейдера — убран DEV-warn спам; whitelist :195 в static-grep) + INFO-страховка cold-start stemsEnabled. Файл: `agent-registry/006-SPEC-MICROPACK-№18-BUS-FADER-v3.md`. Группы применения: pipeline→hygiene→store/sync/fader→gard/docs/tests, checkpoint после каждой. A2-closure строка для Ц3 внутри (H4.2). Остаток TASK-013: брифинг F-2 (G14+v-Mix эталон) и карта cleanup publishSeek — следующим ходом.
- 22.08.2026 (006 · TASK-014 PROPOSAL READY): [@PROPOSAL patch] написан → `agent-registry/006-PROPOSAL-TASK-014-MIC-TOGGLE.md`. Ядро: E1 MonitorRouter.setMicMonitor(on,volume) публичный API над _monitorGain; E2 __belive.monitorRouter экспозиция (main.tsx, замена легаси __router); E3 ControlDeck onClick — v3-ветка acquire()+createMediaStreamSource→micInput+setMicMonitor(true)/OFF=disconnect+release(). Ответы Q1 (refcount+1 постоянный ок, рекордер независимо держит свой), Q2 (живого сеттера нет — громкость=self-monitor через _monitorGain, паритет V2 «raw stream unaffected by slider» :91), Q3 (каскад MonitorRouter готов и ждёт :16; _micDelay=0 сейчас, G14-компенсация осознанно в F-2). Риски R1-R4 внутри. Юзер прислал скриншот — симптом подтверждён визуально (+ бонус: vision главной сессии работает, 008 выведен из контура).
