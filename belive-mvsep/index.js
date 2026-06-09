const MVSEP_API_URL = 'https://mvsep.com/api/separation';
const DAILY_LIMIT = 10;

// ─── CORS ────────────────────────────────────────────────

function corsHeaders(origin, env) {
  const allowed = (env.ALLOWED_ORIGINS || 'https://app.mybelive.com,http://localhost:5173').split(',').map(o => o.trim());
  const allowOrigin = origin && allowed.includes(origin) ? origin : allowed[0];
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Mvsep-User-Key',
    'Access-Control-Max-Age': '86400',
  };
}

// ─── JWT ─────────────────────────────────────────────────

async function verifyJWT(token, secret) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const header = JSON.parse(atob(parts[0]));
    if (header.alg !== 'HS256') return null;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw', encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
    );
    const data = encoder.encode(parts[0] + '.' + parts[1]);
    const sig = Uint8Array.from(atob(parts[2].replace(/-/g,'+').replace(/_/g,'/')), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify('HMAC', key, sig, data);
    if (!valid) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g,'+').replace(/_/g,'/')));
    if (payload.exp && payload.exp < Date.now() / 1000) return null;
    return { sub: payload.sub };
  } catch { return null; }
}

// ─── KV Rate Limit ───────────────────────────────────────

function todayStr() { return new Date().toISOString().slice(0, 10); }

async function getDailyUsage(kv, userId) {
  const key = `mvsep:${userId}:${todayStr()}`;
  try {
    const raw = await kv.get(key);
    return raw ? JSON.parse(raw) : { count: 0, date: todayStr() };
  } catch { return { count: 0, date: todayStr() }; }
}

async function incrementDailyUsage(kv, userId) {
  const today = todayStr();
  const key = `mvsep:${userId}:${today}`;
  const usage = await getDailyUsage(kv, userId);
  usage.count += 1;
  await kv.put(key, JSON.stringify(usage), { expirationTtl: 172800 });
  return usage.count;
}

const CONCURRENT_LOCK_KEY = 'mvsep:shared:active';

async function acquireConcurrentLock(kv, userId) {
  const active = await kv.get(CONCURRENT_LOCK_KEY);
  if (active) return false; // already locked
  await kv.put(CONCURRENT_LOCK_KEY, JSON.stringify({ userId, startedAt: Date.now() }), { expirationTtl: 600 });
  return true;
}

async function releaseConcurrentLock(kv) {
  await kv.delete(CONCURRENT_LOCK_KEY);
}

// ─── Handlers ────────────────────────────────────────────

