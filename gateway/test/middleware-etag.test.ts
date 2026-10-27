// @SEC(007-audit): P1 регресс — checkCommentETag обязан парсить If-None-Match.
// parseCommentETag существовал в helpers.ts, но НЕ был импортирован в middleware.ts →
// любой conditional GET комментариев падал с ReferenceError → 500 на публичном роуте.
import { describe, it, expect, vi } from 'vitest';

import { checkCommentETag } from '../src/middleware';
import { generateCommentETag, parseCommentETag } from '../src/helpers';

function makeEnv(version: string | null): any {
  return {
    FEED_KV: { get: vi.fn().mockResolvedValue(version), put: vi.fn() },
    FEED_DB: {},
  };
}

function request(headers: Record<string, string> = {}): Request {
  return new Request('https://gateway.test/api/feed/posts/p1/comments', { headers });
}

describe('@SEC P1: middleware ETag — If-None-Match не валит запрос', () => {
  it('If-None-Match с валидным ETag и той же версией → match=true (304)', async () => {
    const etag = generateCommentETag('p1', 'v42');
    const res = await checkCommentETag(request({ 'If-None-Match': etag }), makeEnv('v42'), 'p1');
    expect(res.match).toBe(true);
  });

  it('If-None-Match с чужим/мусорным форматом → match=false, без throw (РЕГРЕСС: был ReferenceError)', async () => {
    const res = await checkCommentETag(request({ 'If-None-Match': 'garbage-not-etag' }), makeEnv('v42'), 'p1');
    expect(res.match).toBe(false);
    expect(res.etag).toBe(generateCommentETag('p1', 'v42'));
  });

  it('If-None-Match другого поста → match=false (ETag не пересекаются)', async () => {
    const etag = generateCommentETag('pOTHER', 'v42');
    const res = await checkCommentETag(request({ 'If-None-Match': etag }), makeEnv('v42'), 'p1');
    expect(res.match).toBe(false);
  });

  it('без If-None-Match → отдаёт текущий ETag', async () => {
    const res = await checkCommentETag(request(), makeEnv('v7'), 'p1');
    expect(res.match).toBe(false);
    expect(res.etag).toBe(generateCommentETag('p1', 'v7'));
  });

  it('parseCommentETag: roundtrip generate→parse', () => {
    const parsed = parseCommentETag(generateCommentETag('abc', '12345'));
    expect(parsed).toEqual({ postId: 'abc', version: '12345' });
    expect(parseCommentETag('nonsense')).toBeNull();
  });
});
