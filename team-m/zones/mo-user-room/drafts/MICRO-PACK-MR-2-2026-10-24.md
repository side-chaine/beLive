# MICRO-PACK · MR-2 «Агрегации журнала» (этап 2, чистые функции)
**2026-10-24 · 007 · для operator · вход: SPEC v1.1 §3 + §6 (этап 2) · этап 1 принят**

> Правило Босса: всё тестим на `http://127.0.0.1:3000/beLive/` (живой Vite dev-server, HMR), пуш — только после настройки. Коммит не делаем.

## 0. КАНОН И ГЕЙТЫ
- Canon: Ювелир. Чистые функции, без React и без IDB. Ноль новых зависимостей.
- Замер до: tsc=181 · build=0 · vitest 892 passed / 75 files.
- Гейт после: tsc ≤181 (новых 0) · build exit 0 · vitest 892+N passed, 0 failed.

## 1. ФАЙЛЫ
1. `src/services/practice-journal/date.ts` — **NEW**: вынести `localDay()` из idb.ts:44 (чистая, без IDB), чтобы aggregate не тянул IDB-модуль.
2. `src/services/practice-journal/idb.ts` — импорт `localDay` из date.ts + **re-export** (совместимость с тестами этапа 1).
3. `src/services/practice-journal/aggregate.ts` — **NEW**: 6 функций.
4. `src/services/practice-journal/queries.ts` — **NEW**: тонкое чтение для UI (getAllForOwner, getRecent).
5. `src/services/practice-journal/__tests__/aggregate.test.ts` — **NEW**: ≥10 кейсов.

## 2. API (aggregate.ts)
```ts
export interface WeekStats { minutes: number; runs: number; streak: number; spark: number[] } // spark[0]=6 дней назад … spark[6]=сегодня
export interface TempoRow { blockId: string; blockType: string; label: string; rates: number[]; rate: number; passes: number; mastered: boolean; almost: boolean }
export interface MasterySummary { done: number; total: number; almost: number }
export interface ContinueTarget { trackId: string|null; trackTitle: string|null; blockId: string|null; blockType: string|null; rate: number; at: number }

export function sessionMinutes(s: SessionRecord): number;                                  // Math.round(durationMs/60000)
export function streak(days: string[], today: string): number;                              // helper, дни уникальные
export function weekStats(sessions: SessionRecord[], now?: number): WeekStats;              // окно: today−6 … today
export function tempoByBlock(passes: PassRecord[], blocks: TextBlock[]): TempoRow[];        // порядок = blocks.store
export function mastery(rows: TempoRow[]): MasterySummary;                                  // done: rate>=1.0, almost: 0.95<=rate<1.0
export function lastSession(sessions: SessionRecord[]): ContinueTarget | null;
```

## 3. ПРАВИЛА (зафиксировать в коде)
- **Учитываемая сессия** («прогон») = `passes > 0`. Сессии с 0 прогонов не попадают ни в минуты, ни в runs, ни в streak.
- `minutes` = Σ `sessionMinutes` по учитываемым сессиям в окне.
- `runs` = число учитываемых сессий в окне.
- `spark` = минуты по дням окна, oldest→newest, ровно 7 чисел.
- `streak`: идём назад от `today`; если сегодня записей нет — старт со вчера (день ещё не закончился). Разрыв = остановка.
- `mastery`: `rate` = последний темп блока (по `at`); блок без прогонов → `rate=0`, `passes=0`, `mastered=false`, `almost=false`. `total` = `blocks.length`.
- `tempoByBlock`: только блоки из `blocks` (порядок сохраняем); `passes` с `blockId=null` (сценарии без блока) пропускаются осознанно.
- `lastSession`: последняя по `endedAt ?? at` среди `status ∈ {'ended','kept'}` и `passes>0`; `cancelled/interrupted` не предлагаем «продолжить».
- Даты — только локальные (`date.ts`), никакого UTC.

## 4. queries.ts (тонко)
```ts
export async function getAllForOwner(ownerId: string): Promise<JournalRecord[]>;  // через index('ownerId')
export async function getRecent(ownerId: string, days: number): Promise<JournalRecord[]>; // day >= today−days
```
Без агрегаций внутри — только чтение.

## 5. ТЕСТЫ (≥10)
1. пустой вход → `{minutes:0,runs:0,streak:0,spark:[0,0,0,0,0,0,0]}`, `mastery {0,0,0}`, `lastSession null`
2. один день, две сессии → `runs=2`, `streak=1` (день считается один раз)
3. streak через границу месяца (2026-02-28 → 2026-03-01)
4. streak через границу года (2025-12-31 → 2026-01-01)
5. сегодня пусто, вчера есть → streak продолжается (≥1)
6. разрыв в 2 дня → streak останавливается
7. сессия с `passes=0` не попадает в минуты/runs
8. mastery: 1.0→done, 0.99→almost, 0.94→ничего
9. tempoByBlock: порядок блоков из store, rates по возрастанию `at`, `blockId=null` пропущен
10. lastSession: выбирает последнюю `ended/kept` с прогонами, игнорирует `cancelled`
11. spark: ровно 7, oldest→newest, минуты попадают в свой день
12. sessionMinutes округляет (90_000 мс → 2 мин)

## 6. ПРИЁМКА (проводит 007)
- [ ] tsc ≤181, новых 0 (в aggregate/date/queries — 0)
- [ ] vitest: 892+N passed, 0 failed; новый файл тестов зелёный
- [ ] build exit 0
- [ ] на `http://127.0.0.1:3000/beLive/` страница открывается, консоль без новых ошибок (HMR подхватил)
- [ ] `git diff --stat` — только файлы §1 (плюс, при необходимости, re-export в idb.ts)
- [ ] metrics.store / session-SP / audio / catalog / theme — не тронуты

## 7. НЕ ДЕЛАТЬ
❌ UI и компоненты (этап 3) ❌ React-хуки ❌ правки схемы IDB (уже сдана) ❌ сервер ❌ новые runtime-зависимости ❌ коммит/пуш
