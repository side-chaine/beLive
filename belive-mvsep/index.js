const MVSEP_API_URL = 'https://mvsep.com/api/separation';
const DAILY_LIMIT = 10;

// ─── SSRF-гард для /download ─────────────────────────────
//
// /download — открытый наружу прокси: он ходит по URL, который пришёл от
// клиента. Пускать любой URL нельзя — получим SSRF (внутренние адреса,
// localhost, метаданные Cloudflare). Но и проверять префикс строкой нельзя:
// реальные файлы MVSEP лежат на https://de.mvsep.com/storage/processed/…,
// и старая проверка `startsWith('https://mvsep.com/')` отбивала их все.
//
// Проверяем именно HOSTNAME разобранного URL: mvsep.com и любой его
// поддомен. `mvsep.com.evil.com` и `evil.com/mvsep.com` так не проходят.

const MVSEP_HOST = 'mvsep.com';
const MAX_DOWNLOAD_URL_LEN = 2048;
const MAX_DOWNLOAD_REDIRECTS = 3;

/**
 * Разбирает URL и возвращает его, только если это https на хост MVSEP.
 * Возвращает null на мусор — вызывающий отвечает 400.
 */
function parseAllowedMvsepUrl(raw, base) {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > MAX_DOWNLOAD_URL_LEN) {return null;}

  let u;
  try {
    u = base ? new URL(raw, base) : new URL(raw);
  } catch {
    return null;
  }

  if (u.protocol !== 'https:') {return null;}
  // userinfo в URL — классический обход вида https://mvsep.com@evil.com/
  if (u.username || u.password) {return null;}
  // Порт: только дефолтный. Иначе https://mvsep.com:8443/ уйдёт на чужой сервис.
  if (u.port && u.port !== '443') {return null;}

  const host = u.hostname.toLowerCase();
  if (host !== MVSEP_HOST && !host.endsWith('.' + MVSEP_HOST)) {return null;}

  return u;
}

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
    if (parts.length !== 3) {return null;}
    const header = JSON.parse(atob(parts[0]));
    if (header.alg !== 'HS256') {return null;}
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw', encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
    );
    const data = encoder.encode(parts[0] + '.' + parts[1]);
    const sig = Uint8Array.from(atob(parts[2].replace(/-/g,'+').replace(/_/g,'/')), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify('HMAC', key, sig, data);
    if (!valid) {return null;}
    const payload = JSON.parse(atob(parts[1].replace(/-/g,'+').replace(/_/g,'/')));
    // exp обязателен, как и в belive-feed-bot/src/jwt.ts.
    //
    // Было `if (payload.exp && ...)` — токен без exp считался вечным.
    // Плюс не проверялся sub: без него лимиты считались бы на "undefined",
    // то есть все анонимные запросы делили бы один дневной счётчик.
    if (typeof payload.exp !== 'number') {return null;}
    if (payload.exp < Date.now() / 1000) {return null;}
    if (!payload.sub) {return null;}
    return { sub: String(payload.sub) };
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
  if (active) {return false;} // already locked
  await kv.put(CONCURRENT_LOCK_KEY, JSON.stringify({ userId, startedAt: Date.now() }), { expirationTtl: 600 });
  return true;
}

async function releaseConcurrentLock(kv) {
  await kv.delete(CONCURRENT_LOCK_KEY);
}

/**
 * Снять лок, только если он принадлежит этому пользователю.
 *
 * Лок один на весь воркер (`mvsep:shared:active`) и защищает платную квоту
 * MVSEP: одновременно обрабатывается один трек. Безусловное снятие (как было
 * в /status) позволяло любому, кто знает чужой hash, освободить чужой лок
 * и запустить второй трек параллельно — то есть обойти лимит.
 */
async function releaseConcurrentLockIfOwner(kv, userId) {
  const raw = await kv.get(CONCURRENT_LOCK_KEY);
  if (!raw) {return false;}
  try {
    const lock = JSON.parse(raw);
    if (lock.userId !== userId) {return false;}
  } catch {
    // Битый лок восстановить нельзя, но и снимать его «на всякий» нельзя:
    // это мог быть чужой лок. Оставляем до истечения expirationTtl.
    return false;
  }
  await kv.delete(CONCURRENT_LOCK_KEY);
  return true;
}

// ─── keyTag для /health ──────────────────────────────────
//
// Показывает, КАКОЙ ключ лежит в секрете, не раскрывая его: 8 hex от
// sha256(MVSEP_API_KEY). Значения в Cloudflare encrypted, поэтому после
// ротации иначе не проверить, что секрет действительно сменился.
//
// Считается лениво и кэшируется вместе с сырым ключом: если секрет
// поменяли, тег пересчитается сам. Нет секрета — null, не 500.

let keyTagCache = { key: null, tag: null };

