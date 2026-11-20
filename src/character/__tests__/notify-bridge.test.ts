/**
 * A1e — «почта» не душит собственный сайт.
 *
 * Поллер ходил за статическим INBOX.md раз в 1.5 секунды: 40 запросов в минуту.
 * Прод отдаёт 403, браузер пишет его в консоль при каждом запросе. Тест держит
 * три свойства: прод не дёргает файл вовсе, в dev снижена частота, запрос имеет
 * таймаут.
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

  it('в проде (DEV=false) не делает ни одного запроса', async () => {
    // stub ДО импорта: если проверка DEV переедет на уровень модуля, тест всё равно укусит.
    vi.stubEnv('DEV', false);
    vi.resetModules();
    try {
      const { startNotifyBridge: prodStart } = await import('../notify-bridge');
      const stop = prodStart();
      await vi.advanceTimersByTimeAsync(60_000);
      expect(fetch).not.toHaveBeenCalled();
      stop();
    } finally {
      vi.unstubAllEnvs();
      vi.resetModules();
    }
  });
});
