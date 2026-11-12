/**
 * A1e — «почта» не душит собственный сайт.
 *
 * Поллер ходил за статическим INBOX.md раз в 1.5 секунды: 240 запросов в минуту.
 * На проде Cloudflare отвечал ERR_CONNECTION_CLOSED и рвал HTTP/2, а браузер
 * держит к хосту шесть соединений — остальные запросы приложения вставали в
 * очередь. Тест держит два свойства: частота и один запрос в полёте.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../notify-emit', () => ({ emitReportArrived: vi.fn() }));

const { startNotifyBridge } = await import('../notify-bridge');

describe('notify-bridge · частота опроса', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, text: async () => 'inbox' })));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('за пять секунд — один запрос, а не четыре', async () => {
    const stop = startNotifyBridge();
    const fetchMock = vi.mocked(fetch);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(30_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    stop();
  });

  it('запрос уходит с таймаутом — зависание не копится', async () => {
    const stop = startNotifyBridge();
    const init = vi.mocked(fetch).mock.calls[0][1] as RequestInit;
    expect(init.signal).toBeInstanceOf(AbortSignal);
    stop();
  });
});
