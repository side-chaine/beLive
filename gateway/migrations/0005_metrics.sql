-- Migration 0005: Metrics System (separate METRICS_DB from FEED_DB)
-- Run against belive-metrics database

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

CREATE TABLE IF NOT EXISTS daily_plays (
  user_id TEXT NOT NULL,
  date TEXT NOT NULL,
  plays INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_daily_plays_user_date
  ON daily_plays(user_id, date DESC);

CREATE TABLE IF NOT EXISTS sync_rate_limit (
  user_id TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, window_start)
);

-- Cleanup old rate limit rows (run periodically via migration runner)
DELETE FROM sync_rate_limit WHERE window_start < (strftime('%s','now') * 1000) - 86400000;
