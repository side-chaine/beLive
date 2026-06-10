# AI Expert System — Билли
**Проект:** beLive — Browser Vocal Studio PWA
**Компонент:** AI Expert System (Билли)
**Статус:** Wave A+B+C+D ✅ завершены | Wave E-H в разработке
**Последнее обновление:** 2026-06-10

---

## 1. Продуктовое видение

### Что такое Билли

Билли — AI-коуч, встроенный в TrackMap режим beLive. Помогает вокалистам понимать структуру песен, навигировать по треку, получать факты об артистах и планировать практику.

**Ключевой принцип:** Билли НЕ даёт вокальных советов — он не слышит голос пользователя. Он помогает навигацией, анализом структуры и фактами.

### Где живёт

```
Phase 1 (current): TrackInfoBoard → AiExpertPanel
Phase 2 (future):  Dock → "thought cloud" при клике
```

### Режимы (табы)

| Таб | Иконка | Роль | Цвет |
|-----|--------|------|------|
| Coach | 🎤 | Навигация + программа практики | #f97316 (orange) |
| Analyst | 🎵 | Полный анализ аранжировки | #818cf8 (indigo) |
| Structure | 🔬 | Сравнение структур | #22d3ee (cyan) |
| Harmonic | 🎹 | Гармонический анализ | #a855f7 (purple) |

---

## 2. Архитектура

### 2.1 Общая схема

```
Пользователь
    ↓ клик на таб эксперта
AiExpertPanel.tsx
    ↓ формирует ChatRequest
aiHub (registry.ts)
    ↓ routing по provider
     ├── BeliveProvider (built-in)
     │     ↓ JWT из userProfileStore.currentUser.authToken
     │     ↓ CF Worker belive-gateway /v1/chat/stream
     │     ↓ SSE stream
     │     ↓ Guest → AUTH_REQUIRED
     │     ↓ Rate limit: 20 req/min/IP
     │
     ├── GatewayProvider
     │     ↓ ephemeral-токен
     │     ↓ localhost:8787 (dev)
     │
     └── OpenRouterDirectProvider
           ↓ API ключ пользователя
           ↓ SSE streaming
           OpenRouter API (api.openrouter.ai)
    ↓ токены обратно
appendAiToken() → Zustand store → React re-render
    ↓ стрим завершён
processAiResponse() → parseTextCommand() → executeToolCall()
    ↓ если [SEARCH:]
Wikipedia REST API → второй API запрос с контекстом
```

### 2.2 Провайдеры

| Провайдер | API ключ | Аутентификация |
|-----------|----------|---------------|
| BeliveProvider | Не нужен | JWT (из профиля) |
| GatewayProvider | Не нужен | Ephemeral-токен |
| OpenRouterDirectProvider | API ключ пользователя | Самостоятельно |

**Критическое архитектурное решение:** OpenRouterDirectProvider читает настройки из `localStorage` напрямую, НЕ импортирует из Zustand stores. Это сохраняет границу `js/` ↔ `stores/`.

```typescript
private getApiKey(): string {
  try {
    const raw = localStorage.getItem('belive:ai-settings');
    if (!raw) return '';
    return JSON.parse(raw)?.state?.openRouterApiKey || '';
  } catch { return ''; }
}
```

### 2.3 Доступные модели

**GatewayProvider** (CF Worker belive-gateway):

| Модель | ID |
|--------|-----|
| Gemini 2.5 Pro | `google/gemini-2.5-pro` |
| Claude 4.5 Sonnet | `anthropic/claude-4.5-sonnet` |
| GPT-5 High | `openai/gpt-5-high` |
| GPT-4o Mini | `openai/gpt-4o-mini` |
| Llama 3.1 8B | `meta-llama/llama-3.1-8b` |
| Grok 4 Vision | `x-ai/grok-4-vision` |
| DeepSeek-V3.1 | `deepseek/deepseek-v3.1` |

**OpenRouter** (прямой доступ):

| Модель | ID | Цена | Context |
|--------|-----|------|---------|
| DeepSeek V3 | `deepseek/deepseek-chat-v3-0324` | Free | 64K |
| DeepSeek R1 | `deepseek/deepseek-r1` | Free | 64K |
| Llama 4 Maverick | `meta-llama/llama-4-maverick` | Free | 1M |
| Gemini 2.0 Flash | `google/gemini-2.0-flash-001` | $0.10/M | 1M |
| GPT-4o Mini | `openai/gpt-4o-mini` | $0.15/M | 128K |
| Claude 3.5 Haiku | `anthropic/claude-3.5-haiku` | $0.80/M | 200K |

