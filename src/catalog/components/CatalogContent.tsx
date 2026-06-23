import { useEffect, useState, useRef } from 'react';
import { CoverArt } from '../../components/CoverArt';
import { useTrackStore } from '../../stores/track.store';
import { useCatalogStore } from '../store/catalog.store';
import { useGhostStore } from '../../stores/ghost.store';
import { parseTrackName } from '../types';
import { T, IB } from '../theme';
import { GhostTrackCard } from './GhostTrackCard';

const TG_API_URL = 'https://belive-feed-bot.nikitosss007.workers.dev/tracks';

interface TgTrack {
  id: string; title: string; artist: string; slug: string;
  type: string; fileIds: { instrumental?: string; full?: string };
  fileSize: number; fileName: string;
}

async function downloadTgTrack(
  t: TgTrack,
  handleZip: (file: File, onProgress?: (pct: number) => void) => Promise<void>,
  setSearchQuery: (q: string) => void
): Promise<void> {
  const fileId = t.fileIds?.instrumental || t.fileIds?.full;
  if (!fileId) return;
  setSearchQuery('');
  const gid = 'ghost_' + Date.now();
  useGhostStore.getState().addGhost({
    id: gid, title: t.title, artist: t.artist,
    phase: 'download', progress: 0,
  });

  const baseUrl = TG_API_URL.replace('/tracks', '');
  if (baseUrl === TG_API_URL) {
    useGhostStore.getState().updateGhost(gid, { phase: 'error' });
    return;
  }

  try {
    const resp = await fetch(baseUrl + '/download/' + fileId);
    if (!resp.ok) {
      useGhostStore.getState().updateGhost(gid, { phase: 'error' });
      return;
    }

    const contentLength = resp.headers.get('Content-Length');
    const reader = resp.body?.getReader();
    if (!reader) {
      useGhostStore.getState().updateGhost(gid, { phase: 'error' });
      return;
    }

    const chunks: Uint8Array[] = [];
    let received = 0;
    const total = contentLength ? parseInt(contentLength) : 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        received += value.length;
        if (total > 0) {
          useGhostStore.getState().updateGhost(gid, {
            progress: Math.round((received / total) * 100),
          });
        }
      }
    }

    const blob = new Blob(chunks as BlobPart[], { type: resp.headers.get('Content-Type') || 'application/zip' });
    useGhostStore.getState().updateGhost(gid, { phase: 'extract', progress: 0 });

    const fn = t.artist ? `${t.artist} - ${t.title}.zip` : `${t.title}.zip`;
    await handleZip(
      new File([blob], fn, { type: 'application/zip' }),
      (pct) => useGhostStore.getState().updateGhost(gid, { progress: pct })
    );
    useGhostStore.getState().updateGhost(gid, { phase: 'done', progress: 100 });

  } catch (err) {
    console.error('[TG] Download failed:', err);
    useGhostStore.getState().updateGhost(gid, { phase: 'error' });
  }
}

interface CatalogContentProps {
  color: string;
  handleZip: (file: File, onProgress?: (pct: number) => void) => Promise<void>;
  play: (index: number) => void;
  del: (id: string | number, label: string) => void;
}

