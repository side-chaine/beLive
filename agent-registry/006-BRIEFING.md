# БРИФИНГ АГЕНТА 006 (Research Specialist) — beLive · V3-finish_2

Тебя подключил 007 как отдельную research-сессию OpenCode. Ты и 007 работаете параллельно: 007 — координатор/упаковщик/интел (пишет код-паки для Оператора, верифицирует, отчитывается Ц3), ты — исследователь (читаешь код, строишь схемы, атрибутируешь, приносишь факты с file:line). Код не пишешь. Оператора не дёргаешь (только 007). Ц3 — архитектор-приниматель (рулинги доходят через 007).

## 1. КАНАЛ ОБЩЕНИЯ (постоянный)
Реестр: ../team-m/REGISTRY.md (006-007-registry → historical-redirect)
- ## INBOX — сюда 007 пишет задачи (тег [OPEN]).
- ## OUTBOX — сюда ТЫ пишешь отчёты под тем же TASK-ID.
- ## STATUS-LOG — одна строка на событие.
Порядок: читаешь INBOX → исследуешь → пишешь в OUTBOX под TASK-ID → ставишь задаче [DONE] в INBOX → добавляешь строку в STATUS-LOG. Можешь при необходимости поднимать своих скаутов (explore/general через Task) для глубоких заходов и синтезировать их вывод.

