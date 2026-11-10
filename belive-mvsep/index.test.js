// Тесты воркера belive-mvsep.
//
// Зачем: /status и /download стояли в роутере ВЫШЕ проверки JWT и были
// открыты. /status ходит в mvsep.com с нашим MVSEP_API_KEY — анонимный
// перебор hash'ей жёг платный ключ. Плюс /status безусловно снимал
// глобальный лок, то есть любой, кто знает чужой hash, освобождал чужую
// обработку и обходил лимит одновременности.
//
// Эти тесты падают, если вернуть открытые /status или /download,
// и если вернуть безусловное снятие лока.
//
// Окружение — jsdom (общий setup проекта). jsdom даёт crypto без subtle,
// поэтому ниже подставляем webcrypto из node:crypto. Воркер обращается к
// crypto.subtle только в момент вызова, не при импорте, так что порядок
// безопасен.

import { webcrypto } from 'node:crypto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import worker from './index.js';

if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
}

const SECRET = 'test-jwt-secret';

// ─── helpers ───────────────────────────────────────────────

function makeKv(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    get: async (k) => (store.has(k) ? store.get(k) : null),
    put: async (k, v) => { store.set(k, v); },
    delete: async (k) => { store.delete(k); },
    _store: store,
  };
}

function makeEnv(kv = makeKv()) {
  return {
    JWT_SECRET: SECRET,
    MVSEP_API_KEY: 'mvsep-test-key',
    MVSEP_RATES: kv,
    ALLOWED_ORIGINS: 'https://app.mybelive.com',
  };
}

