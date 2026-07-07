# Metrics System — Architecture Document

**Дата:** 2026-06-25  
**Статус:** ✅ DEPLOYED (client), ⏳ PENDING DEPLOY (gateway handler)  
**Архитектор:** 001 (CEO Co-Architect)  
**Верификация:** 009 CONDITIONAL PASS → ✅ 20894de fixed  

---

## 1. Executive Summary

Система метрик beLive — сбор, агрегация и синхронизация пользовательской статистики.
- **Client-side:** Events → MetricsCube (Zustand) → localStorage + periodic sync
- **Server-side:** Cloudflare D1 (3 таблицы, 3 SQL запроса)
- **ELO:** server-authoritative (клиент не шлёт ELO)
- **Guest:** local-only, не пишет в D1

---

## 2. MetricsCube (единый контракт)

```typescript
// src/types/metrics.types.ts
export interface GenreAggregation {
  name: string;
  count: number;
}

export interface MetricsCube {
  // Counters (earned accumulation)
  rehearsals: number;           // каждый Play = +1
  practiceSessions: number;     // structured practice sessions
  exercisesCompleted: number;   // завершённые упражнения
  totalPlayTimeMs: number;      // суммарное время в мс

  // Derived (recomputed on tracks change)
  genres: GenreAggregation[];   // из IDB (track-meta.service)
  topGenre: string | null;      // наиболее частый жанр

  // Seeded default
  elo: number;                  // 1500 (default), server-authoritative

  // Streak
  lastActiveAt: string | null;
  streakDays: number;

  // UX gating
  hasAnyData: boolean;          // true если есть хоть один counter > 0
}
```

---

## 3. Data Flow

```
Event (track-loaded, practice:completed, audio.store)
    ↓
metrics.bridge.ts (subscriber)
    ↓
metrics.store.ts (MetricsCube, Zustand persist → localStorage)
    ↓
metrics-sync.service.ts (debounce + retry → D1)
```

---

## 4. Server-Side Sync (gateway)

### 4.1 Три SQL запроса

1. **Rate limit check** — `INSERT INTO sync_rate_limit ... RETURNING count`
   - Атомарно, D1 (не KV), per user_id, 30 req/min
2. **Upsert метрик** — `INSERT INTO user_metrics ... ON CONFLICT DO UPDATE`
   - MAX() стратегия для монотонных счётчиков
3. **Daily plays** — `INSERT INTO daily_plays ... ON CONFLICT DO UPDATE`
   - Multi-row, 90 дней в одном VALUES()

### 4.2 D1 Schema

```sql
-- Migration 0005: Metrics System (separate METRICS_DB from FEED_DB)
-- Run against belive-metrics database

-- Таблица 1: user_metrics (1 row/user)
CREATE TABLE IF NOT EXISTS user_metrics (
  user_id TEXT PRIMARY KEY,
  rehearsals INTEGER NOT NULL DEFAULT 0,
  practice_sessions INTEGER NOT NULL DEFAULT 0,
  exercises_completed INTEGER NOT NULL DEFAULT 0,
  total_play_time_ms INTEGER NOT NULL DEFAULT 0,
  elo INTEGER NOT NULL DEFAULT 1500,
  genres_json TEXT NOT NULL DEFAULT '[]',
  last_active_date TEXT,
  last_sync TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_daily_plays_user_date
  ON daily_plays(user_id, date DESC);

-- Таблица 2: daily_plays (1 row/user/day)
CREATE TABLE IF NOT EXISTS daily_plays (
  user_id TEXT NOT NULL,
  date TEXT NOT NULL,
  plays INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, date)
);

-- Таблица 3: sync_rate_limit (atomic throttle)
CREATE TABLE IF NOT EXISTS sync_rate_limit (
  user_id TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, window_start)
);

-- Cleanup old rate limit rows (run periodically)
DELETE FROM sync_rate_limit WHERE window_start < (strftime('%s','now') * 1000) - 86400000;
```

### 4.3 Merge Strategy

