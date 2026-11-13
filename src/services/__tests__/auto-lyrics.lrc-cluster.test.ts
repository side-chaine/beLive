/**
 * auto-lyrics.lrc-cluster.test.ts — TC-LRCPICKER-02: выбор версии LRC по кластеру.
 *
 * Проблема не в тайминге как таковом, а в том, что у одного трека в lrclib
 * лежат версии с РАЗНЫХ мастеров. У «The Unforgiven II» восемнадцать версий
 * начинают текст на 0:37, две — на 0:42.29: у них длиннее вступление, и вся
 * сетка маркеров уезжает на 4–5 секунд. Скор по длительности и числу строк
 * такую версию не отличает — 396 с и 71 строка у всех двадцати.
 *
 * Решение: считать медиану первого таймкода и оставлять в выборе только
 * версии рядом с ней.
 */

import { describe, expect, it, vi, afterEach } from 'vitest';
import { fetchLrcVersions } from '../auto-lyrics.service';

afterEach(() => {
  vi.unstubAllGlobals();
});

/** LRC из 71 строки, первая — на `first` секунд. */
function lrc71(first: number): string {
  const mm = String(Math.floor(first / 60)).padStart(2, '0');
  const ss = (first % 60).toFixed(2).padStart(5, '0');
  const lines = [`[${mm}:${ss}] Lay beside me`];
  for (let i = 1; i < 71; i++) {
    lines.push(`[0${String(Math.floor((first + i * 3) / 60)).padStart(2, '0')}:${((first + i * 3) % 60).toFixed(2).padStart(5, '0')}] line ${i}`);
  }
  return lines.join('\n');
}

function stubSearch(results: unknown[]): void {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => results })));
}

/** Версия lrclib: 396 с, 71 строка — как все двадцать у «The Unforgiven II». */
function version(id: number, first: number) {
  return {
    id,
    artistName: 'Metallica',
    trackName: 'The Unforgiven II',
    duration: 396,
    instrumental: false,
    syncedLyrics: lrc71(first),
  };
}

describe('fetchLrcVersions: кластер по первому таймкоду', () => {
  it('чужой мастер отсечён: 18 версий с 0:37, две с 0:42', async () => {
    const results = [
      version(552428, 37.64),
      ...Array.from({ length: 17 }, (_, i) => version(600000 + i, 37.64)),
      version(552432, 42.29),
      version(552433, 42.29),
    ];
    stubSearch(results);

    const versions = await fetchLrcVersions('Metallica', 'The Unforgiven II', 396);
    const ids = versions.map((v) => v.id);

    // Версия с другим интро не просто ниже — её в выборе нет.
    expect(ids).not.toContain(552432);
    expect(ids).not.toContain(552433);
    expect(ids).toHaveLength(18);

    // Победитель — версия с медианным первым таймкодом. Внутри кластера все
    // восемнадцать равны по скору, порядок держит порядок lrclib (сорт стабилен).
    expect(versions[0].id).toBe(552428);
    expect(versions[0].score).toBeCloseTo(15, 5);
  });

  it('две версии с разным интро — защита: обе остаются, выбирает скор', async () => {
    stubSearch([version(1, 10), version(2, 30)]);
    const versions = await fetchLrcVersions('Metallica', 'The Unforgiven II', 396);

    expect(versions.map((v) => v.id).sort()).toEqual([1, 2]);
  });

  it('кластер меньше половины — берём все, а не одинокую медиану', async () => {
    stubSearch([version(1, 10), version(2, 20), version(3, 30), version(4, 40)]);
    const versions = await fetchLrcVersions('Metallica', 'The Unforgiven II', 396);

    expect(versions).toHaveLength(4);
  });

  it('версия без разборчивого таймкода не выбрасывается', async () => {
    stubSearch([
      version(1, 10),
      version(2, 10.2),
      { id: 3, artistName: 'Metallica', trackName: 'The Unforgiven II', duration: 396, syncedLyrics: '[Verse 1]\nLay beside me' },
    ]);
    const versions = await fetchLrcVersions('Metallica', 'The Unforgiven II', 396);

    expect(versions.map((v) => v.id)).toContain(3);
  });
});
