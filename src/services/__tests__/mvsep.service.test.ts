import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// refresh сессии мокаем: настоящий ходит на auth.mybelive.com
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

import {
  mapMvsepStatus,
  classifyMvsepFiles,
  pollStatus,
  pollStatusDetailed,
  readQueue,
  submitTrack,
  downloadStems,
  MvsepError,
} from '../mvsep.service';
import { useUserProfileStore } from '../../stores/user-profile.store';
import { useMvsepKeyStore } from '../../stores/mvsep-key.store';
import { useMvsepStore } from '../../stores/mvsep.store';

function setToken(token: string) {
  useUserProfileStore.setState({
    currentUser: {
      id: 'u1', name: 'Test', createdAt: '', lastSeenAt: '', isGuest: false, authToken: token,
    },
  });
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const workerAuth401 = (code: 'AUTH_REQUIRED' | 'INVALID_TOKEN' = 'INVALID_TOKEN') =>
  json({ status: 'error', errors: [code] }, 401);

let fetchMock: ReturnType<typeof vi.fn>;
const calls = () => fetchMock.mock.calls.map((c) => String(c[0]));

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  refreshSession.mockReset();
  setToken('tok-1');
  useMvsepKeyStore.getState().clearApiKey();
  useMvsepStore.setState({ activeJobs: new Map() });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ─── I6: таблица статусов (D2/R3) ────────────────────────────

describe('mapMvsepStatus — неизвестный статус не убивает джобу (I6)', () => {
  it.each([
    ['waiting', 'waiting'],
    ['processing', 'processing'],
    ['distributing', 'processing'],
    ['merging', 'processing'],
    ['done', 'done'],
    ['failed', 'failed'],
    ['not_found', 'not_found'],
    ['foo', 'processing'],
    ['', 'processing'],
    [undefined, 'processing'],
    [null, 'processing'],
  ])('%s → %s', (raw, expected) => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(mapMvsepStatus(raw)).toBe(expected);
  });

  it('никогда не возвращает error', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    for (const raw of ['x', 'error', 42, {}, [], 'DONE']) {
      expect(mapMvsepStatus(raw)).not.toBe('error');
    }
  });
});

// ─── D2/R2: pollStatus ───────────────────────────────────────

describe('pollStatus', () => {
  it('distributing приходит как processing', async () => {
    fetchMock.mockResolvedValueOnce(json({ status: 'distributing' }));
    await expect(pollStatus('h1')).resolves.toBe('processing');
  });

  it('5xx — бросок, а не статус error', async () => {
    fetchMock.mockResolvedValueOnce(json({}, 502));
    await expect(pollStatus('h1')).rejects.toMatchObject({ code: 'MVSEP_STATUS_HTTP_502' });
  });

  it('сетевой сбой пробрасывается как есть', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(pollStatus('h1')).rejects.toThrow('Failed to fetch');
  });
});

// ─── Очередь MVSEP: живой ответ 10.11.2026 ───────────────────
//
// Реальный ответ /status:
// {"success":true,"status":"waiting","data":{"queue_count":432,"current_order":26,"eta_seconds":63}}
// eta_seconds намеренно НЕ читаем: он не убывал (63 → 45 → 11 при позиции 26 → 18 → 3).

describe('readQueue — только честные поля', () => {
  it('живой ответ: позиция и размер очереди', () => {
    expect(readQueue({ queue_count: 432, current_order: 26, eta_seconds: 63 }))
      .toEqual({ pos: 26, total: 432 });
  });

  it('eta_seconds не попадает в результат', () => {
    const q = readQueue({ queue_count: 10, current_order: 3, eta_seconds: 5 });
    expect(q).toEqual({ pos: 3, total: 10 });
    expect(q).not.toHaveProperty('eta');
  });

  it.each([
    ['нет data', undefined],
    ['не объект', 'waiting'],
    ['нет полей', { foo: 1 }],
    ['позиция строкой', { queue_count: 10, current_order: '3' }],
    ['NaN', { queue_count: NaN, current_order: 3 }],
    ['Infinity', { queue_count: 10, current_order: Infinity }],
    ['нулевая позиция', { queue_count: 10, current_order: 0 }],
    ['нулевая очередь', { queue_count: 0, current_order: 3 }],
    ['отрицательная позиция', { queue_count: 10, current_order: -2 }],
  ])('мусор → undefined: %s', (_label, data) => {
    expect(readQueue(data)).toBeUndefined();
  });
});

