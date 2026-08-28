---
agent: 007-vinda (Hub)
task: billy-tower-recon
status: delivered
updated: 2026-08-28
---

# 🤖 БАШНЯ БИЛЛИ · Разведка AI-квартала (приоритет Босса №1)

> Разведка: 007_Винда + 2 параллельных скаута (read-only, 28.08).
> Цель Босса (CONTEXT.md §6, приоритет №1): **«Правое окно чата с ИИ + динамические вставки-карточки и квесты прямо в чате»** (рефы 04/12/13; стадии S1 чат-каркас с карточками → S2 квест-планер).
> Связь: ОТЧЁТ 1 §6 квест №1 («Дострой Башню Билли до правого окна»).

---

## §1. ВЕРДИКТ КОРОТКО

**CHARTER врёт: AI District — НЕ пустырь.** Каркас застроен плотно (FSM Билли жив, звук жив, аватар-реакции живы, notify-цепь жива), но **3 здания стоят закрытыми**: чат не имеет правой панели и карточек, CoachPanel недостижим, половина кода не смонтирована. До «правого окна с карточками» — не стройка с нуля, а **достройка 4 конкретных кусков** (§5).

## §2. ФУНДАМЕНТ: src/js/ai/ (AIHub)

- **`registry.ts`** — `AIHub extends EventTarget`, синглтон `aiHub` (:133). Реестр провайдеров (Map), активная модель в localStorage. События: `modelChanged` (:27,51) + **`ASSISTANT_RESPONSE_COMPLETED='assistant.response.completed'`** (:4). Стрим `sendMessage` (:79): провайдер по активной модели; guard openrouter-без-ключа→fallback belive (:90-100); обёртка onDone с once-guard `completionHandled` (:109-119) эмитит completed (detail `{fullText, source:'aiHub'}`). Здесь же `ASSISTANT_PROFILES` — **только billy** (:147-156).
- **`types.ts`** — `Message{role, content:string}`, `ChatRequest`, `StreamCallbacks{onStart,onToken,onDone,onError}`, `AIProvider`, `ModelInfo`.
- **`providers/`** (все SSE, `data:`-строки, `[DONE]`): `belive.provider.ts` (CF Worker VITE_AI_WORKER_URL, JWT OAuth, лимит 20/день — ⚠️ воркера нет в репо, ОТЧЁТ 3 H2) · `gateway-provider.ts` (локальный gateway `POST /v1/chat/stream` :157) · `openrouter-direct.provider.ts` (ключ юзера). Регистрация main.tsx:782-797.
- **Настройки:** `settings/ai-settings.store.ts` (мини-zustand `soundEnabled`) + большой `src/stores/ai-settings.store.ts` (provider/modelId/coachName/billyMode) + AiSettingsModal (App.tsx:252).

## §3. ТРИ ПОВЕРХНОСТИ ЧАТА (живая одна)

| Поверхность | Где | Статус |
|---|---|---|
| **AiExpertPanel** (живой чат) | `src/components/TrackInfoBoard/AiExpertPanel.tsx:86` | ✅ Монтируется в 2 точках: вкладка «🤖» нижнего дока (BillyChatModule `src/deck/BillyChatModule.tsx:15` → deck/modules.ts:106-112 → ControlDeck, position:fixed bottom) + полноэкранный оверлей TrackInfoBoard.tsx:330 (fixed inset:0, z 999997) |
| **AIChatUI** (vanilla) | `src/js/ui/ai-chat-ui.ts:7` → `#ai-chat-window` (index.html:550) | 🗑 Legacy-оболочка: разметка есть, **CSS нет**, рендер только textContent (:290,:309). Но жив как писатель `avatar.tool-error` (:110) |
| **AIChatPanel.tsx** | :12 | ⏸ Mock-стрим без aiHub; модуль закомментирован (deck/modules.ts:49-59, «AI deferred») |

Механика живого чата: сообщения из `trackInfo.store` (`aiMessages`, тип `{role, content:string}`), стрим через `aiHub.sendMessage` (:389), рендер markdown-lite + QuickReply-кнопки, парсятся из текста `[ACTION:...]` (:76-80, 735-764).

## §4. СОБЫТИЙНАЯ ЦЕПОЧКА (дороги квартала — все живы)

**`ASSISTANT_RESPONSE_COMPLETED` → 4 слушателя (grep полный):**
1. `CharacterSoundManager.ts:55` → `playCue()` (CUE_DEFAULT 880→1760 = профиль Билли)
2. `layer2-report-emitter.ts:24` → window-событие `team-m.report-arrived` (source=mac-chat, G3 Layer-2)
3. `FallbackAvatar.tsx:96` (handler :82) → celebrate `happy` 700ms
4. `FullAvatar.tsx:144` (handler :130) → celebrate `happy` 700ms

**Notify-цепь (G3):** единственный writer `notify-emit.ts`; триггеры: `notify-bridge.ts` (полл team-m/INBOX.md каждые 1.5s, hash-diff → `inbox-sync` — колокол 🔔 440→660) + `layer2-report-emitter.ts`. `CharacterSoundManager.playNotification()` → NOTIFY_CUE. Cooldown 400ms, unlock по первому жесту, гейт `getSoundEnabled()`.

