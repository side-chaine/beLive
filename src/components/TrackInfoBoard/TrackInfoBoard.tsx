import { useEffect, useCallback } from 'react';
import { useTrackInfoStore } from '../../stores/trackInfo.store';
import { useTrackStore } from '../../stores/track.store';
import { fetchTrackMeta, loadCachedTrackMeta } from '../../services/track-meta.service';
import { StructureDiagram } from './StructureDiagram';
import { AiExpertPanel } from './AiExpertPanel';
import styles from './TrackInfoBoard.module.css';
import React from 'react';

/* ── ErrorBoundary — ловит ошибки рендеринга ── */
class TrackInfoErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; errorMsg: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMsg: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, errorMsg: error.message || 'Unknown error' };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[TrackInfoBoard] Error caught:', error.message, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '20px',
          textAlign: 'center',
          color: 'rgba(255,255,255,0.5)',
          fontFamily: 'SF Mono, monospace',
          fontSize: '12px',
        }}>
          <div style={{ fontSize: '24px', marginBottom: '8px', opacity: 0.3 }}>⚠️</div>
          <div>Something went wrong</div>
          <div style={{ fontSize: '10px', marginTop: '4px', opacity: 0.3 }}>{this.state.errorMsg}</div>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ── Reusable MetaCard ── */
function MetaCard({
  label,
  value,
  icon,
  loading,
  wide,
  permanent,
  neonClass,
  children,
}: {
  label: string;
  value?: string | null;
  icon?: string;
  loading?: boolean;
  wide?: boolean;
  permanent?: boolean;
  neonClass?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={`${styles.metaCard} ${wide ? styles.wide : ''}`}>
      <span className={styles.cardLabel}>{icon && `${icon} `}{label}</span>
      {loading && !value && !children ? (
        <div className={styles.skeleton} />
      ) : children ? (
        children
      ) : value ? (
        <span className={`${styles.cardValue} ${neonClass || ''}`}>{value}</span>
      ) : permanent ? (
        <span className={styles.cardValueNa}>N/A</span>
      ) : (
        <span className={styles.cardValue}>—</span>
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
  const isAnalyzing = useTrackInfoStore(s => s.isAnalyzing);
  const setAnalyzing = useTrackInfoStore(s => s.setAnalyzing);
  const mergeMeta = useTrackInfoStore(s => s.mergeMeta);
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
          analysisEngine: null,
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
            neonClass={meta?.key ? styles.neonKey : undefined}
          />
          <MetaCard
            label="BPM"
            value={meta?.bpm ? String(Math.round(meta.bpm)) : null}
            icon="🥁"
            permanent
            neonClass={meta?.bpm ? styles.neonBpm : undefined}
          />
          <MetaCard
            label="Energy"
            value={meta?.energy ? `${Math.round(meta.energy * 100)}%` : null}
            icon="⚡"
            permanent
            neonClass={meta?.energy ? styles.neonEnergy : undefined}
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

        {/* Analyze Audio Button */}
        {(!meta?.bpm || !meta?.key || !meta?.energy) && !isAnalyzing && (
          <div className={styles.analyzeRow}>
            <button
              className={styles.analyzeButton}
              onClick={async () => {
                if (!trackId) return;
                setAnalyzing(true);
                try {
                  const { analyzeAndPersist } = await import('../../services/audio-analysis.service');
                  const result = await analyzeAndPersist(trackId);
                  if (result) {
                    mergeMeta({
                      bpm: result.bpm,
                      key: result.key,
                      camelot: result.camelot,
                      energy: result.energy,
                      danceability: result.danceability,
                      mood: result.mood,
                      analysedAt: result.analysedAt,
                      analysisEngine: result.analysisEngine,
                    });
                  }
                } catch (e) {
                  console.warn('[TrackInfoBoard] Analysis failed:', e);
                } finally {
                  setAnalyzing(false);
                }
              }}
            >
              🔍 Analyze Audio
            </button>
            <span className={styles.analyzeHint}>Detects BPM, Key, Energy from real audio (~20s)</span>
          </div>
        )}
        {isAnalyzing && (
          <div className={styles.analyzingRow}>
            <span className={styles.analyzingSpinner}>⟳</span>
            <span className={styles.analyzingText}>Analyzing audio…</span>
          </div>
        )}

        {/* Зона 3: AI Expert */}
        <TrackInfoErrorBoundary>
          <AiExpertPanel />
        </TrackInfoErrorBoundary>

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