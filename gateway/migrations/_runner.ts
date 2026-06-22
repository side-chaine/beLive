// @TC-109-01: Schema migrations runner
// Idempotent migration runner for D1.
// Runs at Worker startup — checks schema_migrations table, applies pending in order.
// ALTER TABLE ADD COLUMN guarded by PRAGMA table_info() — no "duplicate column" errors.

interface Env {
  FEED_DB: D1Database;
}

interface Migration {
  version: number;
  name: string;
  sql: string[];
}

// PRAGMA-based column existence check (SQLite ALTER TABLE ADD COLUMN is not idempotent)
async function columnExists(db: D1Database, table: string, column: string): Promise<boolean> {
  const result = await db.prepare(
    `SELECT 1 FROM pragma_table_info(?) WHERE name = ?`
  ).bind(table, column).first();
  return !!result;
}

const MIGRATIONS: Migration[] = [
  {
    version: 5,
    name: 'wave2_comments_extensions',
    sql: [
      // parent_id for threading
      `ALTER TABLE feed_comments ADD COLUMN parent_id TEXT DEFAULT NULL`,
      // timecode_pin for SoundCloud-style time pinned comments
      `ALTER TABLE feed_comments ADD COLUMN timecode_pin INTEGER DEFAULT NULL`,
      // feedback_tag: vocals, mix, lyrics, arrangement, vibe
      `ALTER TABLE feed_comments ADD COLUMN feedback_tag TEXT DEFAULT NULL`,
      // Index for replies
      `CREATE INDEX IF NOT EXISTS idx_feed_comments_parent ON feed_comments(post_id, parent_id, created_at ASC)`,
      // Partial index for timecode lookups on track posts
      `CREATE INDEX IF NOT EXISTS idx_feed_comments_timecode ON feed_comments(post_id, timecode_pin ASC) WHERE timecode_pin IS NOT NULL`,
    ],
  },
  {
    version: 6,
    name: 'wave2_reactions',
    sql: [
      `CREATE TABLE IF NOT EXISTS feed_reactions (
        target_type TEXT NOT NULL DEFAULT 'post',
        target_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        emoji TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (target_type, target_id, user_id, emoji)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_feed_reactions_target ON feed_reactions(target_type, target_id, emoji)`,
    ],
  },
  {
    version: 7,
    name: 'wave2_notifications',
    sql: [
      `CREATE TABLE IF NOT EXISTS feed_notifications (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        actor_id TEXT,
        actor_name TEXT,
        type TEXT NOT NULL,
        post_id TEXT,
        comment_id TEXT,
        text_preview TEXT,
        is_read INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      `CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON feed_notifications(user_id, is_read, created_at DESC)`,
    ],
  },
  {
    version: 8,
    name: 'wave2_users_mentions',
    sql: [
      `CREATE TABLE IF NOT EXISTS users (
        user_id TEXT PRIMARY KEY,
        display_name TEXT NOT NULL,
        avatar_url TEXT DEFAULT '',
        handle TEXT UNIQUE,
        bio TEXT DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        last_seen TEXT
      )`,
      `CREATE INDEX IF NOT EXISTS idx_users_handle ON users(handle)`,
      `CREATE TABLE IF NOT EXISTS feed_mentions (
        source_type TEXT NOT NULL,
        source_id TEXT NOT NULL,
        mentioned_user_id TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        PRIMARY KEY (source_type, source_id, mentioned_user_id)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_mentions_user ON feed_mentions(mentioned_user_id)`,
    ],
  },
];

export async function runMigrations(db: D1Database): Promise<void> {
  // 1. Ensure schema_migrations tracker table
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`
  ).run();

  // 2. Check which migrations have been applied
  const applied = await db.prepare(
    'SELECT version FROM schema_migrations ORDER BY version ASC'
  ).all();

  const appliedVersions = new Set((applied.results || []).map((r: any) => r.version));

  // 3. Apply pending migrations in order
  for (const migration of MIGRATIONS) {
    if (appliedVersions.has(migration.version)) {
      console.log(`[migrations] ${migration.version}-${migration.name}: already applied, skip`);
      continue;
    }

    console.log(`[migrations] ${migration.version}-${migration.name}: applying...`);

    // Track which ALTER TABLE columns were skipped
    let skippedAlters = 0;

    for (const stmt of migration.sql) {
      // Skip ALTER TABLE ADD COLUMN if column already exists
      const alterMatch = stmt.match(/^ALTER TABLE (\w+) ADD COLUMN (\w+)/i);
      if (alterMatch) {
        const tableName = alterMatch[1];
        const columnName = alterMatch[2];
        const exists = await columnExists(db, tableName, columnName);
        if (exists) {
          console.log(`[migrations]   SKIP: column ${tableName}.${columnName} already exists`);
          skippedAlters++;
          continue;
        } else {
          console.log(`[migrations]   ADD COLUMN ${tableName}.${columnName}`);
        }
      }

      await db.prepare(stmt).run();
    }

    // Record migration as applied
    await db.prepare(
      'INSERT INTO schema_migrations (version, name) VALUES (?, ?)'
    ).bind(migration.version, migration.name).run();

    if (skippedAlters > 0) {
      console.log(`[migrations] ${migration.version}-${migration.name}: applied (${skippedAlters} ALTERs skipped — already existed)`);
    } else {
      console.log(`[migrations] ${migration.version}-${migration.name}: applied ✔`);
    }
  }

  console.log('[migrations] All pending migrations applied.');
}
