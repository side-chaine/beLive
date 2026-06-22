-- TC-107-01: Add deleted_at column for soft-delete audit trail
-- Non-breaking: SQLite ALTER TABLE ADD COLUMN не ломает существующие запросы
-- status='deleted' говорит ЧТО удалено; deleted_at говорит КОГДА
-- Future: auto-purge WHERE deleted_at < datetime('now', '-90 days')

ALTER TABLE feed_posts ADD COLUMN deleted_at TEXT;
