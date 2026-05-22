import { useEffect, useCallback } from 'react';
import { useTrackInfoStore } from '../../stores/trackInfo.store';
import { useTrackStore } from '../../stores/track.store';
import { fetchTrackMeta, loadCachedTrackMeta } from '../../services/track-meta.service';
import { StructureDiagram } from './StructureDiagram';
import { AiExpertPanel } from './AiExpertPanel';
import styles from './TrackInfoBoard.module.css';

/* ── Reusable MetaCard ── */
function MetaCard({
  label,
  value,
  icon,
  loading,
  wide,
  permanent,
  children,
}: {
  label: string;
  value?: string | null;
  icon?: string;
  loading?: boolean;
  wide?: boolean;
  permanent?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className={`${styles.metaCard} ${wide ? styles.wide : ''}`}>
      <span className={styles.cardLabel}>{icon && `${icon} `}{label}</span>
      {loading && !value && !children ? (
        <div className={styles.skeleton} />
      ) : children ? (
        children
      ) : permanent && !value ? (
        <span className={styles.cardValueNa}>N/A</span>
      ) : (
        <span className={styles.cardValue}>{value || '—'}</span>
      )}
    </div>
  );
}

/* ── Sub-components ── */
function TagsList({ genres, tags }: { genres: string[] | null; tags: string[] | null }) {
  const hasAnything = (genres?.length || 0) + (tags?.length || 0) > 0;
  if (!hasAnything) return <span className={styles.cardValue}>—</span>;
  return (
    <div className={styles.tagsList}>
      {genres?.map((g, i) => (
        <span key={`g${i}`} className={`${styles.tag} ${styles.genre}`}>{g}</span>
      ))}
      {tags?.map((t, i) => (
        <span key={`t${i}`} className={styles.tag}>#{t}</span>
      ))}
    </div>
  );
}

function SimilarTracksList({ tracks }: { tracks: { name: string; artist: string }[] | null }) {
  if (!tracks || tracks.length === 0) return <span className={styles.cardValue}>—</span>;
  return (
    <div>
      {tracks.map((t, i) => (
        <div key={i} className={styles.similarTrack}>
          <span className={styles.similarTrackName}>{t.name}</span>
          <span className={styles.similarTrackArtist}>— {t.artist}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Main Component ── */
export function TrackInfoBoard() {
  const isOpen = useTrackInfoStore(s => s.isOpen);
  const trackId = useTrackInfoStore(s => s.trackId);
  const isFirstReveal = useTrackInfoStore(s => s.isFirstReveal);
  const meta = useTrackInfoStore(s => s.meta);
  const isFetchingApi = useTrackInfoStore(s => s.isFetchingApi);
  const close = useTrackInfoStore(s => s.close);
  const setMeta = useTrackInfoStore(s => s.setMeta);
  const setFetchingApi = useTrackInfoStore(s => s.setFetchingApi);
  const currentTrack = useTrackStore(s => s.currentTrack);

  // Load meta on open
  useEffect(() => {
    if (!isOpen || !trackId) return;
    let cancelled = false;
    (async () => {
      // Try cache first
      const cached = await loadCachedTrackMeta(trackId);
      if (cancelled) return;
      if (cached) {
        setMeta(cached);
      }
      // Fetch fresh from API
      setFetchingApi(true);
      const fresh = await fetchTrackMeta(trackId, currentTrack?.title || '');
      if (cancelled) return;
      if (fresh) {
        setMeta(fresh);
      } else if (!cached) {
        // No cache, no API — set empty meta
        setMeta({
          genre: null,
          label: null,
          releaseDate: null,
          isrc: null,
          mbid: null,
          tags: null,
          listeners: null,
          playcount: null,
          similarTracks: null,
          bpm: null,
          key: null,
          camelot: null,
          energy: null,
          danceability: null,
          mood: null,
          analysedAt: new Date().toISOString(),
          essentiaVersion: null,
        });
      }
      setFetchingApi(false);
    })();
    return () => { cancelled = true; };
  }, [isOpen, trackId]);

  // ESC handler
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') close();
  }, [close]);

  useEffect(() => {
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const handleRefresh = async () => {
    if (!trackId) return;
    setFetchingApi(true);
    const fresh = await fetchTrackMeta(trackId, currentTrack?.title || '');
    if (fresh) setMeta(fresh);
    setFetchingApi(false);
  };

  return (
    <div className={styles.overlay} onClick={close}>
      <div
        className={`${styles.board} ${isFirstReveal ? styles.firstReveal : ''}`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className={styles.headerBar}>
          <span className={styles.boardTitle}>TrackMap</span>
          <div className={styles.headerActions}>
            <button className={styles.refreshButton} onClick={handleRefresh} title="Refresh">↻</button>
            <button className={styles.closeButton} onClick={close}>ESC ✕</button>
          </div>
        </div>

        {/* Зона 1: Structure — ABABCB */}
        <MetaCard label="Structure" wide>
          <StructureDiagram />
        </MetaCard>

        {/* Зона 2: Meta cards */}
        <div className={styles.cardsGrid}>
          <MetaCard
            label="Genre & Tags"
            icon="🏷️"
            wide
            loading={isFetchingApi && !meta?.genre && !meta?.tags}
          >
            <TagsList genres={meta?.genre} tags={meta?.tags} />
          </MetaCard>
          <MetaCard
            label="Key"
            value={meta?.key && meta?.camelot ? `${meta.key} / ${meta.camelot}` : null}
            icon="🔑"
            permanent
          />
          <MetaCard
            label="BPM"
            value={meta?.bpm ? String(Math.round(meta.bpm)) : null}
            icon="🥁"
            permanent
          />
          <MetaCard
            label="Energy"
            value={meta?.energy ? `${Math.round(meta.energy * 100)}%` : null}
            icon="⚡"
            permanent
          />
          <MetaCard
            label="Label"
            value={meta?.label}
            icon="🏭"
            loading={isFetchingApi && !meta?.label}
          />
          <MetaCard
            label="Release"
            value={meta?.releaseDate}
            icon="📅"
            loading={isFetchingApi && !meta?.releaseDate}
          />
          <MetaCard
            label="Similar Tracks"
            icon="🔗"
            wide
            loading={isFetchingApi && !meta?.similarTracks}
          >
            <SimilarTracksList tracks={meta?.similarTracks} />
          </MetaCard>
        </div>

        {/* Зона 3: AI Expert */}
        <AiExpertPanel />

        {/* Footer */}
        <div className={styles.footer}>
          <span className={styles.footerHint}>
            {meta?.analysedAt
              ? `Analysed: ${new Date(meta.analysedAt).toLocaleDateString()}`
              : 'No analysis data'}
          </span>
        </div>
      </div>
    </div>
  );
}