**Default:** `openrouter/free` (BeliveProvider fallback)

### 2.4 Store архитектура

```
useAiSettingsStore (persist: localStorage 'belive:ai-settings')
  ├── provider: 'openrouter-direct' | 'gateway'
  ├── openRouterApiKey: string
  ├── modelId: string
  ├── coachName: string (default: 'Билли')
  ├── temperature: number (default: 0.7)
  ├── lastVerifiedAt: string | null
  ├── showSettings: boolean
  └── isConfigured(): boolean

useTrackInfoStore (НЕ persist — runtime only)
  ├── isOpen: boolean
  ├── trackId: number | null
  ├── isFirstReveal: boolean
  ├── meta: TrackMeta | null
  ├── isFetchingApi: boolean
  ├── activeExpert: AiExpert | null
  ├── aiMessages: AiMessage[]
  ├── isAiStreaming: boolean
  ├── _clickedBlockType: string | null
  └── addAiMessage(), appendAiToken(), setAiStreaming(), clearAiMessages()
```

> **Важно:** `aiMessages` НЕ персистятся — чат сбрасывается при смене трека.

---

## 3. Файловая структура

### Новые файлы (Центры 8-11)

```
src/
├── stores/
│   └── ai-settings.store.ts
├── js/ai/providers/
│   └── openrouter-direct.provider.ts
├── utils/
│   └── structure-formula.ts         ← getStructureFormula()
├── components/
│   ├── AiSettingsModal.tsx
│   ├── AiSettingsModal.module.css
│   └── TrackInfoBoard/
│       ├── TrackInfoBoard.tsx
│       ├── TrackInfoBoard.module.css
│       ├── StructureDiagram.tsx      ← Timeline bar
│       ├── AiExpertPanel.tsx         ← Чат с табами
│       ├── ai-expert-prompts.ts      ← System prompts (4 эксперта)
│       └── ai-tools.ts              ← Tools: seek, structure, catalog, wiki
└── types/
    └── track-meta.types.ts           ← TrackMeta, AiExpert, TrackComparison
```

### Изменённые файлы

```
src/main.tsx                    ← Регистрация OpenRouterDirect + hydration
src/App.tsx                     ← AiSettingsModal рендер
src/components/QuickActions.tsx ← Кнопка ⭐ для AI настроек
src/stores/trackInfo.store.ts   ← AI state (messages, streaming, clickedBlock)
```

---

## 4. Логика работы

### 4.1 Первый запуск

```
1. Пользователь кликает блок WagonTrain → открывается TrackInfoBoard
2. Видит: Structure Diagram + Meta Cards + AI Expert Panel
3. Кликает таб → проверка isConfigured()
4. Если не настроен → "⚠️ AI не настроен. Нажмите ⭐ → настройте модель."
```

### 4.2 Настройка AI

```
1. Клик на ⭐ в Header → AiSettingsModal
2. Ввод API key (sk-or-v1-...)
3. Test Connection → GET /api/v1/models (бесплатный, не тратит токены)
4. Выбор модели из dropdown (или Custom model...)
5. Coach name: "Билли" (кастомизируемый)
6. Save → localStorage + aiHub.setActiveModel()
```

### 4.3 AI запрос (полный цикл)

```
1. clearAiMessages() → setActiveExpert(expert)   ← порядок важен!
2. getAutoQuery(expert) → автозапрос
3. sendToAi():
   a. buildTrackContext() → title, structure, genre, key, bpm, activeBlock
   b. getSystemPrompt(expert, coachName)
   c. Собрать apiMessages: system + history[-10] + user
   d. aiHub.sendMessage({ model, messages, stream: true })
   e. onToken → appendAiToken() → re-render
   f. onDone → processAiResponse()
   g. onError → error message
4. processAiResponse():
   a. parseTextCommand() → [SEEK], [STRUCTURE], [CATALOG]
   b. executeToolCall() → локальное выполнение
   c. Если [SEARCH:] → Wikipedia fetch → второй запрос с контекстом
```

### 4.4 Context injection

ИИ получает контекст трека в каждом запросе:

```
TRACK CONTEXT:
Track: "Runaway" by Linkin Park
Structure: A→P→B→A→P→B→C→B→O
Total sections: 10
Genre: alternative metal
Key: (нет данных)
BPM: (нет данных)
User is currently viewing: Chorus
```

---

## 5. System Prompts архитектура

### Многослойная структура

