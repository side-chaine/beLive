// Контракт verifyJWT у gateway.
//
// Зачем этот файл существует отдельно: до него ни один тест в gateway/test/
// не запускался ни локально через `npm test`, ни в CI — каталог не входил
// в include корневого vitest.config.ts, а свой gateway/vitest.config.ts
// в пайплайне никто не вызывал. То есть проверка JWT на главном воркере
// (посты, лайки, комментарии) не проверялась вообще.
//
// Дыра, которую фиксируем: `if (payload.exp && Date.now()/1000 > payload.exp)`
// — токен без exp проходил как вечный.

import { describe, it, expect } from 'vitest';
import { verifyJWT, getAuthCtx, base64UrlDecode } from '../src/handlers/auth';

const SECRET = 'test-secret';
const enc = new TextEncoder();
const b64 = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64url');

async function sign(payload: Record<string, unknown>, secret = SECRET): Promise<string> {
  const header = b64(enc.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const body = b64(enc.encode(JSON.stringify(payload)));
  const data = `${header}.${body}`;
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return `${data}.${b64(new Uint8Array(sig))}`;
}

const inAnHour = () => Math.floor(Date.now() / 1000) + 3600;

const valid = (extra: Record<string, unknown> = {}) => ({
  sub: 'google:123',
  iss: 'belive-auth',
  provider: 'google',
  role: 'user',
  exp: inAnHour(),
  ...extra,
});

describe('gateway verifyJWT: happy path', () => {
  it('валидный токен даёт authCtx с sub и провайдером', async () => {
    const ctx = await verifyJWT(await sign(valid()), SECRET);
    expect(ctx).not.toBeNull();
    expect(ctx!.sub).toBe('google:123');
    expect(ctx!.providerSub).toBe('123');
    expect(ctx!.roleHint).toBe('user');
  });
});

describe('gateway verifyJWT: exp обязателен (fail-closed)', () => {
  it('токен БЕЗ exp → null', async () => {
    const token = await sign(valid({ exp: undefined }));
    expect(await verifyJWT(token, SECRET)).toBeNull();
  });

  it('exp в прошлом → null', async () => {
    const token = await sign(valid({ exp: Math.floor(Date.now() / 1000) - 60 }));
    expect(await verifyJWT(token, SECRET)).toBeNull();
  });

  it('exp строкой → null', async () => {
    const token = await sign(valid({ exp: '9999999999' }));
    expect(await verifyJWT(token, SECRET)).toBeNull();
  });

  it('exp = null → null', async () => {
    const token = await sign(valid({ exp: null }));
    expect(await verifyJWT(token, SECRET)).toBeNull();
  });
});

describe('gateway verifyJWT: остальные отказы', () => {
  it('без sub → null (иначе authCtx.sub = undefined и ломается author_id)', async () => {
    const token = await sign(valid({ sub: undefined }));
    expect(await verifyJWT(token, SECRET)).toBeNull();
  });

  it('чужой iss → null', async () => {
    const token = await sign(valid({ iss: 'someone-else' }));
    expect(await verifyJWT(token, SECRET)).toBeNull();
  });

  it('чужая подпись → null', async () => {
    const token = await sign(valid(), 'другой-секрет');
    expect(await verifyJWT(token, SECRET)).toBeNull();
  });

  it('alg none → null', async () => {
    const header = b64(enc.encode(JSON.stringify({ alg: 'none', typ: 'JWT' })));
    const body = b64(enc.encode(JSON.stringify(valid())));
    expect(await verifyJWT(`${header}.${body}.`, SECRET)).toBeNull();
  });

  it('пустая строка → null (не бросает)', async () => {
    expect(await verifyJWT('', SECRET)).toBeNull();
  });
});

describe('gateway getAuthCtx', () => {
  const env = { JWT_SECRET: SECRET };

  it('без заголовка Authorization → null', async () => {
    const req = new Request('https://gateway.test/api/feed/posts');
    expect(await getAuthCtx(req, env)).toBeNull();
  });

  it('с валидным Bearer → authCtx', async () => {
    const token = await sign(valid());
    const req = new Request('https://gateway.test/api/feed/posts', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const ctx = await getAuthCtx(req, env);
    expect(ctx?.sub).toBe('google:123');
  });

  it('токен без exp в заголовке → null', async () => {
    const token = await sign(valid({ exp: undefined }));
    const req = new Request('https://gateway.test/api/feed/posts', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(await getAuthCtx(req, env)).toBeNull();
  });
});

// Зачем этот блок отдельно от поведенческих тестов выше.
//
// Регрессия, которую ловим: `base64UrlDecode` вернул голый `bytes.buffer`
// вместо view. Тогда crypto.subtle.verify в jsdom отбивает аргумент как
// «чужой», catch в verifyJWT глотает TypeError и отдаёт null — валидный
// токен выглядит невалидным.
//
// Замер откатом (02.11.2026, три машины):
//   jsdom,  Node 20 → поведенческие тесты КРАСНЕЮТ (2 failed)
//   jsdom,  Node 22 → зелёные, охрана молчит
//   jsdom,  Node 24 → зелёные, охрана молчит
//   node,   Node 20 → зелёные, охрана молчит
//   node,   Node 24 → зелёные, охрана молчит
//
// То есть поведенческий тест зависел от версии Node и от среды. Явная
// проверка типа ниже краснеет во всех пяти комбинациях.
describe('gateway base64UrlDecode: тип возврата', () => {
  it('возвращает Uint8Array, а не голый ArrayBuffer', () => {
    expect(base64UrlDecode('AQID')).toBeInstanceOf(Uint8Array);
  });

  it('декодирует base64url без padding', () => {
    expect(Array.from(base64UrlDecode('AQID'))).toEqual([1, 2, 3]);
  });

  it('понимает - и _ вместо + и /', () => {
    const bytes = new Uint8Array([0xfb, 0xff, 0x00]);
    const encoded = Buffer.from(bytes).toString('base64url');
    expect(encoded).toContain('-');
    expect(Array.from(base64UrlDecode(encoded))).toEqual([0xfb, 0xff, 0x00]);
  });
});
