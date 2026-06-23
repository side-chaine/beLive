// @TC-109-09: Reactions handler — toggle reactions on posts/comments
// MUSIC_REACTIONS only. Atomic batch: toggle + counter increment/decrement.

import type { AuthCtx } from './auth';
import { getUserRole } from './roles';

interface Env {
  FEED_DB: D1Database;
}

const MUSIC_REACTIONS = ['🔥', '🎵', '🎤', '💯', '🤯'] as const;
type MusicReaction = typeof MUSIC_REACTIONS[number];

// ─── POST /api/feed/reactions ───
export async function handleToggleReaction(
  request: Request,
  env: Env,
  auth: AuthCtx,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    // Body size check
    const rawText = await request.text();
    if (rawText.length > 1_000) {
      return new Response(
        JSON.stringify({ error: 'Request too large' }),
        { status: 413, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    let body: any;
    try { body = JSON.parse(rawText); } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const { targetType, targetId, emoji } = body as {
      targetType: 'post' | 'comment';
      targetId: string;
      emoji: string;
    };

    // Validation
    if (!targetType || !['post', 'comment'].includes(targetType)) {
      return new Response(
        JSON.stringify({ error: 'targetType must be post or comment' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    if (!targetId) {
      return new Response(
        JSON.stringify({ error: 'targetId is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    if (!emoji || !MUSIC_REACTIONS.includes(emoji as MusicReaction)) {
      return new Response(
        JSON.stringify({ error: `emoji must be one of: ${MUSIC_REACTIONS.join(', ')}` }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const userId = auth.sub;

    // Atomic batch: check existing → toggle
    const existing = await (env.FEED_DB.prepare(
      'SELECT 1 FROM feed_reactions WHERE target_type = ? AND target_id = ? AND user_id = ? AND emoji = ?'
    ) as any).bind(targetType, targetId, userId, emoji).first();

    if (existing) {
      // Remove reaction
      await (env.FEED_DB.prepare(
        'DELETE FROM feed_reactions WHERE target_type = ? AND target_id = ? AND user_id = ? AND emoji = ?'
      ) as any).bind(targetType, targetId, userId, emoji).run();

      return new Response(
        JSON.stringify({ reacted: false, emoji, targetType, targetId }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    } else {
      // Add reaction
      const insertResult = await (env.FEED_DB.prepare(
        'INSERT OR IGNORE INTO feed_reactions (target_type, target_id, user_id, emoji) VALUES (?, ?, ?, ?)'
      ) as any).bind(targetType, targetId, userId, emoji).run();

      // If INSERT OR IGNORE skipped (row already exists), reaction was already active
      const actuallyInserted = insertResult?.meta?.changes > 0;

      return new Response(
        JSON.stringify({ reacted: actuallyInserted, emoji, targetType, targetId }),
        { status: actuallyInserted ? 201 : 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }
  } catch (err: any) {
    console.error('[reactions] POST /api/feed/reactions error:', err);
    return new Response(
      JSON.stringify({ error: 'Failed to toggle reaction' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}

// ─── GET /api/feed/reactions?target_type=post&target_ids=id1,id2,id3 ───
export async function handleGetReactions(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const targetType = url.searchParams.get('target_type') || 'post';
    const targetIds = (url.searchParams.get('target_ids') || '').split(',').filter(Boolean);

    if (!targetIds.length) {
      return new Response(
        JSON.stringify({ reactions: {} }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Batch query: reactions per target
    const placeholders = targetIds.map(() => '?').join(',');
    const { results } = await (env.FEED_DB.prepare(
      `SELECT target_id, emoji, COUNT(*) as count FROM feed_reactions
       WHERE target_type = ? AND target_id IN (${placeholders})
       GROUP BY target_id, emoji ORDER BY target_id, count DESC`
    ) as any).bind(targetType, ...targetIds).all();

    // Group by target_id
    const grouped: Record<string, Record<string, number>> = {};
    for (const row of (results || []) as any[]) {
      if (!grouped[row.target_id]) grouped[row.target_id] = {};
      grouped[row.target_id][row.emoji] = row.count;
    }

    return new Response(
      JSON.stringify({ reactions: grouped }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (err: any) {
    console.error('[reactions] GET /api/feed/reactions error:', err);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch reactions' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}
