import React, { useCallback, useEffect, useState, useRef } from 'react';
import './CatalogLayout.css';
import { UploadPanel } from '../../components/UploadPanel';
import { CoverArt } from '../../components/CoverArt';
import { useTrackStore } from '../../stores/track.store';
import { loadTrack, deleteTrack, getTracksArray } from '../../services/track.actions';
import { handleZipFileSelect } from '../../services/upload.actions';
import { useCatalogStore } from '../store/catalog.store';
import { useDeckStore } from '../../stores/deck.store';
import { useSyncStore } from '../../sync/store/sync.store';
import { parseTrackName } from '../types';
import type { ShowcaseSection } from '../types';
import { OnboardingAccordion } from '../../components/onboarding/OnboardingAccordion';
import { CatalogBillyChat } from './CatalogBillyChat';
import { useUserProfileStore } from '../../stores/user-profile.store';
import { useAppStore } from '../../stores/app.store';
import {
  canAutoSeparate,
  resolveApiKey,
  submitTrack,
  isAudioFile,
  isZipFile,
  getMaxFileSize,
  getDailyUsageInfo,
  incrementDailyUsage,
} from '../../services/mvsep.service';
import { mvsepPollingService } from '../../services/mvsep-polling.service';
import { useMvsepStore, getEstimatedProgress, getElapsedString } from '../../stores/mvsep.store';
import {
  createMvsepPlaceholder,
  cancelMvsepPlaceholder,
} from '../../services/upload.actions';

interface Props { color: string; onClose: () => void; }

const T = {
  bg: 'rgba(8,8,14,0.98)',
  surface: 'rgba(255,255,255,0.035)',
  surfaceH: 'rgba(255,255,255,0.06)',
  border: 'rgba(255,255,255,0.07)',
  border2: 'rgba(255,255,255,0.12)',
  text: '#e2e2e2',
  dim: '#888',
  mute: '#555',
  green: '#4CAF50',
  greenD: 'rgba(76,175,80,0.10)',
  purple: '#9b59b6',
  purpleD: 'rgba(155,89,182,0.08)',
  orange: '#FF8C00',
  orangeD: 'rgba(255,140,0,0.07)',
  red: '#e74c3c',
  r: 6, rL: 10,
};

const colBase: React.CSSProperties = {
  background: T.surface, border: `1px solid ${T.border}`,
  borderRadius: T.rL, padding: 14,
  display: 'flex', flexDirection: 'column', overflow: 'hidden',
};

