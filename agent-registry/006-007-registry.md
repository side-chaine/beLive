# 006 <-> 007 · INTERNAL REGISTRY (beLive · V3-finish_2)

**Назначение:** постоянный канал координации между 007 (координатор/упаковщик) и 006 (research-специалитет). 006 исследует код (read/grep), при необходимости поднимает скаутов (explore/general через Task), складывает отчёты в OUTBOX. 007 читает OUTBOX и принимает решения.

**КТО ТАКОЙ 006 (важно, чтобы не путать):** Реальный 006 — это ОТДЕЛЬНАЯ сессия OpenCode, которую юзер запускает вручную («go»). 007 НЕ может активировать её автоматически: Task-тул спавнит лишь эфемерных субагентов внутри сессии 007, которые 006 НЕ являются. Любой субагент, запущенный 007 для проверки, в логах помечается `007-TEST-SUBAGENT` и НЕ атрибутируется реальному 006. Исследовательские задачи 007 ВСЕГДА оставляет в INBOX для реального 006; своих research-субагентов для них не поднимает.

**ПРАВИЛА**
- 007 пишет задачи в ## INBOX (тег [OPEN]). 006 берёт, исследует, пишет в ## OUTBOX под тем же TASK-ID, ставит задаче [DONE], добавляет строку в ## STATUS-LOG.
- 006 — ТОЛЬКО чтение/исследование. НЕ модифицирует исходники. FROZEN (чтение разрешено, правка — нет): src/audio/core/AudioEngineV2.ts, src/audio/compat/patchV1.ts, src/bridges/*, src/services/track.orchestrator.ts, приватные _.
- Все выводы 006 — с file:line ссылками. Гипотезы помечать [@@HYP]; факты — [@@FACT].
- Канон А4 не нарушать смыслом (006 не коммитит, не пишет код).

---

## INBOX

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

### TASK-004 · N2: слот не перерисовывается до пробела · [DONE]
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

### TASK-004 · N2: слот не перерисовывается до пробела — [DONE]

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