```
Слой 1: BASE_KNOWLEDGE
  - Что такое beLive
  - TrackMap notation (A=verse, B=chorus, P=prechorus...)
  - RESPONSE FORMAT (коротко + [ACTION])
  - STRICT RULE — NO VOCAL ADVICE
  - WEB SEARCH ([SEARCH: query])

Слой 2: EXPERT-SPECIFIC
  - Coach: навигация + программа практики
  - Analyst: анализ аранжировки
  - Structure: сравнение структур
  - Harmonic: ключ/BPM совместимость

Слой 3: TRACK CONTEXT (динамический)
  - Title, Artist, Structure formula
  - Genre, Key, BPM
  - Active block (что смотрит пользователь)
```

### Дополнительные секции промптов (Wave C+)

Помимо 3 основных слоёв, система промптов содержит:

| Секция | Назначение |
|--------|-----------|
| `BILLY_PERSONALITY` | Характер Билли, стиль общения |
| `TECH_BILLY_PROMPT` | Режим tech-билли (для разработчиков) |
| `Player Controls` | 6 инструментов: set_playback_rate, loop_section, set_stem_volume, switch_mode, toggle_vocal_mix, etc. |
| `Practice Scenarios` | Сценарии практики: bpm-ramp, focus-mix, section-breakdown |
| `Language Rules` | Правила языка: коротко, без маркдауна, без советов |
| `Truth-First Runtime Rules` | Приоритет фактов над предположениями |

### NO VOCAL ADVICE — строгий запрет

Запрещённые фразы: "попробуйте спеть", "спой более энергично", "используйте резонатор", "дышите глубже".

Перенаправление: "Я не слышу твой голос — но могу помочь навигацией по треку."

---

## 6. AI Tools

### Текущие (Wave B)

| Tool | Формат | Реализация |
|------|--------|-----------|
| seek_to_section | `[SEEK:chorus:2]` | `getBlockTimeRange()` → `audioEngine.setCurrentTime()` |
| get_track_structure | `[STRUCTURE]` | `blocks.store` → `getStructureFormula()` |
| list_catalog_structures | `[CATALOG]` | `track.store` → список треков |

### Wave C additions

| Tool | Формат | Реализация |
|------|--------|-----------|
| search_wikipedia | `[SEARCH: Linkin Park]` | Wikipedia REST API (ru + en параллельно) |
| QuickReply | `[ACTION: label\|command]` | `parseQuickReplies()` → UI кнопки |

### QuickReply типы

| Тип | Цвет | Действие |
|-----|------|----------|
| seek | Orange | `audioEngine.setCurrentTime()` |
| query | Neutral | Отправить вопрос в чат |
| expert | Purple | Переключить эксперта |
| search | Cyan | Wikipedia + продолжение |

### ⚠️ Seek bug (Wave B → фикс в Wave C)

```typescript
// НЕПРАВИЛЬНО (Wave B) — target.startTime не существует на TextBlock:
const startTime = target.startTime || 0;  // undefined!

// ПРАВИЛЬНО (Wave C):
const range = getBlockTimeRange(targetBlock, markers);
if (range) { ae.setCurrentTime(range.startTime); }
```

---

## 7. CSS архитектура

### Chalk-on-blackboard тема

```css
.board {
  --neon-bpm: rgba(99, 102, 241, 0.6);
  --neon-energy: rgba(249, 115, 22, 0.6);
  --neon-key: rgba(168, 85, 247, 0.5);
  --chalk-dust: rgba(255, 255, 255, 0.02);
}
```

Neon классы активируются условно: когда данные есть → glow. Когда N/A → обычный серый. Готово к Web Audio BPM/Energy (Phase 2).

---

## 8. Frozen архитектурные решения

### ❄️ localStorage boundary (INV-AI-01)
OpenRouterDirectProvider читает `localStorage` напрямую, НЕ импортирует Zustand. Граница `js/` ↔ `stores/` сохраняется. **Не нарушать.**

### ❄️ Zustand persist hydration (INV-AI-02)
Подписка на `onFinishHydration` + синхронный fallback. Порядок обязателен. **Не упрощать до одного пути.**

### ❄️ AiSettingsModal в App.tsx (INV-AI-03)
Модалка рендерится в App.tsx, не в QuickActions. Header имеет `overflow: hidden` → модалка обрезается. **Не переносить.**

### ❄️ renderMd() → React elements (INV-AI-04)
`dangerouslySetInnerHTML` ЗАПРЕЩЁН. `renderMd()` возвращает React элементы. **Не менять.**

### ❄️ НЕ очищать aiMessages при смене эксперта (INV-AI-05)
`clearAiMessages()` НЕ вызывается при `setActiveExpert(expert)`. История сообщений сохраняется при переключении экспертов. Комментарий в коде: *"НЕ очищаем сообщения при смене эксперта"*. **Не добавлять очистку.**

