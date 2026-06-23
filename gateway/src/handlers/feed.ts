// @TC-101-01c: Feed social endpoints — handler functions
// NOT tied to any router (itty-router or if/else). Pure (request, env, corsHeaders) => Response.
// TC-101-01a will connect these to itty-router without rewriting.

interface Env {
  FEED_DB: D1Database;
  FEED_KV?: KVNamespace;
}

import type { AuthCtx } from './auth';
import { getUserRole } from './roles';
import { bumpCommentVersion } from '../helpers';

const VALID_TYPES = ['post', 'track', 'battle', 'event'] as const;

// ─── GET /api/feed/posts ───
export async function handleGetFeedPosts(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const limit = Math.min(
      Math.max(parseInt(url.searchParams.get('limit') || '50'), 1),
      100
    );
    const cursor_ts = url.searchParams.get('cursor_ts');
    const cursor_id = url.searchParams.get('cursor_id');

    // blocks_data excluded from list for perf + security (002 attack #8)
    const selectFields = `
      id, author_id, author_name, author_avatar, author_type,
      type, title, body, tags, cover_r2_key,
      track_id, base_track_id, battle_block_id,
      battle_status, max_submissions,
      event_date, event_price, event_location,
      likes_count, comments_count, source_type, created_at, updated_at
    `;

    let query: string;
    let params: unknown[];

    if (cursor_ts && cursor_id) {
      // Composite cursor (created_at DESC, id DESC) — 001 FIX #2
      // Fixes duplicate timestamp pagination bug (009 C-1 blocker)
      query = `
        SELECT ${selectFields}
        FROM feed_posts
        WHERE status = 'published'
          AND (created_at < ? OR (created_at = ? AND id < ?))
        ORDER BY created_at DESC, id DESC
        LIMIT ?
      `;
      params = [cursor_ts, cursor_ts, cursor_id, limit + 1];
    } else {
      query = `
        SELECT ${selectFields}
        FROM feed_posts
        WHERE status = 'published'
        ORDER BY created_at DESC, id DESC
        LIMIT ?
      `;
      params = [limit + 1];
    }

    const { results } = await (env.FEED_DB.prepare(query) as any)
      .bind(...params)
      .all();

    const hasMore = results.length > limit;
    const posts = hasMore ? results.slice(0, limit) : results;

    // Parse JSON fields
    const parsed = posts.map((p: any) => ({
      ...p,
      tags: p.tags ? JSON.parse(p.tags) : [],
    }));

    const last = parsed[parsed.length - 1];
    const nextCursor = hasMore && last
      ? { cursor_ts: last.created_at, cursor_id: last.id }
      : null;

    return new Response(
      JSON.stringify({ posts: parsed, nextCursor, hasMore }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (err: any) {
    console.error('[feed] GET /api/feed/posts error:', err);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch posts' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}

// ─── POST /api/feed/posts ───
export async function handleCreateFeedPost(
  request: Request,
  env: Env,
  auth: AuthCtx,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    // Body size check (TC-108-07: chunked-safe via request.text(), not Content-Length)
    // Content-Length header absent with Transfer-Encoding: chunked → bypass fix
    const rawText = await request.text();
    if (rawText.length > 1_000_000) {
      return new Response(
        JSON.stringify({ error: 'Request too large (max 1MB)' }),
        { status: 413, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    let body: any;
    try {
      body = JSON.parse(rawText);
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Type validation (002 attack #9)
    if (!body.type || !VALID_TYPES.includes(body.type)) {
      return new Response(
        JSON.stringify({ error: `type must be one of: ${VALID_TYPES.join(', ')}` }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Title validation
    if (!body.title || typeof body.title !== 'string') {
      return new Response(
        JSON.stringify({ error: 'title is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // TC-109-12: Mention extraction (best-effort, non-blocking)
    try {
      extractMentions(body.text, commentId, postId, auth, env).catch(() => {});
    } catch (_) {
      // mentions are best-effort
    }

    // TC-109-15: KV version bump for conditional GET
    bumpCommentVersion(env, postId).catch(() => {});

    return new Response(
      JSON.stringify({
        ...created,
        blocks_data: created?.blocks_data
          ? JSON.parse(created.blocks_data as string)
          : [],
        tags: created?.tags ? JSON.parse(created.tags as string) : [],
      }),
      { status: 201, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (err: any) {
    console.error('[feed] POST /api/feed/posts error:', err);
    return new Response(
      JSON.stringify({ error: 'Failed to create post' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}

// ─── POST /api/feed/likes (TC-109-11: refactored — atomic batch) ───
export async function handleToggleLike(
  request: Request,
  env: Env,
  auth: AuthCtx,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    const { postId } = await request.json() as any;
    const userId = auth.sub;  // из JWT, НЕ из body

    if (!postId) {
      return new Response(
        JSON.stringify({ error: 'postId is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Status-check (read-only, no race)
    const postStatus = await (env.FEED_DB.prepare(
      'SELECT status FROM feed_posts WHERE id = ?'
    ) as any).bind(postId).first() as { status: string } | null;
    if (!postStatus) {
      return new Response(
        JSON.stringify({ error: 'Post not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }
    if (postStatus.status !== 'published') {
      return new Response(
        JSON.stringify({ error: 'Post is not available' }),
        { status: 410, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Atomic batch: check existing + toggle + update counter
    const existing = await (env.FEED_DB.prepare(
      'SELECT 1 FROM feed_likes WHERE post_id = ? AND user_id = ?'
    ) as any).bind(postId, userId).first();

    let liked: boolean;
    let likes_count: number;

    if (existing) {
      // Unlike — atomic batch
      const batchResult = await env.FEED_DB.batch([
        (env.FEED_DB.prepare(
          'DELETE FROM feed_likes WHERE post_id = ? AND user_id = ?'
        ) as any).bind(postId, userId),
        (env.FEED_DB.prepare(
          'UPDATE feed_posts SET likes_count = MAX(0, likes_count - 1) WHERE id = ?'
        ) as any).bind(postId),
      ]);
      liked = false;
      // Read updated counter
      const post = await (env.FEED_DB.prepare(
        'SELECT likes_count FROM feed_posts WHERE id = ?'
      ) as any).bind(postId).first() as { likes_count: number } | null;
      likes_count = post?.likes_count || 0;
    } else {
      // Like — atomic batch
      const batchResult = await env.FEED_DB.batch([
        (env.FEED_DB.prepare(
          'INSERT INTO feed_likes (post_id, user_id, created_at) VALUES (?, ?, ?)'
        ) as any).bind(postId, userId, new Date().toISOString()),
        (env.FEED_DB.prepare(
          'UPDATE feed_posts SET likes_count = likes_count + 1 WHERE id = ?'
        ) as any).bind(postId),
      ]);
      liked = true;
      // Read updated counter
      const post = await (env.FEED_DB.prepare(
        'SELECT likes_count FROM feed_posts WHERE id = ?'
      ) as any).bind(postId).first() as { likes_count: number } | null;
      likes_count = post?.likes_count || 0;
    }

    return new Response(
      JSON.stringify({ liked, likes_count }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (err: any) {
    console.error('[feed] POST /api/feed/likes error:', err);
    return new Response(
      JSON.stringify({ error: 'Failed to toggle like' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}

// ─── DELETE /api/feed/posts/:postId ───
// TC-107-03: Soft-delete with authorization matrix (self / founder)
export async function handleDeleteFeedPost(
  env: Env,
  auth: AuthCtx,
  postId: string,
  corsHeaders: Record<string, string>,
  body?: any
): Promise<Response> {
  try {
    // 1. SELECT post
    const post = await (env.FEED_DB.prepare(
      'SELECT id, author_id, status FROM feed_posts WHERE id = ?'
    ) as any).bind(postId).first<{ id: string; author_id: string; status: string }>();

    if (!post) {
      return new Response(
        JSON.stringify({ error: 'Post not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }
    if (post.status === 'deleted') {
      return new Response(
        JSON.stringify({ error: 'Post already deleted' }),
        { status: 410, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const now = new Date().toISOString();

    // 2. Self-delete? (author_id === authCtx.sub)
    if (post.author_id === auth.sub) {
      await (env.FEED_DB.prepare(
        "UPDATE feed_posts SET status = 'deleted', deleted_at = ? WHERE id = ?"
      ) as any).bind(now, postId).run();

      return new Response(
        JSON.stringify({ success: true, action: 'self_delete' }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // 3. Founder check — D1 lookup, NOT authCtx.roleHint (002 N6)
    const role = await getUserRole(env.FEED_DB, auth.provider, auth.providerSub);
    if (role === 'founder') {
      // ATOMIC: db.batch() гарантирует atomic rollback (VERDICT 009 R1)
      const insertModLog = env.FEED_DB.prepare(
        `INSERT INTO feed_moderation_log (id, post_id, actor_id, actor_role, action, reason, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        crypto.randomUUID(),
        postId,
        auth.sub,           // actor_id = authCtx.sub
        'founder',          // actor_role from D1
        'admin_delete',
        body?.reason || null,
        now
      );

      const updatePost = env.FEED_DB.prepare(
        "UPDATE feed_posts SET status = 'deleted', deleted_at = ? WHERE id = ?"
      ).bind(now, postId);

      await env.FEED_DB.batch([insertModLog, updatePost]);

      return new Response(
        JSON.stringify({ success: true, action: 'admin_delete' }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // 4. Not owner, not founder
    return new Response(
      JSON.stringify({ error: 'Forbidden' }),
      { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (err: any) {
    console.error('[feed] DELETE /api/feed/posts/:id error:', err);
    return new Response(
      JSON.stringify({ error: 'Failed to delete post' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}

// ─── PATCH /api/feed/posts/:postId/restore (TC-107-06) ───
// Founder-only UNDELETE. batch() atomic: INSERT mod_log FIRST, UPDATE SECOND.
export async function handleRestoreFeedPost(
  env: Env,
  auth: AuthCtx,
  postId: string,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    const post = await (env.FEED_DB.prepare(
      'SELECT id, status FROM feed_posts WHERE id = ?'
    ) as any).bind(postId).first<{ id: string; status: string }>();

    if (!post) {
      return new Response(
        JSON.stringify({ error: 'Post not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }
    if (post.status === 'published') {
      return new Response(
        JSON.stringify({ error: 'Post already published' }),
        { status: 410, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const role = await getUserRole(env.FEED_DB, auth.provider, auth.providerSub);
    if (role !== 'founder') {
      return new Response(
        JSON.stringify({ error: 'Forbidden' }),
        { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const now = new Date().toISOString();

    const insertModLog = env.FEED_DB.prepare(
      `INSERT INTO feed_moderation_log (id, post_id, actor_id, actor_role, action, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(
      crypto.randomUUID(),
      postId,
      auth.sub,
      'founder',
      'restore',
      now
    );

    const updatePost = env.FEED_DB.prepare(
      "UPDATE feed_posts SET status = 'published', deleted_at = NULL WHERE id = ?"
    ).bind(postId);

    await env.FEED_DB.batch([insertModLog, updatePost]);

    return new Response(
      JSON.stringify({ success: true, action: 'restore' }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (err: any) {
    console.error('[feed] PATCH restore error:', err);
    return new Response(
      JSON.stringify({ error: 'Failed to restore post' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}

// ─── PATCH /api/feed/posts/:postId (TC-107-08) ───
// Owner-only edit. Whitelist fields. Validation same as POST.
export async function handleUpdateFeedPost(
  env: Env,
  auth: AuthCtx,
  postId: string,
  request: Request,  // ← обязательно!
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    // 1. Parse body + size check (TC-108-07: chunked-safe via request.text())
    const rawText = await request.text();
    if (rawText.length > 1_000_000) {
      return new Response(
        JSON.stringify({ error: 'Request too large (max 1MB)' }),
        { status: 413, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(rawText) as Record<string, unknown>;
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // 2. Whitelist: ТОЛЬКО эти поля разрешены (C1 009)
    const ALLOWED_FIELDS = ['title', 'text', 'tags', 'event_date', 'event_price', 'event_location'] as const;
    const patchFields: Record<string, unknown> = {};

    for (const key of Object.keys(body)) {
      if (!ALLOWED_FIELDS.includes(key as any)) {
        return new Response(
          JSON.stringify({ error: `Unknown field: ${key}. Allowed: ${ALLOWED_FIELDS.join(', ')}` }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }
      patchFields[key] = body[key];
    }

    // 3. Пустой body → 400 (C1 009)
    if (Object.keys(patchFields).length === 0) {
      return new Response(
        JSON.stringify({ error: 'No editable fields provided' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // 4. Validation (same as POST)
    if ('title' in patchFields) {
      if (typeof patchFields.title !== 'string' || !patchFields.title.trim()) {
        return new Response(
          JSON.stringify({ error: 'title must be a non-empty string' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }
      if (patchFields.title.length > 500) {
        return new Response(
          JSON.stringify({ error: 'title max 500 characters' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }
    }
    if ('text' in patchFields && patchFields.text !== null) {
      if (typeof patchFields.text !== 'string' || patchFields.text.length > 10_000) {
        return new Response(
          JSON.stringify({ error: 'text max 10000 characters' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }
    }
    if ('tags' in patchFields && patchFields.tags !== null) {
      if (!Array.isArray(patchFields.tags)) {
        return new Response(
          JSON.stringify({ error: 'tags must be an array' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }
    }

    // 5. SELECT post — check owner, battle lock, status
    const post = await (env.FEED_DB.prepare(
      'SELECT id, author_id, type, status FROM feed_posts WHERE id = ?'
    ) as any).bind(postId).first<{ id: string; author_id: string; type: string; status: string }>();

    if (!post) {
      return new Response(
        JSON.stringify({ error: 'Post not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }
    if (post.status === 'deleted') {
      return new Response(
        JSON.stringify({ error: 'Post is deleted' }),
        { status: 410, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }
    // Owner check
    if (post.author_id !== auth.sub) {
      return new Response(
        JSON.stringify({ error: 'Forbidden' }),
        { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }
    // M1: battle lock
    if (post.type === 'battle') {
      return new Response(
        JSON.stringify({ error: 'Battle posts cannot be edited' }),
        { status: 409, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // 6. Build UPDATE query
    const setClauses: string[] = ['updated_at = ?'];
    const now = new Date().toISOString();
    const params: unknown[] = [now];

    if ('title' in patchFields) {
      setClauses.push('title = ?');
      params.push((patchFields.title as string).slice(0, 500));
    }
    if ('text' in patchFields) {
      setClauses.push('body = ?');
      params.push(patchFields.text !== null ? (patchFields.text as string).slice(0, 10_000) : null);
    }
    if ('tags' in patchFields) {
      setClauses.push('tags = ?');
      params.push(patchFields.tags !== null ? JSON.stringify(patchFields.tags) : null);
    }
    if ('event_date' in patchFields) {
      setClauses.push('event_date = ?');
      params.push(patchFields.event_date as string);
    }
    if ('event_price' in patchFields) {
      setClauses.push('event_price = ?');
      params.push(patchFields.event_price as string);
    }
    if ('event_location' in patchFields) {
      setClauses.push('event_location = ?');
      params.push(patchFields.event_location as string);
    }

    params.push(postId);
    await (env.FEED_DB.prepare(
      `UPDATE feed_posts SET ${setClauses.join(', ')} WHERE id = ?`
    ) as any).bind(...params).run();

    // 7. Return updated post
    const updated = await (env.FEED_DB.prepare(
      'SELECT * FROM feed_posts WHERE id = ?'
    ) as any).bind(postId).first();

    return new Response(
      JSON.stringify({
        ...updated,
        blocks_data: updated?.blocks_data ? JSON.parse(updated.blocks_data as string) : [],
        tags: updated?.tags ? JSON.parse(updated.tags as string) : [],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (err: any) {
    console.error('[feed] PATCH /api/feed/posts/:id error:', err);
    return new Response(
      JSON.stringify({ error: 'Failed to update post' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}

// ─── GET /api/feed/posts/:postId/comments (TC-108-02 / TC-109-16) ───
// Public read. Cursor-based DESC (newest first). Supports ETag for conditional GET.
export async function handleGetComments(
  request: Request,
  env: Env,
  postId: string,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    // TC-109-16: Conditional GET via ETag
    const { checkCommentETag } = await import('../middleware');
    const etagResult = await checkCommentETag(request, env as any, postId);
    if (etagResult.match) {
      return new Response(null, {
        status: 304,
        headers: { ...corsHeaders },
      });
    }
    const url = new URL(request.url);
    const limit = Math.min(
      Math.max(parseInt(url.searchParams.get('limit') || '50'), 1),
      100
    );
    const cursor_ts = url.searchParams.get('cursor_ts');
    const cursor_id = url.searchParams.get('cursor_id');

    let query: string;
    let params: unknown[];

    if (cursor_ts && cursor_id) {
      query = `
        SELECT id, post_id, author_id, author_name, author_avatar, text, parent_id, timecode_pin, feedback_tag, created_at
        FROM feed_comments
        WHERE post_id = ? AND parent_id IS NULL
          AND (created_at < ? OR (created_at = ? AND id < ?))
        ORDER BY created_at DESC, id DESC
        LIMIT ?
      `;
      params = [postId, cursor_ts, cursor_ts, cursor_id, limit + 1];
    } else {
      query = `
        SELECT id, post_id, author_id, author_name, author_avatar, text, parent_id, timecode_pin, feedback_tag, created_at
        FROM feed_comments
        WHERE post_id = ? AND parent_id IS NULL
        ORDER BY created_at DESC, id DESC
        LIMIT ?
      `;
      params = [postId, limit + 1];
    }

    const { results } = await (env.FEED_DB.prepare(query) as any)
      .bind(...params)
      .all();

    const hasMore = results.length > limit;
    const comments = hasMore ? results.slice(0, limit) : results;

    const parsed = comments.map((c: any) => ({
      id: c.id,
      postId: c.post_id,
      authorId: c.author_id,
      authorName: c.author_name,
      authorAvatarUrl: c.author_avatar || '',
      text: c.text,
      parentId: c.parent_id || null,
      timecodePin: c.timecode_pin || null,
      feedbackTag: c.feedback_tag || null,
      createdAt: c.created_at,
    }));

    const last = parsed[parsed.length - 1];
    const nextCursor = hasMore && last
      ? { cursor_ts: last.createdAt, cursor_id: last.id }
      : null;

    return new Response(
      JSON.stringify({ comments: parsed, nextCursor, hasMore }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...(etagResult.etag ? { 'ETag': etagResult.etag } : {}),
          ...corsHeaders,
        },
      }
    );
  } catch (err: any) {
    console.error('[feed] GET comments error:', err);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch comments' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}

// ─── GET /api/feed/posts/:postId/comments/:commentId/replies (TC-109-07) ───
// Returns replies to a specific comment. `?newer_than=<ts>` for polling.
export async function handleListReplies(
  request: Request,
  env: Env,
  postId: string,
  commentId: string,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const limit = Math.min(
      Math.max(parseInt(url.searchParams.get('limit') || '50'), 1),
      100
    );
    const newer_than = url.searchParams.get('newer_than');

    let query: string;
    let params: unknown[];

    if (newer_than) {
      query = `
        SELECT id, post_id, author_id, author_name, author_avatar, text, parent_id, timecode_pin, feedback_tag, created_at
        FROM feed_comments
        WHERE post_id = ? AND parent_id = ? AND created_at > ?
        ORDER BY created_at ASC, id ASC
        LIMIT ?
      `;
      params = [postId, commentId, newer_than, limit + 1];
    } else {
      query = `
        SELECT id, post_id, author_id, author_name, author_avatar, text, parent_id, timecode_pin, feedback_tag, created_at
        FROM feed_comments
        WHERE post_id = ? AND parent_id = ?
        ORDER BY created_at ASC, id ASC
        LIMIT ?
      `;
      params = [postId, commentId, limit + 1];
    }

    const { results } = await (env.FEED_DB.prepare(query) as any)
      .bind(...params)
      .all();

    const hasMore = results.length > limit;
    const replies = hasMore ? results.slice(0, limit) : results;

    const parsed = replies.map((c: any) => ({
      id: c.id,
      postId: c.post_id,
      authorId: c.author_id,
      authorName: c.author_name,
      authorAvatarUrl: c.author_avatar || '',
      text: c.text,
      parentId: c.parent_id,
      timecodePin: c.timecode_pin || null,
      feedbackTag: c.feedback_tag || null,
      createdAt: c.created_at,
    }));

    return new Response(
      JSON.stringify({ replies: parsed, hasMore }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (err: any) {
    console.error('[feed] GET replies error:', err);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch replies' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}

// ─── POST /api/feed/posts/:postId/comments (TC-108-02 / TC-109-08) ───
// JWT required. Atomic batch: INSERT...WHERE EXISTS + UPDATE...AND status='published'.
export async function handleCreateComment(
  request: Request,
  env: Env,
  auth: AuthCtx,
  postId: string,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    const rawText = await request.text();
    if (rawText.length > 10_000) {
      return new Response(
        JSON.stringify({ error: 'Request too large (max 10000 characters)' }),
        { status: 413, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    let body: any;
    try {
      body = JSON.parse(rawText);
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    if (!body.text || typeof body.text !== 'string' || !body.text.trim()) {
      return new Response(
        JSON.stringify({ error: 'text is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }
    if (body.text.length > 2000) {
      return new Response(
        JSON.stringify({ error: 'text max 2000 characters' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Parse optional Wave 2 fields
    const parent_id = body.parentId || body.parent_id || null;
    const timecode_pin = body.timecodePin || body.timecode_pin || null;
    const feedback_tag = body.feedbackTag || body.feedback_tag || null;

    // Validate parent_id exists and belongs to this post
    if (parent_id) {
      const parentExists = await (env.FEED_DB.prepare(
        'SELECT 1 FROM feed_comments WHERE id = ? AND post_id = ? AND parent_id IS NULL'
      ) as any).bind(parent_id, postId).first();
      if (!parentExists) {
        return new Response(
          JSON.stringify({ error: 'parent comment not found or not a top-level comment' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }
    }

    // Validate feedback_tag
    const VALID_TAGS = ['vocals', 'mix', 'lyrics', 'arrangement', 'vibe'] as const;
    if (feedback_tag && !VALID_TAGS.includes(feedback_tag as any)) {
      return new Response(
        JSON.stringify({ error: `feedback_tag must be one of: ${VALID_TAGS.join(', ')}` }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const commentId = crypto.randomUUID();
    const now = new Date().toISOString();

    const insertComment = env.FEED_DB.prepare(
      `INSERT INTO feed_comments (id, post_id, author_id, author_name, author_avatar, text, parent_id, timecode_pin, feedback_tag, created_at)
       SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
       WHERE EXISTS (SELECT 1 FROM feed_posts WHERE id = ? AND status = 'published')`
    ).bind(
      commentId, postId,
      auth.sub, auth.name || 'Пользователь', auth.picture || '',
      body.text.slice(0, 2000), parent_id, timecode_pin, feedback_tag, now, postId
    );

    const updateCounter = env.FEED_DB.prepare(
      `UPDATE feed_posts SET comments_count = comments_count + 1 WHERE id = ? AND status = 'published'`
    ).bind(postId);

    const batch = await env.FEED_DB.batch([insertComment, updateCounter]);

    // 009 FIX: if no rows inserted → post not found or deleted
    if (batch[0].meta.changes === 0) {
      const post = await (env.FEED_DB.prepare(
        'SELECT status FROM feed_posts WHERE id = ?'
      ) as any).bind(postId).first<{ status: string }>();

      if (!post) {
        return new Response(
          JSON.stringify({ error: 'Post not found' }),
          { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }
      return new Response(
        JSON.stringify({ error: 'Post is not available' }),
        { status: 410, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    return new Response(
      JSON.stringify({
        id: commentId, postId,
        authorId: auth.sub, authorName: auth.name || 'Пользователь',
        authorAvatarUrl: auth.picture || '', text: body.text.slice(0, 2000),
        parentId: parent_id, timecodePin: timecode_pin, feedbackTag: feedback_tag,
        createdAt: now,
      }),
      { status: 201, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (err: any) {
    console.error('[feed] POST comment error:', err);
    return new Response(
      JSON.stringify({ error: 'Failed to create comment' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}

// ─── DELETE /api/feed/posts/:postId/comments/:commentId (TC-108-02) ───
export async function handleDeleteComment(
  env: Env,
  auth: AuthCtx,
  postId: string,
  commentId: string,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    const comment = await (env.FEED_DB.prepare(
      'SELECT id, author_id FROM feed_comments WHERE id = ? AND post_id = ?'
    ) as any).bind(commentId, postId).first<{ id: string; author_id: string }>();

    if (!comment) {
      return new Response(
        JSON.stringify({ error: 'Comment not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    if (comment.author_id !== auth.sub) {
      const role = await getUserRole(env.FEED_DB, auth.provider, auth.providerSub);
      if (role !== 'founder') {
        return new Response(
          JSON.stringify({ error: 'Forbidden' }),
          { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }
    }

    const deleteComment = env.FEED_DB.prepare(
      'DELETE FROM feed_comments WHERE id = ? AND post_id = ?'
    ).bind(commentId, postId);

    const updateCounter = env.FEED_DB.prepare(
      `UPDATE feed_posts SET comments_count = MAX(0, comments_count - 1) WHERE id = ? AND status = 'published'`
    ).bind(postId);

    await env.FEED_DB.batch([deleteComment, updateCounter]);

    // TC-109-15: KV version bump for conditional GET
    bumpCommentVersion(env, postId).catch(() => {});

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (err: any) {
    console.error('[feed] DELETE comment error:', err);
    return new Response(
      JSON.stringify({ error: 'Failed to delete comment' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}

// ═══════════════════════════════════════════════════════════════
// TC-109-12: Mention extraction helper
// ═══════════════════════════════════════════════════════════════
const MENTION_RE = /(?:^|\s)@(\p{L}[\p{L}\p{N}_]*)/gu;
const MAX_MENTIONS = 5;

async function extractMentions(
  text: string,
  sourceId: string,
  postId: string,
  auth: AuthCtx,
  env: Env
): Promise<void> {
  const handles = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = MENTION_RE.exec(text)) !== null && handles.size < MAX_MENTIONS) {
    handles.add(match[1].toLowerCase());
  }
  if (handles.size === 0) return;

  const handleList = [...handles];
  const placeholders = handleList.map(() => '?').join(',');
  const users = await (env.FEED_DB.prepare(
    `SELECT user_id FROM users WHERE LOWER(handle) IN (${placeholders}) AND user_id != ?`
  ) as any).bind(...handleList, auth.sub).all();

  const mentionedUsers = (users.results || []) as Array<{ user_id: string }>;
  if (mentionedUsers.length === 0) return;

  const inserts: any[] = [];
  const now = new Date().toISOString();

  for (const u of mentionedUsers) {
    inserts.push(
      (env.FEED_DB.prepare(
        'INSERT OR IGNORE INTO feed_mentions (source_type, source_id, mentioned_user_id) VALUES (?, ?, ?)'
      ) as any).bind('comment', sourceId, u.user_id)
    );
    inserts.push(
      (env.FEED_DB.prepare(`
        INSERT INTO feed_notifications (id, user_id, actor_id, actor_name, type, post_id, comment_id, text_preview, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `) as any).bind(
        crypto.randomUUID(), u.user_id,
        auth.sub, auth.name || 'Пользователь',
        'mention', postId, sourceId,
        text.slice(0, 200), now
      )
    );
  }

  await env.FEED_DB.batch(inserts);
}