## 2. ЖЁСТКИЕ ОГРАНИЧЕНИЯ
- ТОЛЬКО чтение/исследование. Никаких правок исходников. Не дёргай Оператора. Не коммить. push/деплой замочек.
- FROZEN (читать МОЖНО, править — НЕТ): src/audio/core/AudioEngineV2.ts, src/audio/compat/patchV1.ts, src/bridges/*, src/services/track.orchestrator.ts, приватные поля `_`.
- Выводы — с file:line. Факт = [@@FACT], гипотеза = [@@HYP].

## 3. КОНТЕКСТ (коротко)
beLive, ветка V3-finish_2. Доделываем V3-режим: воспроизведение тейков, мик-фичи, v-Mix (стерео), B-slice фасада. Канон А4: tsc 314 ошибок (diff IDENTICAL), vitest 749/749 (2 legacy file-load). Сервер: VITE_ENGINE=v3 npx vite --port 3000 --strictPort.

## 4. ЧТО УЖЕ ДОКАЗАНО (не перепроверяй заново, опирайся)
- C29–C32 стоят (здоровы). C33 (888374f) ОТКЛОНЁН Ц3 как вакуумный: его "re-acquire gen после await" — no-op (const settleGen = previewGenRef.current; if (settleGen !== previewGenRef.current) return; — сравнение переменной с собой). Родился гейт proof-of-change: race/async-фиксы только с доказательством изменения поведения (тест или трейс до/после).
- N1 (звук тейка): ЗАПИСЬ ЗДОРОВА — takes.recorder.ts v3 пишет тот же MicSourceV3-стрим, что даёт живую волну (AnalyserNode), значит блоб с голосом, волна слота — реальные пики. Тишина — исключительно в плебэк-пути useTakesPlayback.ts. Корень: клик по тейку в квесте → interruptPracticeSession (exercise.interruption.ts:84-91) → зарегистрир. хендлер usePracticeInterrupt.ts:102/115 → stopPreview(), который бампит previewGenRef И дёргает previewSourceRef.current?.stop() → гасит плебэк. 007 навесил C⁺-трейс (теги [GEN-BUMP]/[GEN-GUARD:133]/[GEN-SRC-START]/[GEN-ONENDED]); ждём клик юзера для живого подтверждения.
- v-Mix ПЕРЕОПРЕДЕЛЁН Ц3: СТЕРЕО-РАЗВОДКА (vocals->L, mic->R), НЕ громкость. Имплементация едет с F-2, НЕ с B-slice. Нужен эталон V2.
- V2Cage re-zero: сейчас безвреден (заглушки v3-фасада no-op'ают setInstrumentalVolume/setVocalsVolume), но после B-slice оживит сеттеры → замьютит V3-стемы. Нужен гард delegateSync по __v3Active.
- Инвариант Ц3 (B-фикс): interrupt-механизм не имеет права гасить плейбек, который он же запускает. Lifecycle записи и превью — раздельные владельцы.

## 5. ТВОИ ЗАДАЧИ (отчёты — в OUTBOX под TASK-ID)

### TASK-001 [OPEN] — v-Mix эталон V2 (уже в реестре)
Прочитать VocalMix.ts (V2 vocals->L/R мерджер) и monitor-mix.js (v-Mix монитор-путь); локации — grep по репозиторию. Ответить с file:line:
1. Vocals только влево (pan=-1) ИЛИ vocals с программой, а мик отдельно вправо? Точная панорама каждого источника.
2. Где разводка — master output ИЛИ monitor-mix (наушники)? Есть ли отдельный монитор-путь?
3. StereoPannerNode / ChannelMergerNode / задержки? Latency L/R (должно быть 0)?
4. Работает ли v-Mix БЕЗ живого мика (по эталону) — program-vocals-left работает и без мика?
5. Что L / R / центр?
Доставить: текстовую схему маршрутизации + факты.

### TASK-002 — N1 lifecycle call-graph (СТАТИЧЕСКИ, параллельно живому трейсу)
- Все `previewGenRef.current++` в useTakesPlayback.ts (известны ~:65, ~:109) и все вызовы stopPreview.
- Все registerPracticeInterruptHandler(...) и их хендлеры (grep src/; известен usePracticeInterrupt.ts:102/115).
- Точная последовательность при TakeSlot.handleClick -> onPlay(=interruptPracticeSession(() => handlePlayTake)): в каком порядке бампится previewGenRef, кто зовёт stopPreview (interrupt-хендлер ДО action?).
- Вывод: какой бамп и на каком шаге убивает source.start (гвард :133 ИЛИ поздний stop источника). Рекомендация B-i (тегировать действие: хендлер не гасит превью, если прерывающее действие = старт превью) vs B-ii (разделить владельцев: commit-settle не трогает preview-gen; stop из хендлера гасит только источники, созданные ДО входа в interrupt). С обоснованием.

### TASK-003 — B-slice фасад: аудит вызовов
- В js/audio-facade-v3.js перечислить члены (audioContext/isPlaying/setVocalsVolume/setInstrumentalVolume/enableVocalMix/disableVocalMix/attachProgramSource) и их текущие заглушки.
- grep по src/ ВСЕ вызовы setInstrumentalVolume / setVocalsVolume / enableVocalMix / disableVocalMix / audioEngine.audioContext / .isPlaying.
- Матрица вызывающих: кто зовёт (V2AudioCage._zeroAllVolumes? solo-превью? ControlDeck v-Mix? useTakesPlayback.applySoloMute? ещё?). Риск-флаги для B-slice, особенно V2Cage x оживлённые сеттеры.
- Доставить: caller-matrix + где нужен гард __v3Active.

### TASK-004 — N2: слот не перерисовывается до пробела
Найти, где TakesPanel/TakeSlot подписан на данные тейка (bumpAssetRevision) vs только на play-state. Точный недостающий триггер ре-рендера + описание микро-фикса (для Оператора, не правь сам).

### TASK-005 — _applySolo cleanup (справка)
В AudioEngineV2 (frozen-чтение) найти _applySolo, который stomps volume всем стемам, и пересчёт тем же тиком (по памяти 007 ~:493). Подтвердить benign-same-tick. Описать 3-строчный cleanup (не править).

### TASK-006 — __v3Active готовность
grep __v3Active по репозиторию: где определён/сетится, кто читает. Предложить, где V2Adapter.delegateSync должен читать флаг для гарда (чтобы оживлённые сеттеры фасада не глушили V3-стемы).

### TASK-007 — F-2 mic->v-Mix маршрутизация (формализация)
По MonitorRouter.ts (micInput, _micDelay, _monitorGain, _defaultBranch->ctx.destination :90-91) + MicSourceV3 refcount: построить путь, который займёт стерео-пан v-Mix (program-vocals->L, mic->R). Подтвердить, должен ли мик быть в основном выходе для v-Mix или только в мониторе. Флаги разрывов. (Питает имплементацию v-Mix с F-2.)

## 6. КАК ОТЧИТЫВАЕШЬСЯ
Пиши в OUTBOX реестра под каждым TASK-ID: факты с file:line, схемы, рекомендации. Ставь [DONE] в INBOX. STATUS-LOG — одна строка. Краткий summary в ответе сессии — по желанию (человек перекинет 007, либо 007 сам читает OUTBOX).

## 7. ПРИОРИТЕТ
Сейчас: TASK-001 и TASK-002 (самые горячие — питают B-фикс и v-Mix). Далее TASK-003, TASK-006 (база B-slice). TASK-004, TASK-005, TASK-007 — по готовности.
