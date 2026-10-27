// @SEC(007-audit): P1 регресс — handleCreateFeedPost обязан ДЕЙСТВИТЕЛЬНО вставлять пост.
// В src был потерян блок INSERT (worktree-race): валидация → return ...created,
// где created не существует → ReferenceError → 500 на каждом создании поста.
// Восстановлено из dist-new. Тест: подаём валидный body → ожидаем INSERT + 201.
import { describe, it, expect, vi } from 'vitest';

import { handleCreateFeedPost } from '../src/handlers/feed';

function makeDb(insertedSqls: string[], selectResult: unknown) {
  const run = vi.fn().mockResolvedValue({ results: [] });
  const first = vi.fn().mockResolvedValue(selectResult);
  return {
    prepare: vi.fn((sql: string) => {
      if (/^[\s]*INSERT/i.test(sql)) insertedSqls.push(sql);
      return { bind: () => ({ run, first }) };
    }),
    batch: vi.fn(),
  } as any;
}

const AUTH = {
  sub: 'google:user1',
  provider: 'google',
  providerSub: 'user1',
  roleHint: 'user',
  name: 'Тест Юзер',
  picture: 'https://avatar/x.png',
  exp: 9999999999,
} as any;

const CORS = { 'Access-Control-Allow-Origin': '*' };

function postRequest(body: unknown): Request {
  return new Request('https://gateway.test/api/feed/posts', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('@SEC P1: POST /api/feed/posts — INSERT реально выполняется', () => {
  it('валидный пост → 201, INSERT INTO feed_posts вызван, author_id из JWT', async () => {
    const sqls: string[] = [];
    const db = makeDb(sqls, { id: 'new-id', author_id: AUTH.sub, title: 'Test' });
    const res = await handleCreateFeedPost(
      postRequest({ type: 'post', title: 'Test', text: 'body' }),
      { FEED_DB: db } as any,
      AUTH,
      CORS
    );

    expect(res.status).toBe(201);
    expect(sqls.some(s => s.includes('INSERT INTO feed_posts'))).toBe(true);

    // author_id обязан приходить из auth.sub (IDOR-фикс), не из body
    const bindArgs = (db.prepare as ReturnType<typeof vi.fn>).mock.calls;
    const insertCall = bindArgs.find((c: unknown[]) => typeof c[0] === 'string' && /INSERT INTO feed_posts/i.test(c[0] as string));
    expect(insertCall).toBeTruthy();
  });

  it('title > 500 символов → 400, INSERT НЕ вызывается', async () => {
    const sqls: string[] = [];
    const db = makeDb(sqls, null);
    const res = await handleCreateFeedPost(
      postRequest({ type: 'post', title: 'x'.repeat(501) }),
      { FEED_DB: db } as any,
      AUTH,
      CORS
    );
    expect(res.status).toBe(400);
    expect(sqls).toHaveLength(0);
  });

  it('body > 1MB → 413 (chunked-safe проверка)', async () => {
    const sqls: string[] = [];
    const db = makeDb(sqls, null);
    const res = await handleCreateFeedPost(
      postRequest({ type: 'post', title: 'ok', text: 'x'.repeat(1_000_001) }),
      { FEED_DB: db } as any,
      AUTH,
      CORS
    );
    expect(res.status).toBe(413);
  });

  it('невалидный type → 400 (enum guard)', async () => {
    const sqls: string[] = [];
    const db = makeDb(sqls, null);
    const res = await handleCreateFeedPost(
      postRequest({ type: 'newsletter', title: 'x' }),
      { FEED_DB: db } as any,
      AUTH,
      CORS
    );
    expect(res.status).toBe(400);
  });
});