async function makeJwt(sub, overrides = {}) {
  const enc = new TextEncoder();
  const b64 = (bytes) => Buffer.from(bytes).toString('base64url');
  const header = b64(enc.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const payload = b64(enc.encode(JSON.stringify({
    sub,
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...overrides,
  })));
  const data = `${header}.${payload}`;
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return `${data}.${b64(sig)}`;
}

function req(path, { method = 'GET', token } = {}) {
  const headers = {};
  if (token) {headers.Authorization = `Bearer ${token}`;}
  return new Request(`https://mvsep.test${path}`, { method, headers });
}

const LOCK_KEY = 'mvsep:shared:active';

let fetchSpy;

beforeEach(() => {
  // mvsep.com наружу не ходим: /status дергает MVSEP_API_URL/get.
  fetchSpy = vi.fn(async () =>
    new Response(JSON.stringify({ status: 'done', data: { files: [] } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
  vi.stubGlobal('fetch', fetchSpy);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ─── публичные роуты ───────────────────────────────────────

describe('публичные роуты остаются публичными', () => {
  it('/health отвечает без токена и отдаёт keyTag, не сам ключ', async () => {
    const res = await worker.fetch(req('/health'), makeEnv());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({ status: 'ok', service: 'belive-mvsep' });
    expect(json.keyTag).toMatch(/^[0-9a-f]{8}$/);
    // Цель keyTag — опознать ключ, не раскрывая его.
    expect(JSON.stringify(json)).not.toContain('mvsep-test-key');
  });

  it('/health без секрета отдаёт keyTag: null, а не 500', async () => {
    const env = makeEnv();
    delete env.MVSEP_API_KEY;
    const res = await worker.fetch(req('/health'), env);
    expect(res.status).toBe(200);
    expect((await res.json()).keyTag).toBeNull();
  });

  it('keyTag — первые 8 hex от sha256 ключа', async () => {
    const { createHash } = await import('node:crypto');
    const expected = createHash('sha256').update('mvsep-test-key').digest('hex').slice(0, 8);
    const res = await worker.fetch(req('/health'), makeEnv());
    expect((await res.json()).keyTag).toBe(expected);
  });

  it('OPTIONS (preflight) отвечает 204 без токена', async () => {
    const res = await worker.fetch(req('/health', { method: 'OPTIONS' }), makeEnv());
    expect(res.status).toBe(204);
  });
});

// ─── закрытые роуты: 401 без токена ────────────────────────

describe('закрытые роуты требуют JWT', () => {
  it('/status без токена → 401 AUTH_REQUIRED', async () => {
    const res = await worker.fetch(req('/status?hash=abc'), makeEnv());
    expect(res.status).toBe(401);
    expect((await res.json()).errors).toEqual(['AUTH_REQUIRED']);
  });

  it('/download без токена → 401 AUTH_REQUIRED', async () => {
    const res = await worker.fetch(
      req('/download?url=' + encodeURIComponent('https://mvsep.com/file/x.mp3')),
      makeEnv(),
    );
    expect(res.status).toBe(401);
    expect((await res.json()).errors).toEqual(['AUTH_REQUIRED']);
  });

  it('/submit без токена → 401 (регресс-страж)', async () => {
    const res = await worker.fetch(req('/submit', { method: 'POST' }), makeEnv());
    expect(res.status).toBe(401);
  });

  it('/quota без токена → 401', async () => {
    const res = await worker.fetch(req('/quota'), makeEnv());
    expect(res.status).toBe(401);
  });

  it('токен с неверной подписью → 401 INVALID_TOKEN', async () => {
    const env = makeEnv();
    const bad = (await makeJwt('someone')) + 'x';
    const res = await worker.fetch(req('/status?hash=abc', { token: bad }), env);
    expect(res.status).toBe(401);
    expect((await res.json()).errors).toEqual(['INVALID_TOKEN']);
  });

  it('без токена воркер НЕ ходит в mvsep.com (не жжёт наш ключ)', async () => {
    await worker.fetch(req('/status?hash=abc'), makeEnv());
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

// ─── контракт payload: exp и sub обязательны ───────────────
//
// До этого exp проверялся как `if (payload.exp && ...)`, то есть токен без
// срока жизни проходил насквозь. Единственный минтер — belive-auth — всегда
// ставит TTL, поэтому токен без exp не наш. Здесь фиксируем отказ.

describe('payload-контракт: exp и sub обязательны', () => {
  it('токен без exp → 401 INVALID_TOKEN', async () => {
    const token = await makeJwt('user-1', { exp: undefined });
    const res = await worker.fetch(req('/status?hash=abc', { token }), makeEnv());
    expect(res.status).toBe(401);
    expect((await res.json()).errors).toEqual(['INVALID_TOKEN']);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('токен без sub → 401 INVALID_TOKEN (иначе лимит считался бы на undefined)', async () => {
    const token = await makeJwt(undefined);
    const res = await worker.fetch(req('/status?hash=abc', { token }), makeEnv());
    expect(res.status).toBe(401);
    expect((await res.json()).errors).toEqual(['INVALID_TOKEN']);
  });

  it('exp в прошлом → 401 INVALID_TOKEN', async () => {
    const token = await makeJwt('user-1', { exp: Math.floor(Date.now() / 1000) - 60 });
    const res = await worker.fetch(req('/status?hash=abc', { token }), makeEnv());
    expect(res.status).toBe(401);
    expect((await res.json()).errors).toEqual(['INVALID_TOKEN']);
  });

  it('exp не число ("3600" строкой) → 401 INVALID_TOKEN', async () => {
    const token = await makeJwt('user-1', { exp: '3600' });
    const res = await worker.fetch(req('/status?hash=abc', { token }), makeEnv());
    expect(res.status).toBe(401);
    expect((await res.json()).errors).toEqual(['INVALID_TOKEN']);
  });
});

// ─── закрытые роуты: работают с токеном ────────────────────

describe('с валидным токеном роуты работают', () => {
  it('/status отдаёт ответ mvsep и ходит наружу с нашим ключом', async () => {
    const env = makeEnv();
    const token = await makeJwt('google:me');
    const res = await worker.fetch(req('/status?hash=abc', { token }), env);

    expect(res.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toContain('https://mvsep.com/api/separation/get?hash=abc');
    expect(init.headers['X-API-Key']).toBe('mvsep-test-key');
  });

  it('/status с токеном сохраняет CORS-заголовок', async () => {
    // Ловит сдвиг аргументов: если cors уедет на чужое место, заголовки
    // станут мусором, и браузер заблокирует ответ при живом 200.
    const res = await worker.fetch(
      req('/status?hash=abc', { token: await makeJwt('google:me') }),
      makeEnv(),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeTruthy();
  });

  it('/download с токеном проксирует файл и сохраняет CORS-заголовок', async () => {
    // Ровно этот тест падал бы на handleDownload(request, env, user.sub, cors):
    // cors получал строку user.sub, { ...cors } разворачивал её в {0:'g',1:'o'…},
    // Access-Control-Allow-Origin исчезал, и браузер резал скачивание.
    fetchSpy.mockImplementationOnce(async () =>
      new Response('ID3', {
        status: 200,
        headers: { 'Content-Type': 'audio/mpeg' },
      }),
    );

    const res = await worker.fetch(
      req('/download?url=' + encodeURIComponent('https://mvsep.com/file/x.mp3'), {
        token: await makeJwt('google:me'),
      }),
      makeEnv(),
    );

    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeTruthy();
    expect(res.headers.get('Content-Type')).toBe('audio/mpeg');
  });

  it('/download не пускает на чужой хост', async () => {
    const res = await worker.fetch(
      req('/download?url=' + encodeURIComponent('https://evil.example/x.mp3'), {
        token: await makeJwt('google:me'),
      }),
      makeEnv(),
    );
    expect(res.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

// ─── /download: SSRF-гард ──────────────────────────────────
//
// /download — прокси наружу по URL из запроса, поэтому пускать любой URL
// нельзя: получим SSRF (внутренние адреса, localhost, метаданные CF).
// Проверяем HOSTNAME, а не префикс строки: реальные файлы лежат на
// de.mvsep.com, и старая проверка `startsWith('https://mvsep.com/')`
// отбивала их все — то есть ломала продукт и при этом не защищала.

describe('/download: SSRF-гард по hostname', () => {
  const OK_FILE = 'https://de.mvsep.com/storage/processed/b4/x.mp3';

  async function download(url) {
    return worker.fetch(
      req('/download?url=' + encodeURIComponent(url), { token: await makeJwt('google:me') }),
      makeEnv(),
    );
  }

  beforeEach(() => {
    fetchSpy.mockImplementation(async () =>
      new Response('ID3', { status: 200, headers: { 'Content-Type': 'audio/mpeg' } }),
    );
  });

  it('пропускает реальный адрес de.mvsep.com', async () => {
    const res = await download(OK_FILE);
    expect(res.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('пропускает корневой mvsep.com', async () => {
    expect((await download('https://mvsep.com/file/x.mp3')).status).toBe(200);
  });

  it('пропускает явный порт 443', async () => {
    expect((await download('https://de.mvsep.com:443/x.mp3')).status).toBe(200);
  });

  it.each([
    ['чужой домен', 'https://evil.com/storage/x.mp3'],
    ['суффикс-обман', 'https://mvsep.com.evil.com/x.mp3'],
    ['путь-обман', 'https://evil.com/mvsep.com/x.mp3'],
    ['http вместо https', 'http://de.mvsep.com/x.mp3'],
    ['userinfo', 'https://user:pass@de.mvsep.com/x.mp3'],
    ['нестандартный порт', 'https://de.mvsep.com:8443/x.mp3'],
    ['мусор', 'not a url'],
  ])('отклоняет: %s', async (_name, url) => {
    const res = await download(url);
    expect(res.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

// ─── /download: редиректы ─────────────────────────────────
//
// MVSEP реально редиректит (de.mvsep.com/ → de.mvsep.com/en), поэтому
// blanket-400 на любой 3xx уронил бы все стемы. Location разбираем сами и
// проверяем тем же allowlist — иначе редирект становится обходом SSRF-гарда.

describe('/download: редиректы только внутри MVSEP', () => {
  async function download(url) {
    return worker.fetch(
      req('/download?url=' + encodeURIComponent(url), { token: await makeJwt('google:me') }),
      makeEnv(),
    );
  }

  it('302 на тот же хост — проходит', async () => {
    fetchSpy
      .mockImplementationOnce(async () =>
        new Response(null, { status: 302, headers: { Location: 'https://de.mvsep.com/en/x.mp3' } }))
      .mockImplementationOnce(async () =>
        new Response('ID3', { status: 200, headers: { 'Content-Type': 'audio/mpeg' } }));

    const res = await download('https://de.mvsep.com/x.mp3');
    expect(res.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('302 на чужой хост — 400, второй запрос не уходит', async () => {
    fetchSpy.mockImplementationOnce(async () =>
      new Response(null, { status: 302, headers: { Location: 'https://evil.com/x.mp3' } }));

    const res = await download('https://de.mvsep.com/x.mp3');
    expect(res.status).toBe(400);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('четвёртый хоп — 400', async () => {
    fetchSpy.mockImplementation(async () =>
      new Response(null, { status: 302, headers: { Location: 'https://de.mvsep.com/loop' } }));

    const res = await download('https://de.mvsep.com/x.mp3');
    expect(res.status).toBe(400);
    // начальный запрос + 3 разрешённых хопа
    expect(fetchSpy).toHaveBeenCalledTimes(4);
  });
});

// ─── /submit: успех MVSEP и квота ──────────────────────────
//
// /separation/create отдаёт {success:true, data:{link,hash}} — поля `status`
// там нет. Старое условие `data.status === 'ok'` было ложно всегда, поэтому
// счётчик 10/день не рос, а общий лок снимался сразу: оба лимита были мертвы.

describe('/submit: успех MVSEP и квота', () => {
  function postReq(token, fd, extraHeaders = {}) {
    const r = new Request('https://mvsep.test/submit', {
      method: 'POST',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extraHeaders },
    });
    // jsdom-Request не умеет multipart — подменяем только метод разбора.
    Object.defineProperty(r, 'formData', { value: async () => fd, configurable: true });
    return r;
  }

  function mvsepCreate(body) {
    fetchSpy.mockImplementationOnce(async () =>
      new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } }));
  }

  const todayKey = (sub) => `mvsep:${sub}:${new Date().toISOString().slice(0, 10)}`;

  it('живая форма {success:true} засчитывается: счётчик растёт, лок держится', async () => {
    const kv = makeKv();
    mvsepCreate({ success: true, data: { link: 'l', hash: 'h1' } });

    const res = await worker.fetch(postReq(await makeJwt('google:me'), new FormData()), makeEnv(kv));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.quota).toMatchObject({ used: 1, limit: 10, keySource: 'beLive' });
    expect(kv._store.has(LOCK_KEY)).toBe(true);
  });

  it('старая форма {status:"ok"} тоже принимается', async () => {
    const kv = makeKv();
    mvsepCreate({ status: 'ok', data: { hash: 'h2' } });

    const res = await worker.fetch(postReq(await makeJwt('google:me'), new FormData()), makeEnv(kv));

    expect((await res.json()).quota).toMatchObject({ used: 1, keySource: 'beLive' });
    expect(kv._store.has(LOCK_KEY)).toBe(true);
  });

  it('success:false при HTTP 200 — лок снят, счётчик не растёт', async () => {
    const kv = makeKv();
    mvsepCreate({ success: false, errors: ['invalid token'] });

    const res = await worker.fetch(postReq(await makeJwt('google:me'), new FormData()), makeEnv(kv));

    expect((await res.json()).quota).toBeUndefined();
    expect(kv._store.has(LOCK_KEY)).toBe(false);
    expect(kv._store.has(todayKey('google:me'))).toBe(false);
  });

  it('свой ключ: quota только keySource, без limit и used', async () => {
    const kv = makeKv();
    mvsepCreate({ success: true, data: { hash: 'h3' } });

    const res = await worker.fetch(
      postReq(await makeJwt('google:me'), new FormData(), { 'X-Mvsep-User-Key': 'user-key' }),
      makeEnv(kv),
    );

    // Выдуманного limit:49 больше нет — UI не должен показывать чужую цифру.
    expect((await res.json()).quota).toEqual({ keySource: 'user' });
    // BYOK не трогает ни дневной счётчик, ни общий лок.
    expect(kv._store.size).toBe(0);
  });

  // Отказ сабмита снимал лок БЕЗ проверки владельца. Сценарий: пока наш /create
  // висит, лок успевает уйти другому (мы отменили, он взял) — и наш отказ
  // освобождал его обработку, то есть разрешал второй трек параллельно.
  it('сеть упала — лок, ушедший другому за время запроса, остаётся', async () => {
    const kv = makeKv();
    fetchSpy.mockImplementationOnce(async () => {
      kv._store.set(LOCK_KEY, JSON.stringify({ userId: 'google:other', startedAt: 2 }));
      throw new Error('network');
    });

    const res = await worker.fetch(postReq(await makeJwt('google:me'), new FormData()), makeEnv(kv));

    expect(res.status).toBe(502);
    expect(kv._store.has(LOCK_KEY)).toBe(true);
  });

  it('MVSEP вернул ошибку — чужой лок тоже не снимается', async () => {
    const kv = makeKv();
    fetchSpy.mockImplementationOnce(async () => {
      kv._store.set(LOCK_KEY, JSON.stringify({ userId: 'google:other', startedAt: 2 }));
      return new Response(JSON.stringify({ success: false, errors: ['bad'] }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    });

    await worker.fetch(postReq(await makeJwt('google:me'), new FormData()), makeEnv(kv));

    expect(kv._store.has(LOCK_KEY)).toBe(true);
  });
});

// ─── владение локом ────────────────────────────────────────

describe('снятие лока только владельцем', () => {
  it('чужой лок НЕ снимается по /status', async () => {
    const kv = makeKv({ [LOCK_KEY]: JSON.stringify({ userId: 'google:other', startedAt: 1 }) });
    const env = makeEnv(kv);
    const token = await makeJwt('google:me');

    await worker.fetch(req('/status?hash=abc', { token }), env);

    expect(kv._store.has(LOCK_KEY)).toBe(true);
  });

  it('свой лок снимается по /status при done', async () => {
    const kv = makeKv({ [LOCK_KEY]: JSON.stringify({ userId: 'google:me', startedAt: 1 }) });
    const env = makeEnv(kv);
    const token = await makeJwt('google:me');

    await worker.fetch(req('/status?hash=abc', { token }), env);

    expect(kv._store.has(LOCK_KEY)).toBe(false);
  });

  it('чужой лок НЕ снимается по /cancel', async () => {
    const kv = makeKv({ [LOCK_KEY]: JSON.stringify({ userId: 'google:other', startedAt: 1 }) });
    const env = makeEnv(kv);
    const token = await makeJwt('google:me');

    await worker.fetch(req('/cancel', { method: 'POST', token }), env);

    expect(kv._store.has(LOCK_KEY)).toBe(true);
  });
});