describe('pollStatusDetailed', () => {
  it('отдаёт статус и очередь одним ответом', async () => {
    fetchMock.mockResolvedValueOnce(
      json({ success: true, status: 'waiting', data: { queue_count: 446, current_order: 18, eta_seconds: 45 } }),
    );
    await expect(pollStatusDetailed('h1')).resolves.toEqual({
      status: 'waiting',
      queue: { pos: 18, total: 446 },
    });
  });

  it('без полей очереди queue отсутствует, а не равно нулям', async () => {
    fetchMock.mockResolvedValueOnce(json({ status: 'processing' }));
    const r = await pollStatusDetailed('h1');
    expect(r.status).toBe('processing');
    expect(r.queue).toBeUndefined();
  });

  it('pollStatus остаётся совместимым: только статус', async () => {
    fetchMock.mockResolvedValueOnce(json({ status: 'done', data: { files: [] } }));
    await expect(pollStatus('h1')).resolves.toBe('done');
  });
});

// ─── D3/D8: авторизация ──────────────────────────────────────

describe('авторизация воркера', () => {
  it('истёкший JWT: один refresh и повтор — джоба выживает', async () => {
    refreshSession.mockResolvedValueOnce({ jwt: 'tok-2' });
    fetchMock
      .mockResolvedValueOnce(workerAuth401())
      .mockResolvedValueOnce(json({ status: 'processing' }));

    await expect(pollStatus('h1')).resolves.toBe('processing');
    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe('Bearer tok-2');
  });

  it('refresh не помог — AUTH_REQUIRED (бросок), не «error»', async () => {
    refreshSession.mockResolvedValue(null);
    fetchMock.mockImplementation(async () => workerAuth401());
    await expect(pollStatus('h1')).rejects.toMatchObject({ code: 'AUTH_REQUIRED' });
  });

  it('пустой токен: сначала refresh, запрос уходит уже с токеном', async () => {
    setToken('');
    refreshSession.mockResolvedValueOnce({ jwt: 'fresh' });
    fetchMock.mockResolvedValueOnce(json({ status: 'waiting' }));

    await expect(pollStatus('h1')).resolves.toBe('waiting');
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer fresh');
  });

  it('пустой токен и нет сессии — AUTH_REQUIRED без запроса к воркеру', async () => {
    setToken('');
    refreshSession.mockResolvedValueOnce(null);
    await expect(pollStatus('h1')).rejects.toMatchObject({ code: 'AUTH_REQUIRED' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('D8: 401 от MVSEP с пользовательским ключом = MVSEP_KEY_INVALID, а не «войдите»', async () => {
    useMvsepKeyStore.getState().setApiKey('user-key');
    fetchMock.mockResolvedValueOnce(json({ success: false, message: 'Unauthorized' }, 401));

    const err = await submitTrack(new ArrayBuffer(8), 'a.mp3').catch((e) => e);
    expect(err).toBeInstanceOf(MvsepError);
    expect(err.code).toBe('MVSEP_KEY_INVALID');
    expect(refreshSession).not.toHaveBeenCalled(); // сессия тут ни при чём
  });

  it('D8: 401 от нашего воркера (INVALID_TOKEN) в submit — refresh, а не «ключ невалиден»', async () => {
    useMvsepKeyStore.getState().setApiKey('user-key');
    refreshSession.mockResolvedValueOnce({ jwt: 'tok-2' });
    fetchMock
      .mockResolvedValueOnce(workerAuth401('INVALID_TOKEN'))
      .mockResolvedValueOnce(json({ status: 'ok', data: { hash: 'abc' }, quota: { keySource: 'user' } }));

    await expect(submitTrack(new ArrayBuffer(8), 'a.mp3')).resolves.toEqual({
      hash: 'abc', keySource: 'user',
    });
    expect(refreshSession).toHaveBeenCalledTimes(1);
  });

  it('submit шлёт ключ из отдельного стора в X-Mvsep-User-Key', async () => {
    useMvsepKeyStore.getState().setApiKey('  my-key  ');
    fetchMock.mockResolvedValueOnce(json({ status: 'ok', data: { hash: 'h' } }));
    await submitTrack(new ArrayBuffer(8), 'a.mp3');
    expect(fetchMock.mock.calls[0][1].headers['X-Mvsep-User-Key']).toBe('my-key');
  });

  it('429 CONCURRENT_LIMIT и лимит различаются', async () => {
    fetchMock.mockResolvedValueOnce(json({ code: 'CONCURRENT_LIMIT' }, 429));
    await expect(submitTrack(new ArrayBuffer(8), 'a.mp3')).rejects.toMatchObject({ code: 'CONCURRENT_LIMIT' });
    fetchMock.mockResolvedValueOnce(json({ errors: ['Daily limit reached'] }, 429));
    await expect(submitTrack(new ArrayBuffer(8), 'a.mp3')).rejects.toMatchObject({ code: 'MVSEP_LIMIT_REACHED' });
  });
});

// ─── Классификация стемов ────────────────────────────────────

// Живой `/get` (status=done, sep_type 63), присланный 707. `files[].download` — как есть.
const LIVE_HASH = '20261106195927-b4cdf88e23-in-the-end.mp3';
const LIVE_STEM_NAMES = ['bass', 'drums', 'other', 'vocals', 'guitar', 'piano', 'instrum'].map(
  (s) => `in-the-end_bs6stem_mt_0_${s}.mp3`,
);
const LIVE_FILES = ['Bass', 'Drums', 'Other', 'Vocals', 'Guitar', 'Piano', 'Instrum'].map((type, i) => ({
  type,
  url: `https://de.mvsep.com/storage/processed/b4/20261106195927-b4cdf88e23-${LIVE_STEM_NAMES[i]}`,
  size: '822.49 KB',
  bytes: 842230,
  download: LIVE_STEM_NAMES[i],
}));

describe('classifyMvsepFiles — 7 файлов sep_type 63 (живые данные 707: Vocals, Bass, Drums, Guitar, Piano, Other, Instrum)', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  const LABELS = ['Vocals', 'Bass', 'Drums', 'Guitar', 'Piano', 'Other', 'Instrum'];
  const EXPECTED = ['vocals', 'bass', 'drums', 'guitar', 'keys', 'other', 'instrumental'];

  // Живой формат — `<track>_bs6stem_mt_0_<stem>` (см. тест ниже); остальные формы —
  // запас на смену модели/версии MVSEP.
  it.each([
    ['скобки и модель', (t: string, l: string) => `${t}_(${l})_bs_roformer_sw`],
    ['подчёркивания и [mvsep.com]', (t: string, l: string) => `${t}_${l.toLowerCase()}_[mvsep.com]`],
    ['дефис', (t: string, l: string) => `${t} - ${l}`],
    ['метка в начале', (t: string, l: string) => `${l}_${t}`],
    ['только метки', (_t: string, l: string) => l],
  ])('%s', (_label, fmt) => {
    const names = LABELS.map((l) => fmt('in-the-end', l));
    expect(classifyMvsepFiles(names)).toEqual(EXPECTED);
  });

  it('ЖИВАЯ фикстура H3 (707, 07.11.2026): <track>_bs6stem_mt_0_<stem> → 7/7, без unknown', () => {
    const names = LIVE_STEM_NAMES.map((n) => n.replace(/\.mp3$/, ''));
    expect(classifyMvsepFiles(names)).toEqual(['bass', 'drums', 'other', 'vocals', 'guitar', 'keys', 'instrumental']);
  });

  it('название трека со словами-стемами не ломает разбор (Guitar Hero / The Other Side / Drum & Bass)', () => {
    for (const title of ['Guitar Hero', 'The Other Side', 'Drum And Bass Vocals Piano']) {
      const names = LABELS.map((l) => `${title}_(${l})_bs_roformer_sw`);
      expect(classifyMvsepFiles(names)).toEqual(EXPECTED);
    }
  });

  it('Instrum — это instrumental, а не unknown и не молчаливая подмена', () => {
    expect(classifyMvsepFiles(['x_(Vocals)_m', 'x_(Instrum)_m'])).toEqual(['vocals', 'instrumental']);
  });

  it('«No Vocals» — инструментал, а не вокал', () => {
    expect(classifyMvsepFiles(['x_(Vocals)_m', 'x_(No Vocals)_m'])).toEqual(['vocals', 'instrumental']);
  });

  it('неопознанная метка → unknown_<i>, а не instrumental', () => {
    expect(classifyMvsepFiles(['x_(Vocals)_m', 'x_(Xyzzy)_m'])).toEqual(['vocals', 'unknown_1']);
    expect(classifyMvsepFiles(['Song_xyzzy'])).toEqual(['unknown_0']);
  });

  it('старый формат с подчёркиваниями по-прежнему работает', () => {
    expect(
      classifyMvsepFiles(['Song_vocals_[mvsep.com]', 'Song_drums_[mvsep.com]', 'Song_instrum_[mvsep.com]']),
    ).toEqual(['vocals', 'drums', 'instrumental']);
  });
});

// ─── Формы ответа MVSEP на /submit (живые данные 707) ────────

describe('submitTrack — реальные формы ответа MVSEP', () => {
  it('успех без поля status: {success:true, data:{link, hash}}', async () => {
    fetchMock.mockImplementation(async () =>
      json({ success: true, data: { link: 'https://mvsep.com/result/x', hash: '20261107-abc-song.mp3' } }),
    );
    await expect(submitTrack(new ArrayBuffer(8), 'a.mp3')).resolves.toEqual({
      hash: '20261107-abc-song.mp3', keySource: 'beLive',
    });
    useMvsepKeyStore.getState().setApiKey('k');
    await expect(submitTrack(new ArrayBuffer(8), 'a.mp3')).resolves.toMatchObject({ keySource: 'user' });
  });

  it('{success:false, data:{message:"Invalid API token"}} при HTTP 200 → MVSEP_KEY_INVALID', async () => {
    fetchMock.mockImplementation(async () => json({ success: false, data: { message: 'Invalid API token' } }));
    await expect(submitTrack(new ArrayBuffer(8), 'a.mp3')).rejects.toMatchObject({ code: 'MVSEP_KEY_INVALID' });
  });

  const LIVE_401 = {
    success: false,
    errors: ['invalid token'],
    data: { message: 'invalid token. If you have not used the API recently, your key may have been reset for security; get your current key at https://mvsep.com/user-api' },
  };

  it('ЖИВОЙ 401 MVSEP на неверный ключ (user-режим) → MVSEP_KEY_INVALID, refresh не дёргается', async () => {
    useMvsepKeyStore.getState().setApiKey('bad');
    fetchMock.mockImplementation(async () => json(LIVE_401, 401));
    await expect(submitTrack(new ArrayBuffer(8), 'a.mp3')).rejects.toMatchObject({ code: 'MVSEP_KEY_INVALID' });
    expect(refreshSession).not.toHaveBeenCalled();
  });

  it('ЖИВОЙ 401 MVSEP на общий ключ → MVSEP_SUBMIT_ERROR_401 (структурный SERVICE_KEY_INVALID — W0.5 воркера)', async () => {
    fetchMock.mockImplementation(async () => json(LIVE_401, 401));
    await expect(submitTrack(new ArrayBuffer(8), 'a.mp3')).rejects.toMatchObject({ code: 'MVSEP_SUBMIT_ERROR_401' });
    expect(refreshSession).not.toHaveBeenCalled();
  });

  it('HTTP 400 с текстом про ключ → MVSEP_KEY_INVALID', async () => {
    fetchMock.mockImplementation(async () => json({ success: false, data: { message: 'Invalid api_token' } }, 400));
    await expect(submitTrack(new ArrayBuffer(8), 'a.mp3')).rejects.toMatchObject({ code: 'MVSEP_KEY_INVALID' });
  });

  it('HTTP 400 с иным текстом → MVSEP_SUBMIT_ERROR_400 с деталью', async () => {
    fetchMock.mockImplementation(async () => json({ success: false, data: { message: 'File too long' } }, 400));
    const err = await submitTrack(new ArrayBuffer(8), 'a.mp3').catch((e) => e);
    expect(err.code).toBe('MVSEP_SUBMIT_ERROR_400');
    expect(err.message).toContain('File too long');
  });

  it('{success:false} без ключевых слов → MVSEP_API_ERROR', async () => {
    fetchMock.mockImplementation(async () => json({ success: false, data: { message: 'Something broke' } }));
    await expect(submitTrack(new ArrayBuffer(8), 'a.mp3')).rejects.toMatchObject({ code: 'MVSEP_API_ERROR' });
  });
});

// ─── I9: все скачивания идут через /download ─────────────────

describe('downloadStems — всё через /download воркера (I9, D6)', () => {
  const files = [
    { download: 'Song_instrum_[mvsep.com].mp3', url: 'https://mvsep.com/dl/1' },
    { download: 'Song_vocals_[mvsep.com].mp3', url: 'https://mvsep.com/dl/2' },
  ];

  function mockHappyPath() {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('/status')) {return json({ status: 'done', data: { files } });}
      if (url.includes('/download')) {return new Response('x', { status: 200 });}
      throw new Error(`unexpected fetch: ${url}`);
    });
  }

  it('нет записи в сторе (как после перезагрузки) — всё равно только воркер', async () => {
    expect(useMvsepStore.getState().activeJobs.get('h1')).toBeUndefined();
    useMvsepKeyStore.getState().setApiKey('user-key'); // BYOK
    mockHappyPath();

    const stems = await downloadStems('h1');

    expect([...stems.keys()].sort()).toEqual(['instrumental', 'vocals']);
    const urls = calls();
    expect(urls.every((u) => u.startsWith('https://belive-mvsep.') || u.includes('/status') || u.includes('/download'))).toBe(true);
    expect(urls.some((u) => u.startsWith('https://mvsep.com'))).toBe(false); // прямых запросов нет
    expect(urls.filter((u) => u.includes('/download'))).toHaveLength(2);
  });

  it('ЖИВОЙ /get (7 файлов на de.mvsep.com): все 7 слотов, 7 скачиваний через воркер', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('/status')) {
        // реальная форма: status — на верхнем уровне, files — в data
        return json({ success: true, status: 'done', data: { hash: LIVE_HASH, files: LIVE_FILES } });
      }
      if (url.includes('/download')) {return new Response('x', { status: 200 });}
      throw new Error(`unexpected fetch: ${url}`);
    });
    const stems = await downloadStems(LIVE_HASH);
    expect([...stems.keys()].sort()).toEqual(['bass', 'drums', 'guitar', 'instrumental', 'keys', 'other', 'vocals']);
    const dl = calls().filter((u) => u.includes('/download'));
    expect(dl).toHaveLength(7);
    // воркеру уходит исходный URL de.mvsep.com — именно его он сейчас режет (D6, W0.2)
    expect(dl.every((u) => decodeURIComponent(u).includes('de.mvsep.com'))).toBe(true);
    expect(calls().some((u) => u.startsWith('https://de.mvsep.com'))).toBe(false);
  });

  it('keySource=user в сторе тоже идёт через воркер', async () => {
    useMvsepStore.getState().addJob('h1', 1, 'a.mp3', 'user');
    mockHappyPath();
    await downloadStems('h1');
    expect(calls().some((u) => u.startsWith('https://mvsep.com'))).toBe(false);
  });

  it('все файлы без инструментала → MVSEP_NO_INSTRUMENTAL с именами файлов', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('/status')) {
        return json({ status: 'done', data: { files: [{ download: 'Song_xyzzy.mp3', url: 'https://mvsep.com/dl/9' }] } });
      }
      return new Response('x', { status: 200 });
    });
    const err = await downloadStems('h1').catch((e) => e);
    expect(err.code).toBe('MVSEP_NO_INSTRUMENTAL');
    expect(err.message).toContain('Song_xyzzy');
  });

  it('401 на одном из /download — refresh, остальное докачивается', async () => {
    refreshSession.mockResolvedValue({ jwt: 'tok-2' });
    let first = true;
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('/status')) {return json({ status: 'done', data: { files } });}
      if (first) { first = false; return workerAuth401(); }
      return new Response('x', { status: 200 });
    });
    const stems = await downloadStems('h1');
    expect(stems.size).toBe(2);
    expect(refreshSession).toHaveBeenCalledTimes(1); // параллельные 401 делят один refresh
  });

  it('5xx на скачивании ретраится', async () => {
    vi.useFakeTimers();
    try {
      let n = 0;
      fetchMock.mockImplementation(async (url: string) => {
        if (url.includes('/status')) {
          return json({ status: 'done', data: { files: [files[0]] } });
        }
        return n++ === 0 ? json({}, 503) : new Response('x', { status: 200 });
      });
      const p = downloadStems('h1');
      await vi.advanceTimersByTimeAsync(6000);
      await expect(p).resolves.toBeInstanceOf(Map);
      expect(n).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('404 на скачивании не ретраится', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('/status')) {return json({ status: 'done', data: { files: [files[0]] } });}
      return json({}, 404);
    });
    await expect(downloadStems('h1')).rejects.toMatchObject({ code: 'DOWNLOAD_ERROR_404' });
    expect(calls().filter((u) => u.includes('/download'))).toHaveLength(1);
  });
});
