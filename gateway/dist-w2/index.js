var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/helpers.ts
function getCommentVersionKey(postId) {
  return `${VERSION_PREFIX}${postId}`;
}
async function bumpCommentVersion(env, postId) {
  if (!env.FEED_KV)
    return;
  try {
    const version = Date.now().toString();
    await env.FEED_KV.put(getCommentVersionKey(postId), version, { expirationTtl: 86400 });
  } catch (err) {
    console.warn("[helpers] Failed to bump comment version:", err);
  }
}
async function getCommentVersion(env, postId) {
  if (!env.FEED_KV)
    return null;
  try {
    return await env.FEED_KV.get(getCommentVersionKey(postId));
  } catch {
    return null;
  }
}
function generateCommentETag(postId, version) {
  return `"cm:${postId}:${version}"`;
}
var VERSION_PREFIX;
var init_helpers = __esm({
  "src/helpers.ts"() {
    "use strict";
    VERSION_PREFIX = "p:cm:";
    __name(getCommentVersionKey, "getCommentVersionKey");
    __name(bumpCommentVersion, "bumpCommentVersion");
    __name(getCommentVersion, "getCommentVersion");
    __name(generateCommentETag, "generateCommentETag");
  }
});

// src/middleware.ts
var middleware_exports = {};
__export(middleware_exports, {
  bumpCommentVersion: () => bumpCommentVersion,
  checkCommentETag: () => checkCommentETag
});
async function checkCommentETag(request, env, postId) {
  const ifNoneMatch = request.headers.get("If-None-Match");
  if (!ifNoneMatch) {
    const version = await getCommentVersion(env, postId);
    return {
      match: false,
      etag: version ? generateCommentETag(postId, version) : null
    };
  }
  const parsed = parseCommentETag(ifNoneMatch);
  if (!parsed || parsed.postId !== postId) {
    const version = await getCommentVersion(env, postId);
    return {
      match: false,
      etag: version ? generateCommentETag(postId, version) : null
    };
  }
  const currentVersion = await getCommentVersion(env, postId);
  if (!currentVersion) {
    return { match: false, etag: null };
  }
  if (currentVersion === parsed.version) {
    return { match: true, etag: null };
  }
  return {
    match: false,
    etag: generateCommentETag(postId, currentVersion)
  };
}
var init_middleware = __esm({
  "src/middleware.ts"() {
    "use strict";
    init_helpers();
    init_helpers();
    __name(checkCommentETag, "checkCommentETag");
  }
});

// src/handlers/auth.ts
var auth_exports = {};
__export(auth_exports, {
  getAuthCtx: () => getAuthCtx,
  verifyJWT: () => verifyJWT
});
async function getAuthCtx(request, env) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer "))
    return null;
  const token = authHeader.slice(7).trim();
  return verifyJWT(token, env.JWT_SECRET);
}
async function verifyJWT(token, secret) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3)
      return null;
    const [headerB64, payloadB64, signatureB64] = parts;
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
    const sigBuf = base64UrlDecode(signatureB64);
    const valid = await crypto.subtle.verify("HMAC", key, sigBuf, data);
    if (!valid)
      return null;
    const payloadStr = new TextDecoder().decode(base64UrlDecode(payloadB64));
    const payload = JSON.parse(payloadStr);
    if (payload.exp && Date.now() / 1e3 > payload.exp)
      return null;
    if (payload.iss !== "belive-auth")
      return null;
    const roleHint = payload.role || "user";
    return {
      sub: payload.sub,
      provider: payload.provider || "google",
      providerSub: payload.sub?.replace(/^google:/, "") || payload.sub || "",
      roleHint,
      email: payload.email,
      name: payload.name,
      picture: payload.picture || payload.avatar,
      exp: payload.exp
    };
  } catch {
    return null;
  }
}
function base64UrlDecode(str) {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - base64.length % 4) % 4);
  const binaryStr = atob(padded);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return bytes.buffer;
}
var init_auth = __esm({
  "src/handlers/auth.ts"() {
    "use strict";
    __name(getAuthCtx, "getAuthCtx");
    __name(verifyJWT, "verifyJWT");
    __name(base64UrlDecode, "base64UrlDecode");
  }
});

