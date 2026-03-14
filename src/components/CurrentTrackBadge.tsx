import { useMemo } from 'react';
import { useTrackStore } from '../stores/track.store';
import { useModeStore } from '../stores/mode.store';

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
    const { artist, title } = current;
    if (!artist) return title || '';
    if (!title) return artist;
    if (title.startsWith(artist)) {
      const rest = title.slice(artist.length).replace(/^[\s\-\u2014_]+/, '');
      return rest ? `${artist} \u2014 ${rest}` : artist;
    }
    return `${artist} \u2014 ${title}`;
  }, [current]);

  if (!text) return null;

  const style: React.CSSProperties = {
    maxWidth: 400,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontSize: 13,
    color: '#ddd',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: `${color}33`,
    backgroundColor: 'rgba(0,0,0,0.25)',
    padding: '4px 10px',
    borderRadius: 8,
  };

  return <div title={text} style={style}>{text}</div>;
}
