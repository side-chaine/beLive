import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const refreshSession = vi.fn();
vi.mock('../auth.service', async () => {
  const { useUserProfileStore } = await import('../../stores/user-profile.store');
  return {
    authService: {
      refreshSession: (...a: unknown[]) => refreshSession(...a),
      applySession: async (s: { jwt: string }) => {
        const cur = useUserProfileStore.getState().currentUser;
        useUserProfileStore.setState({ currentUser: { ...cur!, authToken: s.jwt } });
      },
    },
  };
});

const updateTrackField = vi.fn().mockResolvedValue(undefined);
const getMvsepResumableTracks = vi.fn().mockResolvedValue([]);
vi.mock('../idb.service', async (orig) => ({
  ...(await orig<typeof import('../idb.service')>()),
  updateTrackField: (...a: unknown[]) => updateTrackField(...a),
  getMvsepResumableTracks: (...a: unknown[]) => getMvsepResumableTracks(...a),
}));

const completeMvsepTrack = vi.fn().mockResolvedValue(undefined);
vi.mock('../upload.service', async (orig) => ({
  ...(await orig<typeof import('../upload.service')>()),
  completeMvsepTrack: (...a: unknown[]) => completeMvsepTrack(...a),
}));

import { mvsepPollingService } from '../mvsep-polling.service';
import { useUserProfileStore } from '../../stores/user-profile.store';
import { useMvsepKeyStore } from '../../stores/mvsep-key.store';
import { useMvsepStore } from '../../stores/mvsep.store';

const NOW = new Date('2026-11-06T12:00:00Z').getTime();
const HASH = 'hash-1';
const TRACK = 42;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const worker401 = () => json({ status: 'error', errors: ['INVALID_TOKEN'] }, 401);

let fetchMock: ReturnType<typeof vi.fn>;
const storeJob = (h = HASH) => useMvsepStore.getState().activeJobs.get(h);
const failedWrites = () =>
  updateTrackField.mock.calls.filter((c) => (c[1] as { mvsepStatus?: string } | undefined)?.mvsepStatus === 'failed');

function setToken(token: string) {
  useUserProfileStore.setState({
    currentUser: { id: 'u1', name: 'T', createdAt: '', lastSeenAt: '', isGuest: false, authToken: token },
  });
}

/** `window.dispatchEvent` в setup.ts подменён заглушкой — шлём в обход. */
function fireOnline() {
  document.defaultView!.dispatchEvent(new Event('online'));
}

async function startAndTick(h = HASH) {
  useMvsepStore.getState().addJob(h, TRACK, 'song.mp3', 'user');
  mvsepPollingService.startPolling(h, TRACK, { firstDelayMs: 0 });
  await vi.advanceTimersByTimeAsync(1);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  refreshSession.mockReset();
  updateTrackField.mockClear();
  getMvsepResumableTracks.mockReset().mockResolvedValue([]);
  completeMvsepTrack.mockClear().mockResolvedValue(undefined);
  setToken('tok-1');
  useMvsepKeyStore.getState().clearApiKey();
  useMvsepStore.setState({ activeJobs: new Map() });
});

afterEach(() => {
  for (const h of [HASH, 'h-a', 'h-b', 'h-old']) {mvsepPollingService.stopPolling(h);}
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ─── I5: сбои транспорта/авторизации = пауза, не failed ──────

describe('R2: пауза вместо failed (I5)', () => {
  it('сетевая ошибка → paused, трек не помечен failed, джоба в сторе', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    await startAndTick();

    expect(mvsepPollingService.isPaused(HASH)).toBe(true);
    expect(failedWrites()).toHaveLength(0);
    expect(storeJob()).toBeDefined();
    expect(storeJob()!.status).not.toBe('failed');
  });

  it('много сбоев подряд не убивают джобу (раньше 3 → failed)', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    await startAndTick();
    await vi.advanceTimersByTimeAsync(10 * 60 * 1000); // 10 мин бэкоффа

    expect(fetchMock.mock.calls.length).toBeGreaterThan(3);
    expect(failedWrites()).toHaveLength(0);
    expect(mvsepPollingService.isPaused(HASH)).toBe(true);
  });

  it('событие online будит поллер без ожидания бэкоффа и снимает паузу', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await startAndTick();
    expect(mvsepPollingService.isPaused(HASH)).toBe(true);

    fetchMock.mockImplementation(async () => json({ status: 'processing' }));
    const before = fetchMock.mock.calls.length;
    fireOnline();
    await vi.advanceTimersByTimeAsync(1);

    expect(fetchMock.mock.calls.length).toBe(before + 1);
    expect(mvsepPollingService.isPaused(HASH)).toBe(false);
    expect(storeJob()!.status).toBe('processing');
  });

  it('401 и refresh не помог → paused + auth_required, не failed', async () => {
    refreshSession.mockResolvedValue(null);
    fetchMock.mockImplementation(async () => worker401());
    await startAndTick();

    expect(mvsepPollingService.isPaused(HASH)).toBe(true);
    expect(storeJob()!.status).toBe('auth_required');
    expect(failedWrites()).toHaveLength(0);
  });

  it('401 → refresh вернул сессию → поллинг идёт дальше без паузы', async () => {
    refreshSession.mockResolvedValueOnce({ jwt: 'tok-2' });
    fetchMock
      .mockResolvedValueOnce(worker401())
      .mockImplementation(async () => json({ status: 'processing' }));
    await startAndTick();

    expect(mvsepPollingService.isPaused(HASH)).toBe(false);
    expect(failedWrites()).toHaveLength(0);
  });

  it('пауза при скачивании (401 на /download, нет сессии) — не failed', async () => {
    refreshSession.mockResolvedValue(null);
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('/status')) {
        return json({
          status: 'done',
          data: { files: [{ download: 'S_instrum_[mvsep.com].mp3', url: 'https://mvsep.com/1' }] },
        });
      }
      return worker401();
    });
    // /status тоже вернёт 401? нет — только /download; но refresh=null → AUTH_REQUIRED
    await startAndTick();

    expect(failedWrites()).toHaveLength(0);
    expect(completeMvsepTrack).not.toHaveBeenCalled();
    expect(mvsepPollingService.isPaused(HASH)).toBe(true);
  });
});

