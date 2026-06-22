// @TC-109-10: Notifications handler — list + mark-read + create
// Notifications for: reply, mention, comment_on_post, reaction

import type { AuthCtx } from './auth';

interface Env {
  FEED_DB: D1Database;
}

// ─── GET /api/feed/notifications?limit=20&cursor_ts= ───
export async function handleListNotifications(
  request: Request,
  env: Env,
  auth: AuthCtx,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const limit = Math.min(
      Math.max(parseInt(url.searchParams.get('limit') || '50'), 1),
      100
    );
    const cursor_ts = url.searchParams.get('cursor_ts');
    const userId = auth.sub;

    let query: string;
    let params: unknown[];

    if (cursor_ts) {
      query = `
        SELECT id, user_id, actor_id, actor_name, type, post_id,
               comment_id, text_preview, is_read, created_at
        FROM feed_notifications
        WHERE user_id = ? AND created_at < ?
        ORDER BY created_at DESC, id DESC
        LIMIT ?
      `;
      params = [userId, cursor_ts, limit + 1];
    } else {
      query = `
        SELECT id, user_id, actor_id, actor_name, type, post_id,
               comment_id, text_preview, is_read, created_at
        FROM feed_notifications
        WHERE user_id = ?
        ORDER BY created_at DESC, id DESC
        LIMIT ?
      `;
      params = [userId, limit + 1];
    }

    const { results } = await (env.FEED_DB.prepare(query) as any)
      .bind(...params)
      .all();

    const hasMore = results.length > limit;
    const notifications = hasMore ? results.slice(0, limit) : results;

    // Also get unread count
    const unreadResult = await (env.FEED_DB.prepare(
      'SELECT COUNT(*) as count FROM feed_notifications WHERE user_id = ? AND is_read = 0'
    ) as any).bind(userId).first<{ count: number }>();

    const last = notifications[notifications.length - 1];
    const nextCursor = hasMore && last
      ? last.created_at
      : null;

    return new Response(
      JSON.stringify({
        notifications,
        unreadCount: unreadResult?.count || 0,
        nextCursor,
        hasMore,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (err: any) {
    console.error('[notifications] GET error:', err);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch notifications' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}

// ─── POST /api/feed/notifications/read ───
// Body: { id?: string } — if id provided, mark single; else mark all
export async function handleMarkNotificationRead(
  request: Request,
  env: Env,
  auth: AuthCtx,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    const body = await request.json() as { id?: string };
    const userId = auth.sub;

    if (body.id) {
      // Mark single notification as read (owner-only)
      await (env.FEED_DB.prepare(
        'UPDATE feed_notifications SET is_read = 1 WHERE id = ? AND user_id = ?'
      ) as any).bind(body.id, userId).run();
    } else {
      // Mark all as read for user
      await (env.FEED_DB.prepare(
        'UPDATE feed_notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0'
      ) as any).bind(userId).run();
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (err: any) {
    console.error('[notifications] POST read error:', err);
    return new Response(
      JSON.stringify({ error: 'Failed to mark notification as read' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}

// ─── POST /api/feed/notifications/create (internal — for creating from handlers) ───
export async function createNotification(
  db: D1Database,
  params: {
    userId: string;
    actorId?: string;
    actorName?: string;
    type: string;
    postId?: string;
    commentId?: string;
    textPreview?: string;
  }
): Promise<void> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await (db.prepare(`
    INSERT INTO feed_notifications (id, user_id, actor_id, actor_name, type, post_id, comment_id, text_preview, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `) as any).bind(
    id,
    params.userId,
    params.actorId || null,
    params.actorName || null,
    params.type,
    params.postId || null,
    params.commentId || null,
    params.textPreview ? params.textPreview.slice(0, 200) : null,
    now
  ).run();
}