async function getKeyTag(apiKey) {
  if (!apiKey) {return null;}
  if (keyTagCache.key === apiKey) {return keyTagCache.tag;}

  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(apiKey));
  const hex = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  const tag = hex.slice(0, 8);

  keyTagCache = { key: apiKey, tag };
  return tag;
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
    if (!userApiKey) {await releaseConcurrentLock(env.MVSEP_RATES);}
    return new Response(JSON.stringify({ status: 'error', errors: ['MVSEP unreachable'] }), {
      status: 502, headers: { ...cors, 'Content-Type': 'application/json' }
    });
  }

  const data = await mvsepResp.json();

  // Успех MVSEP: /separation/create отдаёт {success:true, data:{link, hash}} —
  // поля `status` там нет вообще. Старое условие `data.status === 'ok'` было
  // ложно всегда, поэтому счётчик 10/день не рос, а глобальный лок снимался
  // сразу в else: оба лимита на общем ключе были мертвы. Старую форму
  // `status:'ok'` принимаем для совместимости.
  const accepted = (data.success === true || data.status === 'ok') && !!data.data?.hash;

  if (accepted) {
    if (!userApiKey) {
      const newCount = await incrementDailyUsage(env.MVSEP_RATES, userId);
      data.quota = { used: newCount, limit: DAILY_LIMIT, keySource: 'beLive' };
    } else {
      // У BYOK нет лимита beLive: пользователь платит MVSEP сам. Отдаём только
      // то, что реально знаем — источник ключа. Ни `limit`, ни `used` не шлём:
      // выдуманное число попадёт в UI и будет врать.
      data.quota = { keySource: 'user' };
    }
  } else {
    // MVSEP error — release lock
    if (!userApiKey) {await releaseConcurrentLock(env.MVSEP_RATES);}
  }

  return new Response(JSON.stringify(data), {
    status: mvsepResp.status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

async function handleStatus(request, env, userId, cors) {
  const hash = new URL(request.url).searchParams.get('hash');
  if (!hash) {
    return new Response(JSON.stringify({ status: 'error', errors: ['Missing hash'] }), {
      status: 400, headers: { ...cors, 'Content-Type': 'application/json' }
    });
  }

  const resp = await fetch(`${MVSEP_API_URL}/get?hash=${encodeURIComponent(hash)}`, {
    headers: { 'X-API-Key': env.MVSEP_API_KEY }
  });
  const data = await resp.json();

  // Снимаем лок только если он наш: иначе любой, кто знает чужой hash,
  // освобождал бы чужую обработку и обходил лимит одновременности.
  if (data.status === 'done' || data.status === 'failed') {
    await releaseConcurrentLockIfOwner(env.MVSEP_RATES, userId);
  }

  return new Response(JSON.stringify(data), {
    status: resp.status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

function badDownloadUrl(cors) {
  return new Response(JSON.stringify({ status: 'error', errors: ['Invalid URL'] }), {
    status: 400, headers: { ...cors, 'Content-Type': 'application/json' }
  });
}

async function handleDownload(request, env, cors) {
  const raw = new URL(request.url).searchParams.get('url');

  let target = parseAllowedMvsepUrl(raw);
  if (!target) {return badDownloadUrl(cors);}

  // Редиректы разбираем сами, а не отдаём fetch: MVSEP отдаёт 302 (например,
  // de.mvsep.com/ → de.mvsep.com/en), и blanket-400 на 3xx уронил бы все
  // стемы. Каждый Location проверяем тем же allowlist — иначе редирект
  // становится обходом SSRF-гарда.
  let resp;
  let hops = 0;
  for (;;) {
    try {
      resp = await fetch(target.toString(), { redirect: 'manual' });
    } catch {
      return new Response(JSON.stringify({ status: 'error', errors: ['MVSEP unreachable'] }), {
        status: 502, headers: { ...cors, 'Content-Type': 'application/json' }
      });
    }

    if (resp.status < 300 || resp.status >= 400) {break;}

    const location = resp.headers.get('Location');
    if (!location) {return badDownloadUrl(cors);}

    if (++hops > MAX_DOWNLOAD_REDIRECTS) {return badDownloadUrl(cors);}

    const next = parseAllowedMvsepUrl(location, target);
    if (!next) {return badDownloadUrl(cors);}
    target = next;
  }

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
  await releaseConcurrentLockIfOwner(env.MVSEP_RATES, userId);
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
      const keyTag = await getKeyTag(env.MVSEP_API_KEY);
      return new Response(JSON.stringify({ status: 'ok', service: 'belive-mvsep', keyTag }), {
        headers: { ...cors, 'Content-Type': 'application/json' }
      });
    }

    // Auth required below
    //
    // /status и /download раньше стояли ВЫШЕ этой проверки и были открыты.
    // /status ходит в mvsep.com с нашим MVSEP_API_KEY: анонимный перебор
    // hash'ей жёг платный ключ и вдобавок снимал глобальный лок, обходя
    // лимит одновременности. /download был открытым прокси на mvsep.com.
    // Оба теперь требуют тот же JWT HS256, что /submit.
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

    if (url.pathname === '/status' && request.method === 'GET') {
      return handleStatus(request, env, user.sub, cors);
    }
    if (url.pathname === '/download' && request.method === 'GET') {
      // userId здесь не нужен: /download только проксирует готовый файл и
      // не трогает лок. Передавать его четвёртым аргументом нельзя —
      // handleDownload(request, env, cors), и cors уехал бы на место userId.
      return handleDownload(request, env, cors);
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
