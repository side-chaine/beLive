import { handleGetFeedPosts, handleCreateFeedPost, handleToggleLike, handleDeleteFeedPost, handleRestoreFeedPost, handleUpdateFeedPost, handleGetComments, handleCreateComment, handleDeleteComment } from './handlers/feed';
import { getAuthCtx } from './handlers/auth';
import { getUserRole, assignRole, hasExistingFounder } from './handlers/roles';

interface Env {
  OPENROUTER_API_KEY: string;
  ALLOWED_ORIGIN: string;
  RATE_LIMIT_KV: KVNamespace;
  CACHE: KVNamespace;
  OPERATOR_PROMPT_KV: KVNamespace;
  EPHEMERAL_KV: KVNamespace;
  EPHEMERAL_TTL?: string;
  OPENROUTER_TITLE?: string;
  OPENROUTER_REFERER?: string;
  // @TC-088: Aurora Stage Feed
  FEED_KV: KVNamespace;
  FEED_DB: D1Database;
  // @TC-103: JWT auth
  JWT_SECRET: string;
  FOUNDER_SUB?: string;
}

// Unified SSE events
type StreamEvent =
  | { type: 'start'; model: string; timestamp: number }
  | { type: 'token'; data: string }
  | { type: 'done'; data: { fullText: string; usage?: any } }
  | { type: 'error'; data: { code: string; message: string } };

const corsHeaders = (requestOrigin: string | null, allowedOrigins: string[]) => {
  const origin = requestOrigin && allowedOrigins.includes(requestOrigin) ? requestOrigin : allowedOrigins[0];
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, PATCH, DELETE',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
};

const secHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https://openrouter.ai;"
};

function jsonResponse(data: any, status = 200, origin = '*', allowedOrigins: string[]) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...corsHeaders(origin, allowedOrigins),
      ...secHeaders,
    },
  });
}

// --- Ephemeral Token Management ---
type EphemeralToken = {
  id: string; // uuid
  secretHash: string; // sha256(secret)
  ip?: string; // опционально закрепляем за IP
  exp: number; // ms
  uses: number; // сколько раз использован
  maxUses: number; // лимит
};

