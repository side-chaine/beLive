// @TC-109-16: Middleware — Conditional GET with ETag
// Applies If-None-Match check against KV version key.
// Returns 304 if version matches, otherwise passes through with new ETag.

import { getCommentVersion, getCommentVersionKey, generateCommentETag } from './helpers';

interface Env {
  FEED_KV?: KVNamespace;
  FEED_DB: D1Database;
}

interface ETagResult {
  match: boolean;           // true → 304, no body needed
  etag: string | null;     // ETag for response
}

// ─── Check ETag for comments endpoint ───
// Call BEFORE the actual handler. If match=true → return 304.
export async function checkCommentETag(
  request: Request,
  env: Env,
  postId: string
): Promise<ETagResult> {
  const ifNoneMatch = request.headers.get('If-None-Match');
  if (!ifNoneMatch) {
    // No ETag from client — get current version for response
    const version = await getCommentVersion(env, postId);
    return {
      match: false,
      etag: version ? generateCommentETag(postId, version) : null,
    };
  }

  // Parse client ETag
  const parsed = parseCommentETag(ifNoneMatch);
  if (!parsed || parsed.postId !== postId) {
    // Client sent invalid ETag — treat as no-match
    const version = await getCommentVersion(env, postId);
    return {
      match: false,
      etag: version ? generateCommentETag(postId, version) : null,
    };
  }

  // Check current version
  const currentVersion = await getCommentVersion(env, postId);
  if (!currentVersion) {
    return { match: false, etag: null };
  }

  if (currentVersion === parsed.version) {
    // Version matches → 304
    return { match: true, etag: null };
  }

  // Version changed → return new ETag
  return {
    match: false,
    etag: generateCommentETag(postId, currentVersion),
  };
}

// Re-export helpers for convenience
export { bumpCommentVersion } from './helpers';
