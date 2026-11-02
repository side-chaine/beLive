// Тесты авторизации /upload у belive-feed-bot.
//
// Зачем: /upload принимал общий статический ключ X-API-Key, значение
// которого захардкожено в клиенте (src/services/tg-upload.service.ts).
// То есть ключ лежал в публичном бандле и в публичном репозитории, и
// «проверка» не защищала ничего: любой мог залить ZIP, который уходил в
// наш Telegram и появлялся в каталоге через публичный GET /tracks.
//
// Теперь /upload требует тот же JWT HS256, что gateway и belive-mvsep.
//
// Эти тесты падают, если вернуть приём X-API-Key, если пустить запрос
// без Authorization и если начать принимать всех при незаданном секрете.

import { webcrypto } from 'node:crypto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import worker, { MAX_UPLOAD_BYTES } from './index';
import { verifyJwt } from './jwt';

// jsdom даёт crypto без subtle — подставляем webcrypto из node:crypto.
// Воркер обращается к crypto.subtle только в момент вызова, не при импорте.
if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
}

const SECRET = 'test-jwt-secret';
const APP_ORIGIN = 'https://app.mybelive.com';
const UPLOAD_URL = 'https://feed-bot.test/upload';

// ─── helpers ───────────────────────────────────────────────

function makeKv() {
  const store = new Map<string, string>();
  return {
    get: async (k: string) => (store.has(k) ? store.get(k) : null),
    put: async (k: string, v: string) => { store.set(k, v); },
    delete: async (k: string) => { store.delete(k); },
    list: async (_opts?: any) => ({ keys: [] as any[] }),
    _store: store,
  };
}

function makeEnv(overrides: Record<string, any> = {}) {
  return {
    BOT_TOKEN: 'bot-token',
    WEBHOOK_SECRET: 'webhook-secret',
    ALLOWED_TG_IDS: '1',
    EPHEMERAL_KV: makeKv(),
    UPLOAD_CHAT_ID: '-100123',
    JWT_SECRET: SECRET,
    ALLOWED_ORIGIN: APP_ORIGIN,
    ...overrides,
  } as any;
}

async function makeJwt(sub: string, expOffsetSec = 3600) {
  const enc = new TextEncoder();
  const b64 = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64url');
  const header = b64(enc.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const payload = b64(enc.encode(JSON.stringify({
    sub,
    exp: Math.floor(Date.now() / 1000) + expOffsetSec,
  })));
  const data = `${header}.${payload}`;
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return `${data}.${b64(new Uint8Array(sig))}`;
}

function makeFile() {
  // ZIP magic bytes: PK\x03\x04 — иначе воркер ответит 415 раньше проверки.
  const bytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00, 0x00, 0x00]);
  return new File([bytes], 'stems.zip', { type: 'application/zip' });
}

function uploadRequest(headers: Record<string, string>) {
  const fd = new FormData();
  fd.append('file', makeFile());
  fd.append('artist', 'Linkin Park');
  fd.append('title', 'Breaking the Habit');
  fd.append('stemType', 'full');
  return new Request(UPLOAD_URL, {
    method: 'POST',
    headers: { Origin: APP_ORIGIN, ...headers },
    body: fd,
  });
}

/**
 * Тот же запрос, но без undici-парсера тела.
 *
 * `new Request(url, { body: jsdomFormData })` конструируется, но падает уже на
 * `request.formData()`: undici проверяет File через свой webidl и не признаёт
 * файл из jsdom. Для гейта это неважно (до тела дело не доходит), а рабочий
 * путь надо проверять — поэтому здесь тело отдаётся напрямую.
 */
function uploadRequestWithBody(headers: Record<string, string>) {
  const fd = new FormData();
  fd.append('file', makeFile());
  fd.append('artist', 'Linkin Park');
  fd.append('title', 'Breaking the Habit');
  fd.append('stemType', 'full');
  return {
    method: 'POST',
    url: UPLOAD_URL,
    headers: new Headers({ Origin: APP_ORIGIN, ...headers }),
    formData: async () => fd,
  } as any;
}

