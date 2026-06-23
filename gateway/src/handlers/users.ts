// @TC-109-13: Users CRUD — upsert on auth, lookup by handle

import type { AuthCtx } from './auth';

interface Env {
  FEED_DB: D1Database;
}

// ─── POST /api/users/upsert — upsert user profile from JWT ───
// Called on every auth request. Idempotent (ON CONFLICT DO UPDATE).
export async function handleUpsertUser(
  request: Request,
  env: Env,
  auth: AuthCtx,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    const body = await request.json() as { handle?: string; bio?: string };
    const now = new Date().toISOString();

    await (env.FEED_DB.prepare(`
      INSERT INTO users (user_id, display_name, avatar_url, handle, bio, last_seen)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        display_name = COALESCE(NULLIF(excluded.display_name, ''), users.display_name),
        avatar_url = COALESCE(NULLIF(excluded.avatar_url, ''), users.avatar_url),
        handle = COALESCE(NULLIF(excluded.handle, ''), users.handle),
        last_seen = excluded.last_seen
    `) as any).bind(
      auth.sub,
      auth.name || 'Пользователь',
      auth.picture || '',
      body.handle || null,
      body.bio || null,
      now
    ).run();

    return new Response(
      JSON.stringify({ success: true, userId: auth.sub }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (err: any) {
    // Handle unique constraint violation on handle
    if (err?.message?.includes('UNIQUE constraint failed')) {
      return new Response(
        JSON.stringify({ error: 'Handle already taken' }),
        { status: 409, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }
    console.error('[users] POST /api/users/upsert error:', err);
    return new Response(
      JSON.stringify({ error: 'Failed to upsert user' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}

// ─── GET /api/users/:handle — lookup user by handle ───
export async function handleGetUserByHandle(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const handle = url.pathname.split('/').pop()!;

    const user = await (env.FEED_DB.prepare(
      'SELECT user_id, display_name, avatar_url, handle, bio, created_at FROM users WHERE handle = ?'
    ) as any).bind(handle).first();

    if (!user) {
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    return new Response(
      JSON.stringify(user),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (err: any) {
    console.error('[users] GET /api/users/:handle error:', err);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch user' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}
