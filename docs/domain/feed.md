# Social Feed — Domain Documentation

**Created:** 2026-06-22 (TC-108)  
**Status:** ACTIVE  
**Wave:** 1 (MVP) — Wave 2 (real-time) pending

---

## Overview

Social feed (Aurora Stage) — система постов, лайков, комментариев и модерации.  
Backend: Cloudflare Workers + D1 (SQLite). Frontend: React + Zustand.

## D1 Schema

### feed_posts
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | UUID |
| author_id | TEXT | JWT.sub (google:...) |
| author_name | TEXT | From JWT |
| author_avatar | TEXT | From JWT |
| author_type | TEXT | 'user' (Wave 1) |
| type | TEXT | 'post' \| 'track' \| 'battle' \| 'event' |
| title | TEXT | Required, max 500 |
| body | TEXT | Optional, max 10000 |
| tags | TEXT | JSON array |
| track_id | TEXT | For type='track' |
| blocks_data | TEXT | JSON MiniBlock[] |
| likes_count | INTEGER | Counter (MAX 0 guard) |
| comments_count | INTEGER | Counter (MAX 0 guard, status check) |
| status | TEXT | 'published' \| 'deleted' |
| created_at | TEXT | ISO datetime |
| updated_at | TEXT | TC-107-08 edit timestamp |
| deleted_at | TEXT | TC-107-03 soft-delete timestamp |

### feed_comments
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | UUID |
| post_id | TEXT | FK → feed_posts.id |
| author_id | TEXT | JWT.sub |
| author_name | TEXT | From JWT |
| author_avatar | TEXT | From JWT |
| text | TEXT | Required, max 2000 |
| created_at | TEXT | ISO datetime |

**Index:** `idx_feed_comments_post(post_id, created_at ASC)`

### feed_likes
| Column | Type | Description |
|--------|------|-------------|
| post_id | TEXT | FK → feed_posts.id |
| user_id | TEXT | JWT.sub |
| created_at | TEXT | ISO datetime |

**PK:** (post_id, user_id) — prevents duplicate likes.

### feed_moderation_log
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | UUID |
| post_id | TEXT | FK → feed_posts.id |
| actor_id | TEXT | JWT.sub of moderator |
| actor_role | TEXT | 'founder' |
| action | TEXT | 'admin_delete' \| 'restore' |
| reason | TEXT | Optional |
| created_at | TEXT | ISO datetime |

### user_roles
| Column | Type | Description |
|--------|------|-------------|
| user_id | TEXT | JWT.sub |
| provider | TEXT | 'google' |
| provider_sub | TEXT | Raw Google sub |
| role | TEXT | 'user' \| 'founder' |
| revoked_at | TEXT | NULL = active |

---

## API Endpoints

| Method | Path | JWT | Handler | Description |
|--------|------|-----|---------|-------------|
| GET | /api/feed/posts | ❌ | handleGetFeedPosts | List posts (cursor, status='published') |
| POST | /api/feed/posts | ✅ | handleCreateFeedPost | Create post |
| POST | /api/feed/likes | ✅ | handleToggleLike | Toggle like |
| DELETE | /api/feed/posts/:postId | ✅ | handleDeleteFeedPost | Soft-delete (self/founder) |
| PATCH | /api/feed/posts/:postId/restore | ✅ | handleRestoreFeedPost | Founder-only restore |
| PATCH | /api/feed/posts/:postId | ✅ | handleUpdateFeedPost | Owner-only edit |
| GET | /api/feed/posts/:postId/comments | ❌ | handleGetComments | List comments (cursor DESC) |
| POST | /api/feed/posts/:postId/comments | ✅ | handleCreateComment | Create comment (rate: 5/min) |
| DELETE | /api/feed/posts/:postId/comments/:commentId | ✅ | handleDeleteComment | Delete (self/founder) |

---

## Auth Model

- **JWT** (HS256, Web Crypto) — `getAuthCtx(request, env)`
- **AuthCtx**: sub, provider, providerSub, name, picture, email, roleHint
- **Authorization**: `getUserRole(db, provider, providerSub)` — D1 lookup, NOT roleHint
- **Roles**: 'user' (default), 'founder' (admin)
- **IDOR fix**: author_id always from JWT.sub, never from request body

---

## Security Measures

| Measure | TC | Description |
|---------|-----|-------------|
| Content-Length bypass fix | TC-108-07 | `request.text()` + `.length` (chunked-safe) |
| TOCTOU fix (comments) | TC-108-02 | `INSERT ... SELECT ... WHERE EXISTS` (atomic) |
| Counter drift fix | TC-108-02 | `UPDATE ... AND status = 'published'` |
| IDOR fix (comments) | TC-108-02 | Double-key: `WHERE id = ? AND post_id = ?` |
| Rate limiting | TC-108-03 | 5 req/min/IP on POST createComment |
| XSS guard | TC-108-05 | `{comment.text}` only — no dangerouslySetInnerHTML |
| Body size limit | TC-108-02 | 10000 chars raw text (chunked-safe) |
| Comment text limit | TC-108-02 | 2000 characters max |

---

## Frontend Architecture

### feed.store.ts (Zustand)
- `posts: FeedPost[]` — feed list with optimistic updates
- `comments: Record<string, FeedComment[]>` — postId → comments (ASC order)
- Actions: fetchFeed, createPost, toggleLike, deletePost, editPost
- Comment actions: fetchComments, createComment, deleteComment
- All write actions: legacy guard (authToken check) + optimistic + rollback

### CommentsPanel.tsx
- Loads comments on activePostId change (useEffect)
- Displays: avatar, name, text, time, delete button (own comments)
- Input form: textarea + send button (Enter to send)
- XSS guard: React auto-escape via {comment.text}

---

## Moderation

- **Soft-delete**: `UPDATE feed_posts SET status = 'deleted'`
- **Restore**: Founder-only, `UPDATE ... SET status = 'published'`
- **Mod log**: `feed_moderation_log` — tracks admin_delete and restore actions
- **Atomic**: `db.batch()` for mod_log + status update

---

## Wave 2 (pending)

- Real-time updates (SSE/WebSocket)
- Nested replies (threads)
- Comment reactions
- Audit trail for comment deletes (mod_log with comment_id)
- comments_count reconciliation on post restore
