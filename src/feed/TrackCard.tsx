// @TC-AVATAR-3.1: TrackCard — mini track card below profile stats

import { useFeedStore } from '../catalog/feed/feed.store';
import { useTrackStore } from '../stores/track.store';

const styles: Record<string, React.CSSProperties> = {
  card: {
    marginTop: 10,
    padding: '10px 12px',
    borderRadius: 12,
    background: '#0d0d0d',
    border: '1px solid rgba(255,255,255,0.08)',
    animation: 'track-card-in 0.2s ease',
  },
  title: {
    fontSize: 12,
    fontWeight: 600,
    color: '#fff',
    marginBottom: 8,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  dots: {
    display: 'flex',
    gap: 3,
    flexWrap: 'wrap' as const,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.12)',
  },
  dotFilled: {
    background: 'rgba(255,255,255,0.6)',
  },
};

export function TrackCard() {
  const posts = useFeedStore(s => s.posts);
  const activePostId = useFeedStore(s => s.activePostId);
  const tracksMeta = useTrackStore(s => s.tracksMeta);
  const status = useFeedStore(s => s.status);

  if (!activePostId) return null;
  if (status === 'loading') return <div style={{ ...styles.card, textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>Загрузка...</div>;

  const post = posts.find(p => p.id === activePostId);
  if (!post || !post.trackId) return null;

  // Use post.title as primary source (works for ALL posts, not just current user)
  const title = post.title || 'Неизвестный трек';

  const progress = tracksMeta.length > 0
    ? Math.round((tracksMeta.findIndex(t => String(t.id) === String(post.trackId)) / Math.max(tracksMeta.length, 1)) * 15)
    : 0;
  const filledDots = Number.isFinite(progress) ? Math.min(Math.max(progress, 0), 15) : 0;

  return (
    <div style={styles.card}>
      <div style={styles.title}>{title}</div>
      <div style={styles.dots}>
        {Array.from({ length: 15 }, (_, i) => (
          <div key={i} style={{ ...styles.dot, ...(i < filledDots ? styles.dotFilled : {}) }} />
        ))}
      </div>
    </div>
  );
}