let fetchSpy: any;

beforeEach(() => {
  // Telegram наружу не ходим: sendDocument отвечает как настоящий.
  fetchSpy = vi.fn(async () => new Response(
    JSON.stringify({ ok: true, result: { document: { file_id: 'FILEID' }, message_id: 1 } }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  ));
  vi.stubGlobal('fetch', fetchSpy);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ─── гейт ──────────────────────────────────────────────────

describe('/upload требует JWT', () => {
  it('без Authorization → 401', async () => {
    const res = await worker.fetch(uploadRequest({}), makeEnv());
    expect(res.status).toBe(401);
  });

  it('старый X-API-Key больше не принимается → 401', async () => {
    // Регресс-страж: именно этот заголовок со значением из публичного
    // бандла открывал воркер любому желающему.
    const res = await worker.fetch(uploadRequest({ 'X-API-Key': 'belive2026' }), makeEnv());
    expect(res.status).toBe(401);
  });

  it('токен с неверной подписью → 401', async () => {
    const bad = (await makeJwt('google:me')) + 'x';
    const res = await worker.fetch(uploadRequest({ Authorization: `Bearer ${bad}` }), makeEnv());
    expect(res.status).toBe(401);
  });

  it('истёкший токен → 401', async () => {
    const expired = await makeJwt('google:me', -60);
    const res = await worker.fetch(uploadRequest({ Authorization: `Bearer ${expired}` }), makeEnv());
    expect(res.status).toBe(401);
  });

  it('при незаданном JWT_SECRET закрывается (503), а не открывается', async () => {
    const env = makeEnv({ JWT_SECRET: '' });
    const res = await worker.fetch(
      uploadRequest({ Authorization: `Bearer ${await makeJwt('google:me')}` }),
      env,
    );
    expect(res.status).toBe(503);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('без токена воркер НЕ ходит в Telegram', async () => {
    await worker.fetch(uploadRequest({}), makeEnv());
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

// ─── рабочий путь ──────────────────────────────────────────

describe('с валидным токеном /upload работает', () => {
  it('отправляет документ в Telegram и отдаёт fileId', async () => {
    const env = makeEnv();
    const res = await worker.fetch(
      uploadRequestWithBody({ Authorization: `Bearer ${await makeJwt('google:me')}` }),
      env,
    );

    expect(res.status).toBe(200);
    const json: any = await res.json();
    expect(json.fileId).toBe('FILEID');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(String(fetchSpy.mock.calls[0][0])).toContain('api.telegram.org');
  });

  it('preflight разрешает заголовок Authorization', async () => {
    // Иначе браузер зарежет сам запрос: Authorization не входит в
    // CORS-safelisted headers и требует явного разрешения в preflight.
    const res = await worker.fetch(
      new Request(UPLOAD_URL, { method: 'OPTIONS', headers: { Origin: APP_ORIGIN } }),
      makeEnv(),
    );
    const allow = res.headers.get('Access-Control-Allow-Headers') || '';
    expect(allow.toLowerCase()).toContain('authorization');
    expect(allow.toLowerCase()).not.toContain('x-api-key');
  });
});

// ─── каталог и стемы закрыты входом ────────────────────────

describe('/tracks и /download требуют JWT', () => {
  const TRACKS_URL = 'https://feed-bot.test/tracks';
  const DOWNLOAD_URL = 'https://feed-bot.test/download/BQACAgIAAxkBAAOw';

  const get = (url: string, headers: Record<string, string> = {}) =>
    new Request(url, { method: 'GET', headers });

  it('анонимный /tracks → 401 (каталог больше не раздаётся)', async () => {
    const res = await worker.fetch(get(TRACKS_URL), makeEnv());
    expect(res.status).toBe(401);
  });

  it('анонимный /download/<file_id> → 401 и в Telegram не ходим', async () => {
    const res = await worker.fetch(get(DOWNLOAD_URL), makeEnv());
    expect(res.status).toBe(401);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('токен с неверной подписью → 401 на обоих маршрутах', async () => {
    const bad = (await makeJwt('google:me')) + 'x';
    const headers = { Authorization: `Bearer ${bad}` };
    expect((await worker.fetch(get(TRACKS_URL, headers), makeEnv())).status).toBe(401);
    expect((await worker.fetch(get(DOWNLOAD_URL, headers), makeEnv())).status).toBe(401);
  });

  it('при незаданном JWT_SECRET каталог закрывается (503), а не открывается', async () => {
    const res = await worker.fetch(get(TRACKS_URL), makeEnv({ JWT_SECRET: '' }));
    expect(res.status).toBe(503);
  });

  it('с валидным токеном /tracks отдаёт каталог', async () => {
    const res = await worker.fetch(
      get(TRACKS_URL, { Authorization: `Bearer ${await makeJwt('google:me')}` }),
      makeEnv(),
    );
    expect(res.status).toBe(200);
    const json: any = await res.json();
    expect(Array.isArray(json.tracks)).toBe(true);
    expect(json.tracks.length).toBeGreaterThan(0);
  });

  it('health-заглушка остаётся публичной', async () => {
    const res = await worker.fetch(get('https://feed-bot.test/health'), makeEnv());
    expect(res.status).toBe(200);
  });
});

// ─── сама проверка токена ──────────────────────────────────

// ─── лимит размера ─────────────────────────────────────────

/**
 * Запрос с файлом заданного размера и БЕЗ Content-Length.
 *
 * Именно так обходился единственный гейт: chunked-запрос
 * (Transfer-Encoding: chunked) приходит без Content-Length, проверка выше
 * не срабатывает, и ZIP любого размера уходил в formData() — в память
 * изолята, а потом в Telegram.
 *
 * Размер подделываем через defineProperty, чтобы не выделять 50 МБ:
 * воркеру на этом гейте нужен только file.size.
 */
function uploadRequestWithSize(size: number, headers: Record<string, string> = {}) {
  const fd = new FormData();
  const f = makeFile();
  Object.defineProperty(f, 'size', { value: size });
  fd.append('file', f);
  fd.append('artist', 'Linkin Park');
  fd.append('title', 'Breaking the Habit');
  fd.append('stemType', 'full');
  return {
    method: 'POST',
    url: UPLOAD_URL,
    headers: new Headers({ Origin: APP_ORIGIN, ...headers }),
    formData: async () => fd,
  } as any;
}

describe('/upload: лимит размера', () => {
  it('chunked без Content-Length, файл больше лимита → 413', async () => {
    const res = await worker.fetch(
      uploadRequestWithSize(MAX_UPLOAD_BYTES + 1, {
        Authorization: `Bearer ${await makeJwt('google:me')}`,
      }),
      makeEnv(),
    );
    expect(res.status).toBe(413);
    // Главное: до Telegram дело не дошло.
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('Content-Length больше лимита → 413 до чтения тела', async () => {
    const res = await worker.fetch(
      uploadRequestWithBody({
        Authorization: `Bearer ${await makeJwt('google:me')}`,
        'Content-Length': String(MAX_UPLOAD_BYTES + 1),
      }),
      makeEnv(),
    );
    expect(res.status).toBe(413);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('файл ровно в лимит → не 413 (граница не сдвинута)', async () => {
    const res = await worker.fetch(
      uploadRequestWithSize(MAX_UPLOAD_BYTES, {
        Authorization: `Bearer ${await makeJwt('google:me')}`,
      }),
      makeEnv(),
    );
    expect(res.status).not.toBe(413);
  });
});

describe('verifyJwt', () => {
  it('принимает корректный токен и возвращает sub', async () => {
    const payload = await verifyJwt(await makeJwt('google:42'), SECRET);
    expect(payload?.sub).toBe('google:42');
  });

  it('отклоняет чужой секрет', async () => {
    expect(await verifyJwt(await makeJwt('google:42'), 'other-secret')).toBeNull();
  });

  it('отклоняет мусор вместо токена', async () => {
    expect(await verifyJwt('not-a-jwt', SECRET)).toBeNull();
    expect(await verifyJwt('a.b.c', SECRET)).toBeNull();
  });
});