async function sha256(text: string) {
  const buf = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function rnd(n = 32) {
  const arr = new Uint8Array(n);
  crypto.getRandomValues(arr);
  return [...arr].map(b => b.toString(16).padStart(2, '0')).join('');
}

// Выдаёт одноразовый токен вида "<id>.<secret>"
async function issueEphemeral(env: Env, ip: string) {
  const id = crypto.randomUUID();
  const secret = rnd(32);
  const secretHash = await sha256(secret);
  const ttl = Math.max(10, Math.min(300, parseInt(env.EPHEMERAL_TTL || '60', 10)));
  const token: EphemeralToken = {
    id, secretHash, ip, exp: Date.now() + ttl * 1000, uses: 0, maxUses: 3,
  };
  await env.EPHEMERAL_KV.put(`e:${id}`, JSON.stringify(token), { expirationTtl: ttl });
  return `${id}.${secret}`;
}

async function validateEphemeral(env: Env, authHeader: string | null, ip: string) {
  if (!authHeader?.startsWith('Bearer ')) return { ok: false, error: 'NO_BEARER' as const };
  const raw = authHeader.slice(7).trim();
  const [id, secret] = raw.split('.');
  if (!id || !secret) return { ok: false, error: 'BAD_FORMAT' as const };
  const key = `e:${id}`;
  const data = await env.EPHEMERAL_KV.get(key, 'json') as EphemeralToken | null;
  if (!data) return { ok: false, error: 'NOT_FOUND' as const };
  if (Date.now() > data.exp) return { ok: false, error: 'EXPIRED' as const };
  const hash = await sha256(secret);
  if (hash !== data.secretHash) return { ok: false, error: 'INVALID' as const };
  if (data.ip && data.ip !== ip) return { ok: false, error: 'IP_MISMATCH' as const };
  if (data.uses >= data.maxUses) return { ok: false, error: 'USES_EXCEEDED' as const };
  // инкремент и сохранить (оставляем до истечения TTL)
  data.uses += 1;
  await env.EPHEMERAL_KV.put(key, JSON.stringify(data), { expirationTtl: Math.ceil((data.exp - Date.now())/1000) });
  return { ok: true as const, id };
}

// --- Rate Limiting ---
async function checkRateLimit(kv: KVNamespace, ip: string, limit = 20): Promise<boolean> {
  const minute = Math.floor(Date.now() / 60000);
  const key = `rate:${ip}:${minute}`;
  const current = await kv.get(key);
  const count = current ? parseInt(current) : 0;
  if (count >= limit) return false;
  await kv.put(key, String(count + 1), { expirationTtl: 60 });
  return true;
}

// --- Operator Prompt Management ---
async function getOperatorPrompt(kv: KVNamespace): Promise<string | null> {
  try {
    const prompt = await kv.get('operator_prompt', 'text');
    return prompt;
  } catch (error) {
    console.error('Failed to load operator prompt:', error);
    return null;
  }
}

async function maybeInjectOperatorPrompt(env: Env, body: any) {
  if (!body?.injectOperator) return body;
  const prompt = await getOperatorPrompt(env.OPERATOR_PROMPT_KV);
  if (!prompt) return body;

  const first = body.messages?.[0];
  // Если первый системный промпт уже содержит нашу подпись, не дублируем
  if (first?.role === 'system' && first?.content?.includes('beLive AI Platform Operator')) {
    return body;
  }

  // Если есть существующий системный промпт, дополняем его
  const systemMessageIndex = body.messages?.findIndex((m: any) => m.role === 'system');
  if (systemMessageIndex !== undefined && systemMessageIndex !== -1) {
    const newMessages = [...body.messages];
    newMessages[systemMessageIndex] = {
      ...newMessages[systemMessageIndex],
      content: `${prompt}\n\n${newMessages[systemMessageIndex].content}`
    };
    return { ...body, messages: newMessages };
  } else {
    // Иначе добавляем как первый системный промпт
    return { ...body, messages: [{ role: 'system', content: prompt }, ...(body.messages || [])] };
  }
}

// @TC-103-01: replaced by JWT-based getAuthCtx()


export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    // IP fallback for dev
    const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('x-forwarded-for') || 'local';

    const allowedOrigins = [env.ALLOWED_ORIGIN];
    if (request.url.includes('localhost') || origin.includes('localhost')) {
      allowedOrigins.push('http://localhost:3000'); // Добавляем для локальной разработки
      allowedOrigins.push('http://localhost:5173'); // Default Vite dev server
      allowedOrigins.push('http://localhost:5501'); // Our simple Python server
    }

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: { ...corsHeaders(origin, allowedOrigins), ...secHeaders } });
    }

    // Health check
    if (url.pathname === '/health') {
      return jsonResponse({ ok: true, edge: true, ts: Date.now(), v: 'TC-103' }, 200, origin, allowedOrigins);
    }

    // --- Ephemeral Token Endpoint ---
    if (request.method === 'POST' && url.pathname === '/auth/ephemeral') {
      const token = await issueEphemeral(env, ip);
      return jsonResponse({ token, ttl: parseInt(env.EPHEMERAL_TTL || '60', 10) }, 200, origin, allowedOrigins);
    }

    // --- Streaming Chat Endpoint ---
    if (request.method === 'POST' && url.pathname === '/v1/chat/stream') {
      const auth = await validateEphemeral(env, request.headers.get('Authorization'), ip);
      if (!auth.ok) {
        return new Response(`data: ${JSON.stringify({ type: 'error', data: { code: 'AUTH', message: auth.error } })}\n\n`, {
          status: 401,
          headers: { ...corsHeaders(origin, allowedOrigins), 'Content-Type': 'text/event-stream', ...secHeaders },
        });
      }

      // Rate limit on chat
      const allowed = await checkRateLimit(env.RATE_LIMIT_KV, ip, 20); // 20 req/min
      if (!allowed) {
        return new Response(`data: ${JSON.stringify({ type: 'error', data: { code: 'RATE_LIMIT', message: 'Too many requests' } })}\n\n`, {
          status: 429,
          headers: { ...corsHeaders(origin, allowedOrigins), 'Content-Type': 'text/event-stream', ...secHeaders },
        });
      }

      let rawBody: any;
      try {
        rawBody = await request.json();
      } catch (e) {
        return new Response(`data: ${JSON.stringify({ type: 'error', data: { code: 'BAD_REQUEST', message: 'Invalid JSON body' } })}\n\n`, {
          status: 400,
          headers: { ...corsHeaders(origin, allowedOrigins), 'Content-Type': 'text/event-stream', ...secHeaders },
        });
      }

      const body = await maybeInjectOperatorPrompt(env, rawBody);

      const upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': env.OPENROUTER_REFERER || env.ALLOWED_ORIGIN,
          'X-Title': env.OPENROUTER_TITLE || 'beLive AI Hub',
        },
        body: JSON.stringify({ ...body, stream: true }),
      });

      if (!upstream.ok || !upstream.body) {
        const errorText = await upstream.text().catch(() => 'Unknown upstream error');
        return new Response(`data: ${JSON.stringify({ type: 'error', data: { code: 'UPSTREAM', message: errorText } })}\n\n`, {
          status: upstream.status,
          headers: { ...corsHeaders(origin, allowedOrigins), 'Content-Type': 'text/event-stream', ...secHeaders },
        });
      }

      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      const enc = new TextEncoder();
      const dec = new TextDecoder();

      ctx.waitUntil((async () => {
        let buffer = '';
        let fullText = '';
        let usage: any; // NEW: для хранения usage
        let sentDone = false; // NEW: флаг для предотвращения двойного done
        
        // Start event
        await writer.write(enc.encode(`data: ${JSON.stringify({ type: 'start', model: body.model, timestamp: Date.now() })}}\n\n`));

        try {
          const reader = upstream.body!.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += dec.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              const payload = line.slice(6).trim();
              if (payload === '[DONE]') continue;

              try {
                const parsed = JSON.parse(payload);
                // NEW: Если usage прилетел в потоке (иногда мета), сохраняем его, но done пока не шлём
                if (parsed.usage) usage = parsed.usage;

                const token = parsed.choices?.[0]?.delta?.content ?? '';
                if (token) {
                  fullText += token;
                  await writer.write(enc.encode(`data: ${JSON.stringify({ type: 'token', data: token })}}\n\n`));
                }
              } catch (e) {
                console.warn('Failed to parse SSE line:', line, e);
              }
            }
          }
          // NEW: Финальный done, если ещё не отправлен (защита от двойного done)
          if (!sentDone) {
            await writer.write(enc.encode(`data: ${JSON.stringify({ type: 'done', data: { fullText: fullText, usage: usage } })}}\n\n`));
            sentDone = true;
          }
        } catch (e: any) {
          console.error('Stream processing error:', e);
          await writer.write(enc.encode(`data: ${JSON.stringify({ type: 'error', data: { code: 'STREAM_ERROR', message: e?.message || String(e) } })}}\n\n`));
        } finally {
          await writer.close();
        }
      })());

      return new Response(readable, {
        headers: {
          ...corsHeaders(origin, allowedOrigins),
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
          ...secHeaders,
        },
      });
    }

    // --- Alignment Endpoint (mock-success, unauthenticated) ---
    if (request.method === 'POST' && url.pathname === '/v1/align') {
      let rawBody: any;
      try {
        rawBody = await request.json();
      } catch (e) {
        return jsonResponse(
          { error: 'Invalid JSON body' },
          400,
          origin,
          allowedOrigins
        );
      }

      const alignableLines = Array.isArray(rawBody?.alignableLines)
        ? rawBody.alignableLines
        : [];

      if (!alignableLines.length) {
        return jsonResponse(
          { error: 'alignableLines is required' },
          400,
          origin,
          allowedOrigins
        );
      }

      const lines = alignableLines.map((line: any, index: number) => {
        const start = index * 2;
        const end = start + 2;

        return {
          rawLineIndex: line.rawLineIndex,
          contentLineIndex: line.contentLineIndex,
          text: line.text,
          start,
          end,
          confidence: 0.5,
          words: [],
        };
      });

      const result = {
        source: 'ai-aligner',
        version: 1,
        trackId: rawBody?.trackId,
        language: rawBody?.language,
        lyricsHash: rawBody?.lyricsHash,
        audioHash: rawBody?.audioHash,
        audioSource: rawBody?.audioSource,
        provider: 'mock',
        providerVersion: 'stub-v1',
        mode: rawBody?.mode,
        lines,
        separators: [],
      };

      return jsonResponse(
        result,
        200,
        origin,
        allowedOrigins
      );
    }

    // --- Admin Endpoint: Update Operator Prompt (JWT-protected) ---
    if (request.method === 'POST' && url.pathname === '/admin/operator-prompt') {
      const auth = await getAuthCtx(request, env);
      if (!auth) {
        return jsonResponse({ error: 'Unauthorized' }, 401, origin, allowedOrigins);
      }
      const { prompt } = await request.json() as { prompt: string };
      if (!prompt || typeof prompt !== 'string') {
        return jsonResponse({ error: 'Invalid prompt' }, 400, env.ALLOWED_ORIGIN, allowedOrigins);
      }
      await env.OPERATOR_PROMPT_KV.put('operator_prompt', prompt);
      return jsonResponse({ success: true, message: 'Operator prompt updated' }, 200, origin, allowedOrigins);
    }

    // --- Admin Endpoint: Get Operator Prompt (JWT-protected) ---
    if (request.method === 'GET' && url.pathname === '/admin/operator-prompt') {
      const auth = await getAuthCtx(request, env);
      if (!auth) {
        return jsonResponse({ error: 'Unauthorized' }, 401, origin, allowedOrigins);
      }
      const prompt = await getOperatorPrompt(env.OPERATOR_PROMPT_KV);
      return jsonResponse({ prompt: prompt || '' }, 200, origin, allowedOrigins);
    }

    // --- Feed Endpoint (Aurora Stage) ---
    if (request.method === 'GET' && url.pathname === '/api/feed') {
      const KV_KEY = 'feed:main';
      const cached = await env.FEED_KV.get(KV_KEY, { type: 'json' });
      const headers: Record<string, string> = { ...corsHeaders(origin, allowedOrigins), ...secHeaders };

      if (cached) {
        headers['X-Cache'] = 'HIT';
        return new Response(JSON.stringify(cached), {
          status: 200,
          headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
        });
      }

      // D1.batch() — flat queries, no JOINs; 3rd query for M:N links
      const [sectionsResult, itemsResult, linksResult] = await env.FEED_DB.batch([
        env.FEED_DB.prepare('SELECT * FROM feed_sections WHERE tenant_id = ? ORDER BY sort_order').bind('main'),
        env.FEED_DB.prepare('SELECT * FROM feed_items WHERE tenant_id = ? AND status = ? ORDER BY priority DESC, published_at DESC').bind('main', 'published'),
        env.FEED_DB.prepare('SELECT * FROM feed_section_items'),
      ]);

      // Attach sectionId to items via feed_section_items links
      const links = linksResult.results || [];
      const items = (itemsResult.results || []).map((item: any) => {
        const link = links.find((l: any) => l.item_id === item.id);
        // Parse JSON data field for polls, Elo, etc.
        let parsedData = item.data;
        if (typeof parsedData === 'string') {
          try { parsedData = JSON.parse(parsedData); } catch (_) { parsedData = null; }
        }
        return { ...item, data: parsedData, sectionId: link?.section_id || null };
      });

      const response = {
        sections: sectionsResult.results || [],
        items,
        generatedAt: Date.now(),
      };

      // Short TTL 60s — no manual invalidation (rule 6.1)
      await env.FEED_KV.put(KV_KEY, JSON.stringify(response), { expirationTtl: 60 });

      headers['X-Cache'] = 'MISS';
      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
      });
    }

    // ─── Social Feed Endpoints (TC-101) — AFTER /api/feed (curated) ───
    const feedHeaders = corsHeaders(origin, allowedOrigins);
    if (request.method === 'GET' && url.pathname === '/api/feed/posts') {
      return handleGetFeedPosts(request, env, feedHeaders);
    }
    if (request.method === 'POST' && url.pathname === '/api/feed/posts') {
      const auth = await getAuthCtx(request, env);
      if (!auth) {
        return jsonResponse({ error: 'Unauthorized' }, 401, origin, allowedOrigins);
      }
      return handleCreateFeedPost(request, env, auth, feedHeaders);
    }
    if (request.method === 'POST' && url.pathname === '/api/feed/likes') {
      const auth = await getAuthCtx(request, env);
      if (!auth) {
        return jsonResponse({ error: 'Unauthorized' }, 401, origin, allowedOrigins);
      }
      return handleToggleLike(request, env, auth, feedHeaders);
    }

    // ─── GET /api/feed/posts/:postId/comments (TC-108-03) ───
    if (request.method === 'GET' && /^\/api\/feed\/posts\/[^/]+\/comments$/.test(url.pathname)) {
      const postId = url.pathname.split('/')[4];
      return handleGetComments(request, env, postId, feedHeaders);
    }

    // ─── POST /api/feed/posts/:postId/comments (TC-108-03) ───
    // JWT + rate limit (5 req/min/IP)
    if (request.method === 'POST' && /^\/api\/feed\/posts\/[^/]+\/comments$/.test(url.pathname)) {
      const auth = await getAuthCtx(request, env);
      if (!auth) {
        return jsonResponse({ error: 'Unauthorized' }, 401, origin, allowedOrigins);
      }
      // Rate limit: 5 req/min/IP — protects D1 write quota (002 attack #4)
      const allowed = await checkRateLimit(env.RATE_LIMIT_KV, ip, 5);
      if (!allowed) {
        return jsonResponse({ error: 'Too many requests' }, 429, origin, allowedOrigins);
      }
      const postId = url.pathname.split('/')[4];
      return handleCreateComment(request, env, auth, postId, feedHeaders);
    }

    // ─── DELETE /api/feed/posts/:postId/comments/:commentId (TC-108-03) ───
    if (request.method === 'DELETE' && /^\/api\/feed\/posts\/[^/]+\/comments\/[^/]+$/.test(url.pathname)) {
      const auth = await getAuthCtx(request, env);
      if (!auth) {
        return jsonResponse({ error: 'Unauthorized' }, 401, origin, allowedOrigins);
      }
      const parts = url.pathname.split('/');
      const postId = parts[4];
      const commentId = parts[6];
      return handleDeleteComment(env, auth, postId, commentId, feedHeaders);
    }

    // ─── DELETE /api/feed/posts/:postId (TC-107-03) ───
    if (request.method === 'DELETE' && url.pathname.startsWith('/api/feed/posts/')) {
      const auth = await getAuthCtx(request, env);
      if (!auth) {
        return jsonResponse({ error: 'Unauthorized' }, 401, origin, allowedOrigins);
      }
      const postId = url.pathname.split('/').pop()!;
      let body: any = null;
      try { body = await request.json(); } catch { body = null; }
      return handleDeleteFeedPost(env, auth, postId, feedHeaders, body);
    }

    // ─── PATCH /api/feed/posts/:postId/restore (TC-107-06) ───
    if (request.method === 'PATCH' && /^\/api\/feed\/posts\/[^/]+\/restore$/.test(url.pathname)) {
      const auth = await getAuthCtx(request, env);
      if (!auth) {
        return jsonResponse({ error: 'Unauthorized' }, 401, origin, allowedOrigins);
      }
      const parts = url.pathname.split('/');
      const postId = parts[4];
      return handleRestoreFeedPost(env, auth, postId, feedHeaders);
    }

    // ─── PATCH /api/feed/posts/:postId (TC-107-08) — owner-only edit ───
    // M2: strict regex /^\/api\/feed\/posts\/[^/]+$/ — НЕ совпадает с /restore
    if (request.method === 'PATCH' && /^\/api\/feed\/posts\/[^/]+$/.test(url.pathname)) {
      const auth = await getAuthCtx(request, env);
      if (!auth) {
        return jsonResponse({ error: 'Unauthorized' }, 401, origin, allowedOrigins);
      }
      const postId = url.pathname.split('/').pop()!;
      return handleUpdateFeedPost(env, auth, postId, request, feedHeaders);
    }

    // ─── Founder Bootstrap (TC-103-10) — one-time ───
    // Fallback bootstrap (X-Bootstrap-Key) — удалён после использования (2026-06-21)
    // Только JWT-защищённый bootstrap. Founder уже существует → 409.
    if (request.method === 'POST' && url.pathname === '/api/auth/bootstrap-founder') {
      const auth = await getAuthCtx(request, env);
      if (!auth) {
        return jsonResponse({ error: 'Unauthorized' }, 401, origin, allowedOrigins);
      }
      // Founder already exists → 409
      const existing = await hasExistingFounder(env.FEED_DB);
      if (existing) {
        return jsonResponse({ error: 'Founder already exists' }, 409, origin, allowedOrigins);
      }
      if (!env.FOUNDER_SUB || auth.providerSub !== env.FOUNDER_SUB) {
        return jsonResponse({ error: 'Not authorized for bootstrap' }, 403, origin, allowedOrigins);
      }
      await assignRole(env.FEED_DB, {
        userId: auth.sub,
        provider: auth.provider,
        providerSub: auth.providerSub,
        role: 'founder',
        email: auth.email,
        assignedBy: 'system:bootstrap',
      });
      return jsonResponse({
        success: true,
        message: 'Founder bootstrap complete. Founder is now in D1.',
        role: 'founder',
      }, 201, origin, allowedOrigins);
    }

    // Default 404
    return jsonResponse({ error: { code: 'NOT_FOUND', message: 'Endpoint not found' } }, 404, origin, allowedOrigins);
  },
};
