# STAGE-0-FACTS · B03 Show · фактура скаутов ×4 · 2026-09-06 (глубокая ночь 06→07.09)

> Собрано agent-show [B03] по разнарядке PLAN-KICKOFF. Скауты read-only, все утверждения с file:line.
> Назначение: вход этапа-1 (001-архитектор). Никаких решений тут нет — только факты и пробелы.

---

## S1 · ЗАПИСЬ (recording.store + REC)

**Ядро:** `src/stores/recording.store.ts` (137 строк): `isRecording/duration/error` (:7-9), `startRecording()` (:24), `stopRecording()` (:121); приватные `mediaRecorder/chunks/timerInterval/displayStream` (:14-17). Таймер = setInterval 1s в store (:112-114), стоп :130-133.

**Что пишет:** screen capture `getDisplayMedia()` (:32-35) + **program mix стемов** `ae.getProgramCaptureStream()` (MonitorRouter.captureStream, MonitorRouter.ts:36,96,128 — pre-split tap через _captureGain). Формат `video/webm;codecs=vp8,opus` (:71-73), профиль по perf-tier (performance/recording.ts:37-74, 18-25fps, 2-3.5Mbps).

**КРИТИЧНО:**
- **Микрофон НЕ пишется в Show-REC** — логика автовключения mic-монитора в V3 делает `return` (:52). Запись БЕЗ голоса пользователя.
- **Камера НЕ участвует в записи** — camera.store (61 строк) + CameraPreview.tsx (48) живут только в Live-режиме превью (:28), не связаны с recording.store.
- **Выход = только автоскачивание браузером**: `onstop` → Blob → `<a download="beLive-recording-*.webm">.click()` (:87-97). НЕТ загрузки на сервер/в каталог, НЕТ пост-обработки.
- **Две параллельные записи**: recording.store (screen+mix) и takes.recorder.ts (mic only, audio/webm opus, blob → takes.store, НЕ скачивается) — независимые isRecording.

**Потребители isRecording (12 файлов):** Show (show-editor.store:8 guard блокирует closeScenario :248 · FeatureOverlay:3 REC-индикатор+таймер · PresenterDock:3 REC-кнопка/стоп/тост «Запись сохранена» :319-326 · ShowEditor:3 Escape-guard) · ControlDeck:17 (таб rec подсвечен) · Billy-локомоция useBillyLocomotion:16,99 · useBillyState:6,59-61 (индикатор) · stem-reactive.ts:11,43-44 (гасит stem-визуал при записи) · performance.hooks.ts:16,98-100 (clamp визуального бюджета).

**Takes-REC:** takes.recorder.ts — raw mic через MicSourceV3.acquire() (:77-84), AnalyserNode tap listen-only (:112-117), stop → Promise<Blob> (:135-158).

## S2 · HTML + СЦЕНЫ + ТРИГГЕРЫ

**HTML-пайплайн Show:** show.html.service.ts (52) — createHtmlObjectUrl с принудительным `text/html;charset=utf-8` (:8-15, INV-HTML-02 кракозябры-фикс), File сохраняется целиком без .text() (:34-36, кодировка оригинала), IDB: `rec_html_${htmlId}` в store **custom_backgrounds** (idb.service.ts:601-624, trackId 'rec'). Редактор: StepWorkspace.tsx:419-466, iframe `sandbox=""` (:434-439) — полностью изолирован. Презентация: PresenterDock.tsx:571-587, iframe `sandbox="allow-scripts"` БЕЗ allow-same-origin (:578-584) — скрипты в opaque origin, XSS-меры сильные.

**iframe во всём src/ — только эти 2** (оба Show). allow= Permission-Policy, srcdoc — НЕ НАЙДЕНО. YouTube-embed iframe — НЕТ.

**Сцены = только растровые изображения:** BlockScenesModal.tsx (input accept="image/*" :443-446), рендер через CSS background-image на body (RehearsalBackground.ts:75-76,179), BlockScene хранит blob+theme (idb.service.ts:89-98), маппинг blockIndex→URL (:113-123). Видео/HTML в сценах НЕ поддержано.

**Триггеры:** типы discrete|gate|envelope|continuous (trigger.types.ts:12); источники word-sync|line-sync|section|audio|loop|custom (:18-24) — **audio/section/loop объявлены, но детекторов НЕТ** (реализован только WordLineDetector, detectors/word-line.detector.ts:5-120). TriggerBus on/onAny/emit (trigger.bus.ts:3-32), TriggerEngine.tick (:15-25). TriggerVisualService (trigger-visual.service.ts:37-231): lifecycle по playback-state-changed (:170-177), читает transport.currentTime V3 (:51-77), публикует 3 CSS-вара `--bl-word-active/progress, --bl-line-active` (:19-21,107-109) через css-var-batch (runtime/visual/css-var-batch.ts).