---

## 9. Статус реализации

### Wave A — Foundation ✅
- ai-settings.store.ts
- OpenRouterDirectProvider (localStorage boundary)
- Регистрация в main.tsx (hydration + fallback)
- AiSettingsModal (Cline-style)
- Кнопка ⭐ в QuickActions → модалка в App.tsx

### Wave B — TrackMap AI ✅
- ai-expert-prompts.ts + structure-formula.ts
- AiExpertPanel (чат + 4 таба)
- CSS: chalk-on-blackboard тема
- ai-tools.ts: [SEEK] + [STRUCTURE] + [CATALOG]
- Markdown → React elements (без dangerouslySetInnerHTML)

### Wave C — Intelligence ✅ IMPLEMENTED
- [x] **C2:** ai-expert-prompts — NO VOCAL ADVICE + [ACTION] + [SEARCH]
- [x] **C1a:** ai-tools — fix seek (getBlockTimeRange) + QuickReply + Wikipedia
- [x] **C1b:** AiExpertPanel — QuickReply UI кнопки
- [x] **C1c:** CSS — QuickReply стили
- [x] **C1d:** ErrorBoundary

### Wave D — Dock Billy + Billy v2 ✅ IMPLEMENTED
- BillyDock.tsx — thought cloud UI
- `src/billy/` — Billy v2 FSM (см. §10)
- `useBillyLocomotion.ts` — rAF-управление анимацией

### Future Waves
| Wave | Описание |
|------|----------|
| E | Catalog Expert + Structure Comparison |
| F | Web Audio BPM/Energy → Neon activation |
| G | Player Controls (6 tools в ai-tools.ts: set_playback_rate, loop_section, set_stem_volume, switch_mode, toggle_vocal_mix, etc.) |
| H | Billy v2 FSM expansion (11 файлов в src/billy/) |

---

## 10. Billy v2 Character FSM (NEW)

Добавлен модуль `src/billy/` — чистая FSM без side effects.

### 10.1 Файлы модуля

| Файл | Строк | Назначение |
|------|-------|-----------|
| `billy-controller.ts` | 282 | `stepBilly()` — чистая FSM, `resolveMode()`, `resolveTarget()`, `resolveLerpBase()`, `computeBpmSpeed()` |
| `billy-runtime.ts` | 163 | `BillyHotState` singleton, `getBillyHotState()`, `computePixelPosition()`, `updateLineSlotCache()` |
| `billy-runtime.store.ts` | 115 | Zustand store: `mode`, `zone`, `facing`, `retreatToCorner()`, `returnFromRetreat()` |
| `billy.bridge.ts` | 76 | `initBillyBridge()` — CSS var writer для PlaybackVisualScheduler |
| `billy.constants.ts` | 153 | `CORNER_POS`, `RESPONSIVENESS`, `BPM_BASE`, `SPEED_*`, `ZONE_Z_INDEX` |
| `BillyMessageRenderer.tsx` | 189 | Рендер сообщений Билли с анимацией |
| `BillyMessageRenderer.css` | 44 | Стили сообщений Билли |
| `context-builder.ts` | 103 | `buildBillyContext()`, `resolveZone()` |
| `skill-registry.ts` | 125 | `getActiveSkill()`, `buildSystemPrompt()` |
| `types.ts` | 43 | `BillyZone`, `BillySkill`, `BillyContext` |
| `skills/scout.skill.ts` | 97 | Scout skill implementation |

### 10.2 Архитектура

```
BillyController (pure FSM) → BillyRuntime (singleton state)
    ↓
BillyRuntimeStore (Zustand mirror)
    ↓
BillyBridge (CSS var writer → scheduler)
```

- BillyController — чистая функция без side effects
- BillyRuntime — модульный singleton с hot state
- BillyRuntimeStore — Zustand mirror для React consumers
- BillyBridge — публикует CSS vars через PlaybackVisualScheduler

---

## 11. Риски

| Риск | Влияние | Митигация |
|------|---------|-----------|
| [ACTION] формат — ИИ не следует | Низкое | Few-shot examples в prompt |
| Wikipedia CORS на GitHub Pages | Среднее | Проверить после пуша |
| Seek сломан (Wave B) | Высокое | Wave C: `getBlockTimeRange()` фикс |
| React crash без ErrorBoundary | Высокое | TC-C1d: ErrorBoundary |
| Бесплатные модели rate-limited | Низкое | Переключение на платные |

---

**See also:** `docs/architecture/architecture-map-2.1.md` §5 (boot), `src/stores/trackInfo.store.ts`, `src/stores/ai-settings.store.ts`
