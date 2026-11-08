import { describe, it, expect, vi } from 'vitest';
import { publishTrackUrls, revokeTrackUrls, type TrackUrlHost } from '../track-urls';

/** Минимальный ArrayBuffer с содержимым — важен только факт наличия. */
function ab(bytes = 8): ArrayBuffer {
  return new ArrayBuffer(bytes);
}

function makeHost(urls?: { instrumentalUrl?: string | null; vocalsUrl?: string | null }): TrackUrlHost {
  return urls ? { trackUrls: { ...urls } } : {};
}

describe('track-urls (702-F0: blob-URL не должны копиться)', () => {
  it('первая публикация создаёт оба URL, отзывать нечего', () => {
    const revoke = vi.fn();
    let n = 0;
    const create = vi.fn(() => `blob:${++n}`);
    const host = makeHost();

    const res = publishTrackUrls(
      host,
      { instrumentalData: ab(), vocalsData: ab(), instrumentalType: 'audio/mpeg' },
      create,
      revoke,
    );

    expect(res.instrumentalUrl).toBe('blob:1');
    expect(res.vocalsUrl).toBe('blob:2');
    expect(revoke).not.toHaveBeenCalled();
    expect(host.trackUrls?.instrumentalUrl).toBe('blob:1');
  });

  it('вторая публикация ОТЗЫВАЕТ набор первого трека (главный инвариант)', () => {
    const revoke = vi.fn();
    let n = 0;
    const create = vi.fn(() => `blob:${++n}`);
    const host = makeHost();

    publishTrackUrls(host, { instrumentalData: ab(), vocalsData: ab() }, create, revoke);
    publishTrackUrls(host, { instrumentalData: ab(), vocalsData: ab() }, create, revoke);

    // Ровно два отзыва — по одному на каждый URL предыдущего трека, не больше.
    expect(revoke).toHaveBeenCalledTimes(2);
    expect(revoke).toHaveBeenCalledWith('blob:1');
    expect(revoke).toHaveBeenCalledWith('blob:2');
    // На хосте живёт только новый набор.
    expect(host.trackUrls?.instrumentalUrl).toBe('blob:3');
    expect(host.trackUrls?.vocalsUrl).toBe('blob:4');
  });

  it('10 смен трека → 18 отзывов и ровно 2 живых URL (нет накопления)', () => {
    const revoke = vi.fn();
    let n = 0;
    const create = vi.fn(() => `blob:${++n}`);
    const host = makeHost();

    for (let i = 0; i < 10; i++) {
      publishTrackUrls(host, { instrumentalData: ab(), vocalsData: ab() }, create, revoke);
    }

    expect(create).toHaveBeenCalledTimes(20);
    expect(revoke).toHaveBeenCalledTimes(18); // первые 9 наборов × 2
    expect(host.trackUrls?.instrumentalUrl).toBe('blob:19');
    expect(host.trackUrls?.vocalsUrl).toBe('blob:20');
  });

  it('трек без вокала обнуляет vocalsUrl, а не оставляет URL прошлого трека', () => {
    const revoke = vi.fn();
    let n = 0;
    const create = vi.fn(() => `blob:${++n}`);
    const host = makeHost();

    publishTrackUrls(host, { instrumentalData: ab(), vocalsData: ab() }, create, revoke);
    const res = publishTrackUrls(host, { instrumentalData: ab() }, create, revoke);

    expect(res.vocalsUrl).toBeNull();
    expect(host.trackUrls?.vocalsUrl).toBeNull();
    expect(revoke).toHaveBeenCalledWith('blob:2'); // вокал прошлого трека отозван
  });

  it('revoke бросает исключение — публикация нового трека всё равно проходит', () => {
    const revoke = vi.fn(() => {
      throw new Error('detached');
    });
    let n = 0;
    const create = vi.fn(() => `blob:${++n}`);
    const host = makeHost({ instrumentalUrl: 'blob:old', vocalsUrl: 'blob:old2' });

    const res = publishTrackUrls(host, { instrumentalData: ab() }, create, revoke);

    expect(res.instrumentalUrl).toBe('blob:1');
    expect(host.trackUrls?.instrumentalUrl).toBe('blob:1');
  });

  it('revokeTrackUrls идемпотентна: пустой хост — no-op', () => {
    const revoke = vi.fn();
    const host = makeHost();
    revokeTrackUrls(host, revoke);
    revokeTrackUrls(host, revoke);
    expect(revoke).not.toHaveBeenCalled();
  });
});