export function CatalogLayout({ color, onClose }: Props) {
  const tracks = useTrackStore(s => s.tracksMeta);
  const currentIdx = useTrackStore(s => s.currentTrackIndex);
  const store = useCatalogStore();
  const {
    myMusicIds, playlists, searchQuery,
    syncMyMusicFromLegacy, syncPlaylistsFromLegacy,
    addToMyMusic, removeFromMyMusic, setSearchQuery,
    startBuildingPlaylist, savePlaylist, deletePlaylist, loadPlaylist,
    cancelBuilding, isBuilding, buildingName, setBuildingName,
    addToBuildingPlaylist, buildingTracks,
    showcaseSections, addRecentTrack,
    toggleArtist, getGroupedMyMusic,
  } = store;

  const [showManual, setShowManual] = useState(false);
  const [pendingLyricsTrackId, setPendingLyricsTrackId] = useState<number | null>(null);
  const [pendingLyricsTitle, setPendingLyricsTitle] = useState<string>(''); // TC-GENIUS-001: Track title for Genius link
  const [zipOver, setZipOver] = useState(false);
  const [zipBusy, setZipBusy] = useState(false);
  const [zipProgress, setZipProgress] = useState(0);
  const [zipHover, setZipHover] = useState(false);
  // MVSEP Smart Cell state
  const [mvsepState, setMvsepState] = useState<
    'idle' | 'uploading' | 'active' | 'limit_reached' | 'error' | 'auth_required' | 'concurrent' | 'no_key'
  >('idle');
  const [mvsepProgress, setMvsepProgress] = useState(0);
  const [mvsepError, setMvsepError] = useState('');
  const [dragHint, setDragHint] = useState('');
  const [plOpen, setPlOpen] = useState(false);
  const [hovId, setHovId] = useState<number | null>(null);
  const zipRef = useRef<HTMLInputElement>(null);
  const trackListRef = useRef<HTMLDivElement>(null);
  const safetyTimedOut = useRef(false); // guard: safety timeout already reset UI

  const onboardingComplete = useUserProfileStore(s => s.catalogOnboardingComplete);
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [isChatMode, setIsChatMode] = useState(false);
  const [showBillyExpanded, setShowBillyExpanded] = useState(false);
  const isGuest = useUserProfileStore(s => s.isGuest);

  // Hydration guard — предотвратить flash onboarding
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setHydrated(true), 500);
    if (tracks.length > 0) { setHydrated(true); clearTimeout(t); }
    return () => clearTimeout(t);
  }, [tracks.length]);

  const showOnboarding = tracks.length === 0 && !onboardingComplete && hydrated;

  // Reset chat mode when onboarding completes (tracks loaded)
  useEffect(() => {
    if (tracks.length > 0) {
      setIsChatMode(false);
    }
  }, [tracks.length]);

  // Auto-scroll to bottom when new tracks added
  useEffect(() => {
    if (trackListRef.current) {
      trackListRef.current.scrollTo({ top: trackListRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [tracks.length]);

  useEffect(() => {
    const dh = (e: Event) => { const d = (e as CustomEvent).detail; if (d?.tab) useDeckStore.setState({ activeTabId: d.tab, expanded: d.expanded ?? true }); };
    const ch = () => onClose();
    document.addEventListener('deck-set-tab', dh);
    document.addEventListener('catalog-close', ch);
    return () => { document.removeEventListener('deck-set-tab', dh); document.removeEventListener('catalog-close', ch); };
  }, [onClose]);

  useEffect(() => { syncMyMusicFromLegacy(); syncPlaylistsFromLegacy(); }, []);

  // W9-UX: Listen for track-saved event to auto-open lyrics paste modal
  useEffect(() => {
    const handler = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (!d.hasLyrics) {
        setPendingLyricsTrackId(d.trackId);
        setPendingLyricsTitle(d.title || ''); // TC-GENIUS-001: Save title for Genius link
        setShowManual(true); // Open UploadPanel
      }
    };
    document.addEventListener('track-saved', handler);
    return () => document.removeEventListener('track-saved', handler);
  }, []);

  // Reset smart cell state when MVSEP job completes
  useEffect(() => {
    const unsub = useMvsepStore.subscribe((state) => {
      const jobs = state.activeJobs;
      const hasActive = [...jobs.values()].some(
        (j) => j.status !== 'done' && j.status !== 'failed' && j.status !== 'timeout'
      );
      if (!hasActive && mvsepState === 'active') {
        setMvsepState('idle');
      }
    });
    return unsub;
  }, [mvsepState]);

  const play = useCallback((index: number) => {
    // MVSEP guard: block playback for processing tracks
    const t = getTracksArray()[index];
    if (t?.mvsepStatus && t.mvsepStatus !== 'done') {
      const w = window as any;
      if (w.showAppNotification) {
        w.showAppNotification('⏳ Трек ещё обрабатывается', 'info');
      }
      return;
    }
    loadTrack(index, { autoplay: true, openSyncEditor: false });
    (window as any).beLiveSwitchMode?.('rehearsal');
    useSyncStore.getState().closeSync();
    useDeckStore.setState({ expanded: true, activeTabId: 'mix' });
    const tr = tracks[index]; if (tr?.id) addRecentTrack(Number(tr.id));
    onClose();
  }, [onClose, addRecentTrack, tracks]);

  const del = useCallback((id: string | number, l: string) => {
    if (!confirm(`Delete "${l}"?`)) return;
    deleteTrack(Number(id));
    useTrackStore.getState().removeTrack(String(id));
  }, []);

  const handleZip = useCallback(async (file: File) => {
    if (zipBusy) return;
    setZipBusy(true);
    setZipProgress(0);
    safetyTimedOut.current = false;

    // Safety timeout: force-reset zipBusy after 60s if stuck (SceneImport can take 45s+)
    const safetyTimer = setTimeout(() => {
      console.warn('[ZIP] safety timeout — forcing zipBusy=false');
      safetyTimedOut.current = true;
      setZipBusy(false);
    }, 60000);

    try {
      await handleZipFileSelect(file, (pct) => setZipProgress(pct));
      clearTimeout(safetyTimer);
      setTimeout(() => document.dispatchEvent(new CustomEvent('tracks-changed', { detail: { source: 'catalog' } })), 2000)
    } catch (err) {
      console.error('[ZIP] handleZip error:', err);
      clearTimeout(safetyTimer);
      alert('ZIP failed.');
    } finally {
      console.log('[ZIP] finally called, timedOut=', safetyTimedOut.current);
      clearTimeout(safetyTimer);
      if (!safetyTimedOut.current) {
        setZipBusy(false);
        setMvsepState('idle');
      }
    }
  }, [zipBusy]);

  // ─── MVSEP Smart Cell Handlers ──────────────────────────────

  const handleMvsepUpload = useCallback(async (file: File) => {
    // 1. Pre-checks
    const check = canAutoSeparate();

    if (!check.allowed) {
      switch (check.reason) {
        case 'auth_required':
          setMvsepState('auth_required');
          return;
        case 'limit_reached':
          setMvsepState('limit_reached');
          return;
        case 'concurrent':
          setMvsepState('concurrent');
          return;
        case 'no_key':
          setMvsepState('no_key');
          return;
      }
      return;
    }

    // 2. File size check
    if (file.size > getMaxFileSize()) {
      const w = window as any;
      if (w.showAppNotification) {
        w.showAppNotification('❌ Максимум 50 МБ', 'error');
      }
      return;
    }

    // 3. Submit to MVSEP
    setMvsepState('uploading');
    setMvsepProgress(0);

    try {
      const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as ArrayBuffer);
        reader.onerror = (e) => reject(e);
        reader.onprogress = (e) => {
          if (e.lengthComputable) {
            setMvsepProgress(Math.round((e.loaded / e.total) * 100));
          }
        };
        reader.readAsArrayBuffer(file);
      });

      const result = await submitTrack(arrayBuffer, file.name);

      // 4. Create placeholder in catalog
      const trackId = await createMvsepPlaceholder(file.name, result.hash);

      // 5. Add to store
      useMvsepStore.getState().addJob(result.hash, trackId, file.name, result.keySource);

      // 6. Increment daily usage (only for beLive shared key)
      if (result.keySource === 'beLive') {
        incrementDailyUsage();
      }

      // 7. Start polling
      mvsepPollingService.startPolling(result.hash, trackId);

      setMvsepState('active');
    } catch (err: any) {
      if (err.message?.includes('LIMIT') || err.message?.includes('403')) {
        setMvsepState('limit_reached');
        setMvsepError('Лимит MVSEP исчерпан');
      } else {
        setMvsepState('error');
        setMvsepError(err.message || 'Ошибка отправки');
      }
    }
  }, []);

  const handleSmartDrop = useCallback(async (file: File) => {
    const name = file.name.toLowerCase();

    if (isZipFile(name)) {
      await handleZip(file);
      return;
    }

    if (isAudioFile(name)) {
      await handleMvsepUpload(file);
      return;
    }

    const w = window as any;
    if (w.showAppNotification) {
      w.showAppNotification('❌ Неподдерживаемый формат. Используйте MP3, WAV, FLAC или ZIP', 'error');
    }
  }, [handleZip, handleMvsepUpload]);

  const handleSmartDropMultiple = useCallback(async (files: FileList) => {
    const audioFiles = [...files].filter((f) => isAudioFile(f.name));
    const zipFiles = [...files].filter((f) => isZipFile(f.name));

    for (const zip of zipFiles) {
      await handleZip(zip);
    }

    if (audioFiles.length > 0) {
      if (audioFiles.length > 1) {
        const w = window as any;
        if (w.showAppNotification) {
          w.showAppNotification(
            `🎵 Обрабатываем «${audioFiles[0].name}». Остальные добавьте по одному.`,
            'info'
          );
        }
      }
      await handleMvsepUpload(audioFiles[0]);
    }
  }, [handleZip, handleMvsepUpload]);

  const handleCancelMvsep = useCallback(async () => {
    const jobs = useMvsepStore.getState().activeJobs;
    for (const [hash, job] of jobs) {
      if (job.status !== 'done' && job.status !== 'failed') {
        mvsepPollingService.stopPolling(hash);
        await cancelMvsepPlaceholder(job.trackId);
      }
    }
    setMvsepState('idle');
  }, []);

  /** Small badge showing MVSEP quota status */
  function MvsepQuotaBadge() {
    const { key, source } = resolveApiKey();

    if (source === 'user') {
      return (
        <span style={{ fontSize: 9, color: '#6366f1', fontWeight: 600 }}>
          🔑 свой
        </span>
      );
    }

    if (source === 'beLive') {
      const { used, limit } = getDailyUsageInfo();
      const color = used >= limit
        ? (T.orange || '#f97316')
        : used > limit - 3
          ? (T.orange || '#f97316')
          : (T.green || '#4ade80');
      return (
        <span style={{ fontSize: 9, color, fontWeight: 600 }}>
          {used}/{limit}
        </span>
      );
    }

    return null;
  }

  const filtered = searchQuery.trim()
    ? tracks.filter(t => { const q = searchQuery.toLowerCase(); return t.title?.toLowerCase().includes(q) || t.artist?.toLowerCase().includes(q); })
    : tracks;
  const groups = getGroupedMyMusic();
  const sections = showcaseSections.filter(s => s.id !== 'welcome');

  return (
    <div onClick={e => e.stopPropagation()} style={{
      position: 'absolute', inset: 0,
      background: T.bg,
      display: 'flex', flexDirection: 'column',
      color: T.text, fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', flexShrink: 0, borderBottom: `1px solid ${T.border}` }}>
        <span style={{ fontWeight: 800, color, fontSize: 15, letterSpacing: '0.05em' }}>CATALOG</span>
        <button onClick={onClose} style={{ background: 'transparent', border: `1px solid ${color}44`, color, padding: '5px 16px', borderRadius: T.r, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Close</button>
      </div>

      {/* Grid — fills remaining space */}
      <div style={{ display: 'grid', gridTemplateColumns: '22% 1fr 28%', gap: 12, flex: 1, minHeight: 0, overflow: 'hidden', padding: '12px 16px 16px' }}>

        {/* ═══ COL 1: MY MUSIC ═══ */}
        <div style={colBase}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.green, marginBottom: 12, letterSpacing: '0.03em' }}>Моя Музыка</div>
          <div style={{ flex: 1, overflow: 'auto', paddingRight: 2 }}>
            {groups.length === 0 && <div style={{ color: T.mute, fontSize: 11, padding: '16px 4px', lineHeight: 1.6 }}>Нажмите + на треке в каталоге</div>}
            {groups.map(g => (
              <div key={g.artist} style={{ marginBottom: 8 }}>
                <div onClick={() => toggleArtist(g.artist)} style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px',
                  cursor: 'pointer', borderRadius: T.r, borderLeft: `3px solid ${T.green}`,
                  background: g.expanded ? T.greenD : 'transparent',
                }}>
                  <span style={{ fontSize: 9, color: T.dim, width: 10 }}>{g.expanded ? '▼' : '▶'}</span>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{g.artist}</span>
                  <span style={{ fontSize: 10, color: T.dim }}>{g.tracks.length}</span>
                </div>
                {g.expanded && g.tracks.map(t => {
                  const a = t.index === currentIdx;
                  return (
                    <div key={t.id} onMouseEnter={() => setHovId(t.id)} onMouseLeave={() => setHovId(null)}
                      onClick={() => play(t.index)} style={{
                        display: 'flex', alignItems: 'center', marginLeft: 18, padding: '5px 10px',
                        borderRadius: 4, background: a ? T.greenD : 'transparent', cursor: 'pointer', marginTop: 2,
                      }}>
                      <CoverArt url={t.coverArtUrl} title={t.title} size={28} borderRadius={5} />
                      <span style={{ flex: 1, fontSize: 12, color: a ? T.green : T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginLeft: 8 }}>
                        {a && '▶ '}{t.title}
                      </span>
                      {isBuilding && <IB c={T.purple} onClick={e => { e.stopPropagation(); addToBuildingPlaylist({ trackId: t.id, title: t.fullTitle, addedAt: new Date().toISOString() }); }}>+</IB>}
                      <IB c={T.red} o={hovId === t.id ? 1 : 0} onClick={e => { e.stopPropagation(); removeFromMyMusic(t.id); }}>✕</IB>
                    </div>
                  );
                })}
              </div>
            ))}

            <div style={{ height: 1, background: T.border2, margin: '14px 0' }} />
            <div onClick={() => setPlOpen(!plOpen)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', cursor: 'pointer' }}>
              <span style={{ fontSize: 9, color: T.dim, width: 10 }}>{plOpen ? '▼' : '▶'}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: T.dim, letterSpacing: '0.05em' }}>ПЛЕЙЛИСТЫ</span>
              <span style={{ fontSize: 10, color: T.mute }}>({playlists.length})</span>
            </div>
            {plOpen && (
              <div style={{ marginTop: 6 }}>
                {isBuilding ? (
                  <div style={{ background: T.purpleD, border: `1px solid ${T.purple}33`, borderRadius: T.r, padding: 10, marginBottom: 6 }}>
                    <input value={buildingName} onChange={e => setBuildingName(e.target.value)} placeholder="Авто-имя или введите..." autoFocus
                      style={{ width: '100%', background: 'rgba(0,0,0,0.3)', color: '#fff', border: `1px solid ${T.border2}`, borderRadius: 4, padding: '5px 8px', fontSize: 11, marginBottom: 5, boxSizing: 'border-box', outline: 'none' }} />
                    <div style={{ fontSize: 10, color: T.dim, marginBottom: 5 }}>Треков: {buildingTracks.length}</div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={savePlaylist} style={{ background: T.green, color: '#fff', border: 'none', borderRadius: 4, padding: '4px 12px', cursor: 'pointer', fontSize: 10 }}>Save</button>
                      <button onClick={cancelBuilding} style={{ background: T.border2, color: '#ccc', border: 'none', borderRadius: 4, padding: '4px 12px', cursor: 'pointer', fontSize: 10 }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div onClick={() => startBuildingPlaylist()} style={{ border: `1px dashed ${T.purple}55`, borderRadius: T.r, padding: 7, cursor: 'pointer', color: T.purple, fontSize: 11, textAlign: 'center', marginBottom: 6 }}>+ Новый плейлист</div>
                )}
                {playlists.map(p => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', padding: '6px 10px', borderRadius: T.r, borderLeft: `3px solid ${T.purple}`, background: T.surface, marginBottom: 3 }}>
                    <span style={{ flex: 1, fontSize: 11, cursor: 'pointer' }} onClick={() => loadPlaylist(p.id)}>{p.name} <span style={{ color: T.dim, fontSize: 9 }}>({p.tracks.length})</span></span>
                    <IB c={T.green} onClick={() => loadPlaylist(p.id)}>▶</IB>
                    <IB c={T.red} onClick={() => deletePlaylist(p.id)}>✕</IB>
                  </div>
                ))}
              </div>
            )}

            <div style={{ height: 1, background: T.border2, margin: '14px 0' }} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <NB onClick={() => {
                if (!tracks.length) return;
                const prev = (currentIdx ?? 0) - 1;
                const idx = prev < 0 ? tracks.length - 1 : prev;
                loadTrack(idx, { autoplay: true, openSyncEditor: false });
                (window as any).beLiveSwitchMode?.('rehearsal');
                useSyncStore.getState().closeSync();
                useDeckStore.setState({ expanded: true, activeTabId: 'mix' });
              }}>Prev</NB>
              <NB onClick={() => {
                if (!tracks.length) return;
                const next = (currentIdx ?? 0) + 1;
                const idx = next >= tracks.length ? 0 : next;
                loadTrack(idx, { autoplay: true, openSyncEditor: false });
                (window as any).beLiveSwitchMode?.('rehearsal');
                useSyncStore.getState().closeSync();
                useDeckStore.setState({ expanded: true, activeTabId: 'mix' });
              }}>Next</NB>
            </div>
          </div>
        </div>

        {/* ═══ COL 2: SHOWCASE ═══ */}
        {/*
          TC-073: Unified onboarding card + Billy chat.
          Three visual states:
          1. showOnboarding=true → full-height card (steps | chat)
          2. showOnboarding=false, showBillyExpanded=true → full-height chat
          3. showOnboarding=false, showBillyExpanded=false → collapsed header + sections
        */}
        <div style={{ ...colBase, padding: (showOnboarding || showBillyExpanded) ? 0 : 20 }}>
          {showOnboarding ? (
            /* ── ONBOARDING: full-height card ── */
            !isChatMode ? (
              /* Steps mode */
              <>
                <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
                  <OnboardingAccordion onActiveStepChange={setOnboardingStep} />
                </div>
                <button className="bl-catalog-ask-billy" onClick={() => setIsChatMode(true)}
                  style={{ flexShrink: 0, margin: '0 20px 20px' }}>
                  Спроси Билли 🤔
                </button>
              </>
            ) : (
              /* Chat mode */
              isGuest ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div className="bl-catalog-premium-gate">
                    <p>🚀 Войдите, чтобы спросить Билли</p>
                    <button onClick={() => {}}>Войти через Google</button>
                  </div>
                </div>
              ) : (
                <>
                  <button className="bl-catalog-back-to-steps" onClick={() => setIsChatMode(false)}
                    style={{ flexShrink: 0, margin: '20px 20px 0', padding: 0 }}>
                    ← К шагам
                  </button>
                  <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '0 20px 20px' }}>
                    <CatalogBillyChat />
                  </div>
                </>
              )
            )
          ) : (
            /* ── POST-ONBOARDING ── */
            showBillyExpanded ? (
              /* Expanded Billy — full-height chat */
              isGuest ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
                  <div className="bl-catalog-premium-gate">
                    <p>🚀 Войдите, чтобы спросить Билли</p>
                    <button onClick={() => {}}>Войти через Google</button>
                  </div>
                </div>
              ) : (
                <>
                  <button className="bl-catalog-back-to-steps" onClick={() => setShowBillyExpanded(false)}
                    style={{ flexShrink: 0, margin: '20px 20px 0', padding: 0 }}>
                    ← Свернуть
                  </button>
                  <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '0 20px 20px' }}>
                    <CatalogBillyChat />
                  </div>
                </>
              )
            ) : (
              /* Collapsed: compact header + sections */
              <>
                <button onClick={() => setShowBillyExpanded(true)}
                  style={{
                    width: '100%', padding: '14px 20px', borderRadius: T.rL, cursor: 'pointer',
                    background: T.surfaceH, border: `1px solid ${T.border2}`, color: T.dim,
                    fontSize: 14, textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    flexShrink: 0, marginBottom: 14, transition: 'all 0.2s',
                  }}>
                  <span>🎤 Спроси Билли</span>
                  <span style={{ fontSize: 11 }}>▼</span>
                </button>
                <div style={{ flex: 1, overflow: 'auto', paddingRight: 6 }}>
                  {sections.map(sec => (
                    <Sec key={sec.id} s={sec} play={play} tracks={tracks} idx={currentIdx} rec={store.recentTrackIds} />
                  ))}
                </div>
              </>
            )
          )}
        </div>

        {/* ═══ COL 3: SEARCH / UPLOAD ═══ */}
        <div style={colBase}>

          {/* ─── Smart Cell: Track Preparation ─── */}
          <div
            className={`bl-catalog-dropzone ${showOnboarding && onboardingStep === 3 ? 'bl-catalog-dropzone--highlight' : ''} ${mvsepState === 'active' ? 'mvsep-processing' : ''}`}
            style={{
              position: 'relative',
              border: (zipOver || zipHover) ? `2px dashed ${T.orange}` : mvsepState === 'limit_reached' || mvsepState === 'no_key' ? `2px dashed ${T.orange}` : `2px dashed ${T.border2}`,
              borderRadius: T.rL,
              padding: mvsepState === 'active' ? '16px 12px' : '18px 12px',
              textAlign: 'center',
              cursor: mvsepState === 'active' ? 'default' : 'pointer',
              background: zipOver ? 'rgba(99,102,241,0.1)' : zipHover ? 'rgba(255,140,0,0.03)' : 'transparent',
              marginBottom: 10,
              transition: 'all 0.2s',
              overflow: 'hidden',
              minHeight: mvsepState === 'active' ? 80 : undefined,
            }}
            onClick={() => {
              if (mvsepState === 'active') return;
              const input = document.getElementById('bl-smart-file-input') as HTMLInputElement;
              input?.click();
            }}
            onMouseEnter={() => setZipHover(true)} onMouseLeave={() => setZipHover(false)}
            onDragOver={e => {
              e.preventDefault();
              e.stopPropagation();
              const items = e.dataTransfer?.items;
              if (items && items.length > 0) {
                const item = items[0];
                const name = (item as any).name || '';
                if (name) {
                  if (isZipFile(name)) {
                    setDragHint('📦 ZIP — распаковка');
                    setZipOver(true);
                  } else if (isAudioFile(name)) {
                    const check = canAutoSeparate();
                    if (check.allowed) {
                      setDragHint('🎵 Авто-разделение через MVSEP');
                      setZipOver(true);
                    } else {
                      setDragHint('⚠️ Только ZIP при лимите');
                      setZipOver(true);
                    }
                  } else {
                    setDragHint('❌ Неподдерживаемый формат');
                  }
                } else {
                  const mime = item.type || '';
                  if (mime.includes('zip') || mime.includes('compressed')) {
                    setDragHint('📦 ZIP — распаковка');
                    setZipOver(true);
                  } else if (mime.startsWith('audio/')) {
                    const check = canAutoSeparate();
                    if (check.allowed) {
                      setDragHint('🎵 Авто-разделение через MVSEP');
                      setZipOver(true);
                    } else {
                      setDragHint('⚠️ Только ZIP при лимите');
                      setZipOver(true);
                    }
                  } else {
                    setZipOver(true);
                  }
                }
              } else {
                setZipOver(true);
              }
            }}
            onDragLeave={() => { setZipOver(false); setDragHint(''); }}
            onDrop={e => {
              e.preventDefault();
              setZipOver(false);
              setDragHint('');
              const files = e.dataTransfer?.files;
              if (files && files.length > 0) {
                if (files.length === 1) {
                  handleSmartDrop(files[0]);
                } else {
                  handleSmartDropMultiple(files);
                }
              }
            }}
          >
            {/* Hidden file input — accepts both ZIP and audio */}
            <input
              id="bl-smart-file-input"
              type="file"
              accept=".zip,.mp3,.wav,.flac,.ogg,.m4a,.aac,audio/*"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleSmartDrop(file);
                e.target.value = '';
              }}
            />

            {/* Drag-over hint */}
            {dragHint && zipOver && (
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(99,102,241,0.12)',
                backdropFilter: 'blur(2px)',
                WebkitBackdropFilter: 'blur(2px)',
                borderRadius: 8,
                fontSize: 13, fontWeight: 600,
                color: dragHint.includes('⚠️')
                  ? (T.orange || '#f97316')
                  : dragHint.includes('❌')
                    ? (T.orange || '#f97316')
                    : '#6366f1',
                zIndex: 2,
                pointerEvents: 'none',
              }}>
                {dragHint}
              </div>
            )}

            {/* State: IDLE */}
            {mvsepState === 'idle' && !zipBusy && (
              <>
                <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 4 }}>
                  🎵 Трек или ZIP
                </div>
                <div style={{ fontSize: 11, color: T.dim, marginBottom: 2 }}>
                  Перетащите mp3, wav или .zip
                </div>
                <div style={{ fontSize: 10, color: T.dim, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>или нажмите для выбора</span>
                  <MvsepQuotaBadge />
                </div>
              </>
            )}

            {/* State: UPLOADING */}
            {mvsepState === 'uploading' && (
              <>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 6 }}>
                  ⏳ Отправка на MVSEP...
                </div>
                <div style={{
                  height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.1)',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%', borderRadius: 2,
                    background: '#6366f1',
                    width: `${mvsepProgress}%`,
                    transition: 'width 0.3s',
                  }} />
                </div>
              </>
            )}

            {/* State: ACTIVE (processing) */}
            {mvsepState === 'active' && (() => {
              const jobs = useMvsepStore.getState().activeJobs;
              const activeJob = [...jobs.values()].find(
                (j) => j.status !== 'done' && j.status !== 'failed' && j.status !== 'timeout'
              );
              if (!activeJob) return null;
              const progress = getEstimatedProgress(activeJob);
              const elapsed = getElapsedString(activeJob.submittedAt);
              return (
                <>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 4 }}>
                    🔄 Разделяем «{activeJob.fileName.replace(/\.[^.]+$/, '')}»...
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      flex: 1, height: 4, borderRadius: 2,
                      background: 'rgba(255,255,255,0.1)', overflow: 'hidden',
                    }}>
                      <div style={{
                        height: '100%', borderRadius: 2,
                        background: '#6366f1',
                        width: `${progress}%`,
                        transition: 'width 1s',
                      }} />
                    </div>
                    <span style={{ fontSize: 10, color: T.dim }}>MVSEP {elapsed}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleCancelMvsep(); }}
                      style={{
                        background: 'transparent', border: 'none',
                        color: T.dim, fontSize: 12, cursor: 'pointer',
                        padding: '2px 4px',
                      }}
                    >
                      ✕
                    </button>
                  </div>
                </>
              );
            })()}

            {/* State: LIMIT REACHED */}
            {mvsepState === 'limit_reached' && (
              <>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.orange, marginBottom: 4 }}>
                  ⚠️ Лимит на сегодня
                </div>
                <div style={{ fontSize: 11, color: T.dim, marginBottom: 6 }}>
                  Кидайте .zip или добавьте свой ключ
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); useAppStore.getState().setSurface('profile'); }}
                    style={{
                      padding: '4px 8px', borderRadius: 4,
                      border: '1px solid #6366f1',
                      background: 'transparent',
                      color: '#6366f1',
                      fontSize: 10, cursor: 'pointer',
                    }}
                  >
                    🔑 Добавить ключ
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); window.open('https://mvsep.com/ru', '_blank'); }}
                    style={{
                      padding: '4px 8px', borderRadius: 4,
                      border: '1px solid rgba(255,255,255,0.15)',
                      background: 'transparent',
                      color: T.dim,
                      fontSize: 10, cursor: 'pointer',
                    }}
                  >
                    🔗 mvsep.com
                  </button>
                </div>
              </>
            )}

            {/* State: AUTH_REQUIRED (Guest) */}
            {mvsepState === 'auth_required' && (
              <>
                <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 4 }}>
                  🎵 Трек или ZIP
                </div>
                <div style={{ fontSize: 11, color: T.dim, marginBottom: 6 }}>
                  Войдите для авто-разделения или кидайте .zip
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); useAppStore.getState().setSurface('welcome'); }}
                  style={{
                    padding: '4px 10px', borderRadius: 4,
                    border: '1px solid #6366f1',
                    background: '#6366f1',
                    color: '#fff',
                    fontSize: 11, cursor: 'pointer',
                  }}
                >
                  🔑 Войти через Google
                </button>
              </>
            )}

            {/* State: NO_KEY */}
            {mvsepState === 'no_key' && (
              <>
                <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 4 }}>
                  🎵 Трек или ZIP
                </div>
                <div style={{ fontSize: 11, color: T.dim, marginBottom: 6 }}>
                  Только .zip — добавьте ключ MVSEP для авто-разделения
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      useAppStore.getState().setSurface('profile');
                    }}
                    style={{
                      padding: '4px 8px', borderRadius: 4,
                      border: '1px solid #6366f1',
                      background: 'transparent',
                      color: '#6366f1',
                      fontSize: 10, cursor: 'pointer',
                    }}
                  >
                    🔑 Добавить ключ
                  </button>
                </div>
              </>
            )}

            {/* State: CONCURRENT */}
            {mvsepState === 'concurrent' && (
              <>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 4 }}>
                  ⏳ Трек в очереди
                </div>
                <div style={{ fontSize: 11, color: T.dim, marginBottom: 6 }}>
                  Перед вами 1 трек на разделение
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); useAppStore.getState().setSurface('profile'); }}
                  style={{
                    padding: '4px 8px', borderRadius: 4,
                    border: '1px solid #6366f1',
                    background: 'transparent',
                    color: '#6366f1',
                    fontSize: 10, cursor: 'pointer',
                  }}
                >
                  🔑 Свой ключ — без очереди
                </button>
              </>
            )}

            {/* State: ERROR */}
            {mvsepState === 'error' && (
              <>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.orange, marginBottom: 4 }}>
                  ❌ Ошибка
                </div>
                <div style={{ fontSize: 11, color: T.dim, marginBottom: 6 }}>
                  {mvsepError}
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); setMvsepState('idle'); }}
                    style={{
                      padding: '4px 8px', borderRadius: 4,
                      border: '1px solid #6366f1',
                      background: 'transparent',
                      color: '#6366f1',
                      fontSize: 10, cursor: 'pointer',
                    }}
                  >
                    🔄 Повторить
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); window.open('https://mvsep.com/ru', '_blank'); }}
                    style={{
                      padding: '4px 8px', borderRadius: 4,
                      border: '1px solid rgba(255,255,255,0.15)',
                      background: 'transparent',
                      color: T.dim,
                      fontSize: 10, cursor: 'pointer',
                    }}
                  >
                    🔗 mvsep.com
                  </button>
                </div>
              </>
            )}

            {/* State: ZIP BUSY — existing flow */}
            {zipBusy && (
              <>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 6 }}>
                  📦 Распаковка ZIP...
                </div>
                <div style={{
                  height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.1)',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%', borderRadius: 2,
                    background: '#6366f1',
                    width: `${zipProgress}%`,
                    transition: 'width 0.3s',
                  }} />
                </div>
              </>
            )}
          </div>

          {/* 2. Manual upload */}
          <div onClick={() => setShowManual(!showManual)} style={{
            padding: '6px 10px', cursor: 'pointer', color: T.dim, fontSize: 11,
            borderRadius: T.r, marginBottom: showManual ? 0 : 4,
            background: showManual ? T.surfaceH : 'transparent',
          }}>{showManual ? '▲ Ручная загрузка' : '▶ Ручная загрузка'}</div>
          {showManual && <div style={{ marginBottom: 8 }}>
            <UploadPanel onClose={() => { setShowManual(false); setPendingLyricsTrackId(null); setPendingLyricsTitle(''); }} onSaved={() => { setShowManual(false); setPendingLyricsTrackId(null); setPendingLyricsTitle(''); setTimeout(() => { document.dispatchEvent(new CustomEvent('tracks-changed', { detail: { source: 'catalog' } })); onClose(); }, 500); }} autoOpenLyrics={pendingLyricsTrackId !== null} pendingTrackId={pendingLyricsTrackId} pendingTrackTitle={pendingLyricsTrackId ? pendingLyricsTitle : null} />

          </div>}



          {/* 4. Search */}
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Найти трек..."
            style={{ width: '100%', background: 'rgba(0,0,0,0.3)', color: '#fff', border: `1px solid ${T.border2}`, borderRadius: T.r, padding: '8px 12px', fontSize: 12, marginBottom: 8, boxSizing: 'border-box', outline: 'none' }} />

          {/* 5. Track list */}
          <div style={{ height: 1, background: T.border2, margin: '4px 0 8px' }} />
          <div style={{ fontSize: 10, fontWeight: 700, color: T.dim, marginBottom: 6, letterSpacing: '0.05em' }}>ВСЕ ТРЕКИ ({filtered.length})</div>
          <div ref={trackListRef} style={{ flex: 1, overflow: 'auto' }}>
            {filtered.length === 0 ? (
              <div style={{ color: T.mute, fontSize: 11, padding: 12 }}>{searchQuery ? 'Не найдено' : 'Нет треков'}</div>
            ) : filtered.map((t, i) => {
              const a = t.index === currentIdx;
              const inMy = myMusicIds.includes(Number(t.id));
              const p = parseTrackName(t.title || '');
              const label = p.artist !== 'Разное' ? `${p.artist} — ${p.title}` : p.title || `Track ${t.index + 1}`;
              return (
                <div key={t.id ?? i}
                  className={`track-card${t.mvsepStatus === 'processing' ? ' track-card--mvsep-processing' : ''}${t.mvsepStatus === 'failed' || t.mvsepStatus === 'timeout' ? ' track-card--mvsep-failed' : ''}`}
                  style={{
                    display: 'flex', alignItems: 'center', padding: '6px 10px', borderRadius: T.r,
                    marginBottom: 2, background: a ? T.orangeD : T.surface,
                    border: `1px solid ${a ? T.orange + '22' : T.border}`, cursor: 'pointer',
                  }}>
                  <CoverArt url={t.coverArtUrl} title={t.title} size={32} borderRadius={6} />
                  {/* MVSEP Status Badge */}
                  {t.mvsepStatus === 'processing' && (
                    <div className="mvsep-badge mvsep-badge--processing" style={{ marginLeft: 4, flexShrink: 0 }}>
                      🔄
                    </div>
                  )}
                  {t.mvsepStatus === 'failed' && (
                    <div className="mvsep-badge mvsep-badge--failed" style={{ marginLeft: 4, flexShrink: 0 }}>
                      ❌
                    </div>
                  )}
                  {t.mvsepStatus === 'timeout' && (
                    <div className="mvsep-badge mvsep-badge--timeout" style={{ marginLeft: 4, flexShrink: 0 }}>
                      ⏱️
                    </div>
                  )}
                  <span onClick={() => play(t.index)} style={{ flex: 1, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: a ? T.orange : T.text, marginLeft: 8 }}>
                    {a && '▶ '}{label}
                  </span>
                  {/* MVSEP failed/timeout actions */}
                  {(t.mvsepStatus === 'failed' || t.mvsepStatus === 'timeout') && (
                    <div className="mvsep-card-actions" style={{ marginRight: 8 }}>
                      <button
                        className="mvsep-card-action mvsep-card-action--primary"
                        onClick={(e) => {
                          e.stopPropagation();
                          const input = document.getElementById('bl-smart-file-input') as HTMLInputElement;
                          input?.click();
                        }}
                      >
                        🔄
                      </button>
                      <button
                        className="mvsep-card-action mvsep-card-action--danger"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteTrack(Number(t.id));
                        }}
                      >
                        🗑️
                      </button>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 1, flexShrink: 0 }}>
                    {isBuilding && <IB c={T.purple} onClick={() => addToBuildingPlaylist({ trackId: Number(t.id), title: label, addedAt: new Date().toISOString() })}>+</IB>}
                    {!inMy && <IB c={T.green} onClick={() => addToMyMusic(Number(t.id))}>+</IB>}
                    <IB c={T.red} onClick={() => del(t.id, label)}>✕</IB>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function IB({ c, children, onClick, o }: { c: string; children: React.ReactNode; onClick: (e: React.MouseEvent) => void; o?: number }) {
  return <button onClick={onClick} style={{ background: 'none', border: 'none', cursor: 'pointer', color: c, fontSize: 13, padding: '2px 4px', lineHeight: 1, opacity: o ?? 1, transition: 'opacity 0.15s' }}>{children}</button>;
}

function NB({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return <button onClick={onClick} style={{ background: 'rgba(255,255,255,0.05)', color: '#aaa', border: `1px solid rgba(255,255,255,0.08)`, borderRadius: 4, padding: '5px 16px', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>{children}</button>;
}

function Sec({ s, play, tracks, idx, rec }: { s: ShowcaseSection; play: (i: number) => void; tracks: any[]; idx: number; rec: number[] }) {
  const items = s.id === 'recent'
    ? rec.map(id => { const t = tracks.find((x: any) => Number(x.id) === id); if (!t) return null; const p = parseTrackName(t.title || ''); return { id: String(id), title: p.title, artist: p.artist, coverArtUrl: t.coverArtUrl, _index: t.index } as any; }).filter(Boolean)
    : s.items;
  if (s.id === 'recent' && items.length === 0) return null;

  return (
    <div style={{ marginBottom: 36 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: T.dim, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 16 }}>{s.title}</div>
      {s.type === 'featured' ? s.items.map(item => (
        <div key={item.id} style={{
          background: s.id === 'coming-soon' ? `linear-gradient(135deg, ${T.purpleD} 0%, ${T.orangeD} 100%)` : T.purpleD,
          border: `1px solid ${T.purple}22`, borderRadius: T.rL, padding: '28px 24px',
        }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 10, lineHeight: 1.3 }}>{item.title}</div>
          {item.description && <div style={{ fontSize: 13, color: '#aaa', lineHeight: 1.6 }}>{item.description}</div>}
        </div>
      )) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(items as any[]).map((item: any) => {
            const ex = s.type === 'exercises';
            return (
              <div key={item.id} onClick={() => item._index !== undefined && play(item._index)} style={{
                padding: ex ? '16px 18px' : '10px 14px', borderRadius: ex ? T.rL : T.r,
                background: item._index === idx ? T.purpleD : T.surface,
                border: `1px solid ${item._index === idx ? T.purple + '33' : T.border}`,
                cursor: item._index !== undefined ? 'pointer' : 'default',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <CoverArt url={item.coverArtUrl} title={item.title} size={32} borderRadius={6} />
                  <div style={{ flex: 1, minWidth: 0, marginLeft: 8 }}>
                    <div style={{ fontSize: ex ? 15 : 13, fontWeight: ex ? 600 : 500, color: item._index === idx ? T.purple : T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item._index === idx && '▶ '}{item.artist && item.artist !== 'Разное' ? `${item.artist} — ` : ''}{item.title}
                    </div>
                    {item.description && <div style={{ fontSize: 11, color: T.dim, marginTop: 5, lineHeight: 1.5 }}>{item.description}</div>}
                  </div>
                  {item.sourceType === 'youtube' && <span style={{ fontSize: 9, color: T.purple, background: T.purpleD, padding: '2px 8px', borderRadius: 3, marginLeft: 10, fontWeight: 600 }}>video</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
