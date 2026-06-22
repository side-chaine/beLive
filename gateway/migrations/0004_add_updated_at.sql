-- TC-107-07: Add updated_at column for edit audit trail
ALTER TABLE feed_posts ADD COLUMN updated_at TEXT;