| Поле | Стратегия |
|------|-----------|
| rehearsals | `MAX(server, client)` — монотонный счётчик |
| practice_sessions | `MAX(server, client)` — монотонный |
| exercises_completed | `MAX(server, client)` — монотонный |
| total_play_time_ms | `MAX(server, client)` — монотонный |
| genres_json | `excluded.genres_json` (client overwrite) — display-only |
| elo | **Server-authoritative.** Клиент не шлёт elo. Возвращается в sync response. |
| last_active_date | Server-derived (`sync_ts + tz_offset`) |
| last_sync | Всегда `datetime('now')` |
| daily_plays | `MAX(server, client)` per (user_id, date) — монотонный per-day |

### 4.4 Validation (pre-SQL)

Все проверки в Worker JS до D1 (metrics.ts:100-132):

| Поле | Проверка | Поведение при fail |
|------|----------|-------------------|
| `rehearsals` | `typeof number, ≥ 0, isFinite` | 400 `invalid_rehearsals` |
| `practiceSessions` | `typeof number, ≥ 0, isFinite` | 400 `invalid_practiceSessions` |
| `exercisesCompleted` | `typeof number, ≥ 0, isFinite` | 400 `invalid_exercisesCompleted` |
| `totalPlayTimeMs` | `typeof number, ≥ 0, isFinite` | 400 `invalid_totalPlayTimeMs` |
| `genres` | `Array, ≤ 50 entries, each name ≤ 50 chars` | 400 `invalid_genres/genre_entry` |
| `timezoneOffset` | `number, ∈ [-1080, +1080]` (18h) | 400 `invalid_timezone` |

**Дополнительные защиты перед записью:**
- Все counters: `Math.max(0, Math.round(value))` — обрезка отрицательных и дробных
- genres_json: `slice(0, 50)` + `length ≤ 2048 bytes` — обрезка до лимита
- daily.plays: `Math.max(0, Math.round(rehearsals))` — не больше чем rehearsals

**NOTE:** Валидация даты и `elo` не реализована — elo никогда не приходит от клиента, дата вычисляется сервером из timezoneOffset. Это сознательное упрощение.

---

## 5. ProfileStats (pure reader)

| Поле | Источник | Появляется | Если нет |
|------|----------|-----------|----------|
| ELO | const 1500 → D1 в Phase 3 | Всегда | Показать 1500 |
| Треков | trackStore.tracksMeta.length | При ≥1 треке | Показать 0 |
| Репетиции | metrics.bridge → metrics.store | При первом Play | Скрыть |
| Квесты | exercise.store + persist | При первом квесте | Скрыть |
| Жанр | genre-aggregation → IDB | При ≥1 треке с meta | Скрыть |

**Принципы:**
- Zero mock — только заработанные данные
- Conditional cells — counter > 0 → visible
- Pure reader — ProfileStats НЕ мутирует stores

---

## 6. Coalescing & Retry

- startup + online + debounce → 1 sync (pendingSync promise)
- Base 800ms, ×2, cap 16s, jitter ±50%, max 5 попыток
- После 5 попыток → background mode (каждые 30s)
- Idempotent: повторный sync с теми же числами безопасен

---

## 7. Guest Data Path

- Guest: метрики только в localStorage
- При OAuth: bulk import (capped 30 дней)
- ELO 1500 — единственное исключение для Guest

---

## 8. Free Plan Budget

| План | Пользователи |
|------|-------------|
| Free ($0) | ~3000 активных/день |
| Paid ($5/мес) | ~500,000 активных/день |

---

## 9. Key Files

| Файл | Строк | Назначение |
|------|-------|-----------|
| src/types/metrics.types.ts | — | MetricsCube интерфейс |
| src/stores/metrics.store.ts | — | Zustand persist → localStorage |
| src/services/metrics.bridge.ts | — | Event subscriber |
| src/services/genre-aggregation.service.ts | — | IDB genre aggregation |
| src/services/metrics-sync.service.ts | — | Client sync + retry |
| src/feed/ProfileStats.tsx | 95 | Conditional cells (pure reader) |
| gateway/src/handlers/metrics.ts | — | Sync + get endpoints |
| gateway/migrations/0005_metrics.sql | — | D1 schema |
