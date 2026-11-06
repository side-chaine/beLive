// CORS-векторы: что обязано падать и что обязано проходить.
//
// Векторы не выдуманы — это промахи двух аудитов подряд:
//   * `https://192.168.evil.com` — вектор Центра. В код он не попал, потому
//     что префикс был `http://192.168.` (другая схема), и Центр честно признал
//     промах своего вектора.
//   * `http://192.168.1.evil.com` — вектор 707. Попал в живую дыру: префикс
//     совпал, воркер отразил origin.
//   * `http://localhost.evil.com` и `...pages.dev.evil.com` — проверка того,
//     что фикс не превратился в новую префиксную проверку.
//
// Отдельно: `http://192.168.1.42:5173` в проде ЗАПРЕЩЁН. LAN-адрес телефона
// больше не зашит в код — для телефона есть превью-домены, а если очень нужен
// LAN, его кладут в env.ALLOWED_ORIGINS руками.

import { describe, it, expect } from 'vitest';
import worker from './index';
import { isAllowedOrigin, corsHeaders, PROD_ORIGIN } from './cors';

const MUST_FAIL = [
  'http://192.168.1.evil.com',
  'https://192.168.evil.com',
  'http://localhost.evil.com',
  'https://x1y2.belive-dul.pages.dev.evil.com',
  'http://127.0.0.1.evil.com',
  'https://app.mybelive.com.evil.com',
  '',
];

const MUST_PASS = [
  'https://app.mybelive.com',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://0.0.0.0:5173',
  'https://x1y2.belive-dul.pages.dev',
];

function makeEnv(overrides: Record<string, any> = {}) {
  return {
    BOT_TOKEN: 'bot-token',
    WEBHOOK_SECRET: 'webhook-secret',
    ALLOWED_TG_IDS: '1',
    EPHEMERAL_KV: {
      get: async () => null, put: async () => {}, delete: async () => {},
      list: async () => ({ keys: [] }),
    },
    UPLOAD_CHAT_ID: '-100123',
    JWT_SECRET: 'secret',
    ...overrides,
  } as any;
}

describe('isAllowedOrigin: обязан отказывать', () => {
  for (const origin of MUST_FAIL) {
    it(`«${origin || '(пусто)'}» → false`, () => {
      expect(isAllowedOrigin(origin)).toBe(false);
    });
  }
});

describe('isAllowedOrigin: обязан пропускать', () => {
  for (const origin of MUST_PASS) {
    it(`«${origin}» → true`, () => {
      expect(isAllowedOrigin(origin)).toBe(true);
    });
  }
});

describe('LAN только через env, не из кода', () => {
  it('192.168.1.42:5173 по умолчанию запрещён', () => {
    expect(isAllowedOrigin('http://192.168.1.42:5173')).toBe(false);
  });

  it('192.168.1.42:5173 разрешён, если его положили в extra', () => {
    expect(isAllowedOrigin('http://192.168.1.42:5173', ['http://192.168.1.42:5173'])).toBe(true);
  });

  it('extra не открывает соседний хост', () => {
    expect(isAllowedOrigin('http://192.168.1.43:5173', ['http://192.168.1.42:5173'])).toBe(false);
  });
});

describe('corsHeaders: отражение только для разрешённого', () => {
  it('разрешённый origin отражается и помечен Vary: Origin', () => {
    const h = corsHeaders('http://localhost:5173');
    expect(h['Access-Control-Allow-Origin']).toBe('http://localhost:5173');
    expect(h.Vary).toBe('Origin');
  });

  it('чужой origin получает прод-origin, а не отражение', () => {
    const h = corsHeaders('http://192.168.1.evil.com');
    expect(h['Access-Control-Allow-Origin']).toBe(PROD_ORIGIN);
  });

  it('allow-credentials не выставляется (иначе отражение стало бы опасным)', () => {
    const h = corsHeaders('http://localhost:5173') as Record<string, string>;
    expect(h['Access-Control-Allow-Credentials']).toBeUndefined();
  });
});

describe('живой воркер: отражения на GET больше нет', () => {
  it('GET /tracks с Origin 192.168.1.evil.com → ACAO не содержит evil', async () => {
    const res = await worker.fetch(
      new Request('https://feed-bot.test/tracks', {
        method: 'GET',
        headers: { Origin: 'http://192.168.1.evil.com' },
      }),
      makeEnv(),
    );
    expect(res.status).toBe(401);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(PROD_ORIGIN);
  });

  it('префлайт с Origin 192.168.1.evil.com → ACAO не содержит evil', async () => {
    const res = await worker.fetch(
      new Request('https://feed-bot.test/tracks', {
        method: 'OPTIONS',
        headers: { Origin: 'http://192.168.1.evil.com' },
      }),
      makeEnv(),
    );
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(PROD_ORIGIN);
  });

  it('префлайт с разрешённым Origin отражается (иначе сломается дев-фронт)', async () => {
    const res = await worker.fetch(
      new Request('https://feed-bot.test/tracks', {
        method: 'OPTIONS',
        headers: { Origin: 'http://localhost:5173' },
      }),
      makeEnv(),
    );
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173');
  });

  it('POST /upload с Origin 192.168.1.evil.com → 403 (тот же хелпер, что у GET)', async () => {
    const res = await worker.fetch(
      new Request('https://feed-bot.test/upload', {
        method: 'POST',
        headers: { Origin: 'http://192.168.1.evil.com' },
      }),
      makeEnv(),
    );
    expect(res.status).toBe(403);
  });

  it('POST /upload с Origin из env.ALLOWED_ORIGINS проходит гейт origin', async () => {
    // Дальше по коду он упрётся в отсутствие токена (401), но не в 403 —
    // значит origin пропущен. Это и проверяем: 403 vs 401.
    const res = await worker.fetch(
      new Request('https://feed-bot.test/upload', {
        method: 'POST',
        headers: { Origin: 'http://192.168.1.42:5173' },
      }),
      makeEnv({ ALLOWED_ORIGINS: 'http://192.168.1.42:5173' }),
    );
    expect(res.status).toBe(401);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://192.168.1.42:5173');
  });
});
