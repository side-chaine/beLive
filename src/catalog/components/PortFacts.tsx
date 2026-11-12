/**
 * Карточка «что уже знаем» — стоит под Портом, пока идёт очередь.
 *
 * Ожидание в 2–5 минут не должно быть пустым: обложка, темп, год и наличие
 * текста приходят сами, каждый — когда ответил его источник. Чего нет — того
 * не рисуем: пустая строка честнее выдуманной.
 */

import { T } from '../theme';
import { splitTrackName } from '../../services/track-facts.service';
import type { TrackFactsPatch } from '../../services/track-facts.service';

interface Props {
  fileName: string;
  facts: TrackFactsPatch | null;
  /** Источники ещё не ответили — тогда «собираю…», а не «ничего не нашлось». */
  pending: boolean;
}

const DOT = ' · ';

export function PortFacts({ fileName, facts, pending }: Props) {
  const { artist, title } = splitTrackName(fileName);
  const name = [artist, title].filter(Boolean).join(' — ') || fileName;

  const tempoLine = [
    facts?.bpm ? `≈${facts.bpm} BPM` : null,
    facts?.key,
    facts?.camelot,
  ].filter(Boolean).join(DOT);

  const lines = facts?.lyricsLines;
  const lyrics = lines === undefined
    ? null
    : lines === null ? 'текста нет' : `текст: ${lines} строк`;

  const metaLine = [facts?.year, facts?.genre, lyrics].filter(Boolean).join(DOT);
  const emptyLine = !tempoLine && !metaLine
    ? (pending ? 'собираю обложку, темп и текст…' : 'данных о треке не нашлось')
    : '';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '9px 10px', minHeight: 68,
      border: `1px solid ${T.border}`, borderRadius: T.rL,
      background: T.surface,
    }}>
      {facts?.coverUrl ? (
        <img
          src={facts.coverUrl}
          alt=""
          width={56}
          height={56}
          style={{ width: 56, height: 56, borderRadius: 8, objectFit: 'cover', flex: '0 0 auto' }}
        />
      ) : (
        <div style={{
          width: 56, height: 56, borderRadius: 8, flex: '0 0 auto',
          border: `1px dashed ${T.border2}`, background: 'rgba(255,255,255,0.02)',
        }} />
      )}

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div style={{
          fontSize: 12.5, fontWeight: 600, color: T.text,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{name}</div>

        <div style={{
          fontFamily: 'ui-monospace,monospace', fontSize: 11.5, minHeight: 14,
          color: tempoLine ? T.orange : '#767676',
        }}>{tempoLine || emptyLine}</div>

        <div style={{
          fontSize: 11.5, minHeight: 14, color: '#9a9a9a',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{metaLine}</div>
      </div>
    </div>
  );
}