// src/handlers/roles.ts
async function getUserRole(db, provider, providerSub) {
  const row = await db.prepare(
    "SELECT role FROM user_roles WHERE provider = ? AND provider_sub = ? AND revoked_at IS NULL"
  ).bind(provider, providerSub).first();
  return row?.role ?? null;
}
__name(getUserRole, "getUserRole");
async function assignRole(db, params) {
  await db.prepare(
    `INSERT INTO user_roles (user_id, provider, provider_sub, role, email, assigned_by)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(
    params.userId,
    params.provider,
    params.providerSub,
    params.role,
    params.email ?? null,
    params.assignedBy
  ).run();
}
__name(assignRole, "assignRole");
async function hasExistingFounder(db) {
  const row = await db.prepare(
    "SELECT 1 FROM user_roles WHERE role = 'founder' AND revoked_at IS NULL LIMIT 1"
  ).first();
  return !!row;
}
__name(hasExistingFounder, "hasExistingFounder");

// src/handlers/feed.ts
init_helpers();
var VALID_TYPES = ["post", "track", "battle", "event"];
async function handleGetFeedPosts(request, env, corsHeaders2) {
  try {
    const url = new URL(request.url);
    const limit = Math.min(
      Math.max(parseInt(url.searchParams.get("limit") || "50"), 1),
      100
    );
    const cursor_ts = url.searchParams.get("cursor_ts");
    const cursor_id = url.searchParams.get("cursor_id");
    const selectFields = `
      id, author_id, author_name, author_avatar, author_type,
      type, title, body, tags, cover_r2_key,
      track_id, base_track_id, battle_block_id,
      battle_status, max_submissions,
      event_date, event_price, event_location,
      likes_count, comments_count, source_type, created_at, updated_at
    `;
    let query;
    let params;
    if (cursor_ts && cursor_id) {
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
    const { results } = await env.FEED_DB.prepare(query).bind(...params).all();
    const hasMore = results.length > limit;
    const posts = hasMore ? results.slice(0, limit) : results;
    const parsed = posts.map((p) => ({
      ...p,
      tags: p.tags ? JSON.parse(p.tags) : []
    }));
    const last = parsed[parsed.length - 1];
    const nextCursor = hasMore && last ? { cursor_ts: last.created_at, cursor_id: last.id } : null;
    return new Response(
      JSON.stringify({ posts: parsed, nextCursor, hasMore }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders2 } }
    );
  } catch (err) {
    console.error("[feed] GET /api/feed/posts error:", err);
    return new Response(
      JSON.stringify({ error: "Failed to fetch posts" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders2 } }
    );
  }
}
__name(handleGetFeedPosts, "handleGetFeedPosts");
async function handleCreateFeedPost(request, env, auth, corsHeaders2) {
  try {
    const rawText = await request.text();
    if (rawText.length > 1e6) {
      return new Response(
        JSON.stringify({ error: "Request too large (max 1MB)" }),
        { status: 413, headers: { "Content-Type": "application/json", ...corsHeaders2 } }
      );
    }
    let body;
    try {
      body = JSON.parse(rawText);
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders2 } }
      );
    }
    if (!body.type || !VALID_TYPES.includes(body.type)) {
      return new Response(
        JSON.stringify({ error: `type must be one of: ${VALID_TYPES.join(", ")}` }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders2 } }
      );
    }
    if (!body.title || typeof body.title !== "string") {
      return new Response(
        JSON.stringify({ error: "title is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders2 } }
      );
    }
    return new Response(
      JSON.stringify({
        ...created,
        blocks_data: created?.blocks_data ? JSON.parse(created.blocks_data) : [],
        tags: created?.tags ? JSON.parse(created.tags) : []
      }),
      { status: 201, headers: { "Content-Type": "application/json", ...corsHeaders2 } }
    );
  } catch (err) {
    console.error("[feed] POST /api/feed/posts error:", err);
    return new Response(
      JSON.stringify({ error: "Failed to create post" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders2 } }
    );
  }
}
__name(handleCreateFeedPost, "handleCreateFeedPost");
async function handleToggleLike(request, env, auth, corsHeaders2) {
  try {
    const { postId } = await request.json();
    const userId = auth.sub;
    if (!postId) {
      return new Response(
        JSON.stringify({ error: "postId is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders2 } }
      );
    }
    const postStatus = await env.FEED_DB.prepare(
      "SELECT status FROM feed_posts WHERE id = ?"
    ).bind(postId).first();
    if (!postStatus) {
      return new Response(
        JSON.stringify({ error: "Post not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders2 } }
      );
    }
    if (postStatus.status !== "published") {
      return new Response(
        JSON.stringify({ error: "Post is not available" }),
        { status: 410, headers: { "Content-Type": "application/json", ...corsHeaders2 } }
      );
    }
    const existing = await env.FEED_DB.prepare(
      "SELECT 1 FROM feed_likes WHERE post_id = ? AND user_id = ?"
    ).bind(postId, userId).first();
    let liked;
    let likes_count;
    if (existing) {
      const batchResult = await env.FEED_DB.batch([
        env.FEED_DB.prepare(
          "DELETE FROM feed_likes WHERE post_id = ? AND user_id = ?"
        ).bind(postId, userId),
        env.FEED_DB.prepare(
          "UPDATE feed_posts SET likes_count = MAX(0, likes_count - 1) WHERE id = ?"
        ).bind(postId)
      ]);
      liked = false;
      const post = await env.FEED_DB.prepare(
        "SELECT likes_count FROM feed_posts WHERE id = ?"
      ).bind(postId).first();
      likes_count = post?.likes_count || 0;
    } else {
      const batchResult = await env.FEED_DB.batch([
        env.FEED_DB.prepare(
          "INSERT INTO feed_likes (post_id, user_id, created_at) VALUES (?, ?, ?)"
        ).bind(postId, userId, (/* @__PURE__ */ new Date()).toISOString()),
        env.FEED_DB.prepare(
          "UPDATE feed_posts SET likes_count = likes_count + 1 WHERE id = ?"
        ).bind(postId)
      ]);
      liked = true;
      const post = await env.FEED_DB.prepare(
        "SELECT likes_count FROM feed_posts WHERE id = ?"
      ).bind(postId).first();
      likes_count = post?.likes_count || 0;
    }
    return new Response(
      JSON.stringify({ liked, likes_count }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders2 } }
    );
  } catch (err) {
    console.error("[feed] POST /api/feed/likes error:", err);
    return new Response(
      JSON.stringify({ error: "Failed to toggle like" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders2 } }
    );
  }
}
__name(handleToggleLike, "handleToggleLike");
async function handleDeleteFeedPost(env, auth, postId, corsHeaders2, body) {
  try {
    const post = await env.FEED_DB.prepare(
      "SELECT id, author_id, status FROM feed_posts WHERE id = ?"
    ).bind(postId).first();
    if (!post) {
      return new Response(
        JSON.stringify({ error: "Post not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders2 } }
      );
    }
    if (post.status === "deleted") {
      return new Response(
        JSON.stringify({ error: "Post already deleted" }),
        { status: 410, headers: { "Content-Type": "application/json", ...corsHeaders2 } }
      );
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    if (post.author_id === auth.sub) {
      await env.FEED_DB.prepare(
        "UPDATE feed_posts SET status = 'deleted', deleted_at = ? WHERE id = ?"
      ).bind(now, postId).run();
      return new Response(
        JSON.stringify({ success: true, action: "self_delete" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders2 } }
      );
    }
    const role = await getUserRole(env.FEED_DB, auth.provider, auth.providerSub);
    if (role === "founder") {
      const insertModLog = env.FEED_DB.prepare(
        `INSERT INTO feed_moderation_log (id, post_id, actor_id, actor_role, action, reason, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        crypto.randomUUID(),
        postId,
        auth.sub,
        // actor_id = authCtx.sub
        "founder",
        // actor_role from D1
        "admin_delete",
        body?.reason || null,
        now
      );
      const updatePost = env.FEED_DB.prepare(
        "UPDATE feed_posts SET status = 'deleted', deleted_at = ? WHERE id = ?"
      ).bind(now, postId);
      await env.FEED_DB.batch([insertModLog, updatePost]);
      return new Response(
        JSON.stringify({ success: true, action: "admin_delete" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders2 } }
      );
    }
    return new Response(
      JSON.stringify({ error: "Forbidden" }),
      { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders2 } }
    );
  } catch (err) {
    console.error("[feed] DELETE /api/feed/posts/:id error:", err);
    return new Response(
      JSON.stringify({ error: "Failed to delete post" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders2 } }
    );
  }
}
__name(handleDeleteFeedPost, "handleDeleteFeedPost");
async function handleRestoreFeedPost(env, auth, postId, corsHeaders2) {
  try {
    const post = await env.FEED_DB.prepare(
      "SELECT id, status FROM feed_posts WHERE id = ?"
    ).bind(postId).first();
    if (!post) {
      return new Response(
        JSON.stringify({ error: "Post not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders2 } }
      );
    }
    if (post.status === "published") {
      return new Response(
        JSON.stringify({ error: "Post already published" }),
        { status: 410, headers: { "Content-Type": "application/json", ...corsHeaders2 } }
      );
    }
    const role = await getUserRole(env.FEED_DB, auth.provider, auth.providerSub);
    if (role !== "founder") {
      return new Response(
        JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders2 } }
      );
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const insertModLog = env.FEED_DB.prepare(
      `INSERT INTO feed_moderation_log (id, post_id, actor_id, actor_role, action, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(
      crypto.randomUUID(),
      postId,
      auth.sub,
      "founder",
      "restore",
      now
    );
    const updatePost = env.FEED_DB.prepare(
      "UPDATE feed_posts SET status = 'published', deleted_at = NULL WHERE id = ?"
    ).bind(postId);
    await env.FEED_DB.batch([insertModLog, updatePost]);
    return new Response(
      JSON.stringify({ success: true, action: "restore" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders2 } }
    );
  } catch (err) {
    console.error("[feed] PATCH restore error:", err);
    return new Response(
      JSON.stringify({ error: "Failed to restore post" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders2 } }
    );
  }
}
__name(handleRestoreFeedPost, "handleRestoreFeedPost");
async function handleUpdateFeedPost(env, auth, postId, request, corsHeaders2) {
  try {
    const rawText = await request.text();
    if (rawText.length > 1e6) {
      return new Response(
        JSON.stringify({ error: "Request too large (max 1MB)" }),
        { status: 413, headers: { "Content-Type": "application/json", ...corsHeaders2 } }
      );
    }
    let body;
    try {
      body = JSON.parse(rawText);
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders2 } }
      );
    }
    const ALLOWED_FIELDS = ["title", "text", "tags", "event_date", "event_price", "event_location"];
    const patchFields = {};
    for (const key of Object.keys(body)) {
      if (!ALLOWED_FIELDS.includes(key)) {
        return new Response(
          JSON.stringify({ error: `Unknown field: ${key}. Allowed: ${ALLOWED_FIELDS.join(", ")}` }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders2 } }
        );
      }
      patchFields[key] = body[key];
    }
    if (Object.keys(patchFields).length === 0) {
      return new Response(
        JSON.stringify({ error: "No editable fields provided" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders2 } }
      );
    }
    if ("title" in patchFields) {
      if (typeof patchFields.title !== "string" || !patchFields.title.trim()) {
        return new Response(
          JSON.stringify({ error: "title must be a non-empty string" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders2 } }
        );
      }
      if (patchFields.title.length > 500) {
        return new Response(
          JSON.stringify({ error: "title max 500 characters" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders2 } }
        );
      }
    }
    if ("text" in patchFields && patchFields.text !== null) {
      if (typeof patchFields.text !== "string" || patchFields.text.length > 1e4) {
        return new Response(
          JSON.stringify({ error: "text max 10000 characters" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders2 } }
        );
      }
    }
    if ("tags" in patchFields && patchFields.tags !== null) {
      if (!Array.isArray(patchFields.tags)) {
        return new Response(
          JSON.stringify({ error: "tags must be an array" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders2 } }
        );
      }
    }
    const post = await env.FEED_DB.prepare(
      "SELECT id, author_id, type, status FROM feed_posts WHERE id = ?"
    ).bind(postId).first();
    if (!post) {
      return new Response(
        JSON.stringify({ error: "Post not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders2 } }
      );
    }
    if (post.status === "deleted") {
      return new Response(
        JSON.stringify({ error: "Post is deleted" }),
        { status: 410, headers: { "Content-Type": "application/json", ...corsHeaders2 } }
      );
    }
    if (post.author_id !== auth.sub) {
      return new Response(
        JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders2 } }
      );
    }
    if (post.type === "battle") {
      return new Response(
        JSON.stringify({ error: "Battle posts cannot be edited" }),
        { status: 409, headers: { "Content-Type": "application/json", ...corsHeaders2 } }
      );
    }
    const setClauses = ["updated_at = ?"];
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const params = [now];
    if ("title" in patchFields) {
      setClauses.push("title = ?");
      params.push(patchFields.title.slice(0, 500));
    }
    if ("text" in patchFields) {
      setClauses.push("body = ?");
      params.push(patchFields.text !== null ? patchFields.text.slice(0, 1e4) : null);
    }
    if ("tags" in patchFields) {
      setClauses.push("tags = ?");
      params.push(patchFields.tags !== null ? JSON.stringify(patchFields.tags) : null);
    }
    if ("event_date" in patchFields) {
      setClauses.push("event_date = ?");
      params.push(patchFields.event_date);
    }
    if ("event_price" in patchFields) {
      setClauses.push("event_price = ?");
      params.push(patchFields.event_price);
    }
    if ("event_location" in patchFields) {
      setClauses.push("event_location = ?");
      params.push(patchFields.event_location);
    }
    params.push(postId);
    await env.FEED_DB.prepare(
      `UPDATE feed_posts SET ${setClauses.join(", ")} WHERE id = ?`
    ).bind(...params).run();
    const updated = await env.FEED_DB.prepare(
      "SELECT * FROM feed_posts WHERE id = ?"
    ).bind(postId).first();
    return new Response(
      JSON.stringify({
        ...updated,
        blocks_data: updated?.blocks_data ? JSON.parse(updated.blocks_data) : [],
        tags: updated?.tags ? JSON.parse(updated.tags) : []
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders2 } }
    );
  } catch (err) {
    console.error("[feed] PATCH /api/feed/posts/:id error:", err);
    return new Response(
      JSON.stringify({ error: "Failed to update post" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders2 } }
    );
  }
}
__name(handleUpdateFeedPost, "handleUpdateFeedPost");
async function handleGetComments(request, env, postId, corsHeaders2) {
  try {
    const { checkCommentETag: checkCommentETag2 } = await Promise.resolve().then(() => (init_middleware(), middleware_exports));
    const etagResult = await checkCommentETag2(request, env, postId);
    if (etagResult.match) {
      return new Response(null, {
        status: 304,
        headers: { ...corsHeaders2 }
      });
    }
    const url = new URL(request.url);
    const limit = Math.min(
      Math.max(parseInt(url.searchParams.get("limit") || "50"), 1),
      100
    );
    const cursor_ts = url.searchParams.get("cursor_ts");
    const cursor_id = url.searchParams.get("cursor_id");
    let query;
    let params;
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
    const { results } = await env.FEED_DB.prepare(query).bind(...params).all();
    const hasMore = results.length > limit;
    const comments = hasMore ? results.slice(0, limit) : results;
    const parsed = comments.map((c) => ({
      id: c.id,
      postId: c.post_id,
      authorId: c.author_id,
      authorName: c.author_name,
      authorAvatarUrl: c.author_avatar || "",
      text: c.text,
      parentId: c.parent_id || null,
      timecodePin: c.timecode_pin || null,
      feedbackTag: c.feedback_tag || null,
      createdAt: c.created_at
    }));
    const last = parsed[parsed.length - 1];
    const nextCursor = hasMore && last ? { cursor_ts: last.createdAt, cursor_id: last.id } : null;
    return new Response(
      JSON.stringify({ comments: parsed, nextCursor, hasMore }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...etagResult.etag ? { "ETag": etagResult.etag } : {},
          ...corsHeaders2
        }
      }
    );
  } catch (err) {
    console.error("[feed] GET comments error:", err);
    return new Response(
      JSON.stringify({ error: "Failed to fetch comments" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders2 } }
    );
  }
}
__name(handleGetComments, "handleGetComments");
async function handleListReplies(request, env, postId, commentId, corsHeaders2) {
  try {
    const url = new URL(request.url);
    const limit = Math.min(
      Math.max(parseInt(url.searchParams.get("limit") || "50"), 1),
      100
    );
    const newer_than = url.searchParams.get("newer_than");
    let query;
    let params;
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
    const { results } = await env.FEED_DB.prepare(query).bind(...params).all();
    const hasMore = results.length > limit;
    const replies = hasMore ? results.slice(0, limit) : results;
    const parsed = replies.map((c) => ({
      id: c.id,
      postId: c.post_id,
      authorId: c.author_id,
      authorName: c.author_name,
      authorAvatarUrl: c.author_avatar || "",
      text: c.text,
      parentId: c.parent_id,
      timecodePin: c.timecode_pin || null,
      feedbackTag: c.feedback_tag || null,
      createdAt: c.created_at
    }));
    return new Response(
      JSON.stringify({ replies: parsed, hasMore }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders2 } }
    );
  } catch (err) {
    console.error("[feed] GET replies error:", err);
    return new Response(
      JSON.stringify({ error: "Failed to fetch replies" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders2 } }
    );
  }
}
__name(handleListReplies, "handleListReplies");
async function handleCreateComment(request, env, auth, postId, corsHeaders2) {
  try {
    const rawText = await request.text();
    if (rawText.length > 1e4) {
      return new Response(
        JSON.stringify({ error: "Request too large (max 10000 characters)" }),
        { status: 413, headers: { "Content-Type": "application/json", ...corsHeaders2 } }
      );
    }
    let body;
    try {
      body = JSON.parse(rawText);
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders2 } }
      );
    }
    if (!body.text || typeof body.text !== "string" || !body.text.trim()) {
      return new Response(
        JSON.stringify({ error: "text is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders2 } }
      );
    }
    if (body.text.length > 2e3) {
      return new Response(
        JSON.stringify({ error: "text max 2000 characters" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders2 } }
      );
    }
    const parent_id = body.parentId || body.parent_id || null;
    const timecode_pin = body.timecodePin || body.timecode_pin || null;
    const feedback_tag = body.feedbackTag || body.feedback_tag || null;
    if (parent_id) {
      const parentExists = await env.FEED_DB.prepare(
        "SELECT 1 FROM feed_comments WHERE id = ? AND post_id = ? AND parent_id IS NULL"
      ).bind(parent_id, postId).first();
      if (!parentExists) {
        return new Response(
          JSON.stringify({ error: "parent comment not found or not a top-level comment" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders2 } }
        );
      }
    }
    const VALID_TAGS = ["vocals", "mix", "lyrics", "arrangement", "vibe"];
    if (feedback_tag && !VALID_TAGS.includes(feedback_tag)) {
      return new Response(
        JSON.stringify({ error: `feedback_tag must be one of: ${VALID_TAGS.join(", ")}` }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders2 } }
      );
    }
    const commentId = crypto.randomUUID();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const insertComment = env.FEED_DB.prepare(
      `INSERT INTO feed_comments (id, post_id, author_id, author_name, author_avatar, text, parent_id, timecode_pin, feedback_tag, created_at)
       SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
       WHERE EXISTS (SELECT 1 FROM feed_posts WHERE id = ? AND status = 'published')`
    ).bind(
      commentId,
      postId,
      auth.sub,
      auth.name || "\u041F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C",
      auth.picture || "",
      body.text.slice(0, 2e3),
      parent_id,
      timecode_pin,
      feedback_tag,
      now,
      postId
    );
    const updateCounter = env.FEED_DB.prepare(
      `UPDATE feed_posts SET comments_count = comments_count + 1 WHERE id = ? AND status = 'published'`
    ).bind(postId);
    const batch = await env.FEED_DB.batch([insertComment, updateCounter]);
    if (batch[0].meta.changes === 0) {
      const post = await env.FEED_DB.prepare(
        "SELECT status FROM feed_posts WHERE id = ?"
      ).bind(postId).first();
      if (!post) {
        return new Response(
          JSON.stringify({ error: "Post not found" }),
          { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders2 } }
        );
      }
      return new Response(
        JSON.stringify({ error: "Post is not available" }),
        { status: 410, headers: { "Content-Type": "application/json", ...corsHeaders2 } }
      );
    }
    extractMentions(body.text, commentId, postId, auth, env).catch(() => {
    });
    bumpCommentVersion(env, postId).catch(() => {
    });
    return new Response(
      JSON.stringify({
        id: commentId,
        postId,
        authorId: auth.sub,
        authorName: auth.name || "\u041F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C",
        authorAvatarUrl: auth.picture || "",
        text: body.text.slice(0, 2e3),
        parentId: parent_id,
        timecodePin: timecode_pin,
        feedbackTag: feedback_tag,
        createdAt: now
      }),
      { status: 201, headers: { "Content-Type": "application/json", ...corsHeaders2 } }
    );
  } catch (err) {
    console.error("[feed] POST comment error:", err);
    return new Response(
      JSON.stringify({ error: "Failed to create comment" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders2 } }
    );
  }
}
__name(handleCreateComment, "handleCreateComment");
async function handleDeleteComment(env, auth, postId, commentId, corsHeaders2) {
  try {
    const comment = await env.FEED_DB.prepare(
      "SELECT id, author_id FROM feed_comments WHERE id = ? AND post_id = ?"
    ).bind(commentId, postId).first();
    if (!comment) {
      return new Response(
        JSON.stringify({ error: "Comment not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders2 } }
      );
    }
    if (comment.author_id !== auth.sub) {
      const role = await getUserRole(env.FEED_DB, auth.provider, auth.providerSub);
      if (role !== "founder") {
        return new Response(
          JSON.stringify({ error: "Forbidden" }),
          { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders2 } }
        );
      }
    }
    const deleteComment = env.FEED_DB.prepare(
      "DELETE FROM feed_comments WHERE id = ? AND post_id = ?"
    ).bind(commentId, postId);
    const updateCounter = env.FEED_DB.prepare(
      `UPDATE feed_posts SET comments_count = MAX(0, comments_count - 1) WHERE id = ? AND status = 'published'`
    ).bind(postId);
    await env.FEED_DB.batch([deleteComment, updateCounter]);
    bumpCommentVersion(env, postId).catch(() => {
    });
    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders2 } }
    );
  } catch (err) {
    console.error("[feed] DELETE comment error:", err);
    return new Response(
      JSON.stringify({ error: "Failed to delete comment" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders2 } }
    );
  }
}
__name(handleDeleteComment, "handleDeleteComment");
var MENTION_RE = /(?:^|\s)@(\p{L}[\p{L}\p{N}_]*)/gu;
var MAX_MENTIONS = 5;
async function extractMentions(text, sourceId, postId, auth, env) {
  const handles = /* @__PURE__ */ new Set();
  let match;
  while ((match = MENTION_RE.exec(text)) !== null && handles.size < MAX_MENTIONS) {
    handles.add(match[1].toLowerCase());
  }
  if (handles.size === 0)
    return;
  const handleList = [...handles];
  const placeholders = handleList.map(() => "?").join(",");
  const users = await env.FEED_DB.prepare(
    `SELECT user_id FROM users WHERE LOWER(handle) IN (${placeholders}) AND user_id != ?`
  ).bind(...handleList, auth.sub).all();
  const mentionedUsers = users.results || [];
  if (mentionedUsers.length === 0)
    return;
  const inserts = [];
  const now = (/* @__PURE__ */ new Date()).toISOString();
  for (const u of mentionedUsers) {
    inserts.push(
      env.FEED_DB.prepare(
        "INSERT OR IGNORE INTO feed_mentions (source_type, source_id, mentioned_user_id) VALUES (?, ?, ?)"
      ).bind("comment", sourceId, u.user_id)
    );
    inserts.push(
      env.FEED_DB.prepare(`
        INSERT INTO feed_notifications (id, user_id, actor_id, actor_name, type, post_id, comment_id, text_preview, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        crypto.randomUUID(),
        u.user_id,
        auth.sub,
        auth.name || "\u041F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C",
        "mention",
        postId,
        sourceId,
        text.slice(0, 200),
        now
      )
    );
  }
  await env.FEED_DB.batch(inserts);
}
__name(extractMentions, "extractMentions");

// src/index.ts
init_auth();

// migrations/_runner.ts
async function columnExists(db, table, column) {
  const result = await db.prepare(
    `SELECT 1 FROM pragma_table_info(?) WHERE name = ?`
  ).bind(table, column).first();
  return !!result;
}
__name(columnExists, "columnExists");
var MIGRATIONS = [
  {
    version: 5,
    name: "wave2_comments_extensions",
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
      `CREATE INDEX IF NOT EXISTS idx_feed_comments_timecode ON feed_comments(post_id, timecode_pin ASC) WHERE timecode_pin IS NOT NULL`
    ]
  },
  {
    version: 6,
    name: "wave2_reactions",
    sql: [
      `CREATE TABLE IF NOT EXISTS feed_reactions (
        target_type TEXT NOT NULL DEFAULT 'post',
        target_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        emoji TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (target_type, target_id, user_id, emoji)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_feed_reactions_target ON feed_reactions(target_type, target_id, emoji)`
    ]
  },
  {
    version: 7,
    name: "wave2_notifications",
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
      `CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON feed_notifications(user_id, is_read, created_at DESC)`
    ]
  },
  {
    version: 8,
    name: "wave2_users_mentions",
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
      `CREATE INDEX IF NOT EXISTS idx_mentions_user ON feed_mentions(mentioned_user_id)`
    ]
  }
];
async function runMigrations(db) {
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`
  ).run();
  const applied = await db.prepare(
    "SELECT version FROM schema_migrations ORDER BY version ASC"
  ).all();
  const appliedVersions = new Set((applied.results || []).map((r) => r.version));
  for (const migration of MIGRATIONS) {
    if (appliedVersions.has(migration.version)) {
      console.log(`[migrations] ${migration.version}-${migration.name}: already applied, skip`);
      continue;
    }
    console.log(`[migrations] ${migration.version}-${migration.name}: applying...`);
    let skippedAlters = 0;
    for (const stmt of migration.sql) {
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
    await db.prepare(
      "INSERT INTO schema_migrations (version, name) VALUES (?, ?)"
    ).bind(migration.version, migration.name).run();
    if (skippedAlters > 0) {
      console.log(`[migrations] ${migration.version}-${migration.name}: applied (${skippedAlters} ALTERs skipped \u2014 already existed)`);
    } else {
      console.log(`[migrations] ${migration.version}-${migration.name}: applied \u2714`);
    }
  }
  console.log("[migrations] All pending migrations applied.");
}
__name(runMigrations, "runMigrations");

// src/handlers/reactions.ts
var MUSIC_REACTIONS = ["\u{1F525}", "\u{1F3B5}", "\u{1F3A4}", "\u{1F4AF}", "\u{1F92F}"];
async function handleToggleReaction(request, env, auth, corsHeaders2) {
  try {
    const rawText = await request.text();
    if (rawText.length > 1e3) {
      return new Response(
        JSON.stringify({ error: "Request too large" }),
        { status: 413, headers: { "Content-Type": "application/json", ...corsHeaders2 } }
      );
    }
    let body;
    try {
      body = JSON.parse(rawText);
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders2 } }
      );
    }
    const { targetType, targetId, emoji } = body;
    if (!targetType || !["post", "comment"].includes(targetType)) {
      return new Response(
        JSON.stringify({ error: "targetType must be post or comment" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders2 } }
      );
    }
    if (!targetId) {
      return new Response(
        JSON.stringify({ error: "targetId is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders2 } }
      );
    }
    if (!emoji || !MUSIC_REACTIONS.includes(emoji)) {
      return new Response(
        JSON.stringify({ error: `emoji must be one of: ${MUSIC_REACTIONS.join(", ")}` }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders2 } }
      );
    }
    const userId = auth.sub;
    const current = await env.FEED_DB.prepare(
      "SELECT emoji FROM feed_reactions WHERE target_type = ? AND target_id = ? AND user_id = ?"
    ).bind(targetType, targetId, userId).first();
    const wasActive = current?.emoji === emoji;
    await env.FEED_DB.prepare(
      "DELETE FROM feed_reactions WHERE target_type = ? AND target_id = ? AND user_id = ?"
    ).bind(targetType, targetId, userId).run();
    let reacted = false;
    if (!wasActive) {
      await env.FEED_DB.prepare(
        "INSERT INTO feed_reactions (target_type, target_id, user_id, emoji) VALUES (?, ?, ?, ?)"
      ).bind(targetType, targetId, userId, emoji).run();
      reacted = true;
    }
    return new Response(
      JSON.stringify({ reacted, emoji, targetType, targetId }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders2 } }
    );
  } catch (err) {
    console.error("[reactions] POST /api/feed/reactions error:", err);
    return new Response(
      JSON.stringify({ error: "Failed to toggle reaction" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders2 } }
    );
  }
}
__name(handleToggleReaction, "handleToggleReaction");
async function handleGetReactions(request, env, corsHeaders2) {
  try {
    const url = new URL(request.url);
    const targetType = url.searchParams.get("target_type") || "post";
    const targetIds = (url.searchParams.get("target_ids") || "").split(",").filter(Boolean);
    if (!targetIds.length) {
      return new Response(
        JSON.stringify({ reactions: {}, userReactions: {} }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders2 } }
      );
    }
    const placeholders = targetIds.map(() => "?").join(",");
    const { results } = await env.FEED_DB.prepare(
      `SELECT target_id, emoji, COUNT(*) as count FROM feed_reactions
       WHERE target_type = ? AND target_id IN (${placeholders})
       GROUP BY target_id, emoji ORDER BY target_id, count DESC`
    ).bind(targetType, ...targetIds).all();
    const grouped = {};
    for (const row of results || []) {
      if (!grouped[row.target_id])
        grouped[row.target_id] = {};
      grouped[row.target_id][row.emoji] = row.count;
    }
    const authHeader = request.headers.get("Authorization");
    let userReactions = {};
    if (authHeader?.startsWith("Bearer ")) {
      const { getAuthCtx: getAuthCtx2 } = await Promise.resolve().then(() => (init_auth(), auth_exports));
      const auth = await getAuthCtx2(request, env);
      if (auth) {
        const { results: userRows } = await env.FEED_DB.prepare(
          `SELECT target_id, emoji FROM feed_reactions
           WHERE target_type = ? AND target_id IN (${placeholders}) AND user_id = ?`
        ).bind(targetType, ...targetIds, auth.sub).all();
        for (const row of userRows || []) {
          if (!userReactions[row.target_id])
            userReactions[row.target_id] = [];
          userReactions[row.target_id].push(row.emoji);
        }
      }
    }
    return new Response(
      JSON.stringify({ reactions: grouped, userReactions }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders2 } }
    );
  } catch (err) {
    console.error("[reactions] GET /api/feed/reactions error:", err);
    return new Response(
      JSON.stringify({ error: "Failed to fetch reactions" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders2 } }
    );
  }
}
__name(handleGetReactions, "handleGetReactions");

// src/handlers/notifications.ts
async function handleListNotifications(request, env, auth, corsHeaders2) {
  try {
    const url = new URL(request.url);
    const limit = Math.min(
      Math.max(parseInt(url.searchParams.get("limit") || "50"), 1),
      100
    );
    const cursor_ts = url.searchParams.get("cursor_ts");
    const userId = auth.sub;
    let query;
    let params;
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
    const { results } = await env.FEED_DB.prepare(query).bind(...params).all();
    const hasMore = results.length > limit;
    const notifications = hasMore ? results.slice(0, limit) : results;
    const unreadResult = await env.FEED_DB.prepare(
      "SELECT COUNT(*) as count FROM feed_notifications WHERE user_id = ? AND is_read = 0"
    ).bind(userId).first();
    const last = notifications[notifications.length - 1];
    const nextCursor = hasMore && last ? last.created_at : null;
    return new Response(
      JSON.stringify({
        notifications,
        unreadCount: unreadResult?.count || 0,
        nextCursor,
        hasMore
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders2 } }
    );
  } catch (err) {
    console.error("[notifications] GET error:", err);
    return new Response(
      JSON.stringify({ error: "Failed to fetch notifications" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders2 } }
    );
  }
}
__name(handleListNotifications, "handleListNotifications");
async function handleMarkNotificationRead(request, env, auth, corsHeaders2) {
  try {
    const body = await request.json();
    const userId = auth.sub;
    if (body.id) {
      await env.FEED_DB.prepare(
        "UPDATE feed_notifications SET is_read = 1 WHERE id = ? AND user_id = ?"
      ).bind(body.id, userId).run();
    } else {
      await env.FEED_DB.prepare(
        "UPDATE feed_notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0"
      ).bind(userId).run();
    }
    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders2 } }
    );
  } catch (err) {
    console.error("[notifications] POST read error:", err);
    return new Response(
      JSON.stringify({ error: "Failed to mark notification as read" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders2 } }
    );
  }
}
__name(handleMarkNotificationRead, "handleMarkNotificationRead");
async function handleMarkNotificationReadById(request, env, auth, notificationId, corsHeaders2) {
  try {
    await env.FEED_DB.prepare(
      "UPDATE feed_notifications SET is_read = 1 WHERE id = ? AND user_id = ?"
    ).bind(notificationId, auth.sub).run();
    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders2 } }
    );
  } catch (err) {
    console.error("[notifications] POST read error:", err);
    return new Response(
      JSON.stringify({ error: "Failed to mark notification as read" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders2 } }
    );
  }
}
__name(handleMarkNotificationReadById, "handleMarkNotificationReadById");
async function handleDeleteNotification(request, env, auth, notificationId, corsHeaders2) {
  try {
    await env.FEED_DB.prepare(
      "DELETE FROM feed_notifications WHERE id = ? AND user_id = ?"
    ).bind(notificationId, auth.sub).run();
    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders2 } }
    );
  } catch (err) {
    console.error("[notifications] DELETE error:", err);
    return new Response(
      JSON.stringify({ error: "Failed to delete notification" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders2 } }
    );
  }
}
__name(handleDeleteNotification, "handleDeleteNotification");

// src/handlers/users.ts
async function handleUpsertUser(request, env, auth, corsHeaders2) {
  try {
    const body = await request.json();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    await env.FEED_DB.prepare(`
      INSERT INTO users (user_id, display_name, avatar_url, handle, bio, last_seen)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        display_name = COALESCE(NULLIF(excluded.display_name, ''), users.display_name),
        avatar_url = COALESCE(NULLIF(excluded.avatar_url, ''), users.avatar_url),
        handle = COALESCE(NULLIF(excluded.handle, ''), users.handle),
        last_seen = excluded.last_seen
    `).bind(
      auth.sub,
      auth.name || "\u041F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C",
      auth.picture || "",
      body.handle || null,
      body.bio || null,
      now
    ).run();
    return new Response(
      JSON.stringify({ success: true, userId: auth.sub }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders2 } }
    );
  } catch (err) {
    if (err?.message?.includes("UNIQUE constraint failed")) {
      return new Response(
        JSON.stringify({ error: "Handle already taken" }),
        { status: 409, headers: { "Content-Type": "application/json", ...corsHeaders2 } }
      );
    }
    console.error("[users] POST /api/users/upsert error:", err);
    return new Response(
      JSON.stringify({ error: "Failed to upsert user" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders2 } }
    );
  }
}
__name(handleUpsertUser, "handleUpsertUser");
async function handleGetUserByHandle(request, env, corsHeaders2) {
  try {
    const url = new URL(request.url);
    const handle = url.pathname.split("/").pop();
    const user = await env.FEED_DB.prepare(
      "SELECT user_id, display_name, avatar_url, handle, bio, created_at FROM users WHERE handle = ?"
    ).bind(handle).first();
    if (!user) {
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders2 } }
      );
    }
    return new Response(
      JSON.stringify(user),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders2 } }
    );
  } catch (err) {
    console.error("[users] GET /api/users/:handle error:", err);
    return new Response(
      JSON.stringify({ error: "Failed to fetch user" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders2 } }
    );
  }
}
__name(handleGetUserByHandle, "handleGetUserByHandle");

// src/index.ts
var corsHeaders = /* @__PURE__ */ __name((requestOrigin, allowedOrigins) => {
  const origin = requestOrigin && allowedOrigins.includes(requestOrigin) ? requestOrigin : allowedOrigins[0];
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS, PUT, PATCH, DELETE",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  };
}, "corsHeaders");
var secHeaders = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "DENY",
  "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https://openrouter.ai;"
};
function jsonResponse(data, status = 200, origin = "*", allowedOrigins) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(origin, allowedOrigins),
      ...secHeaders
    }
  });
}
__name(jsonResponse, "jsonResponse");
async function sha256(text) {
  const buf = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(sha256, "sha256");
function rnd(n = 32) {
  const arr = new Uint8Array(n);
  crypto.getRandomValues(arr);
  return [...arr].map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(rnd, "rnd");
async function issueEphemeral(env, ip) {
  const id = crypto.randomUUID();
  const secret = rnd(32);
  const secretHash = await sha256(secret);
  const ttl = Math.max(10, Math.min(300, parseInt(env.EPHEMERAL_TTL || "60", 10)));
  const token = {
    id,
    secretHash,
    ip,
    exp: Date.now() + ttl * 1e3,
    uses: 0,
    maxUses: 3
  };
  await env.EPHEMERAL_KV.put(`e:${id}`, JSON.stringify(token), { expirationTtl: ttl });
  return `${id}.${secret}`;
}
__name(issueEphemeral, "issueEphemeral");
async function validateEphemeral(env, authHeader, ip) {
  if (!authHeader?.startsWith("Bearer "))
    return { ok: false, error: "NO_BEARER" };
  const raw = authHeader.slice(7).trim();
  const [id, secret] = raw.split(".");
  if (!id || !secret)
    return { ok: false, error: "BAD_FORMAT" };
  const key = `e:${id}`;
  const data = await env.EPHEMERAL_KV.get(key, "json");
  if (!data)
    return { ok: false, error: "NOT_FOUND" };
  if (Date.now() > data.exp)
    return { ok: false, error: "EXPIRED" };
  const hash = await sha256(secret);
  if (hash !== data.secretHash)
    return { ok: false, error: "INVALID" };
  if (data.ip && data.ip !== ip)
    return { ok: false, error: "IP_MISMATCH" };
  if (data.uses >= data.maxUses)
    return { ok: false, error: "USES_EXCEEDED" };
  data.uses += 1;
  await env.EPHEMERAL_KV.put(key, JSON.stringify(data), { expirationTtl: Math.ceil((data.exp - Date.now()) / 1e3) });
  return { ok: true, id };
}
__name(validateEphemeral, "validateEphemeral");
async function checkRateLimit(kv, ip, limit = 20) {
  const minute = Math.floor(Date.now() / 6e4);
  const key = `rate:${ip}:${minute}`;
  const current = await kv.get(key);
  const count = current ? parseInt(current) : 0;
  if (count >= limit)
    return false;
  await kv.put(key, String(count + 1), { expirationTtl: 60 });
  return true;
}
__name(checkRateLimit, "checkRateLimit");
async function getOperatorPrompt(kv) {
  try {
    const prompt = await kv.get("operator_prompt", "text");
    return prompt;
  } catch (error) {
    console.error("Failed to load operator prompt:", error);
    return null;
  }
}
__name(getOperatorPrompt, "getOperatorPrompt");
async function maybeInjectOperatorPrompt(env, body) {
  if (!body?.injectOperator)
    return body;
  const prompt = await getOperatorPrompt(env.OPERATOR_PROMPT_KV);
  if (!prompt)
    return body;
  const first = body.messages?.[0];
  if (first?.role === "system" && first?.content?.includes("beLive AI Platform Operator")) {
    return body;
  }
  const systemMessageIndex = body.messages?.findIndex((m) => m.role === "system");
  if (systemMessageIndex !== void 0 && systemMessageIndex !== -1) {
    const newMessages = [...body.messages];
    newMessages[systemMessageIndex] = {
      ...newMessages[systemMessageIndex],
      content: `${prompt}

${newMessages[systemMessageIndex].content}`
    };
    return { ...body, messages: newMessages };
  } else {
    return { ...body, messages: [{ role: "system", content: prompt }, ...body.messages || []] };
  }
}
__name(maybeInjectOperatorPrompt, "maybeInjectOperatorPrompt");
var _migrationsRan = false;
var src_default = {
  async fetch(request, env, ctx) {
    if (!_migrationsRan) {
      _migrationsRan = true;
      ctx.waitUntil(runMigrations(env.FEED_DB).catch((err) => {
        console.error("[migrations] Failed to run migrations:", err);
      }));
    }
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    const ip = request.headers.get("CF-Connecting-IP") || request.headers.get("x-forwarded-for") || "local";
    const allowedOrigins = [env.ALLOWED_ORIGIN];
    if (request.url.includes("localhost") || origin.includes("localhost")) {
      allowedOrigins.push("http://localhost:3000");
      allowedOrigins.push("http://localhost:5173");
      allowedOrigins.push("http://localhost:5501");
    }
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: { ...corsHeaders(origin, allowedOrigins), ...secHeaders } });
    }
    if (url.pathname === "/health") {
      return jsonResponse({ ok: true, edge: true, ts: Date.now(), v: "TC-103" }, 200, origin, allowedOrigins);
    }
    if (request.method === "POST" && url.pathname === "/auth/ephemeral") {
      const token = await issueEphemeral(env, ip);
      return jsonResponse({ token, ttl: parseInt(env.EPHEMERAL_TTL || "60", 10) }, 200, origin, allowedOrigins);
    }
    if (request.method === "POST" && url.pathname === "/v1/chat/stream") {
      const auth = await validateEphemeral(env, request.headers.get("Authorization"), ip);
      if (!auth.ok) {
        return new Response(`data: ${JSON.stringify({ type: "error", data: { code: "AUTH", message: auth.error } })}

`, {
          status: 401,
          headers: { ...corsHeaders(origin, allowedOrigins), "Content-Type": "text/event-stream", ...secHeaders }
        });
      }
      const allowed = await checkRateLimit(env.RATE_LIMIT_KV, ip, 20);
      if (!allowed) {
        return new Response(`data: ${JSON.stringify({ type: "error", data: { code: "RATE_LIMIT", message: "Too many requests" } })}

`, {
          status: 429,
          headers: { ...corsHeaders(origin, allowedOrigins), "Content-Type": "text/event-stream", ...secHeaders }
        });
      }
      let rawBody;
      try {
        rawBody = await request.json();
      } catch (e) {
        return new Response(`data: ${JSON.stringify({ type: "error", data: { code: "BAD_REQUEST", message: "Invalid JSON body" } })}

`, {
          status: 400,
          headers: { ...corsHeaders(origin, allowedOrigins), "Content-Type": "text/event-stream", ...secHeaders }
        });
      }
      const body = await maybeInjectOperatorPrompt(env, rawBody);
      const upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": env.OPENROUTER_REFERER || env.ALLOWED_ORIGIN,
          "X-Title": env.OPENROUTER_TITLE || "beLive AI Hub"
        },
        body: JSON.stringify({ ...body, stream: true })
      });
      if (!upstream.ok || !upstream.body) {
        const errorText = await upstream.text().catch(() => "Unknown upstream error");
        return new Response(`data: ${JSON.stringify({ type: "error", data: { code: "UPSTREAM", message: errorText } })}

`, {
          status: upstream.status,
          headers: { ...corsHeaders(origin, allowedOrigins), "Content-Type": "text/event-stream", ...secHeaders }
        });
      }
      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      const enc = new TextEncoder();
      const dec = new TextDecoder();
      ctx.waitUntil((async () => {
        let buffer = "";
        let fullText = "";
        let usage;
        let sentDone = false;
        await writer.write(enc.encode(`data: ${JSON.stringify({ type: "start", model: body.model, timestamp: Date.now() })}}