**Аватар:** оба (Full/Fallback) — direct DOM setAttribute + useAvatarStore: `ai.isStreaming`→listening/sing; completed→happy; window `avatar.tool-error`→error 700ms. Состояния: idle/happy/listening/sing/error/reactive (reactive dormant).

## §5. ЧЕГО НЕТ для «правого окна + карточек» (4 куска достройки)

| # | Кусок | Факт |
|---|---|---|
| К1 | **Правая панель** | Чат живёт в нижнем доке (вкладка) + полноэкранном оверлее. Right-dock-компонента в App.tsx **не существует**. |
| К2 | **Структурированные карточки** | `AiMessage{role, content:string}` — карточки только как текст-теги `[ACTION:...]` при рендере. Единственная реальная карточка — `PracticeSessionCard` (AiExpertPanel.tsx:771), хардкод вне потока сообщений. Типа «карточка в сообщении» нет. |
| К3 | **Квест-вставки** | Сценарии практики запускаются кнопками `SCENARIO:`; квест-планера (S2) и типа quest-карточки не существует. Вкладка «Quest» дока = TakesPanel, к чату не относится. |
| К4 | **Мёртвые здания** | (а) CoachPanel: каркас, body пуст («Mac-зона: подсказки/разбор от сабагентов»), чипов из ASSISTANT_PROFILES нет, `setOpen(true)` **не зовёт никто** → панель недостижима; монтаж App.tsx:**247** (REGISTRY пишет 253 — drift). (б) `getProfileSound()` определена, **вызовов ноль** — мертва. (в) `CatalogBillyChat` + `BillyMessageRenderer.tsx` ([кнопка:]/[ссылка:]) — код есть, **не смонтированы нигде**. (г) ASSISTANT_PROFILES: 1 профиль billy (TODO: English/Vocal Coach/Hero — GPT A–E Босса). |

## §6. КВАРТАЛ БИЛЛИ: таблица зданий

| Здание | Статус |
|---|---|
| Billy FSM (controller/runtime/store, 6 состояний patrol/groove/think/sleep/jump/retreat) | ✅ жив (26 тестов; рендер BillyDock App.tsx:246; приоритет resolveMode: transient > overlay→retreat > !hasTrack→sleep > isAiStreaming→think > isPlaying→groove > patrol) |
| BillyBridge (CSS vars --bl-billy-pos-x/y, PlaybackVisualScheduler) | ✅ жив |
| CharacterSoundManager (SoundCue{synth\|asset} union, standalone WebAudio) | ✅ жив |
| Notify-цепь (notify-emit/notify-bridge/layer2-emitter) | ✅ жив |
| Avatar AI-реакции (Full+Fallback) | ✅ жив |
| Skill-система (skill-registry) | 🚧 каркас: реализован 1 скилл (scout, зона catalog-empty), остальные «заглушки на v3.0» |
| ASSISTANT_PROFILES + getProfileSound | 🚧 каркас: 1 профиль, геттер мёртв |
| CatalogBillyChat + BillyMessageRenderer | ⏸ HOLD: код есть, не смонтирован |
| CoachPanel (D4) | ⏸ HOLD: body пуст, нет opener'а |

Примечание: `src/ai/` из CHARTER **не существует** — квартал фактически = `src/billy/` + `src/character/` + `src/avatar/` + `src/js/ai/`. Ещё один drift Устава (ОТЧЁТ 1 §9 D6).

## §7. НОВЫЙ DRIFT (в дополнение к ОТЧЁТУ 1 §9)

| # | Drift | Факт |
|---|---|---|
| D9 | CoachPanel монтаж | REGISTRY/док пишут App.tsx:253, факт :247 |
| D10 | getProfileSound мёртв | Определена в registry.ts, 0 вызовов (ратификация письма k ждала её локальной в CoachPanel) |
| D11 | BillyMessageRenderer не используется | Компонент существует, нигде не смонтирован |
| D12 | src/ai/ из CHARTER не существует | Квартал = billy+character+avatar+js/ai |

## §8. ВЫВОД

1. **Дороги построены, здания закрыты:** событийная инфраструктура (aiHub → звук/аватар/G3) полностью жива; UI-поверхности не дают жителю правого окна и карточек.
2. **Достройка = 4 куска (К1-К4)**, каждый — не-frozen, в зонах Mac (avatar/UI) + PC (ai-логика) по матрице REGISTRY §1. Материал дизайна готов: design-refs 04/12/13 (чат с карточками, квест-планер).
3. **Порядок по CONTEXT.md:** S1 (чат-каркас с карточками: К1+К2) → S2 (квест-планер: К3). К4 (CoachPanel/профили) — параллельно, это Mac-зона + GPT A–E артефакты Босса.
4. **Тайминг:** всё post-m3 (директива «только миграция»); разведка готова, MICRO-PACK'и упакует цепь 001→002→009 после GO Босса на квартал.

---

*Все факты: grep/чтение 28.08. Frozen не читался. Ничего не изменено. 🤖*
