> **СТАТУС Ф001 (007_Мак, 25.08): design-only. src/ НЕ тронут (read-only sshfs). Единственный writer плана — этот файл. Frozen-зона (AudioEngineV2, patchV1, bridges/*, track.orchestrator, _-поля, vendor WASM) не затрагивается.**

# MICRO-PACK-G3 · LAYER-2 EMIT (Mac-side `team-m.report-arrived`) · draft

Автор: mac-007 / роль Ф001 Со-Архитектор · 2026-08-25
Входы: `src/character/notify-bridge.ts`, `src/character/sound/CharacterSoundManager.ts`, `src/js/ai/registry.ts`, `src/js/ui/ai-chat-ui.ts`, `src/stores/notify.store.ts`, `src/foundation/registry/initRegistry.ts`.
Контекст из брифинга: V007 (Windows) УЖЕ слушает `team-m.report-arrived`, но мост DORMANT — на Mac нет живого эмиттера. INBOX-полл (`notify-bridge.ts`) лежит как Layer-1, но INBOX.md на Маке не апдейтится вживую → хэш не меняется → эмит не происходит.

---

## §1. Где слушатель и контракт события

**Слушатель (Windows/Mac-клиент):**
- `src/character/sound/CharacterSoundManager.ts:57` — `window.addEventListener('team-m.report-arrived', () => this.playNotification());`
- `playNotification()` (`:110–112`) играет мягкий `NOTIFY_CUE` (440→660 Hz, gain 0.12) через WebAudio standalone — мимо frozen AudioEngineV2. Игнорирует `detail` (payload сейчас не читается).

**Единственный существующий эмиттер (DORMANT):**
- `src/character/notify-bridge.ts:20` — `window.dispatchEvent(new CustomEvent('team-m.report-arrived'));` (БЕЗ `detail`).
- Триггер — смена хэша `team-m/INBOX.md` в `apply()` (`:14–21`), опрашивается каждые `POLL_MS=1500` (`:35`). При оффлайне фолбэк на `inboxVirtual` (`:29`) → хэш стабилен → эмита нет.

**Контракт события (то, что V007 уже потребляет):**
```
type: 'team-m.report-arrived'          // window CustomEvent
detail: { source: string; reportId?: string; text?: string; ts: number }  // опц., backward-compat: detail может отсутствовать
```
Сейчас контракт де-факто = no-payload. Дизайн расширяет `detail` (см. §2) НЕЛОМАЮЩЕ: слушатель `:57` не читает detail, поэтому добавление полей безопасно для V007.

---

## §2. Где эмитить на Mac (точка) + payload

**Точка эмита — завершение финального сообщения-отчёта ассистента в чат-стриме Mac:**
- Авторитетный сигнал завершения ответа ассистента: событие `ASSISTANT_RESPONSE_COMPLETED` (`src/js/ai/registry.ts:4`, диспатчится в `wrapped.onDone` `:115–118` с `detail:{ fullText, source:'aiHub' }`).
- Подписка без правки registry.ts — через публичный `aiHub.on(ASSISTANT_RESPONSE_COMPLETED, …)` (`:71–73`), как уже делает `CharacterSoundManager.ts:55`.

**Payload (extend-контракт §1):**
```
window.dispatchEvent(new CustomEvent('team-m.report-arrived', {
  detail: { source: 'mac-chat', reportId: <stable-id>, text: fullText, ts: Date.now() }
}))
```
`reportId` — стабильный id репорта (напр. `useNotifyStore`+hash или correlation-id запроса), чтобы Windows мог дедупить.

**Gating (опц., но рекомендую — шум-контроль):** не эмитить на КАЖДЫЙ чат Billy. Эмитить, только если сообщение помечено как «отчёт» (тег `[REPORT]` / поле `request.kind==='report'`). Сейчас `ChatRequest` тега не несёт — вводим опц. предикат `isReport(fullText, request)` в новом модуле; при отсутствии тега эмитим всё равно (parity с текущим INBOX-путём), чтобы не сломать G1-уведомление.

---

## §3. Дизайн эмиттера (минимальный, not-frozen, single-writer-friendly)

**Решение: один writer-функция + два trigger-подписчика. НЕ two writers of `team-m.report-arrived`.**

### 3.1 Новый модуль `src/character/notify-emit.ts` (~12 строк) — SOLE dispatcher
```ts
// G3: единственный writer события 'team-m.report-arrived'.
// Все триггеры (INBOX-полл, chat-completion) зовут ТОЛЬКО отсюда.
export interface ReportArrivedDetail {
  source: 'inbox-sync' | 'mac-chat';
  reportId?: string;
  text?: string;
  ts: number;
}
export function emitReportArrived(detail: ReportArrivedDetail): void {
  try {
    window.dispatchEvent(new CustomEvent('team-m.report-arrived', { detail }));
  } catch { /* никогда не блокируем caller — G1-safe */ }
}
```

### 3.2 Новый модуль `src/character/layer2-report-emitter.ts` — подписка на chat-completion
```ts
import { aiHub, ASSISTANT_RESPONSE_COMPLETED } from '../js/ai/registry';
import { emitReportArrived } from './notify-emit';
import { registerInit } from '../foundation/registry/initRegistry';

function onAssistantDone(e: Event): void {
  const d = (e as CustomEvent).detail as { fullText?: string } | undefined;
  emitReportArrived({ source: 'mac-chat', text: d?.fullText, ts: Date.now() });
}