`));
        try {
          const reader = upstream.body.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done)
              break;
            buffer += dec.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";
            for (const line of lines) {
              if (!line.startsWith("data: "))
                continue;
              const payload = line.slice(6).trim();
              if (payload === "[DONE]")
                continue;
              try {
                const parsed = JSON.parse(payload);
                if (parsed.usage)
                  usage = parsed.usage;
                const token = parsed.choices?.[0]?.delta?.content ?? "";
                if (token) {
                  fullText += token;
                  await writer.write(enc.encode(`data: ${JSON.stringify({ type: "token", data: token })}}

`));
                }
              } catch (e) {
                console.warn("Failed to parse SSE line:", line, e);
              }
            }
          }
          if (!sentDone) {
            await writer.write(enc.encode(`data: ${JSON.stringify({ type: "done", data: { fullText, usage } })}}

`));
            sentDone = true;
          }
        } catch (e) {
          console.error("Stream processing error:", e);
          await writer.write(enc.encode(`data: ${JSON.stringify({ type: "error", data: { code: "STREAM_ERROR", message: e?.message || String(e) } })}}

`));
        } finally {
          await writer.close();
        }
      })());
      return new Response(readable, {
        headers: {
          ...corsHeaders(origin, allowedOrigins),
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          "Connection": "keep-alive",
          ...secHeaders
        }
      });
    }
    if (request.method === "POST" && url.pathname === "/v1/align") {
      let rawBody;
      try {
        rawBody = await request.json();
      } catch (e) {
        return jsonResponse(
          { error: "Invalid JSON body" },
          400,
          origin,
          allowedOrigins
        );
      }
      const alignableLines = Array.isArray(rawBody?.alignableLines) ? rawBody.alignableLines : [];
      if (!alignableLines.length) {
        return jsonResponse(
          { error: "alignableLines is required" },
          400,
          origin,
          allowedOrigins
        );
      }
      const lines = alignableLines.map((line, index) => {
        const start = index * 2;
        const end = start + 2;
        return {
          rawLineIndex: line.rawLineIndex,
          contentLineIndex: line.contentLineIndex,
          text: line.text,
          start,
          end,
          confidence: 0.5,
          words: []
        };
      });
      const result = {
        source: "ai-aligner",
        version: 1,
        trackId: rawBody?.trackId,
        language: rawBody?.language,
        lyricsHash: rawBody?.lyricsHash,
        audioHash: rawBody?.audioHash,
        audioSource: rawBody?.audioSource,
        provider: "mock",
        providerVersion: "stub-v1",
        mode: rawBody?.mode,
        lines,
        separators: []
      };
      return jsonResponse(
        result,
        200,
        origin,
        allowedOrigins
      );
    }
    if (request.method === "POST" && url.pathname === "/admin/operator-prompt") {
      const auth = await getAuthCtx(request, env);
      if (!auth) {
        return jsonResponse({ error: "Unauthorized" }, 401, origin, allowedOrigins);
      }
      const { prompt } = await request.json();
      if (!prompt || typeof prompt !== "string") {
        return jsonResponse({ error: "Invalid prompt" }, 400, env.ALLOWED_ORIGIN, allowedOrigins);
      }
      await env.OPERATOR_PROMPT_KV.put("operator_prompt", prompt);
      return jsonResponse({ success: true, message: "Operator prompt updated" }, 200, origin, allowedOrigins);
    }
    if (request.method === "GET" && url.pathname === "/admin/operator-prompt") {
      const auth = await getAuthCtx(request, env);
      if (!auth) {
        return jsonResponse({ error: "Unauthorized" }, 401, origin, allowedOrigins);
      }
      const prompt = await getOperatorPrompt(env.OPERATOR_PROMPT_KV);
      return jsonResponse({ prompt: prompt || "" }, 200, origin, allowedOrigins);
    }
    if (request.method === "GET" && url.pathname === "/api/feed") {
      const KV_KEY = "feed:main";
      const cached = await env.FEED_KV.get(KV_KEY, { type: "json" });
      const headers = { ...corsHeaders(origin, allowedOrigins), ...secHeaders };
      if (cached) {
        headers["X-Cache"] = "HIT";
        return new Response(JSON.stringify(cached), {
          status: 200,
          headers: { "Content-Type": "application/json; charset=utf-8", ...headers }
        });
      }
      const [sectionsResult, itemsResult, linksResult] = await env.FEED_DB.batch([
        env.FEED_DB.prepare("SELECT * FROM feed_sections WHERE tenant_id = ? ORDER BY sort_order").bind("main"),
        env.FEED_DB.prepare("SELECT * FROM feed_items WHERE tenant_id = ? AND status = ? ORDER BY priority DESC, published_at DESC").bind("main", "published"),
        env.FEED_DB.prepare("SELECT * FROM feed_section_items")
      ]);
      const links = linksResult.results || [];
      const items = (itemsResult.results || []).map((item) => {
        const link = links.find((l) => l.item_id === item.id);
        let parsedData = item.data;
        if (typeof parsedData === "string") {
          try {
            parsedData = JSON.parse(parsedData);
          } catch (_) {
            parsedData = null;
          }
        }
        return { ...item, data: parsedData, sectionId: link?.section_id || null };
      });
      const response = {
        sections: sectionsResult.results || [],
        items,
        generatedAt: Date.now()
      };
      await env.FEED_KV.put(KV_KEY, JSON.stringify(response), { expirationTtl: 60 });
      headers["X-Cache"] = "MISS";
      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { "Content-Type": "application/json; charset=utf-8", ...headers }
      });
    }
    const feedHeaders = corsHeaders(origin, allowedOrigins);
    if (request.method === "GET" && url.pathname === "/api/feed/posts") {
      return handleGetFeedPosts(request, env, feedHeaders);
    }
    if (request.method === "POST" && url.pathname === "/api/feed/posts") {
      const auth = await getAuthCtx(request, env);
      if (!auth) {
        return jsonResponse({ error: "Unauthorized" }, 401, origin, allowedOrigins);
      }
      return handleCreateFeedPost(request, env, auth, feedHeaders);
    }
    if (request.method === "POST" && url.pathname === "/api/feed/likes") {
      const auth = await getAuthCtx(request, env);
      if (!auth) {
        return jsonResponse({ error: "Unauthorized" }, 401, origin, allowedOrigins);
      }
      return handleToggleLike(request, env, auth, feedHeaders);
    }
    if (request.method === "GET" && /^\/api\/feed\/posts\/[^/]+\/comments$/.test(url.pathname)) {
      const postId = url.pathname.split("/")[4];
      return handleGetComments(request, env, postId, feedHeaders);
    }
    if (request.method === "POST" && /^\/api\/feed\/posts\/[^/]+\/comments$/.test(url.pathname)) {
      const auth = await getAuthCtx(request, env);
      if (!auth) {
        return jsonResponse({ error: "Unauthorized" }, 401, origin, allowedOrigins);
      }
      const allowed = await checkRateLimit(env.RATE_LIMIT_KV, ip, 5);
      if (!allowed) {
        return jsonResponse({ error: "Too many requests" }, 429, origin, allowedOrigins);
      }
      const postId = url.pathname.split("/")[4];
      return handleCreateComment(request, env, auth, postId, feedHeaders);
    }
    if (request.method === "DELETE" && /^\/api\/feed\/posts\/[^/]+\/comments\/[^/]+$/.test(url.pathname)) {
      const auth = await getAuthCtx(request, env);
      if (!auth) {
        return jsonResponse({ error: "Unauthorized" }, 401, origin, allowedOrigins);
      }
      const parts = url.pathname.split("/");
      const postId = parts[4];
      const commentId = parts[6];
      return handleDeleteComment(env, auth, postId, commentId, feedHeaders);
    }
    if (request.method === "GET" && /^\/api\/feed\/posts\/[^/]+\/comments\/[^/]+\/replies$/.test(url.pathname)) {
      const parts = url.pathname.split("/");
      const postId = parts[4];
      const commentId = parts[6];
      return handleListReplies(request, env, postId, commentId, feedHeaders);
    }
    if (request.method === "POST" && url.pathname === "/api/feed/reactions") {
      const auth = await getAuthCtx(request, env);
      if (!auth) {
        return jsonResponse({ error: "Unauthorized" }, 401, origin, allowedOrigins);
      }
      return handleToggleReaction(request, env, auth, feedHeaders);
    }
    if (request.method === "GET" && url.pathname === "/api/feed/reactions") {
      return handleGetReactions(request, env, feedHeaders);
    }
    if (request.method === "GET" && url.pathname === "/api/feed/notifications") {
      const auth = await getAuthCtx(request, env);
      if (!auth) {
        return jsonResponse({ error: "Unauthorized" }, 401, origin, allowedOrigins);
      }
      return handleListNotifications(request, env, auth, feedHeaders);
    }
    if (request.method === "POST" && url.pathname === "/api/feed/notifications/read") {
      const auth = await getAuthCtx(request, env);
      if (!auth) {
        return jsonResponse({ error: "Unauthorized" }, 401, origin, allowedOrigins);
      }
      return handleMarkNotificationRead(request, env, auth, feedHeaders);
    }
    if (request.method === "POST" && /^\/api\/feed\/notifications\/[^/]+\/read$/.test(url.pathname)) {
      const auth = await getAuthCtx(request, env);
      if (!auth) {
        return jsonResponse({ error: "Unauthorized" }, 401, origin, allowedOrigins);
      }
      const notificationId = url.pathname.split("/")[4];
      return handleMarkNotificationReadById(request, env, auth, notificationId, feedHeaders);
    }
    if (request.method === "DELETE" && /^\/api\/feed\/notifications\/[^/]+$/.test(url.pathname)) {
      const auth = await getAuthCtx(request, env);
      if (!auth) {
        return jsonResponse({ error: "Unauthorized" }, 401, origin, allowedOrigins);
      }
      const notificationId = url.pathname.split("/").pop();
      return handleDeleteNotification(request, env, auth, notificationId, feedHeaders);
    }
    if (request.method === "POST" && url.pathname === "/api/users/upsert") {
      const auth = await getAuthCtx(request, env);
      if (!auth) {
        return jsonResponse({ error: "Unauthorized" }, 401, origin, allowedOrigins);
      }
      return handleUpsertUser(request, env, auth, feedHeaders);
    }
    if (request.method === "GET" && url.pathname.startsWith("/api/users/")) {
      const handle = url.pathname.split("/").pop();
      if (handle && handle !== "api") {
        return handleGetUserByHandle(request, env, feedHeaders);
      }
    }
    if (request.method === "DELETE" && url.pathname.startsWith("/api/feed/posts/")) {
      const auth = await getAuthCtx(request, env);
      if (!auth) {
        return jsonResponse({ error: "Unauthorized" }, 401, origin, allowedOrigins);
      }
      const postId = url.pathname.split("/").pop();
      let body = null;
      try {
        body = await request.json();
      } catch {
        body = null;
      }
      return handleDeleteFeedPost(env, auth, postId, feedHeaders, body);
    }
    if (request.method === "PATCH" && /^\/api\/feed\/posts\/[^/]+\/restore$/.test(url.pathname)) {
      const auth = await getAuthCtx(request, env);
      if (!auth) {
        return jsonResponse({ error: "Unauthorized" }, 401, origin, allowedOrigins);
      }
      const parts = url.pathname.split("/");
      const postId = parts[4];
      return handleRestoreFeedPost(env, auth, postId, feedHeaders);
    }
    if (request.method === "PATCH" && /^\/api\/feed\/posts\/[^/]+$/.test(url.pathname)) {
      const auth = await getAuthCtx(request, env);
      if (!auth) {
        return jsonResponse({ error: "Unauthorized" }, 401, origin, allowedOrigins);
      }
      const postId = url.pathname.split("/").pop();
      return handleUpdateFeedPost(env, auth, postId, request, feedHeaders);
    }
    if (request.method === "POST" && url.pathname === "/api/auth/bootstrap-founder") {
      const auth = await getAuthCtx(request, env);
      if (!auth) {
        return jsonResponse({ error: "Unauthorized" }, 401, origin, allowedOrigins);
      }
      const existing = await hasExistingFounder(env.FEED_DB);
      if (existing) {
        return jsonResponse({ error: "Founder already exists" }, 409, origin, allowedOrigins);
      }
      if (!env.FOUNDER_SUB || auth.providerSub !== env.FOUNDER_SUB) {
        return jsonResponse({ error: "Not authorized for bootstrap" }, 403, origin, allowedOrigins);
      }
      await assignRole(env.FEED_DB, {
        userId: auth.sub,
        provider: auth.provider,
        providerSub: auth.providerSub,
        role: "founder",
        email: auth.email,
        assignedBy: "system:bootstrap"
      });
      return jsonResponse({
        success: true,
        message: "Founder bootstrap complete. Founder is now in D1.",
        role: "founder"
      }, 201, origin, allowedOrigins);
    }
    return jsonResponse({ error: { code: "NOT_FOUND", message: "Endpoint not found" } }, 404, origin, allowedOrigins);
  }
};
export {
  src_default as default
};
//# sourceMappingURL=index.js.map
