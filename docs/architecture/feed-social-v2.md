# Social Layer v2 — Wave 2 Architecture

**Created:** 2026-06-22 (TC-109)
**Status:** ACTIVE
**После:** Wave 1 (TC-108) — CRUD комментариев

---

## Архитектура

### Conditional GET Cascade (Transport)

```
Client poll 30s → Cache API 60s → KV version key → D1 (только при изменении)
```

- **Polling:** 30s интервал, пауза при `document.hidden`
- **ETag:** `"cm:<postId>:<version>"` — per-post comment version
- **KV:** Only for comment version bump (NOT for likes/reactions/notifications)
- **304:** Если версия не изменилась — 0 данных

### Threads (Single-Level)

| Endpoint | Назначение | Pagination |
|----------|-----------|------------|
| `GET /api/feed/posts/:id/comments` | Top-level (`parent_id IS NULL`) | cursor |
| `GET /api/feed/posts/:id/comments/:id/replies` | Replies к комментарию | `newer_than` |

- Один уровень вложенности (Instagram-style)
- Reply-to-reply → ответ на parent (Twitter model)

### Reactions (One Per User)

```
POST /api/feed/reactions
  body: { targetType: 'post', targetId: 'uuid', emoji: '🔥' }
  → DELETE all existing → INSERT new (or skip if toggle off)
  → { reacted: bool, emoji, ... }
```

**Music Emoji Set:** `['🔥', '🎵', '🎤']`
- 🔥 = фаер
- 🎵 = вайб  
- 🎤 = вокал

**GET endpoint:** `GET /api/feed/reactions?target_type=post&target_ids=a,b,c`
```json
{
  "reactions": { "postId": { "🔥": 3, "🎵": 1 } },
  "userReactions": { "postId": ["🔥"] }
}
```

### Notifications

- `feed_notifications` table в D1
- Events: reply, mention, comment_on_post, reaction
- Polling через conditional GET
- Telegram push — Wave 2.1

### Mentions (@handle)

- Backend regex `/(?:^|\s)@(\p{L}[\p{L}\p{N}_]*)/gu`
- Max 5 @handle на комментарий
- Batch INSERT в `feed_mentions`
- Rate limit: 10 comments/min

### Users

- `users` table с UPSERT (`ON CONFLICT DO UPDATE`)
- `POST /api/users/upsert` — при каждом auth
- `GET /api/users/:handle` — lookup

---

## D1 Schema (новые таблицы)

### feed_reactions
| Column | Type | Description |
|--------|------|-------------|
| target_type | TEXT | 'post' \| 'comment' |
| target_id | TEXT | feed_posts.id \| feed_comments.id |
| user_id | TEXT | JWT.sub |
| emoji | TEXT | 🔥 \| 🎵 \| 🎤 |
| created_at | TEXT | ISO datetime |
| **PK** | | (target_type, target_id, user_id, emoji) |

### feed_notifications
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | UUID |
| user_id | TEXT | Получатель |
| actor_id | TEXT | Кто триггернул |
| actor_name | TEXT | Имя триггера |
| type | TEXT | reply \| mention \| comment_on_post \| reaction |
| is_read | INTEGER | 0/1 |
| created_at | TEXT | ISO datetime |

### users
| Column | Type | Description |
|--------|------|-------------|
| user_id | TEXT PK | JWT.sub |
| display_name | TEXT | Из JWT |
| avatar_url | TEXT | Из JWT |
| handle | TEXT UNIQUE | @username |
| last_seen | TEXT | ISO datetime |

### feed_mentions
| Column | Type | Description |
|--------|------|-------------|
| source_type | TEXT | 'comment' \| 'post' |
| source_id | TEXT | Comment or post ID |
| mentioned_user_id | TEXT | users.user_id |
| **PK** | | (source_type, source_id, mentioned_user_id) |

---

## API Endpoints (Wave 2 new)

| Method | Path | JWT | Handler | Описание |
|--------|------|-----|---------|----------|
| GET | `/api/feed/posts/:id/comments/:id/replies` | ❌ | handleListReplies | Replies, `?newer_than=` |
| POST | `/api/feed/reactions` | ✅ | handleToggleReaction | Toggle reaction |
| GET | `/api/feed/reactions` | ❌* | handleGetReactions | Counts + userReactions |
| GET | `/api/feed/notifications` | ✅ | handleListNotifications | Paginated list |
| POST | `/api/feed/notifications/read` | ✅ | handleMarkNotificationRead | Mark read |
| DELETE | `/api/feed/notifications/:id` | ✅ | handleDeleteNotification | Delete |
| POST | `/api/users/upsert` | ✅ | handleUpsertUser | UPSERT on auth |
| GET | `/api/users/:handle` | ❌ | handleGetUserByHandle | Lookup |

*\* GET reactions — JWT опционально, для userReactions*

---

## Budget (Free Tier)

| Ресурс | Проекция/день | Лимит | Запас |
|--------|--------------|-------|-------|
| D1 reads | ~50K | 5M | 100× |
| D1 writes | ~500 | 100K | 200× |
| KV reads | ~3K | 100K | 33× |
| KV writes | ~50 | 1K | 20× |
| Workers req | ~3K | 100K | 33× |

---

## Wave 2.1 (ближайшее)

- Telegram push-уведомления через belive-feed-bot
- Timecode seek (клик по ⏱ → jump в AudioEngine)

## Wave 3 (отложено)

- Mention autocomplete UI
- HOT DROP badge для треков
- Archive cron (>180 дней)
