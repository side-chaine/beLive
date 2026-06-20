-- TC-103: User roles & moderation
-- НЕ ТРОГАЕТ: feed_posts, feed_likes, feed_comments (migration 0001)

CREATE TABLE IF NOT EXISTS user_roles (
  user_id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  provider_sub TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  email TEXT,
  assigned_by TEXT,
  assigned_at TEXT DEFAULT (datetime('now')),
  revoked_at TEXT,
  revoke_reason TEXT,
  UNIQUE (provider, provider_sub)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role);
CREATE INDEX IF NOT EXISTS idx_user_roles_provider_sub ON user_roles(provider, provider_sub);

CREATE TABLE IF NOT EXISTS feed_moderation_log (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  action TEXT NOT NULL,
  reason TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_modlog_post ON feed_moderation_log(post_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_modlog_actor ON feed_moderation_log(actor_id, created_at DESC);
