-- НЕ ТРОГАТЬ: feed_sections, feed_items, feed_section_items

CREATE TABLE IF NOT EXISTS feed_posts (
  id TEXT PRIMARY KEY,
  author_id TEXT NOT NULL,
  author_name TEXT NOT NULL,
  author_avatar TEXT DEFAULT '',
  author_type TEXT NOT NULL DEFAULT 'user',
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  cover_r2_key TEXT,
  tags TEXT,
  track_id TEXT,
  blocks_data TEXT,
  base_track_id TEXT,
  battle_block_id TEXT,
  max_submissions INTEGER DEFAULT 5,
  battle_status TEXT DEFAULT 'open',
  event_date TEXT,
  event_price TEXT,
  event_location TEXT,
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  source_type TEXT DEFAULT 'manual',
  status TEXT DEFAULT 'published',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS feed_likes (
  post_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS feed_comments (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  author_name TEXT NOT NULL,
  author_avatar TEXT DEFAULT '',
  text TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_feed_posts_created_at 
  ON feed_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feed_posts_author 
  ON feed_posts(author_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feed_posts_status_type 
  ON feed_posts(status, type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feed_comments_post 
  ON feed_comments(post_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_feed_likes_user 
  ON feed_likes(user_id);
