# STAGE-2-FINDINGS-005 · B03 Show · «СТЕК-СЕССИЯ» · 2026-09-07

> Этап-2 зонного прогона. 005-команда ×5 (параллельно по разнарядке 001, конституция).
> Вход: STAGE-1-DIRECTION-001 (7 слоёв L1-L7). Выход — добыча для 002-стресса.

---

## T1 · postMessage-мост (питает L4) — ВЕРДИКТ: MessageChannel + port-transfer + rAF-батчинг

- **Opaque origin диктует wildcard при handshake:** sandbox-iframe = origin `null` → `contentWindow.postMessage(msg, '*')` — единственный легальный первый шаг (MDN WebExtensions sandbox). Обратная валидация: `event.source === iframe.contentWindow` (MDN-канон), `event.origin` = "null" — по нему не валидируешь.
- **MessageChannel-паттерн:** родитель после `iframe load` шлёт `postMessage("init", "*", [channel.port2])` (port2 в transfer-list); iframe берёт `event.ports[0]`, назначает `onmessage` (неявно вызывает start()). Дальше — порт-в-порт, у MessagePort.postMessage **нет targetOrigin вообще**. У нас уже есть `htmlSlideLoaded`-триггер (PresenterDock.tsx:573-584) — hook для handshake готов.
- **60fps без floods:** 1 port.postMessage на rAF-кадр с 8 значениями = коалесцинг по построению (канон репо: css-var-batch last-write-wins, useBillyAudioReactive CACHE_TTL 30ms / 15-30-60fps tier). Flood невозможен: ≤60 msg/с, единицы KB/с. Tier-паттерн Billy — готовый деградатор частоты моста.
- **Либы отвергнуты:** zoid (3.4MB unpacked, 4 runtime-deps, рендерит свой iframe) · penpal (MIT, zero deps, но RPC-семантика с промисом на каждый пуш) · Comlink (~1-1.5KB gzip, Apache-2.0, Proxy-RPC — опция второго этажа если слайду нужен обратный канал). Натив = 0 зависимостей, 0 лицензионного веса.
- **Приёмник внутри слайда** пишет свои ЛОКАЛЬНЫЕ CSS-вары на documentElement слайда (наш document — не наследуется через opaque origin).
- Прецеденты: Figma plugins (main thread ↔ UI-iframe message passing), браузерные расширения (тот же opaque-origin + wildcard + source-валидация). CodePen Prefill — инъекция разовая, для live не годится.
- НЕ ПРОВЕРЕНО: гарантии message-очереди в HTML-спеке; бенчмарки structured-clone малых массивов.

## T2 · композитная запись (питает L3) — ВЕРДИКТ: pre-mix один аудиотрек через WebAudio-узел

- **Схема-победитель:** screen-видеотрек (getDisplayMedia, как сейчас) + **ОДИН** аудиотрек из нового WebAudio mix-узла: program-capture tap (createMediaStreamSource от MonitorRouter.captureStream — читаем, не меняем) + raw-mic из `MicSourceV3.acquire()` (прецедент takes.recorder.ts:77-84) → `MediaStreamAudioDestinationNode` → один MediaRecorder, `start(1000)`.
- **Почему один трек:** Chrome исторически пишет первый аудиотрек из нескольких (НЕ ПРОВЕРЕНО докой — проверить экспериментом); pre-mix решает без обходных путей.
- **`start(1000)`** — crash-resilience: при краше вкладки теряется ≤1с чанков, не вся запись; dataavailable идёт по timeslice, onstop-финализация надёжна (MDN: stop event preceded by dataavailable).
- **`clone()` не нужен** если треки созданы в capture-dest (они наши, не движка). Треки движка — только source-чтение.
- **Echo:** program-mix идёт напрямую из WebAudio (не через воздух) — эхо ему не грозит; угроза только mic. AEC на mic-констрейнте деградирует музыку; главный щит — рекомендация наушников (UX) + опц. AEC "remote-only" на mic при REC. Известный баг Chrome (AEC не работает при WebAudio-плейбеке) — НЕ ПРОВЕРЕНО, ручной тест.
- **Tier-кодеки:** расширять не mic-битрейт (Opus 24-64kbps хватает, у нас уже 128-256k), а mimeType-цепочку vp8→vp9 на max/ultra при isTypeSupported (прецедент detectAudioMime takes.recorder.ts:14-26).
- **Camera — вне T2** (отдельный рекордер/canvas PIP по RecordRTC-паттерну).
- RecordRTC не нужен: vanilla MediaRecorder + WebAudio-микшер = весь наш паттерн; ценность RecordRTC только в canvas-композитинге.
- НЕ ПРОВЕРЕНО: webm Duration:Infinity (ремукс ts-ebml), Safari-связка.

## T3 · пресеты (питает L5) — ВЕРДИКТ: `belive-show-preset` v1, ZIP-контейнер, zod-валидация

