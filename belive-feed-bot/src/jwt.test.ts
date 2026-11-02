// Контракт verifyJwt — юнит-уровень.
//
// Зачем отдельный файл: в index.test.ts проверки идут через весь воркер, и
// там не видно, что именно отклонило токен — подпись, exp или sub. Здесь
// проверяется сама функция, чтобы вектор «без exp» падал по своей причине.
//
// Дыра, которую эти тесты закрепляют: до 02.11.2026 проверка была
// `typeof payload.exp === 'number' && payload.exp < now`. Токен вообще без
// exp проходил как бессрочный. Минтер один — belive-auth — и он всегда ставит
// TTL, поэтому «токен без exp» не может быть нашим.

import { describe, it, expect } from 'vitest';
import { verifyJwt } from './jwt';

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

describe('verifyJwt: happy path', () => {
  it('валидный токен возвращает sub и exp', async () => {
    const token = await sign({ sub: 'google:123', exp: inAnHour() });
    const out = await verifyJwt(token, SECRET);
    expect(out).not.toBeNull();
    expect(out!.sub).toBe('google:123');
    expect(typeof out!.exp).toBe('number');
  });
});

describe('verifyJwt: exp обязателен (fail-closed)', () => {
  it('токен БЕЗ exp → null', async () => {
    const token = await sign({ sub: 'google:123' });
    expect(await verifyJwt(token, SECRET)).toBeNull();
  });

  it('exp в прошлом → null', async () => {
    const token = await sign({ sub: 'google:123', exp: Math.floor(Date.now() / 1000) - 60 });
    expect(await verifyJwt(token, SECRET)).toBeNull();
  });

  it('exp строкой ("9999999999") → null', async () => {
    const token = await sign({ sub: 'google:123', exp: '9999999999' });
    expect(await verifyJwt(token, SECRET)).toBeNull();
  });

  it('exp = null → null', async () => {
    const token = await sign({ sub: 'google:123', exp: null });
    expect(await verifyJwt(token, SECRET)).toBeNull();
  });
});

describe('verifyJwt: остальные отказы', () => {
  it('без sub → null', async () => {
    const token = await sign({ exp: inAnHour() });
    expect(await verifyJwt(token, SECRET)).toBeNull();
  });

  it('чужая подпись → null', async () => {
    const token = await sign({ sub: 'google:123', exp: inAnHour() }, 'другой-секрет');
    expect(await verifyJwt(token, SECRET)).toBeNull();
  });

  it('alg none → null (подпись не проверяется по алгоритму из header)', async () => {
    const header = b64(enc.encode(JSON.stringify({ alg: 'none', typ: 'JWT' })));
    const body = b64(enc.encode(JSON.stringify({ sub: 'google:123', exp: inAnHour() })));
    expect(await verifyJwt(`${header}.${body}.`, SECRET)).toBeNull();
  });

  it('две части вместо трёх → null', async () => {
    expect(await verifyJwt('a.b', SECRET)).toBeNull();
  });

  it('пустая строка → null (не бросает)', async () => {
    expect(await verifyJwt('', SECRET)).toBeNull();
  });
});