// ─── I6: статусы на уровне поллера ───────────────────────────

describe('R3: промежуточные статусы MVSEP (I6)', () => {
  it.each(['distributing', 'merging', 'foo'])('%s → джоба продолжает жить', async (st) => {
    fetchMock.mockImplementation(async () => json({ status: st }));
    await startAndTick();

    expect(failedWrites()).toHaveLength(0);
    expect(mvsepPollingService.isPaused(HASH)).toBe(false);
    expect(storeJob()!.status).toBe('processing');
  });

  it('done → скачали и импортировали, джоба снята', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('/status')) {
        return json({
          status: 'done',
          data: {
            files: [
              { download: 'S_instrum_[mvsep.com].mp3', url: 'https://mvsep.com/1' },
              { download: 'S_vocals_[mvsep.com].mp3', url: 'https://mvsep.com/2' },
            ],
          },
        });
      }
      return new Response('x', { status: 200 });
    });
    await startAndTick();
    await vi.advanceTimersByTimeAsync(1);

    expect(completeMvsepTrack).toHaveBeenCalledTimes(1);
    expect(completeMvsepTrack.mock.calls[0][0]).toBe(TRACK);
    expect([...(completeMvsepTrack.mock.calls[0][1] as Map<string, Blob>).keys()].sort()).toEqual([
      'instrumental', 'vocals',
    ]);
    expect(storeJob()).toBeUndefined();
  });

  it('failed от MVSEP → IDB failed + код', async () => {
    fetchMock.mockImplementation(async () => json({ status: 'failed' }));
    await startAndTick();

    expect(updateTrackField).toHaveBeenCalledWith(TRACK, {
      mvsepStatus: 'failed', mvsepErrorCode: 'MVSEP_FAILED',
    });
    expect(storeJob()).toBeUndefined();
  });

  it('not_found: два раза подряд терпим, третий — failed', async () => {
    fetchMock.mockImplementation(async () => json({ status: 'not_found' }));
    await startAndTick();
    expect(failedWrites()).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(failedWrites()).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(10_000);
    await vi.advanceTimersByTimeAsync(5);

    expect(updateTrackField).toHaveBeenCalledWith(TRACK, {
      mvsepStatus: 'failed', mvsepErrorCode: 'MVSEP_NOT_FOUND',
    });
  });

  it('not_found сбрасывается успешным опросом', async () => {
    fetchMock
      .mockResolvedValueOnce(json({ status: 'not_found' }))
      .mockResolvedValueOnce(json({ status: 'not_found' }))
      .mockResolvedValueOnce(json({ status: 'processing' }))
      .mockImplementation(async () => json({ status: 'not_found' }));
    await startAndTick();
    await vi.advanceTimersByTimeAsync(40_000);

    expect(failedWrites()).toHaveLength(0);
  });

  it('нет инструментала в ответе → failed MVSEP_NO_INSTRUMENTAL (политика D1 — после замера)', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('/status')) {
        return json({
          status: 'done',
          data: { files: [{ download: 'S_vocals_[mvsep.com].mp3', url: 'https://mvsep.com/2' }] },
        });
      }
      return new Response('x', { status: 200 });
    });
    await startAndTick();
    await vi.advanceTimersByTimeAsync(1);

    expect(updateTrackField).toHaveBeenCalledWith(TRACK, {
      mvsepStatus: 'failed', mvsepErrorCode: 'MVSEP_NO_INSTRUMENTAL',
    });
  });

  it('окно ожидания вышло → timeout, а не failed', async () => {
    useMvsepStore.getState().addJob(HASH, TRACK, 's.mp3', 'user');
    mvsepPollingService.startPolling(HASH, TRACK, {
      startTime: NOW - 21 * 60 * 1000,
      firstDelayMs: 0,
    });
    await vi.advanceTimersByTimeAsync(1);

    expect(updateTrackField).toHaveBeenCalledWith(TRACK, { mvsepStatus: 'timeout' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// ─── R4/R5: resume ───────────────────────────────────────────

describe('resumeOrphanedJobs (R4, R5)', () => {
  const iso = (msAgo: number) => new Date(NOW - msAgo).toISOString();

  it('processing с пустым токеном: заводит джобу из IDB, сам берёт токен через refresh', async () => {
    setToken('');
    refreshSession.mockResolvedValue({ jwt: 'fresh' });
    fetchMock.mockImplementation(async () => json({ status: 'processing' }));
    getMvsepResumableTracks.mockResolvedValue([
      {
        id: 7, title: 'Song', mvsepStatus: 'processing', mvsepHash: 'h-a',
        mvsepSubmittedAt: iso(5 * 60 * 1000), mvsepKeySource: 'user',
      },
    ]);

    await mvsepPollingService.resumeOrphanedJobs();

    const job = storeJob('h-a');
    expect(job).toMatchObject({ trackId: 7, fileName: 'Song', keySource: 'user' });
    expect(job!.submittedAt).toBe(NOW - 5 * 60 * 1000);

    await vi.advanceTimersByTimeAsync(3_000);
    expect(fetchMock).toHaveBeenCalled();
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer fresh');
    expect(failedWrites()).toHaveLength(0);
  });

  it('keySource в IDB нет → берём по наличию ключа в key-store', async () => {
    useMvsepKeyStore.getState().setApiKey('k');
    getMvsepResumableTracks.mockResolvedValue([
      { id: 7, title: 'S', mvsepStatus: 'processing', mvsepHash: 'h-a', mvsepSubmittedAt: iso(1000) },
    ]);
    await mvsepPollingService.resumeOrphanedJobs();
    expect(storeJob('h-a')!.keySource).toBe('user');
  });

  it('timeout в окне 24 ч → снова processing и поллим (результат мог доехать)', async () => {
    fetchMock.mockImplementation(async () => json({ status: 'processing' }));
    getMvsepResumableTracks.mockResolvedValue([
      { id: 8, title: 'S', mvsepStatus: 'timeout', mvsepHash: 'h-b', mvsepSubmittedAt: iso(2 * 3600 * 1000) },
    ]);
    await mvsepPollingService.resumeOrphanedJobs();

    expect(updateTrackField).toHaveBeenCalledWith(8, { mvsepStatus: 'processing' });
    expect(storeJob('h-b')).toBeDefined();
  });

  it('timeout старше 24 ч → остаётся timeout, не поллим', async () => {
    getMvsepResumableTracks.mockResolvedValue([
      { id: 9, title: 'S', mvsepStatus: 'timeout', mvsepHash: 'h-old', mvsepSubmittedAt: iso(30 * 3600 * 1000) },
    ]);
    await mvsepPollingService.resumeOrphanedJobs();

    expect(storeJob('h-old')).toBeUndefined();
    expect(updateTrackField).not.toHaveBeenCalledWith(9, { mvsepStatus: 'processing' });
  });

  it('processing старше 24 ч → timeout', async () => {
    getMvsepResumableTracks.mockResolvedValue([
      { id: 9, title: 'S', mvsepStatus: 'processing', mvsepHash: 'h-old', mvsepSubmittedAt: iso(30 * 3600 * 1000) },
    ]);
    await mvsepPollingService.resumeOrphanedJobs();

    expect(updateTrackField).toHaveBeenCalledWith(9, { mvsepStatus: 'timeout' });
    expect(storeJob('h-old')).toBeUndefined();
  });

  it('нет hash → failed NO_HASH', async () => {
    getMvsepResumableTracks.mockResolvedValue([
      { id: 10, title: 'S', mvsepStatus: 'processing', mvsepHash: null, mvsepSubmittedAt: iso(1000) },
    ]);
    await mvsepPollingService.resumeOrphanedJobs();
    expect(updateTrackField).toHaveBeenCalledWith(10, { mvsepStatus: 'failed', mvsepErrorCode: 'NO_HASH' });
  });

  it('повторный resume не дублирует уже опрашиваемую джобу', async () => {
    fetchMock.mockImplementation(async () => json({ status: 'processing' }));
    getMvsepResumableTracks.mockResolvedValue([
      { id: 7, title: 'S', mvsepStatus: 'processing', mvsepHash: 'h-a', mvsepSubmittedAt: iso(1000) },
    ]);
    await mvsepPollingService.resumeOrphanedJobs();
    const first = storeJob('h-a');
    await mvsepPollingService.resumeOrphanedJobs();
    expect(storeJob('h-a')).toBe(first);
  });
});
