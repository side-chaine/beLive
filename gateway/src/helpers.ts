// @TC-109-15: Helpers — KV version bump, ETag

interface Env {
  FEED_KV?: KVNamespace;
  FEED_DB: D1Database;
}

// ─── KV version key helpers ───
// Pattern: `p:cm:<postId>` — per-post comment version
// Only bumped on INSERT/UPDATE/DELETE of feed_comments (C2 constraint)

const VERSION_PREFIX = 'p:cm:';

export function getCommentVersionKey(postId: string): string {
  return `${VERSION_PREFIX}${postId}`;
}

// Bump comment version in KV. Gracefully degrades if KV not available.
export async function bumpCommentVersion(env: Env, postId: string): Promise<void> {
  if (!env.FEED_KV) return;
  try {
    const version = Date.now().toString();
    await env.FEED_KV.put(getCommentVersionKey(postId), version, { expirationTtl: 86400 });
  } catch (err) {
    console.warn('[helpers] Failed to bump comment version:', err);
  }
}

// Get comment version from KV. Returns null if not set or KV unavailable.
export async function getCommentVersion(env: Env, postId: string): Promise<string | null> {
  if (!env.FEED_KV) return null;
  try {
    return await env.FEED_KV.get(getCommentVersionKey(postId));
  } catch {
    return null;
  }
}

// ─── ETag generation ───
// ETag format: `"cm:<postId>:<version>"` — unique per post comment thread

export function generateCommentETag(postId: string, version: string): string {
  return `"cm:${postId}:${version}"`;
}

export function parseCommentETag(etag: string): { postId: string; version: string } | null {
  // Format: "cm:<postId>:<version>"
  const match = etag.match(/^"cm:([^:]+):(.+)"$/);
  if (!match) return null;
  return { postId: match[1], version: match[2] };
}