export function CatalogContent({ handleZip, play, del }: CatalogContentProps) {
  const tracks = useTrackStore(s => s.tracksMeta);
  const currentIdx = useTrackStore(s => s.currentTrackIndex);
  const searchQuery = useCatalogStore(s => s.searchQuery);
  const setSearchQuery = useCatalogStore(s => s.setSearchQuery);
  const ghosts = useGhostStore(s => s.ghosts);

  const [tgTracks, setTgTracks] = useState<TgTrack[]>([]);
  const [tgError, setTgError] = useState(false);
  const trackListRef = useRef<HTMLDivElement>(null);

  // Fetch Telegram tracks on mount
  useEffect(() => {
    let cancelled = false;
    fetch(TG_API_URL)
      .then(r => r.json())
      .then(data => { if (!cancelled && data?.tracks) setTgTracks(data.tracks); })
      .catch(() => { if (!cancelled) setTgError(true); });
    return () => { cancelled = true; };
  }, []);

  // Auto-scroll to bottom when new tracks added
  useEffect(() => {
    if (trackListRef.current) {
      trackListRef.current.scrollTo({ top: trackListRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [tracks.length]);

  // Auto-scroll when ghost added
  useEffect(() => {
    if (ghosts.length > 0 && trackListRef.current) {
      setTimeout(() => trackListRef.current?.scrollTo({ top: trackListRef.current.scrollHeight, behavior: 'smooth' }), 100);
    }
  }, [ghosts.length]);

  // Listener #1 of 2: ghost cleanup. Сопряжённый listener в CatalogLayout управляет навигацией. НЕ объединять.
  useEffect(() => {
    const handler = (_e: Event) => {
      const gs = useGhostStore.getState().ghosts;
      if (gs.length > 0) {
        useGhostStore.getState().removeGhost(gs[0].id);
      }
    };
    document.addEventListener('track-saved', handler);
    return () => document.removeEventListener('track-saved', handler);
  }, []);

  // TC-TG-05: Main list = all IDB tracks. Search shows dropdown overlay.
  const filtered = tracks;
  const q = searchQuery.toLowerCase().trim();
  const showingTg = q.length >= 2;
  const idbMatches = q ? tracks.filter(t => t.title?.toLowerCase().includes(q) || t.artist?.toLowerCase().includes(q)) : [];
  const tgMatches = showingTg ? tgTracks.filter(t => t.title?.toLowerCase().includes(q) || t.artist?.toLowerCase().includes(q)) : [];
  const showDropdown = showingTg && (idbMatches.length > 0 || tgMatches.length > 0);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'visible' }}>
      {/* Search input — always visible */}
      <div style={{ position: 'relative', flexShrink: 0, marginBottom: 8 }}>
        <input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Найти трек..."
          style={{
            width: '100%', background: 'rgba(0,0,0,0.3)', color: '#fff',
            border: `1px solid ${T.border2}`, borderRadius: T.r, padding: '8px 12px',
            fontSize: 12, boxSizing: 'border-box', outline: 'none',
          }}
        />
        {searchQuery && (
          <span
            onClick={() => setSearchQuery('')}
            style={{
              position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
              cursor: 'pointer', color: T.dim, fontSize: 14, zIndex: 1, lineHeight: 1,
            }}
          >
            ✕
          </span>
        )}
        {showDropdown && (
          <div
            style={{
              position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 10,
              background: T.bg, border: `1px solid ${T.border2}`,
              borderTop: '2px solid #FF8C00', borderRadius: T.rL,
              maxHeight: '50vh', overflow: 'auto',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            }}
          >
            {idbMatches.length > 0 && (
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', color: '#4CAF50', padding: '6px 8px 2px', textTransform: 'uppercase' }}>
                В каталоге
              </div>
            )}
            {idbMatches.map(t => {
              const p = parseTrackName(t.title || '');
              const lb = p.artist ? `${p.artist} — ${p.title}` : p.title || `Track ${t.index + 1}`;
              return (
                <div
                  key={t.id}
                  onClick={() => play(t.index)}
                  style={{ display: 'flex', alignItems: 'center', padding: '8px 12px', cursor: 'pointer', borderBottom: `1px solid ${T.border}` }}
                >
                  <CoverArt url={t.coverArtUrl} title={t.title} size={28} borderRadius={5} />
                  <span style={{ flex: 1, fontSize: 12, marginLeft: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: T.text }}>{lb}</span>
                  <span style={{ fontSize: 10, color: T.dim, flexShrink: 0 }}>▶</span>
                </div>
              );
            })}
            {tgMatches.length > 0 && (
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', color: '#FF8C00', padding: '6px 8px 2px', textTransform: 'uppercase' }}>
                В Telegram
              </div>
            )}
            {tgMatches.map(t => (
              <div
                key={t.id}
                onClick={() => downloadTgTrack(t, handleZip, setSearchQuery)}
                style={{ display: 'flex', alignItems: 'center', padding: '8px 12px', cursor: 'pointer', borderBottom: `1px solid ${T.border}` }}
              >
                <div style={{ width: 28, height: 28, borderRadius: 5, background: `${T.orange}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: T.orange, flexShrink: 0 }}>☁</div>
                <span style={{ flex: 1, fontSize: 12, marginLeft: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: T.text }}>{t.title}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      {tgError && <div style={{ fontSize: 10, color: T.mute, marginBottom: 8, textAlign: 'center', flexShrink: 0 }}>TG каталог недоступен</div>}

      {/* All tracks header */}
      <div style={{ fontSize: 10, fontWeight: 700, color: T.dim, marginBottom: 6, letterSpacing: '0.05em', flexShrink: 0 }}>
        ВСЕ ТРЕКИ ({tracks.length})
      </div>

      {/* Track list */}
      <div ref={trackListRef} style={{ flex: 1, overflow: 'auto' }}>
        {filtered.length === 0 ? (
          <div style={{ color: T.mute, fontSize: 11, padding: 12 }}>Нет треков</div>
        ) : (
          filtered.map((t, i) => {
            const a = t.index === currentIdx;
            const p = parseTrackName(t.title || '');
            const lb = p.artist ? `${p.artist} — ${p.title}` : p.title || `Track ${t.index + 1}`;
            const myMusicIds = useCatalogStore.getState().myMusicIds;
            const inMy = myMusicIds.includes(Number(t.id));
            return (
              <div
                key={t.id ?? i}
                style={{
                  display: 'flex', alignItems: 'center', padding: '6px 10px', borderRadius: T.r,
                  marginBottom: 2, background: a ? T.orangeD : T.surface,
                  border: `1px solid ${a ? T.orange + '22' : T.border}`, cursor: 'pointer',
                }}
              >
                <CoverArt url={t.coverArtUrl} title={t.title} size={32} borderRadius={6} />
                <span
                  onClick={() => play(t.index)}
                  style={{
                    flex: 1, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap', color: a ? T.orange : T.text, marginLeft: 8,
                  }}
                >
                  {a && '▶ '}{lb}
                </span>
                {(() => {
                  const tc = (window as any).trackCatalog;
                  const ft = tc?.tracks?.find((tr: any) => String(tr.id) === String(t.id));
                  const sc = ft?.stemsData ? Object.keys(ft.stemsData).length : 0;
                  if (sc > 2) return <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 5px', borderRadius: 3, border: '1px solid #4CAF5066', color: '#4CAF50', letterSpacing: '0.05em', flexShrink: 0, marginLeft: 6 }}>‹ FULL ›</span>;
                  if (ft?.vocalsData || sc === 2) return <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 5px', borderRadius: 3, border: '1px solid #FF8C0066', color: '#FF8C00', letterSpacing: '0.05em', flexShrink: 0, marginLeft: 6 }}>‹ DUO ›</span>;
                  return null;
                })()}
                <div style={{ display: 'flex', gap: 1, flexShrink: 0 }}>
                  {!inMy && <IB c={T.green} onClick={() => useCatalogStore.getState().addToMyMusic(Number(t.id))}>+</IB>}
                  <IB c={T.red} onClick={() => del(t.id, lb)}>✕</IB>
                </div>
              </div>
            );
          })
        )}
        {ghosts.map(g => <GhostTrackCard key={g.id} ghost={g} />)}
      </div>
    </div>
  );
}
