// @TC-MET-05: Metrics handler — sync endpoint for metrics.store
// DEPLOY via CF Dashboard: copy bundle + create METRICS_DB binding

interface Env {
  METRICS_DB: D1Database;
}

interface SyncRequest {
  clientMetrics: {
    rehearsals: number;
    practiceSessions: number;
    exercisesCompleted: number;
    totalPlayTimeMs: number;
    genres: { genre: string; count: number }[];
  };
  timezoneOffset: number;
}

/**
 * GET /api/metrics/me — pull own metrics (for fresh device login)
 */
export async function handleGetMyMetrics(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>,
  authSub: string
): Promise<Response> {
  try {
    const row = await env.METRICS_DB.prepare(
      `SELECT * FROM user_metrics WHERE user_id = ?`
    ).bind(authSub).first();

    if (!row) {
      return new Response(JSON.stringify({ error: 'no_metrics' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    return new Response(JSON.stringify(row), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'internal' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}

/**
 * POST /api/metrics/sync — atomic upsert with server-side merge
 * 3 SQL statements: rate limit check + metrics upsert + daily insert
 */
export async function handleSyncMetrics(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>,
  authSub: string
): Promise<Response> {
  try {
    // 1. Rate limit check (atomic, 1 query)
    const now = Date.now();
    const WINDOW_MS = 60_000;
    const LIMIT = 30;

    const rateRow = await env.METRICS_DB.prepare(
      `INSERT INTO sync_rate_limit (user_id, window_start, count)
       VALUES (?, ?, 1)
       ON CONFLICT(user_id, window_start) DO UPDATE SET
         count = count + 1
       RETURNING count, window_start`
    ).bind(authSub, now).first() as { count: number; window_start: number } | null;

    if (rateRow && rateRow.count > LIMIT) {
      const retryAfterMs = WINDOW_MS - (now - rateRow.window_start);
      return new Response(JSON.stringify({ error: 'rate_limited' }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(Math.ceil(Math.max(retryAfterMs, 1) / 1000)),
          ...corsHeaders,
        },
      });
    }

    // 2. Parse + validate body
    const body: SyncRequest = await request.json();

    if (!body.clientMetrics || typeof body.clientMetrics !== 'object') {
      return new Response(JSON.stringify({ error: 'invalid_body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const m = body.clientMetrics;

    // Validate counters
    for (const key of ['rehearsals', 'practiceSessions', 'exercisesCompleted', 'totalPlayTimeMs'] as const) {
      if (typeof m[key] !== 'number' || m[key] < 0 || !Number.isFinite(m[key])) {
        return new Response(JSON.stringify({ error: `invalid_${key}` }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }
    }

    // Validate genres (max 50, each name ≤ 50 chars)
    if (!Array.isArray(m.genres) || m.genres.length > 50) {
      return new Response(JSON.stringify({ error: 'invalid_genres' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }
    for (const g of m.genres) {
      if (typeof g.genre !== 'string' || g.genre.length > 50 || typeof g.count !== 'number' || g.count < 0) {
        return new Response(JSON.stringify({ error: 'invalid_genre_entry' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }
    }

    // Validate timezone offset (±18h in minutes)
    if (typeof body.timezoneOffset !== 'number' || body.timezoneOffset < -1080 || body.timezoneOffset > 1080) {
      return new Response(JSON.stringify({ error: 'invalid_timezone' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Compute server-derived date from sync timestamp + client timezone offset
    const syncTimestamp = Math.floor(Date.now() / 1000);
    const tzOffsetSeconds = body.timezoneOffset * 60;
    const localDate = new Date((syncTimestamp + tzOffsetSeconds) * 1000);
    const dateStr = localDate.toISOString().split('T')[0]; // 'YYYY-MM-DD'

    // Clamp genre names (denormalized, cap at 2KB)
    const genresSafe = m.genres.slice(0, 50).map(g => ({
      genre: g.genre.slice(0, 50),
      count: Math.min(Math.max(Math.round(g.count), 0), 100000),
    }));
    const genresJson = JSON.stringify(genresSafe);
    const genresTruncated = genresJson.length > 2048 ? JSON.stringify(genresSafe.slice(0, 10)) : genresJson;

    // 3. Metrics upsert (atomic MAX merge, 1 query)
    const merged = await env.METRICS_DB.prepare(
      `INSERT INTO user_metrics (
        user_id, rehearsals, practice_sessions, exercises_completed,
        total_play_time_ms, genres_json, last_active_date, last_sync
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        rehearsals = MAX(user_metrics.rehearsals, excluded.rehearsals),
        practice_sessions = MAX(user_metrics.practice_sessions, excluded.practice_sessions),
        exercises_completed = MAX(user_metrics.exercises_completed, excluded.exercises_completed),
        total_play_time_ms = MAX(user_metrics.total_play_time_ms, excluded.total_play_time_ms),
        genres_json = excluded.genres_json,
        last_active_date = excluded.last_active_date,
        last_sync = excluded.last_sync
      RETURNING *`
    ).bind(
      authSub,
      Math.max(0, Math.round(m.rehearsals)),
      Math.max(0, Math.round(m.practiceSessions)),
      Math.max(0, Math.round(m.exercisesCompleted)),
      Math.max(0, Math.round(m.totalPlayTimeMs)),
      genresTruncated,
      dateStr,
      new Date().toISOString()
    ).first();

    // 4. Daily activity upsert (for streak computation, 1 query)
    const totalDaily = Math.max(0, Math.round(m.rehearsals));
    await env.METRICS_DB.prepare(
      `INSERT INTO daily_plays (user_id, date, plays)
       VALUES (?, ?, ?)
       ON CONFLICT(user_id, date) DO UPDATE SET
         plays = MAX(daily_plays.plays, excluded.plays)`
    ).bind(authSub, dateStr, totalDaily).run();

    if (!merged) {
      return new Response(JSON.stringify({ error: 'merge_failed' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // 5. Return merged state (includes server-authoritative elo)
    return new Response(JSON.stringify({
      rehearsals: merged.rehearsals,
      practiceSessions: merged.practice_sessions,
      exercisesCompleted: merged.exercises_completed,
      totalPlayTimeMs: merged.total_play_time_ms,
      elo: merged.elo ?? 1500,
      lastActiveDate: merged.last_active_date,
      topGenre: merged.genres_json ? (JSON.parse(merged.genres_json)?.[0]?.genre ?? null) : null,
      genres: merged.genres_json ? JSON.parse(merged.genres_json) : [],
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'internal', detail: String(e) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}