async function handleSubmit(request, env, userId, cors) {
  const userApiKey = request.headers.get('X-Mvsep-User-Key');

  // Rate limit — только для shared key
  if (!userApiKey) {
    const usage = await getDailyUsage(env.MVSEP_RATES, userId);
    if (usage.count >= DAILY_LIMIT) {
      return new Response(JSON.stringify({
        status: 'error', errors: ['Daily limit reached'],
        quota: { used: usage.count, limit: DAILY_LIMIT },
      }), { status: 429, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    // Concurrent guard — только для shared key
    const locked = await acquireConcurrentLock(env.MVSEP_RATES, userId);
    if (!locked) {
      return new Response(JSON.stringify({
        status: 'error', errors: ['Another track is processing. Please wait.'],
        code: 'CONCURRENT_LIMIT',
      }), { status: 429, headers: { ...cors, 'Content-Type': 'application/json' } });
    }
  }

  const formData = await request.formData();
  formData.delete('api_token');
  formData.append('api_token', userApiKey || env.MVSEP_API_KEY);

  let mvsepResp;
  try {
    mvsepResp = await fetch(`${MVSEP_API_URL}/create`, { method: 'POST', body: formData });
  } catch (err) {
    if (!userApiKey) await releaseConcurrentLock(env.MVSEP_RATES);
    return new Response(JSON.stringify({ status: 'error', errors: ['MVSEP unreachable'] }), {
      status: 502, headers: { ...cors, 'Content-Type': 'application/json' }
    });
  }

  const data = await mvsepResp.json();

  if (data.status === 'ok' && data.data?.hash) {
    if (!userApiKey) {
      const newCount = await incrementDailyUsage(env.MVSEP_RATES, userId);
      data.quota = { used: newCount, limit: DAILY_LIMIT, keySource: 'beLive' };
    } else {
      data.quota = { used: 0, limit: 49, keySource: 'user' };
    }
  } else {
    // MVSEP error — release lock
    if (!userApiKey) await releaseConcurrentLock(env.MVSEP_RATES);
  }

  return new Response(JSON.stringify(data), {
    status: mvsepResp.status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

async function handleStatus(request, env, cors) {
  const hash = new URL(request.url).searchParams.get('hash');
  if (!hash) {
    return new Response(JSON.stringify({ status: 'error', errors: ['Missing hash'] }), {
      status: 400, headers: { ...cors, 'Content-Type': 'application/json' }
    });
  }

  const resp = await fetch(`${MVSEP_API_URL}/get?hash=${encodeURIComponent(hash)}&api_token=${env.MVSEP_API_KEY}`);
  const data = await resp.json();

  // Release concurrent lock if done/failed
  if (data.status === 'done' || data.status === 'failed') {
    await releaseConcurrentLock(env.MVSEP_RATES);
  }

  return new Response(JSON.stringify(data), {
    status: resp.status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

async function handleDownload(request, env, cors) {
  const fileUrl = new URL(request.url).searchParams.get('url');
  if (!fileUrl || !fileUrl.startsWith('https://mvsep.com/')) {
    return new Response(JSON.stringify({ status: 'error', errors: ['Invalid URL'] }), {
      status: 400, headers: { ...cors, 'Content-Type': 'application/json' }
    });
  }
  const resp = await fetch(fileUrl);
  return new Response(resp.body, {
    status: resp.status,
    headers: {
      ...cors,
      'Content-Type': resp.headers.get('Content-Type') || 'audio/mpeg',
    },
  });
}

async function handleQuota(request, env, userId, cors) {
  const usage = await getDailyUsage(env.MVSEP_RATES, userId);
  return new Response(JSON.stringify({ used: usage.count, limit: DAILY_LIMIT, date: usage.date }), {
    headers: { ...cors, 'Content-Type': 'application/json' }
  });
}

async function handleCancel(request, env, userId, cors) {
  // Release concurrent lock (only the locking user can cancel)
  const lockRaw = await env.MVSEP_RATES.get(CONCURRENT_LOCK_KEY);
  if (lockRaw) {
    try {
      const lock = JSON.parse(lockRaw);
      if (lock.userId === userId) {
        await releaseConcurrentLock(env.MVSEP_RATES);
      }
    } catch {
      await releaseConcurrentLock(env.MVSEP_RATES);
    }
  }
  return new Response(JSON.stringify({ status: 'ok', cancelled: true }), {
    headers: { ...cors, 'Content-Type': 'application/json' }
  });
}

// ─── Main ─────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');
    const cors = corsHeaders(origin, env);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    // Health — no auth
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok', service: 'belive-mvsep' }), {
        headers: { ...cors, 'Content-Type': 'application/json' }
      });
    }

    // Download — no auth required (URLs are temporary/signed)
    if (url.pathname === '/download' && request.method === 'GET') {
      return handleDownload(request, env, cors);
    }

    // Status — no auth required
    if (url.pathname === '/status' && request.method === 'GET') {
      return handleStatus(request, env, cors);
    }

    // Auth required below
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ status: 'error', errors: ['AUTH_REQUIRED'] }), {
        status: 401, headers: { ...cors, 'Content-Type': 'application/json' }
      });
    }
    const user = await verifyJWT(authHeader.slice(7), env.JWT_SECRET);
    if (!user) {
      return new Response(JSON.stringify({ status: 'error', errors: ['INVALID_TOKEN'] }), {
        status: 401, headers: { ...cors, 'Content-Type': 'application/json' }
      });
    }

    if (url.pathname === '/submit' && request.method === 'POST') {
      return handleSubmit(request, env, user.sub, cors);
    }
    if (url.pathname === '/quota' && request.method === 'GET') {
      return handleQuota(request, env, user.sub, cors);
    }
    if (url.pathname === '/cancel' && request.method === 'POST') {
      return handleCancel(request, env, user.sub, cors);
    }

    return new Response('Not Found', { status: 404, headers: cors });
  }
};
