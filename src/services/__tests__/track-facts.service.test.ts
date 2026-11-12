/**
 * N6 — сбор фактов о треке, пока MVSEP разделяет.
 *
 * Проверяем не сеть, а контракт: что каждый источник отдаёт свой патч,
 * что без буфера локальный анализ не запускается и что неудача одного
 * источника не мешает остальным.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { loadTrackFacts, splitTrackName } from '../track-facts.service';
import type { TrackFactsPatch } from '../track-facts.service';
import { fetchCoverArt } from '../cover-art.service';
import { fetchMusicBrainz } from '../track-meta.service';
import { analyzeTrack } from '../audio-analysis.service';
import { prefetch, waitForCache } from '../auto-lyrics.service';

vi.mock('../cover-art.service', () => ({ fetchCoverArt: vi.fn() }));
vi.mock('../track-meta.service', () => ({ fetchMusicBrainz: vi.fn() }));
vi.mock('../audio-analysis.service', () => ({ analyzeTrack: vi.fn() }));
vi.mock('../auto-lyrics.service', () => ({ prefetch: vi.fn(), waitForCache: vi.fn() }));

const FILE = 'Linkin Park - Runaway.mp3';

const collect = () => {
  const patches: TrackFactsPatch[] = [];
  return { patches, onPatch: (p: TrackFactsPatch) => { patches.push(p); } };
};

const merge = (patches: TrackFactsPatch[]): TrackFactsPatch =>
  patches.reduce<TrackFactsPatch>((acc, p) => ({ ...acc, ...p }), {});

describe('loadTrackFacts · четыре источника, один трек', () => {
  beforeEach(() => {
    vi.mocked(fetchCoverArt).mockReset().mockResolvedValue('https://example.test/c.jpg');
    vi.mocked(fetchMusicBrainz).mockReset().mockResolvedValue({
      genre: ['rock'], releaseDate: '2000-10-24', label: 'Warner', isrc: null, mbid: 'x',
    });
    vi.mocked(waitForCache).mockReset().mockResolvedValue({
      lines: [{ time: 0, text: 'a' }, { time: 1, text: 'b' }, { time: 2, text: 'c' }],
      rawSynced: '', fetchedAt: 0,
    });
    vi.mocked(prefetch).mockReset();
    vi.mocked(analyzeTrack).mockReset().mockResolvedValue({
      bpm: 120, key: 'A minor', camelot: '8A', energy: 0.5,
      danceability: null, mood: 'calm', analysedAt: '2026-11-11T00:00:00.000Z',
      analysisEngine: 'test',
    });
  });

  it('отдаёт обложку, темп, год, жанр и число строк текста', async () => {
    const { patches, onPatch } = collect();
    await loadTrackFacts(FILE, new ArrayBuffer(8), onPatch);

    const facts = merge(patches);
    expect(facts.coverUrl).toBe('https://example.test/c.jpg');
    expect(facts.bpm).toBe(120);
    expect(facts.key).toBe('A minor');
    expect(facts.camelot).toBe('8A');
    expect(facts.year).toBe('2000');
    expect(facts.genre).toBe('rock');
    expect(facts.lyricsLines).toBe(3);
  });

  it('без буфера локальный анализ не запускается — и это не ошибка', async () => {
    const { patches, onPatch } = collect();
    await loadTrackFacts(FILE, null, onPatch);

    expect(analyzeTrack).not.toHaveBeenCalled();
    expect(merge(patches).bpm).toBeUndefined();
    expect(merge(patches).coverUrl).toBe('https://example.test/c.jpg');
  });

  it('нет артиста в имени — lrclib не дёргаем впустую', async () => {
    const { onPatch } = collect();
    await loadTrackFacts('Runaway.mp3', null, onPatch);

    expect(prefetch).not.toHaveBeenCalled();
    expect(waitForCache).not.toHaveBeenCalled();
  });

  it('обложки нет — патча обложки нет, остальные факты на месте', async () => {
    vi.mocked(fetchCoverArt).mockResolvedValue(null);
    const { patches, onPatch } = collect();
    await loadTrackFacts(FILE, null, onPatch);

    expect(merge(patches).coverUrl).toBeUndefined();
    expect(merge(patches).genre).toBe('rock');
  });

  it('упавший источник не отменяет остальные', async () => {
    vi.mocked(fetchMusicBrainz).mockRejectedValue(new Error('503'));
    const { patches, onPatch } = collect();
    await loadTrackFacts(FILE, new ArrayBuffer(8), onPatch);

    expect(merge(patches).bpm).toBe(120);
    expect(merge(patches).year).toBeUndefined();
  });
});

describe('splitTrackName · имя файла как источник артиста', () => {
  it('снимает расширение', () => {
    expect(splitTrackName('Linkin Park - Runaway.mp3')).toEqual({
      artist: 'Linkin Park', title: 'Runaway',
    });
  });

  it('понимает тире без пробелов', () => {
    expect(splitTrackName('Nirvana-Smells Like Teen Spirit.flac')).toEqual({
      artist: 'Nirvana', title: 'Smells Like Teen Spirit',
    });
  });

  it('без разделителя всё имя остаётся названием', () => {
    expect(splitTrackName('Demo Track 01.wav')).toEqual({ artist: '', title: 'Demo Track 01' });
  });
});