**Audio-reactive:** audio-reactive.ts wrapper — копия FROZEN bridges/audio-reactive.bridge.ts; AnalyserNode FFT 256 (:45-48), реконнект по track-loaded (:50-63), boot-гонка 6086bbf вылечена. Публикует 5 CSS-варов `--bl-audio-energy/bass/mid/high/beat` (:136-140) на document.documentElement. Потребитель: useBillyAudioReactive (микро-движения Billy).

**КЛЮЧЕВОЙ ПРОБЕЛ ДЛЯ ПЛАНА:** CSS-вары аудио/триггеров живут в родительском документе — **sandbox-iframe (opaque origin) их не видит**. Мост «родитель → iframe» (инжект/пост-месседж) НЕ существует. Это главный затык «динамики от HTML-проекции».

**Внешний контент (YouTube/видео/ссылки):** НЕ НАЙДЕНО нигде в рендерерах. YouTube — только метаданные каталога (catalog/types.ts:127-128, sourceType 'youtube').

**slot-matrix:** текстовые слоты лирики (Slot=строка, SlotGroup, SlotCanvas с viewport-центрированием/zoom/preview) — готовая геометрия позиционирования, но HTML не рендерит; есть резерв QuestSlotState/QuestSlotMeta (:27-34,109-122).

## S3 · ПРЕСЕТЫ + ШАРИНГ + ПАБЛИШ

**Пресеты в проекте:** TEXT_STYLE_PRESETS (data/textStylePresets.ts:4, 11 шт., код-константы) · StyleRecipe (styles/style-recipes.ts:16-26, 6 шт.) · **TRANSITION_PRESETS (data/transition-presets.ts:8) — ЕДИНСТВЕННЫЙ спроектированный делимым** («сериализуется в JSON, едет в ZIP» :3, slot-matrix/transition-preset.types.ts:102-103); поле TrackRecord.transitionPreset (idb.service.ts:47-48) — НО в export.json НЕ пишется (zip-export.service.ts:167-181 — упущение) · PERFORMANCE_PRESETS (performance.presets.ts:39) · FeatureAction.preset (types/show.types.ts:17) — уже часть JSON-сценария Show.

**Экспорт:** трек-ZIP generateTrackZip (sync/services/zip-export.service.ts:37): стемы/лирика/обложка/сцены + export.json + alignment.json, лимит 50MB. **Экспорт/импорт сценария Show — НЕ НАЙДЕНО** (loadShowScenario/saveShowScenario idb.service.ts:541-553 только IDB).

**Лифты загрузки (4, не 3):** ручной (UploadPanel → upload.service saveTrack) · ZIP (handleZipFileSelect upload.service.ts:685, классификация стемов :34-48, сцены :976-1036) · MVSEP (placeholder → поллинг → completeMvsepTrack :1098-1221) · TG-скачивание (CatalogContent.tsx:34-86 /download/<fileId>).

**TG-публикация:** tg-upload.service.ts:20-33 — FormData POST /upload, **X-API-Key 'belive2026' хардкод** :70. Бот belive-feed-bot (workers.dev): /tracks /download /upload, BOT_TOKEN в wrangler.toml:13, 50MB лимит, batch-publish.service.ts:38-118 (ген-рип → upload).