export function startLayer2Emitter(): () => void {
  aiHub.on(ASSISTANT_RESPONSE_COMPLETED, onAssistantDone);
  return () => aiHub.off(ASSISTANT_RESPONSE_COMPLETED, onAssistantDone);
}
registerInit({ id: 'layer2-report-emitter', init: startLayer2Emitter });
```
- `initRegistry` (idempotent `:29`, HMR-safe) — уже используется `notify-bridge.ts:1,33`, паттерн совместим.

### 3.3 Переключение INBOX-пути на sole-writer (old → new)
| Файл:строка | БЫЛО (old) | СТАНЕТ (new) |
|---|---|---|
| `notify-bridge.ts:2` | `import { useNotifyStore } from '../stores/notify.store';` | `+ import { emitReportArrived } from './notify-emit';` |
| `notify-bridge.ts:20` | `if (hadBaseline) window.dispatchEvent(new CustomEvent('team-m.report-arrived'));` | `if (hadBaseline) emitReportArrived({ source: 'inbox-sync', reportId: hash, ts: Date.now() });` |

### 3.4 Хук/effect vs прямой вызов
- Прямой вызов `emitReportArrived()` из `onAssistantDone` (НЕ React-hook, НЕ effect) — модуль вне React-дерева, инициализируется через `initRegistry` один раз. Нулевой re-render-cost, single-writer сохранён.
- Альтернатива «эмитить прямо в `registry.ts:115`» ОТВЕРГНУТА: это второй writer и правка ai-ядра вне mandate G3; подписка снаружи чище.

---

## §4. Frozen-check

Метод: diff-scope (§3.3) + grep-инвентарь. Правятся ТОЛЬКО:
- `src/character/notify-emit.ts` — **НОВЫЙ** файл, вне frozen-перечня (сосед `notify-bridge.ts` уже там живёт, не-frozen).
- `src/character/layer2-report-emitter.ts` — **НОВЫЙ** файл, `src/character/`, не в `bridges/`.
- `src/character/notify-bridge.ts` — только 1 строка импорта + 1 строка вызова (замена прямого dispatch на sole-writer). НЕ frozen-файл.

НЕ трогается (0 правок): `AudioEngineV2` (не в scope), `patchV1`, `bridges/*` (grep `team-m.report-arrived`/`ASSISTANT_RESPONSE_COMPLETED` по `src/bridges/**` → 0 хитов), `track.orchestrator.ts`, `_`-поля (не создаём/не правим), `CharacterSoundManager.ts` (слушатель оставляем как есть — он уже корректен и не-frozen по инвентарю E1), `registry.ts` (только читаем `ASSISTANT_RESPONSE_COMPLETED`, не правим). `aiHub.on/off` — публичный API, вызов без изменения ядра.

---

## §5. Verify: tsc 313 / vitest 769 + Mac manual (G1)

**Статика (базовая фиксация PLAN §2: tsc 313 / vitest 769):**
1. `npm run typecheck` (`tsc --noEmit`) — ожидание **0 дельты** против 313 (новые файлы чистые, импорты типизированы).
2. `npm run test` (`vitest`) — ожидание **≥769 passed**; новый микротест (см. 3) +1.
3. Новый тест `src/character/__tests__/layer2-report-emitter.test.ts` (~25 стр):
   - `aiHub.emit(ASSISTANT_RESPONSE_COMPLETED,{detail:{fullText:'x'}})` → `window` получает ровно 1 `team-m.report-arrived` с `detail.source==='mac-chat'`;
   - `emitReportArrived` выбрасывает внутрь try/catch (window.dispatchEvent бросает) → не падает caller (G1-safe);
   - writer-count: `window.dispatchEvent(new CustomEvent('team-m.report-arrived'` в src/ встречается ровно в `notify-emit.ts` (sole writer), в `notify-bridge.ts` — больше НЕТ.

**Mac manual (юзер/Оператор):**
4. Запустить app на Маке, открыть чат ассистента, отправить запрос-отчёт.
5. В DevTools console: убедиться, что `team-m.report-arrived` диспатчится (можно `window.addEventListener('team-m.report-arrived', e=>console.log('[G3]',e.detail))`); `CharacterSoundManager.playNotification` проигрывает `NOTIFY_CUE` (слышен мягкий бип).
6. **G1 (критично):** при `onDone` ассистента `ai-chat-ui.ts:109–114` вызывается `checkForToolCalls`, и если ТУЛ падает (`console.error` `:112`, non-fatal) — аватар-HAPPY НЕ гаснет. Доказательство: эмиттер подписан на `ASSISTANT_RESPONSE_COMPLETED` независимо от ветки tool-call и обёрнут в try/catch `notify-emit.ts`; ошибка тула в `ai-chat-ui` НЕ может подавить `team-m.report-arrived`. Проверить: форсировать ошибку тула → happy-mood держится, бип прихода слышен.
7. Dedupe: двойной фаер (INBOX-полл + chat-completion) в окне <400ms гасится `CharacterSoundManager.COOLDOWN_MS=400` (`:40`) — слышен один бип.

**Зависимости:** G3 независим от E1; выполнять после ратификации Hub. Не требует правок frozen-файлов.

---
— draft окончен · mac-007 · design-only, src/ не тронут
