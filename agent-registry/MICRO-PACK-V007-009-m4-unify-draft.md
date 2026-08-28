# MICRO-PACK V007-009 — M4 unify (DRAFT from recon, pending 002 finalization)

**Автор:** 007 (coordinator) · **Цепь:** recon(explore) → 002 (finalize+stress) → 009 (verify+doc) → Operator
**Статус:** DRAFT · **Frozen:** НЕ ТРОГАТЬ (`AudioEngineV2.ts`, `patchV1.ts`, `bridges/*`, `track.orchestrator.ts`, `_`-поля). `src/js/ui/ai-chat-ui.ts` и `src/js/ai/registry.ts` — НЕ frozen.
**Канон:** `tsc --noEmit` ровно **314** · `vitest run` **763/763**

---

## 🐞 Суть
Vanilla операторский чат (`AIChatUI.handleSend`) хардкодит `fetch('/api/gateway/chat')` (404 — мёртвый путь; воркер отдаёт `/v1/chat/stream`). Живой путь уже есть: `aiHub.sendMessage` → `GatewayProvider`/`BeliveProvider`/`OpenRouterDirectProvider`. M4 = клиент-сайд рефактор (не нужен новый бэкенд). Закрывает R1-дублирование SSE-парсера (`streamOpenAI`) и 3 P0-риска.

## 🔧 Правки (черновик — 002 финализирует якоря)

### (1) `src/js/ui/ai-chat-ui.ts:3` — удалить мёртвый импорт
OLD: `import { streamOpenAI } from '../utils/stream-openai';`
NEW: (строка удаляется)

### (2) `src/js/ui/ai-chat-ui.ts:22` — поле abort → флаг
OLD: `private abortController: AbortController | null = null;`
NEW: `private wasAborted = false;`

### (3) `src/js/ui/ai-chat-ui.ts:62-148` — `handleSend` через `aiHub.sendMessage`
(см. тело из recon: замена fetch+streamOpenAI на await aiHub.sendMessage(req, {onStart,onToken,onDone,onError}); убрать ручной dispatch ASSISTANT_RESPONSE_COMPLETED — его делает хаб)

### (4) `src/js/ui/ai-chat-ui.ts:267-275` — `closeChat` abort → stopAllProviders
OLD: `this.abortController.abort(); ...`
NEW: `this.wasAborted = true; aiHub.stopAllProviders(); ...`

### (5) `src/js/ai/registry.ts:109-117` — once-guard onDone (P0-3 double-done)
OLD: `onDone: (fullText, usage) => { this.dispatchEvent(...ASSISTANT_RESPONSE_COMPLETED...); callbacks?.onDone?.(fullText, usage); }`
NEW: `let completionDispatched=false; onDone: (fullText, usage) => { if(!completionDispatched){completionDispatched=true; this.dispatchEvent(...);} callbacks?.onDone?.(fullText, usage); }`

### (6) Удалить `src/js/utils/stream-openai.ts` (R1 closure; импортер только ai-chat-ui.ts)

## ⚠️ Открытые (не блокеры, на Центр)
- Дефолтный провайдер для vanilla-чата когда юзер не выбрал модель (`registry.getActiveModel` → первый belive; BeliveProvider только если `VITE_AI_WORKER_URL` задан). Аналогично React-пути.
- History: черновик шлёт только `{role:'user', content}` (TODO). Оригинальный vanilla тоже одно сообщение — поведение не ухудшается.

## Верификация (Operator, после финализации 002)
1. tsc 314 / vitest 763.
2. Frozen нетронуты; только `ai-chat-ui.ts` + `registry.ts` + удаление `stream-openai.ts`.
3. Ретест чата: отправка сообщения идёт через живой `aiHub` (не 404), stop останавливает стрим, ошибка рендерится через `onError`.
