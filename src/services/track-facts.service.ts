/**
 * Track Facts — «что уже знаем» о треке, пока MVSEP его разделяет.
 *
 * Четыре источника, все без ключей: обложка — iTunes, год и жанр — MusicBrainz,
 * текст — lrclib, темп и тональность — локальный WASM по тому же буферу, что
 * уже прочитан для отправки. Ни одного нового секрета и ни одного лишнего
 * чтения файла с диска.
 *
 * Ответы приходят вразнобой и отдаются по мере готовности: панель заполняется
 * сама, а очередь перестаёт быть пустым ожиданием. В IDB ничего не пишем —
 * постоянные данные появятся в каталоге своим путём, здесь только витрина.
 */

import { parseTrackName } from '../catalog/types';
import { fetchCoverArt } from './cover-art.service';
import { fetchMusicBrainz } from './track-meta.service';
import { analyzeTrack } from './audio-analysis.service';
import { prefetch, waitForCache } from './auto-lyrics.service';

export interface TrackFacts {
  coverUrl: string | null;
  bpm: number | null;
  key: string | null;
  camelot: string | null;
  year: string | null;
  genre: string | null;
  /** null — проверили и не нашли; undefined — ещё не ответили. */
  lyricsLines: number | null;
}

export type TrackFactsPatch = Partial<TrackFacts>;

const AUDIO_EXT = /\.(mp3|wav|flac|ogg|m4a|aac|aiff?|opus|wma)$/i;

/** «Linkin Park - Runaway.mp3» → артист и название. Расширение не часть имени. */
export function splitTrackName(fileName: string): { artist: string; title: string } {
  const parsed = parseTrackName(fileName.replace(AUDIO_EXT, ''));
  return { artist: parsed.artist, title: parsed.title };
}

/**
 * Запустить все источники разом и отдавать факты по одному.
 * Промис закрывается, когда ответили все, — по нему панель понимает, что
 * «собираю…» пора снять.
 */
export async function loadTrackFacts(
  fileName: string,
  audio: ArrayBuffer | null,
  onPatch: (patch: TrackFactsPatch) => void,
): Promise<void> {
  const { artist, title } = splitTrackName(fileName);
  if (title.trim().length < 2) {return;}

  const jobs: Array<Promise<void>> = [];

  // Обложка — самый заметный факт и самый быстрый ответ.
  jobs.push(
    fetchCoverArt(artist, title)
      .then((coverUrl) => { if (coverUrl) {onPatch({ coverUrl });} })
      .catch(() => {}),
  );

  // Год и жанр — MusicBrainz. Один трек — один поиск, лимит 1 rps не задеваем.
  jobs.push(
    fetchMusicBrainz(artist, title)
      .then((mb) => {
        if (!mb) {return;}
        onPatch({
          year: mb.releaseDate ? mb.releaseDate.slice(0, 4) : null,
          genre: mb.genre?.[0] ?? null,
        });
      })
      .catch(() => {}),
  );

  // Текст — lrclib. prefetch не ждёт ответа, поэтому забираем из кэша с таймаутом:
  // четырёх секунд хватает, а дольше держать карточку в ожидании незачем.
  if (artist) {
    const key = `${artist} - ${title}`;
    jobs.push(
      (async () => {
        prefetch(key);
        const lrc = await waitForCache(key, 4000);
        onPatch({ lyricsLines: lrc ? lrc.lines.length : null });
      })().catch(() => {}),
    );
  }

  // Темп и тональность — локальный WASM. Он тяжелее сети и считает на главном
  // потоке, поэтому стартует последним тиком: к этому моменту очередь уже
  // нарисована и первый кадр не дёргается.
  if (audio) {
    jobs.push(new Promise<void>((resolve) => {
      setTimeout(() => {
        analyzeTrack(audio)
          .then((res) => {
            if (res) {onPatch({ bpm: res.bpm, key: res.key, camelot: res.camelot });}
          })
          .catch(() => {})
          .finally(resolve);
      }, 0);
    }));
  }

  await Promise.all(jobs);
}