- **Формат-победитель:**
```
show.json: { format:"belive-show-preset", schemaVersion:1, id, name, savedAt, appVersion,
  scenario: ShowScenario, transitionPreset?: TransitionPreset (инлайн, чистый JSON),
  assets: [{imageId, file:"assets/img_x.png", hash?}] }   // ссылочная модель
assets/img_*.png|jpg   // блобы ТОЛЬКО здесь
```
- **НЕ включать:** HTML-блобы (rec_html_*), каверы, тексты песен — пресет сценария, не бэкап (R4: JSON-first подтверждён).
- **zod ^4.3.6 уже в package.json:11 с 0 импортов в src** — валидатор лежит без дела; safeParse (без throw, с путями ошибок) + discriminatedUnion("schemaVersion") = безопасный импорт чужого JSON бесплатно, ноль новых килобайт.
- **Превью-до-применения** (паттерн VS Code Profiles): импорт не затирает текущий сценарий молча; сценарий один → превью = «заменить/отмена» — дешёвый UX-щит.
- **Идемпотентная миграция на импорте:** переиспользуем migrateStepToSubSlides (show-editor.store.ts:52-92, маркер undefined/[]) — чужой пресет v0 поднимется тем же кодом, что и локальный IDB.
- **Распространение:** MVP = ZIP-файл + TG-бот belive-feed-bot (/upload уже ест zip с magic-bytes) = marketplace-lite без сервера. URL-шаринг (gist-паттерн VS Code) — потом, у нас CF-скелеты.
- Индустрия: VS Code (JSON+gist+превью), OBS (safe-load с backup от порчи, атомарная запись tmp+backup, медиа ссылками). Semver не подтверждён — **int schemaVersion**.

## T4 · ИИ-тулзы (питает L6) — ВЕРДИКТ: 4 макро-тулза + capability-детект + require_parameters

- **Мин-набор:** `propose_session_stack` · `set_stack_source` · `set_stack_preset` · `preflight_stack` — макро-тулзы, собираемые клиентом (анти-паттерн «100 мелких» подтверждён Anthropic: батчить повторяющиеся мелкие вызовы; порог деградации ~10-20 тулзов, нам до него далеко).
- **OpenRouter:** tools-параметр OpenAI-совместим, поддержка per-model/per-provider; `GET /v1/models?supported_parameters=tools` — runtime-фильтр моделей; **`provider.require_parameters: true`** — роутер шлёт только провайдерам, реально поддерживающим tools, иначе молчаливое игнорирование.
- **Деградация:** молчаливое игнорирование tools = модель отвечает текстом → наш парсер `[ACTION: label|command]` (ai-tools.ts:124-152) ловит это по финальному тексту (parseQuickReplies работает после onDone, registry.ts:112) — грамматика-фолбэк уже совместима со стримом.
- **Гейт подтверждения — protocol-native:** клиент всегда исполняет тул сам (Anthropic: stop_reason 'tool_use' → приложение решает → tool_result). Наш PLAYER_TOOLS-гейт (AiExpertPanel.tsx:334-355) — точная реализация; расширяем до STACK_TOOLS: propose → карточка → confirm → runPracticeActions (прецедент серийного исполнения billy-action-runner.ts:48).
- **Scoped toolset:** в ChatRequest кладём только 4-6 Show-тулзов, плеерные 15 — за бортом запроса (Anthropic Manage Tool Context: набор режется на стороне клиента).
- **tool_choice + disable_parallel_tool_use** — пошаговая линейная сборка стека (как ChatGPT-план), а не пачкой.
- **Streaming:** SSE уже несёт delta.tool_calls (OpenRouter Stream and Aggregate), наш gateway /v1/chat/stream (gateway/src/index.ts:211) — парсинг дельт поверх без смены транспорта.
- НЕ ПРОВЕРЕНО: конкретные model-ID с tools (runtime-список, один curl при интеграции); канонизированность «plan-then-confirm» в доках (у нас есть код-прецедент — достаточно).

## T5 · аудитория-шаблоны (питает L1/L5) — ВЕРДИКТ: 3 статик-скелета в src/data/

- **3 шаблона MVP** (по 1 point с 6 шагами, язык ShowStep, плейсхолдеры в [скобках] по PowerPoint-паттерну):
  - **Учитель «Урок»:** Приветствие → Теория (subSlides [Понятие 1/2]) → Разбор → feature open-studio-mixer («Показать студию») → Практика → Домашка+итоги
  - **Музыкант «Разбор трека»:** Интро → feature («Прослушаем целиком») → Структура (subSlides [Куплет/Припев/Бридж]) → Стемы → Соло/детали → Финал
  - **Блогер «Эпизод»:** Хук → Тема → Демо (imageIds) → feature («Живое демо») → Итоги → CTA
- **Где жить:** статик `src/data/showTemplates.ts` по паттерну TEXT_STYLE_PRESETS (textStylePresets.ts:4 — проверен в проде); fetched-галерея — v1.1.
- **Копия не мутирует шаблон** (Notion «Use this template»: id генерятся при инстанциации; правки шаблона не трогают копии).
- **Пустой сценарий уже есть** в каноне (show-editor.store.ts:266) — отдельный пустой шаблон не нужен.
- **Отложить:** html-шаги в шаблонах (нет зарегистрированных htmlId — риск битых ссылок); расширение featureRegistry (сейчас 1 фича open-studio-mixer, featureRegistry.ts:63).
- Прецеденты: Notion (дублирование одним кликом, превью), PowerPoint (layout+placeholders, наследование), OBS (scene collection JSON).

## СВОДКА ДЛЯ 002 (что бить)

001 каркас L1-L7 получил по каждому слою добытое решение: L4 = MessageChannel native, L3 = WebAudio pre-mix + start(1000), L5 = belive-show-preset ZIP + zod + TG-MVP, L6 = 4 макро-тулза + require_parameters + гейт, L1/L5 = 3 статик-шаблона. Открытые вопросы 002: Chrome multi-audio-track (эксперимент), AEC×WebAudio, webm Infinity, runtime-список tools-моделей, приёмник внутри слайда (дизайн), монтаж Billy (вне прогона — но стык L6↔Billy-семя есть).
