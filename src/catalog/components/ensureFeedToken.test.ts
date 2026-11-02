// Дедупликация продления токена.
//
// После перезагрузки страница делает несколько запросов сразу, и каждый
// звал /auth/refresh. При ротации refresh-токена параллельные продления
// гасят друг друга: первое инвалидирует старый refresh, остальные получают
// 401 и разлогинивают — хотя сессия была жива. Здесь фиксируется, что на
// пять одновременных вызовов приходится ровно один refresh.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
  refreshSession: vi.fn(),
  applySession: vi.fn(),
  state: { currentUser: null as { authToken?: string } | null },
}));

vi.mock('../../services/auth.service', () => ({
  authService: {
    refreshSession: h.refreshSession,
    applySession: h.applySession,
  },
}));

vi.mock('../../stores/user-profile.store', () => ({
  useUserProfileStore: {
    getState: () => h.state,
    subscribe: () => () => {},
  },
}));

import { ensureFeedToken } from './CatalogContent';

beforeEach(() => {
  h.refreshSession.mockReset();
  h.applySession.mockReset();
  h.state = { currentUser: null };
});

describe('ensureFeedToken', () => {
  it('без токена идёт в /auth/refresh', async () => {
    h.refreshSession.mockResolvedValue({ accessToken: 'T1' });
    h.applySession.mockImplementation(async () => { h.state = { currentUser: { authToken: 'T1' } }; });

    const token = await ensureFeedToken();

    expect(token).toBe('T1');
    expect(h.refreshSession).toHaveBeenCalledTimes(1);
  });

  it('живой токен в сторе не тратит refresh', async () => {
    h.state = { currentUser: { authToken: 'LIVE' } };

    const token = await ensureFeedToken();

    expect(token).toBe('LIVE');
    expect(h.refreshSession).not.toHaveBeenCalled();
  });

  it('пять параллельных вызовов → один refresh (single-flight)', async () => {
    h.refreshSession.mockImplementation(
      () => new Promise((res) => setTimeout(() => res({ accessToken: 'T1' }), 20)),
    );
    h.applySession.mockImplementation(async () => { h.state = { currentUser: { authToken: 'T1' } }; });

    const tokens = await Promise.all([
      ensureFeedToken(true),
      ensureFeedToken(true),
      ensureFeedToken(true),
      ensureFeedToken(true),
      ensureFeedToken(true),
    ]);

    expect(h.refreshSession).toHaveBeenCalledTimes(1);
    expect(tokens).toEqual(['T1', 'T1', 'T1', 'T1', 'T1']);
  });

  it('после завершения следующий force снова продлевает (inflight снят)', async () => {
    h.refreshSession.mockResolvedValue({ accessToken: 'T1' });
    h.applySession.mockImplementation(async () => { h.state = { currentUser: { authToken: 'T1' } }; });

    await ensureFeedToken(true);
    h.refreshSession.mockResolvedValue({ accessToken: 'T2' });
    h.applySession.mockImplementation(async () => { h.state = { currentUser: { authToken: 'T2' } }; });
    const second = await ensureFeedToken(true);

    expect(h.refreshSession).toHaveBeenCalledTimes(2);
    expect(second).toBe('T2');
  });

  it('refresh не дал сессии → null, и следующий вызов пробует снова', async () => {
    h.refreshSession.mockResolvedValue(null);

    expect(await ensureFeedToken(true)).toBeNull();
    expect(await ensureFeedToken(true)).toBeNull();
    expect(h.refreshSession).toHaveBeenCalledTimes(2);
  });
});
