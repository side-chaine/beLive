# MICRO-PACK · MR-1 «Журнал прогонов» (этап 1, без UI)
**2026-10-24 · 007 · для operator · вход: SPEC-progress-room-v1 (v1.1 + условия 009) · код не писал**

> Вердикт 009 = ОТЛОЖЕНО → 4 условия. Все 4 внесены в спеку и в этот пак. Оператор архитектуру НЕ меняет: только исполняет.

## 0. КАНОН И ГЕЙТЫ
- Canon: Ювелир. Минимум движущихся частей. Новых зависимостей нет, кроме test-only polyfill (см. §6).
- Замер до: tsc=181 · build=0 · HEAD bd9cad7.
- Гейт после: `npm run typecheck` → ошибок ≤181 (новых 0) · `npm run build` → exit 0 · `npx vitest run` → все зелёные, число тестов ≥ baseline.
- Frozen/вне зоны: metrics.store (App.tsx:67), session-SP, audio/engine-v3, catalog, theme — НЕ трогать.

## 1. ФАЙЛЫ (только эти)
1. `src/services/idb.service.ts` — +store, +индексы, export-хелперы, onblocked-политика
2. `src/services/practice-journal/types.ts` — типы записей
3. `src/services/practice-journal/idb.ts` — единственный писатель (CRUD/кэш/миграция/prune)
4. `src/services/practice-journal/init.ts` — подписка на document-события + registerInit
5. `src/main.tsx` — 1 строка registerInit (:60-67)
6. `src/stores/practice-session.store.ts` — 2 строки emit паузы (:424/:428)
7. `src/services/practice-journal/__tests__/*.test.ts` — тесты

## 2. СХЕМА (types.ts)
```ts
export type JournalKind = 'session' | 'pass';
export interface JournalBase { id: string; kind: JournalKind; at: number; day: string; ownerId: string; migrated?: boolean }
export interface SessionRecord extends JournalBase {
  kind: 'session'; startedAt: number; endedAt: number | null; lastSeenAt: number;
  pausedMs: number; durationMs: number;
  status: 'open' | 'ended' | 'kept' | 'cancelled' | 'interrupted';
  trackId: string | null; trackTitle: string | null; trackArtist: string | null;
  scenarioId: string | null; blockId: string | null; blockType: string | null; label: string | null;
  passes: number; rateStart: number; rateEnd: number; reachedFull?: boolean;
}
export interface PassRecord extends JournalBase {
  kind: 'pass'; sessionId: string; blockId: string | null; blockType: string | null;
  passIndex: number; rate: number; label: string | null;
}
export type JournalRecord = SessionRecord | PassRecord;
```
- `day` = ЛОКАЛЬНАЯ дата: `${d.getFullYear()}-${MM}-${DD}` (НЕ toISOString — UTC-сдвиг).
- `ownerId` = currentUser?.id ?? 'guest'.

## 3. IDB (idb.service.ts)
- :11 `DB_VERSION = 10`.
- В `onupgradeneeded` (после блока users, ~:155) добавить по эталону `contains()`:
```ts
if (!db.objectStoreNames.contains('practice_log')) {
  const s = db.createObjectStore('practice_log', { keyPath: 'id' });
  s.createIndex('day', 'day', { unique: false });
  s.createIndex('sessionId', 'sessionId', { unique: false });
  s.createIndex('kind', 'kind', { unique: false });
  s.createIndex('ownerId', 'ownerId', { unique: false });
}
```
- Экспорт хелперов (без новой абстракции): `export function getDB() { return _getDB(); }` + `export { _tx as tx, _req as req };` (`_getDB`:130, `_tx`:200, `_req`:207).
- **ONBLOCKED (условие 009-1):** :188-192 сейчас reject+null сразу — заменить: `onblocked` только warn (не reject, не null); таймер 3с → reject + `_dbPromise=null` (ретрай следующим вызовом); `onsuccess` обязательно `clearTimeout`. Промис не висит вечно, поздний успех принимается.

