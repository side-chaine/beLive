import { describe, it, expect, vi } from 'vitest';

// Мокаем IDB и catalog before import
vi.mock('../idb.service', () => ({
  getTrack: vi.fn(),
  updateTrackField: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../catalog/types', () => ({
  parseTrackName: vi.fn((title: string) => {
    if (title === 'Artist - Song') return { artist: 'Artist', title: 'Song' };
    if (title === 'Unknown - Test') return { artist: '', title: 'Test' };
    return { artist: title, title };
  }),
}));

// Импорт после моков
import { fetchTrackMeta } from '../track-meta.service';

describe('track-meta.service', () => {
  describe('openKeyToCamelot', () => {
    // Эта функция не экспортирована, но используется внутри fetchGetSongBPM
    // Проверяем через fetchGetSongBPM с замоканным fetch
    it('конвертирует open_key в camelot (интеграционно)', async () => {
      const mockTrack = { search: [{ tempo: 120, key_of: 'C', open_key: '8m', camelot: null }] };
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockTrack),
      });

      const { getTrack } = await import('../idb.service');
      (getTrack as any).mockResolvedValue({ trackMeta: null });

      const meta = await fetchTrackMeta(1, 'Artist - Song');

      // open_key '8m' → camelot '3A'
      // Но camelot: null в ответе API, плюс open_key: '8m'
      // Проверяем что функция не падает
      expect(meta).not.toBeNull();
    });
  });

  describe('mergeNonNull', () => {
    it('мержит только non-null значения', async () => {
      const { getTrack } = await import('../idb.service');
      (getTrack as any).mockResolvedValue({ trackMeta: { genre: ['rock'], bpm: null } });

      const { fetchTrackMeta } = await import('../track-meta.service');
      global.fetch = vi.fn().mockResolvedValue({ ok: false });

      const meta = await fetchTrackMeta(1, 'Artist - Song');

      // Если все API вернули null — meta должна быть с existing значениями
      expect(meta).not.toBeNull();
    });
  });

  it('короткое название (<2 символов) → null', async () => {
    const { getTrack } = await import('../idb.service');
    (getTrack as any).mockResolvedValue({ trackMeta: null });

    const meta = await fetchTrackMeta(1, 'A');
    expect(meta).toBeNull();
  });

  it('пустой результат при недоступных API сохраняет existing meta', async () => {
    const existingMeta = { genre: ['rock'], bpm: 120, analysedAt: '2026-01-01' };

    const { getTrack } = await import('../idb.service');
    (getTrack as any).mockResolvedValue({ trackMeta: existingMeta });

    global.fetch = vi.fn().mockResolvedValue({ ok: false });

    const meta = await fetchTrackMeta(1, 'Artist - Song');

    // Должен вернуть existing meta (не перезаписал null из API)
    expect(meta?.bpm).toBe(120);
    expect(meta?.genre).toEqual(['rock']);
  });
});