**Сеть наружу:** belive-gateway (metrics /api/metrics/sync, feed /api/feed/* с постами/лайками/комментами, AI /auth/ephemeral + /v1/chat/stream) · belive-auth (Google OAuth, JWT) · belive-mvsep (JWT-прокси) · last.fm, getsongbpm, lrclib.net, **WebSocket signaling wss://belive-rehearsal…/ws**.

**Телеметрия:** metrics.store (persist belive:metrics) → POST /api/metrics/sync Bearer (metrics-sync.service.ts:73), replay/backoff, гости не синкаются. METRICS_DB database_id ПУСТОЙ (gateway/wrangler.toml:38-42) — «скелет» (junction-registry 7-14, жертва №1).

**IDB для шаринга Show-сценария:** сериализовать JSON rec_studio_scenario_v1 (ShowScenario {title/points/steps} show.types.ts:57-61) + блобы rec_img_*/rec_html_* из beLive_scenes. Готового пути нет. Прецедент «JSON поверх ZIP» есть в трек-пайплайне — импортная сторона подготовлена, Show-стороны нет.

## S4 · ИИ-ПОВЕРХНОСТИ

**Billy = два разных:** (а) МАСКОТ-живец: FSM billy-controller.ts:202 (patrol/groove/think/sleep/jump/retreat), CSS-var writer billy.service.ts:47, монтируется App.tsx:100,121; (б) ИИ-ассистент-«семя» — 6 файлов, **0 живых импортёров** (остров): types.ts:13-19 (BillySkill: zone/systemPrompt/contextBuilder/temperature/maxTokens · BillyContext: userName/isGuest/tracksCount/currentTrackTitle/currentMode/onboardingStep) · skill-registry.ts:6-9 (1 живой скилл catalog-empty→scout, остальные «заглушки v3.0») · scout.skill.ts (промт скаута + кнопки [кнопка: …|action]) · context-builder.ts:10-32 (читает user-profile/mode/track сторы, resolveZone) · BillyMessageRenderer.tsx:16-75 (парсит [кнопка: label|action] → кнопки).

**AIChatPanel — ТРУП** (mock-ответы :30-44, регистрация закомментирована deck/modules.ts:49-59 «AI deferred»). **CatalogBillyChat — спящий** (настоящий Billy-чат, aiHub.sendMessage, BillyMessageRenderer, экшены, но 0 импортёров, [shelved]). **Живой чат = AiExpertPanel в доке** (deck/BillyChatModule.tsx:7, вкладка 🤖 order:45).

**LLM-хаб:** js/ai/registry.ts AIHub (register/getActiveModel/sendMessage, событие ASSISTANT_RESPONSE_COMPLETED). 3 провайдера: belive (CF Worker, OAuth-JWT обязателен, 20/день) · **gateway** (эффемерный токен + SSE /v1/chat/stream, бэкенд ходит в openrouter с OPENROUTER_API_KEY — в CF-очереди, models: gemini-2.5-pro/claude-4.5-sonnet/gpt-5-high/…) · openrouter-direct (свой ключ из localStorage belive:ai-settings). Гость может только direct со своим ключом.

**«ИИ → действие» — ЕСТЬ, 15 инструментов:** TrackInfoBoard/ai-tools.ts: парсеры [ACTION: label|command] (:124-152), executeToolCall (:156-194): seek_to_section, get_track_structure, list_catalog_structures, search_wikipedia, search_audiodb, set_playback_rate, loop_section, set_stem_volume, switch_mode, toggle_vocal_mix, ensure_stems_enabled, get_runtime_snapshot, stem_compare, get_recent_events, get_perf_metrics. Player-действия НЕ авто-исполняются — только клик по кнопке (AiExpertPanel.tsx:334-355). Серийный исполнитель: practice/billy-action-runner.ts:48. Прямой доступ к audioEngine (window.beLiveSwitchMode :963). **deck.setTab-команды у ИИ НЕТ.** Вывод: «ассистент собирает стэк» возможен композицией тулзов, но механика требует подтверждения пользователем.

**Guest/SSO:** skipAuth → гость (auth.service.ts:11-17); Google OAuth через VITE_AUTH_WORKER_URL, JWT в ?auth= (:54-79). Знание пользователя сейчас = сторы (track.store, user-profile.store persist belive:user-profile, onboardingProgress).

**Видео-мост Rehearsal — ГОТОВАЯ транспортная сетка для стрима:** SignalingClient (wss, реконнект) + peer-connection (RTCPeerConnection, ICE, **RTCDataChannel control+trigger, clock-sync**) + RehearsalTriggerBridge (broadcast play/pause/seek/loop/стем-волюм, drift-коррекция). Комната на 2 пира (DurableObject rehearsal-room.do.ts:9-62), билеты HMAC (teacher/student). Deep-links ?room=&role=&ticket= (App.tsx:177-183), phone-режим (?phone=1, main.tsx:817-830). Данные ходят между пирами — но это 1:1 репетиция, не публикация.

---

## СВОДКА ПРОБЕЛОВ (сырьё для 001, не решения)

1. Show-REC без микрофона (V3 return :52) и без камеры — «подготовка записи» не может собрать полный стэк человека (голос/лицо).
2. Запись = только файл в браузер: нет ни серверного хранения, ни паблиша, ни связи с каталогом.
3. HTML-проекция изолирована от аудио/триггеров (CSS-вары не видны в opaque origin iframe) — «динамика от HTML» требует моста, которого нет.
4. Триггеры-источники audio/section/loop объявлены в типах, детекторов нет.
5. YouTube/видео-контент не поддержан нигде (только метаданные каталога).
6. Пресетов-системы нет: единственный делимый пресет (transition) даже в export.json не попадает. Сценарий Show не экспортируется/не импортируется.
7. ИИ-ассистент Billy-«семя» не смонтирован (0 импортёров), скилл один, deck.setTab-механики нет, но 15 инструментов executeToolCall + action-runner уже есть.
8. Стрим: транспорт WebRTC 1:1 есть (rehearsal-мост с data-channel + clock-sync), публикации/RTMP нет.
9. Аудитория (блогеры/музыканты/учителя): в коде нет ни профилей пользователей под аудитории, ни шаблонов сценариев.