## 4. ПИСАТЕЛЬ (practice-journal/idb.ts)
Module-state кэш (условие 009-4): `active = { sessionId, startedAt, passes, rateEnd, trackId, trackTitle, trackArtist, scenarioId, blockId, blockType, label, pausedStartedAt } | null`.
Функции: `appendSession`, `appendPass`, `patchSession`, `heartbeat`, `closeSession`, `prune`, `migrateGuest`, `closeStale`.
Все записи — try/catch no-op (журнал best-effort), ошибка не ломает практику.
- `closeSession(status)`: если `!active` → no-op; читает ТОЛЬКО кэш; `durationMs = endedAt − startedAt − pausedMs` (≥0); патчит `status/endedAt/durationMs`; **не перезаписывает `passes/rateEnd`** (уже записаны pass-complete); идемпотентно: если запись уже не 'open' — skip.
- `prune()`: удалить `day < today−365`; если записей >10 000 — удалять старейшие, **но НИКОГДА не `day === today`** (условие 009-2).
- `migrateGuest(accountId)`: guard — есть записи с `ownerId===accountId` → skip; иначе readwrite-транзакция, курсор по индексу `ownerId='guest'`, **read-modify-write**: `const r = cursor.value; r.ownerId = accountId; r.migrated = true; cursor.update(r);` (условие 009-3; эталон idb.service.ts:357-361). Частичный объект в update запрещён.
- `closeStale(now)`: сессии `status==='open'` и `now−lastSeenAt > 2ч` → `'interrupted'`, `durationMs = lastSeenAt − startedAt − pausedMs`.

## 5. ХУКИ (init.ts + store)
Подписка — **document.addEventListener**, не EventBus (facade.ts:158 зовёт оригинал, но map неполон — не полагаемся на map).
| событие | точка | действие |
|---|---|---|
| `practice:started` | store:245 | appendSession(status open), кэш |
| `practice:pass-complete` | store:401 | appendPass + patchSession(passes,rateEnd), кэш |
| `practice:completed` | store:412 | patchSession(reachedFull=true) |
| `practice:completed-kept` | store:281 | closeSession('kept') |
| `practice:ended` | store:267 | closeSession('ended') |
| `practice:cancelled` | store:298 | closeSession('cancelled') (кэш; нет кэша — факт) |
| `practice:paused` | store:424 + **emit** | pausedStartedAt=now |
| `practice:resumed` | store:428 + **emit** | pausedMs += now−pausedStartedAt |
- store:424/428 — добавить `emitPracticeEvent('paused',{})` / `emitPracticeEvent('resumed',{})` по эталону :291.
- Пауза >30 мин: таймер на 'paused' → `closeSession('interrupted')`, снять на 'resumed'.
- heartbeat: setInterval 30с при открытой сессии → patch `lastSeenAt`.
- `registerInit({ id: 'practice-journal', init })` в main.tsx:60-67: подписка + prune + closeStale.

## 6. ТЕСТЫ
DevDep (test-only, в бандл не идёт): `fake-indexeddb` — иначе jsdom не имеет IndexedDB (vitest.config.ts:7). Если установка запрещена — IDB-кейсы переносятся в ручную проверку DevTools, логика (день/day/duration) тестируется на in-memory.
Обязательные кейсы:
1. 3 pass 0.8/0.9/1.0 → 1 session (passes=3, rateStart=0.8, rateEnd=1.0) + 3 pass
2. reload-эмуляция: open + старый lastSeenAt → init → 'interrupted', duration=lastSeenAt−startedAt
3. пауза 10 мин (fake timers) → durationMs без этих 10 мин
4. повторный close → без дубля, без перезаписи passes
5. migrateGuest: полный record сохраняется (kind/day/passes на месте), повторный вызов не дублирует
6. prune: старые удалены, `day===today` живы даже при >10k

## 7. ПРИЁМКА (её провожу я, 007)
- [ ] `npm run typecheck` → ≤181, новых 0
- [ ] `npm run build` → exit 0
- [ ] `npx vitest run` → зелёные, тестов ≥ baseline
- [ ] кейсы 1–6 §6 зелёные
- [ ] `git diff --stat` — только файлы §1
- [ ] нет правок в metrics.store/session-SP/audio/catalog/theme
- [ ] DevTools: `practice_log` содержит 1 session + N pass после 3 прогонов
- [ ] повторный вход: `npx vitest` не падает; guest→account миграция проверена тестом 5

## 8. НЕ ДЕЛАТЬ
❌ UI комнаты (этап 3) ❌ агрегации (этап 2 — MR-2) ❌ сервер/кросс-девайс ❌ ELO/PRO ❌ правка metrics.store ❌ новые runtime-зависимости ❌ переписывать idb.service.ts целиком (только §3)
