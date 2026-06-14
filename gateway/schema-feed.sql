-- Feed Sections (Hero, Events, Tracks, Polls, Leaderboards)
CREATE TABLE IF NOT EXISTS feed_sections (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'main',
  title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'list', -- 'hero-stack', 'list', 'scroll'
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- Feed Items (Posts, Events, Tracks, Polls)
CREATE TABLE IF NOT EXISTS feed_items (
  id TEXT PRIMARY KEY, -- Supports idempotency: 'tg_12345'
  tenant_id TEXT NOT NULL DEFAULT 'main',
  author_type TEXT NOT NULL DEFAULT 'system', -- 'system' (Phase 1), 'user' (Phase 2)
  author_id TEXT,
  type TEXT NOT NULL, -- 'post', 'event', 'service', 'track', 'poll', 'leaderboard'
  status TEXT NOT NULL DEFAULT 'published' CHECK(status IN ('published', 'archived', 'pending')), -- Soft Delete
  title TEXT NOT NULL,
  subtitle TEXT,
  description TEXT,
  cover_r2_key TEXT,
  tags TEXT, -- JSON array string
  priority INTEGER NOT NULL DEFAULT 0,
  source_url TEXT,
  local_track_id TEXT, -- Link to TrackMeta.id
  event_date TEXT,
  price TEXT,
  data TEXT, -- JSON payload for PollData, LeaderboardData (Elo rails)
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  published_at TEXT
);

-- M:N Section-to-Item relationship
CREATE TABLE IF NOT EXISTS feed_section_items (
  section_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (section_id, item_id)
);

-- Indexes for D1.batch() speed
CREATE INDEX IF NOT EXISTS idx_items_status ON feed_items(tenant_id, status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_items_author ON feed_items(author_type, author_id);
