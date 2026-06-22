import { describe, it, expect, vi } from 'vitest';

// Mock the roles module BEFORE importing the handler
vi.mock('../src/handlers/roles', () => ({
  getUserRole: vi.fn().mockResolvedValue('founder'),
}));

import { handleDeleteFeedPost } from '../src/handlers/feed';

describe('TC-107-03: DELETE batch atomicity', () => {
  it('batch() is called with [INSERT mod_log, UPDATE post] order for founder', async () => {
    const batchSpy = vi.fn().mockResolvedValue([{ results: [] }, { results: [] }]);
    const runMock = vi.fn().mockResolvedValue({ results: [] });

    // Collect SQLs from prepare calls for later batch inspection
    const batchSqls: string[] = [];
    let selectCount = 0;
    const prepareMock = (sql: string) => {
      if (sql.includes('SELECT') && sql.includes('feed_posts')) {
        // First prepare: SELECT the post
        selectCount++;
        return {
          bind: () => ({
            first: vi.fn().mockResolvedValue({
              id: 'post-123',
              author_id: 'google:other_user', // NOT the caller — triggers founder path
              status: 'published',
            }),
          }),
        };
      }
      // Capture SQL for batch assertion and return bindable statement
      batchSqls.push(sql);
      return { bind: () => ({ run: runMock, first: vi.fn().mockResolvedValue(null) }) };
    };

    const db = { prepare: prepareMock, batch: batchSpy } as any;
    const auth = {
      sub: 'google:founder1',
      provider: 'google',
      providerSub: 'founder1',
      roleHint: 'user',
      exp: 9999999999,
    };

    const corsHeaders = { 'Access-Control-Allow-Origin': '*' };

    await handleDeleteFeedPost(
      { FEED_DB: db } as any,
      auth,
      'post-123',
      corsHeaders,
      { reason: 'spam' }
    );

    expect(batchSpy).toHaveBeenCalledOnce();
    const stmts = batchSpy.mock.calls[0][0];
    expect(stmts).toHaveLength(2);
    // batchSqls[0] = INSERT mod_log, batchSqls[1] = UPDATE post
    expect(batchSqls[0]).toMatch(/INSERT INTO feed_moderation_log/);
    expect(batchSqls[1]).toMatch(/UPDATE feed_posts/);
  });

  it('self-delete returns 200 self_delete and does NOT call batch()', async () => {
    const batchSpy = vi.fn();
    const runMock = vi.fn().mockResolvedValue({ results: [] });

    const prepareMock = (sql: string) => {
      // Self-delete: author_id matches auth.sub
      if (sql.includes('SELECT') && sql.includes('feed_posts')) {
        return {
          bind: () => ({
            first: vi.fn().mockResolvedValue({
              id: 'post-123',
              author_id: 'google:self_user', // matches auth.sub
              status: 'published',
            }),
          }),
        };
      }
      return { bind: () => ({ run: runMock, first: vi.fn().mockResolvedValue(null) }) };
    };

    const db = { prepare: prepareMock, batch: batchSpy } as any;
    const auth = {
      sub: 'google:self_user',
      provider: 'google',
      providerSub: 'self_user',
      roleHint: 'user',
      exp: 9999999999,
    };

    const corsHeaders = { 'Access-Control-Allow-Origin': '*' };

    const response = await handleDeleteFeedPost(
      { FEED_DB: db } as any,
      auth,
      'post-123',
      corsHeaders
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.action).toBe('self_delete');
    // Self-delete must NOT use batch() — only simple UPDATE
    expect(batchSpy).not.toHaveBeenCalled();
  });

  it('already-deleted post returns 410', async () => {
    const prepareMock = (sql: string) => {
      if (sql.includes('SELECT')) {
        return {
          bind: () => ({
            first: vi.fn().mockResolvedValue({
              id: 'post-123',
              author_id: 'google:some_user',
              status: 'deleted', // already deleted
            }),
          }),
        };
      }
      return { bind: () => ({ run: vi.fn() }) };
    };

    const db = { prepare: prepareMock, batch: vi.fn() } as any;
    const auth = {
      sub: 'google:some_user',
      provider: 'google',
      providerSub: 'some_user',
      roleHint: 'user',
      exp: 9999999999,
    };

    const corsHeaders = { 'Access-Control-Allow-Origin': '*' };

    const response = await handleDeleteFeedPost(
      { FEED_DB: db } as any,
      auth,
      'post-123',
      corsHeaders
    );

    expect(response.status).toBe(410);
    const body = await response.json();
    expect(body.error).toBe('Post already deleted');
  });

  it('non-owner non-founder returns 403', async () => {
    // Mock getUserRole to return 'user' (not founder)
    const { getUserRole } = await import('../src/handlers/roles');
    vi.mocked(getUserRole).mockResolvedValue('user');

    const prepareMock = (sql: string) => {
      if (sql.includes('SELECT') && sql.includes('feed_posts')) {
        return {
          bind: () => ({
            first: vi.fn().mockResolvedValue({
              id: 'post-123',
              author_id: 'google:other_user',
              status: 'published',
            }),
          }),
        };
      }
      return { bind: () => ({ run: vi.fn(), first: vi.fn().mockResolvedValue(null) }) };
    };

    const db = { prepare: prepareMock, batch: vi.fn() } as any;
    const auth = {
      sub: 'google:stranger',
      provider: 'google',
      providerSub: 'stranger',
      roleHint: 'user',
      exp: 9999999999,
    };

    const corsHeaders = { 'Access-Control-Allow-Origin': '*' };

    const response = await handleDeleteFeedPost(
      { FEED_DB: db } as any,
      auth,
      'post-123',
      corsHeaders
    );

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBe('Forbidden');
  });
});
