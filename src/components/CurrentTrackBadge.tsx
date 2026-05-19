import { useMemo } from 'react';
import { useTrackStore } from '../stores/track.store';
import { useModeStore } from '../stores/mode.store';
import { CoverArt } from './CoverArt';

const MODE_COLORS: Record<string, string> = {
  concert: '#3498db',
  karaoke: '#9b59b6',
  rehearsal: '#FF8C00',
  live: '#e74c3c',
};

export function CurrentTrackBadge() {
  const current = useTrackStore((s) => s.currentTrack);
  const mode = useModeStore((s) => s.mode);
  const color = MODE_COLORS[mode] || '#fff';

  const text = useMemo(() => {
    if (!current) return '';
    const { artist, title, coverArtUrl } = current;
    if (!artist) return title || '';
    if (!title) return artist;
    if (title.startsWith(artist)) {
      const rest = title.slice(artist.length).replace(/^[\s\-\u2014_]+/, '');
      return rest ? `${artist} \u2014 ${rest}` : artist;
    }
    return `${artist} \u2014 ${title}`;
  }, [current]);

  if (!text) return null;

  const { coverArtUrl } = current || {};

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '4px 10px',
    borderRadius: 8,
    background: `${color}15`,
    border: `1px solid ${color}30`,
    maxWidth: 420,
    cursor: 'default',
  };

  const textStyle: React.CSSProperties = {
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontSize: 13,
    color: '#ddd',
  };

  return (
    <div title={text} style={containerStyle}>
      <CoverArt url={coverArtUrl} title={current?.title || current?.artist || ''} size={40} borderRadius={6} />
      <span style={textStyle}>{text}</span>
    </div>
  );
}
