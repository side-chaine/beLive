import React, { useCallback, useEffect, useState, useRef } from 'react';
import './CatalogLayout.css';
import { CoverArt } from '../../components/CoverArt';
import { UploadPanel } from '../../components/UploadPanel';
import { useTrackStore } from '../../stores/track.store';
import { loadTrack, deleteTrack } from '../../services/track.actions';
import { handleZipFileSelect } from '../../services/upload.actions';
import { useCatalogStore } from '../store/catalog.store';
import { useDeckStore } from '../../stores/deck.store';
import { useSyncStore } from '../../sync/store/sync.store';
import { useUIStore } from '../../stores/ui.store';
import { useSwipe } from '../hooks/useSwipe';
import { CatalogContent } from './CatalogContent';
import { T, colBase, IB, NB } from '../theme';
import { AvatarEngine } from '../../avatar/AvatarEngine';

interface Props { color: string; onClose: () => void; } // deploy-force





export function CatalogLayout({ color, onClose }: Props) {
  const tracks = useTrackStore(s => s.tracksMeta);
  const currentIdx = useTrackStore(s => s.currentTrackIndex);
  const store = useCatalogStore();
  const {
    playlists,
    syncMyMusicFromLegacy, syncPlaylistsFromLegacy,
    removeFromMyMusic,
    startBuildingPlaylist, savePlaylist, deletePlaylist, loadPlaylist,
    cancelBuilding, isBuilding, buildingName, setBuildingName,
    addToBuildingPlaylist, buildingTracks,
    addRecentTrack,
    toggleArtist, getGroupedMyMusic,
  } = store;

  const [plOpen, setPlOpen] = useState(false);
  const [hovId, setHovId] = useState<number | null>(null);
  const [zipBusy, setZipBusy] = useState(false);
  const [zipProgress, setZipProgress] = useState(0);
  const zipBusyRef = useRef(false);
  const [zipOver, setZipOver] = useState(false);
  const [zipHover, setZipHover] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [pendingLyricsTrackId, setPendingLyricsTrackId] = useState<number|null>(null);
  const [pendingLyricsTitle, setPendingLyricsTitle] = useState('');
  const safetyTimedOut = useRef(false); // guard: safety timeout already reset UI

  const gridRef = useRef<HTMLDivElement>(null);
  const activeFeedColumn = useUIStore(s => s.activeFeedColumn);
  const setActiveFeedColumn = useUIStore(s => s.setActiveFeedColumn);
  const catalogTab = useUIStore(s => s.catalogTab);
  const setCatalogTab = useUIStore(s => s.setCatalogTab);
  const goToUpload = useCallback(() => {
    setCatalogTab('upload');
    setActiveFeedColumn(2);
  }, [setCatalogTab, setActiveFeedColumn]);

  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const onScroll = () => { const idx = Math.round(el.scrollLeft / el.clientWidth); if (idx !== activeFeedColumn) setActiveFeedColumn(idx); };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [activeFeedColumn, setActiveFeedColumn]);

  useSwipe(gridRef, {
    onSwipeLeft: () => { const n = Math.min(activeFeedColumn + 1, 2); if (n !== activeFeedColumn) { setActiveFeedColumn(n); gridRef.current?.scrollTo({ left: n * (gridRef.current?.clientWidth || 0), behavior: 'smooth' }); } },
    onSwipeRight: () => { const n = Math.max(activeFeedColumn - 1, 0); if (n !== activeFeedColumn) { setActiveFeedColumn(n); gridRef.current?.scrollTo({ left: n * (gridRef.current?.clientWidth || 0), behavior: 'smooth' }); } },
  });

  useEffect(() => {
    if (activeFeedColumn === 0 || !window.history) return;
    window.history.replaceState({ catalog: true, column: activeFeedColumn }, '');
    const onPop = () => {
      setActiveFeedColumn(0);
      window.history.replaceState({ catalog: true, column: 0 }, '');
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [activeFeedColumn, setActiveFeedColumn]);

  useEffect(() => {
    const dh = (e: Event) => { const d = (e as CustomEvent).detail; if (d?.tab) useDeckStore.setState({ activeTabId: d.tab, expanded: d.expanded ?? true }); };
    const ch = () => onClose();
    document.addEventListener('deck-set-tab', dh);
    document.addEventListener('catalog-close', ch);
    return () => { document.removeEventListener('deck-set-tab', dh); document.removeEventListener('catalog-close', ch); };
  }, [onClose]);

  useEffect(() => { syncMyMusicFromLegacy(); syncPlaylistsFromLegacy(); }, []);

  // Listen for track-saved event to open upload tab (Listener #2 of 2)
  // Listener #1 (ghost cleanup) lives in CatalogContent.tsx. НЕ объединять.
  useEffect(() => {
    const handler = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (!d.hasLyrics) {
        setPendingLyricsTrackId(d.trackId);
        setPendingLyricsTitle(d.title || '');
        setShowManual(true);
        goToUpload();
      } else {
        setActiveFeedColumn(1);
      }
    };
    document.addEventListener('track-saved', handler);
    return () => document.removeEventListener('track-saved', handler);
  }, [goToUpload]);

  const play = useCallback((index: number) => {
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

  const handleZip = useCallback(async (file: File, onProgress?: (pct: number) => void) => {
    if (zipBusyRef.current) return;
    zipBusyRef.current = true;
    // Guard: skip if already processing (dropzone blocks via zipBusy check separately)
    setZipBusy(true);
    setZipProgress(0);
    safetyTimedOut.current = false;

    // Safety timeout: force-reset zipBusy after 60s if stuck (SceneImport can take 45s+)
    const safetyTimer = setTimeout(() => {
      console.warn('[ZIP] safety timeout — forcing zipBusy=false');
      safetyTimedOut.current = true;
      zipBusyRef.current = false;
      setZipBusy(false);
    }, 60000);

    try {
      await handleZipFileSelect(file, (pct) => { setZipProgress(pct); onProgress?.(pct); });
      clearTimeout(safetyTimer);
      setTimeout(() => document.dispatchEvent(new CustomEvent('tracks-changed', { detail: { source: 'catalog' } })), 2000)
    } catch (err) {
      console.error('[ZIP] handleZip error:', err);
      clearTimeout(safetyTimer);
      alert('ZIP failed.');
    } finally {
      if (import.meta.env.DEV) console.log('[ZIP] finally called, timedOut=', safetyTimedOut.current);
      zipBusyRef.current = false;
      clearTimeout(safetyTimer);
      if (!safetyTimedOut.current) {
        setTimeout(() => {
          setZipBusy(false);
          setZipProgress(0);
        }, 800);
      }
    }
  }, []); // no deps — zipBusy/zipProgress are stable setters

  // TG download — не используется в текущей версии (будет восстановлен позже)

  const groups = getGroupedMyMusic();

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
      <div ref={gridRef} className="bl-catalog-grid" style={{ flex: 1, minHeight: 0, padding: '12px 16px 16px' }}>

        {/* ═══ COL 0: AVATAR ═══ */}
        <div className="bl-catalog-col" style={{ ...colBase, alignItems: 'center', justifyContent: 'center' }}>
          <AvatarEngine mode="compact" />
        </div>

        {/* ═══ COL 1: CATALOG CENTER (search + tracks + TG) ═══ */}
        <div className="bl-catalog-col" style={colBase}>
          <CatalogContent
            color={color}
            handleZip={handleZip}
            play={play}
            del={del}
          />
        </div>

        {/* ═══ COL 2: CATALOG ═══ */}
        <div className="bl-catalog-col" style={colBase}>
          <div style={{ display:'flex', gap:4, marginBottom:8, flexShrink:0 }}>
            <button onClick={()=>setCatalogTab('my-music')} style={{ flex:1, padding:'6px 0', fontSize:11, fontWeight:700, cursor:'pointer', color:catalogTab==='my-music'?T.green:T.dim, borderBottom:catalogTab==='my-music'?`2px solid ${T.green}`:'2px solid transparent', background:'none', border:'none', letterSpacing:'0.05em' }}>МОЯ МУЗЫКА</button>
            <button onClick={goToUpload} style={{ flex:1, padding:'6px 0', fontSize:11, fontWeight:700, cursor:'pointer', color:catalogTab==='upload'?T.orange:T.dim, borderBottom:catalogTab==='upload'?`2px solid ${T.orange}`:'2px solid transparent', background:'none', border:'none', letterSpacing:'0.05em' }}>ЗАГРУЗКА</button>
          </div>

          <div style={{ display:catalogTab==='my-music'?'flex':'none', flexDirection:'column', flex:1, minHeight:0 }}>
            <div style={{ flex:1, overflow:'auto', paddingRight:2 }}>
              {groups.length===0&&<div style={{ color:T.mute, fontSize:11, padding:'16px 4px', lineHeight:1.6 }}>Нажмите + на треке в каталоге</div>}
              {groups.map(g=>(
                <div key={g.artist} style={{ marginBottom:8 }}>
                  <div onClick={()=>toggleArtist(g.artist)} style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 10px', cursor:'pointer', borderRadius:T.r, borderLeft:`3px solid ${T.green}`, background:g.expanded?T.greenD:'transparent' }}>
                    <span style={{ fontSize:9, color:T.dim, width:10 }}>{g.expanded?'▼':'▶'}</span>
                    <span style={{ flex:1, fontSize:13, fontWeight:600 }}>{g.artist}</span>
                    <span style={{ fontSize:10, color:T.dim }}>{g.tracks.length}</span>
                  </div>
                  {g.expanded&&g.tracks.map(t=>{const a=t.index===currentIdx; return(
                    <div key={t.id} onMouseEnter={()=>setHovId(t.id)} onMouseLeave={()=>setHovId(null)} onClick={()=>play(t.index)} style={{ display:'flex', alignItems:'center', marginLeft:18, padding:'5px 10px', borderRadius:4, background:a?T.greenD:'transparent', cursor:'pointer', marginTop:2 }}>
                      <CoverArt url={t.coverArtUrl} title={t.title} size={28} borderRadius={5} />
                      <span style={{ flex:1, fontSize:12, color:a?T.green:T.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginLeft:8 }}>{a&&'▶ '}{t.title}</span>
                      {(()=>{const tc=(window as any).trackCatalog;const ft=tc?.tracks?.find((tr:any)=>String(tr.id)===String(t.id));const sc=ft?.stemsData?Object.keys(ft.stemsData).length:0;if(sc>2)return<span style={{fontSize:9,fontWeight:700,padding:'2px 5px',borderRadius:3,border:'1px solid #4CAF5066',color:'#4CAF50',letterSpacing:'0.05em',flexShrink:0,marginLeft:6}}>‹ FULL ›</span>;if(ft?.vocalsData||sc===2)return<span style={{fontSize:9,fontWeight:700,padding:'2px 5px',borderRadius:3,border:'1px solid #FF8C0066',color:'#FF8C00',letterSpacing:'0.05em',flexShrink:0,marginLeft:6}}>‹ DUO ›</span>;return null;})()}
                      {isBuilding&&<IB c={T.purple} onClick={e=>{e.stopPropagation();addToBuildingPlaylist({trackId:t.id,title:t.fullTitle,addedAt:new Date().toISOString()});}}>+</IB>}
                      <IB c={T.red} o={hovId===t.id?1:0} onClick={e=>{e.stopPropagation();removeFromMyMusic(t.id);}}>✕</IB>
                    </div>);})}
                </div>
              ))}
              <div style={{ height:1, background:T.border2, margin:'14px 0' }} />
              <div onClick={()=>setPlOpen(!plOpen)} style={{ display:'flex', alignItems:'center', gap:6, padding:'4px 0', cursor:'pointer' }}>
                <span style={{ fontSize:9, color:T.dim, width:10 }}>{plOpen?'▼':'▶'}</span>
                <span style={{ fontSize:11, fontWeight:700, color:T.dim, letterSpacing:'0.05em' }}>ПЛЕЙЛИСТЫ</span>
                <span style={{ fontSize:10, color:T.mute }}>({playlists.length})</span>
              </div>
              {plOpen&&(<div style={{ marginTop:6 }}>
                {isBuilding?(<div style={{ background:T.purpleD, border:`1px solid ${T.purple}33`, borderRadius:T.r, padding:10, marginBottom:6 }}>
                  <input value={buildingName} onChange={e=>setBuildingName(e.target.value)} placeholder="Авто-имя" autoFocus style={{ width:'100%', background:'rgba(0,0,0,0.3)', border:`1px solid ${T.border2}`, borderRadius:4, padding:'5px 8px', fontSize:11, marginBottom:5, boxSizing:'border-box', outline:'none' }} />
                  <div style={{ fontSize:10, color:T.dim, marginBottom:5 }}>Треков: {buildingTracks.length}</div>
                  <div style={{ display:'flex', gap:4 }}><button onClick={savePlaylist} style={{ background:T.green, color:'#fff', border:'none', borderRadius:4, padding:'4px 12px', cursor:'pointer', fontSize:10 }}>Save</button><button onClick={cancelBuilding} style={{ background:T.border2, color:'#ccc', border:'none', borderRadius:4, padding:'4px 12px', cursor:'pointer', fontSize:10 }}>Cancel</button></div>
                </div>):<div onClick={()=>startBuildingPlaylist()} style={{ border:`1px dashed ${T.purple}55`, borderRadius:T.r, padding:7, cursor:'pointer', color:T.purple, fontSize:11, textAlign:'center', marginBottom:6 }}>+ Новый плейлист</div>}
                {playlists.map(p=>(<div key={p.id} style={{ display:'flex', alignItems:'center', padding:'6px 10px', borderRadius:T.r, borderLeft:`3px solid ${T.purple}`, background:T.surface, marginBottom:3 }}><span style={{ flex:1, fontSize:11, cursor:'pointer' }} onClick={()=>loadPlaylist(p.id)}>{p.name} <span style={{ color:T.dim, fontSize:9 }}>({p.tracks.length})</span></span><IB c={T.green} onClick={()=>loadPlaylist(p.id)}>▶</IB><IB c={T.red} onClick={()=>deletePlaylist(p.id)}>✕</IB></div>))}
              </div>)}
              <div style={{ height:1, background:T.border2, margin:'14px 0' }} />
              <div style={{ display:'flex', gap:8, justifyContent:'center' }}>
                <NB onClick={()=>{if(!tracks.length)return;const prev=(currentIdx??0)-1;loadTrack(prev<0?tracks.length-1:prev,{autoplay:true});(window as any).beLiveSwitchMode?.('rehearsal');useSyncStore.getState().closeSync();useDeckStore.setState({expanded:true,activeTabId:'mix'});}}>Prev</NB>
                <NB onClick={()=>{if(!tracks.length)return;const next=(currentIdx??0)+1;loadTrack(next>=tracks.length?0:next,{autoplay:true});(window as any).beLiveSwitchMode?.('rehearsal');useSyncStore.getState().closeSync();useDeckStore.setState({expanded:true,activeTabId:'mix'});}}>Next</NB>
              </div>
            </div>
          </div>
          {/* ── Upload tab: PORT + Manual upload ── */}
          <div style={{ display:catalogTab==='upload'?'flex':'none', flexDirection:'column', flex:1, minHeight:0, overflow:'auto', gap:8 }}>
            {/* PORT dropzone */}
            <div onClick={()=>{if(zipBusy)return;const input=document.getElementById('bl-smart-file-input') as HTMLInputElement;input?.click();}} onMouseEnter={()=>setZipHover(true)} onMouseLeave={()=>setZipHover(false)} onDragOver={e=>{e.preventDefault();e.stopPropagation();setZipOver(true);}} onDragLeave={()=>setZipOver(false)} onDrop={e=>{e.preventDefault();setZipOver(false);const files=e.dataTransfer?.files;if(files&&files.length>0)handleZip(files[0]);}} style={{ border:zipOver?`2px dashed ${T.orange}`:`1.5px dashed ${zipHover?T.orange:T.border2}`, borderRadius:T.rL, padding:'20px 16px', textAlign:'center', cursor:zipBusy?'default':'pointer', background:zipOver?'rgba(255,140,0,0.07)':zipHover?'rgba(255,140,0,0.03)':'transparent', transition:'all 0.2s', overflow:'hidden', minHeight:88, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:6 }}>
              <input id="bl-smart-file-input" type="file" accept=".zip" style={{ display:'none' }} onChange={e=>{const file=e.target.files?.[0];if(file)handleZip(file);e.target.value='';}} />
              {!zipBusy?(<>
                {zipOver&&<div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(255,140,0,0.10)', borderRadius:T.rL, fontSize:13, fontWeight:600, color:T.orange, zIndex:2, pointerEvents:'none' }}>📦 Отпустите ZIP</div>}
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:12 }}>
                    <div style={{ display:'flex', gap:2 }}>{(zipOver||zipHover)?<><span style={{fontSize:15,fontWeight:700,color:'rgba(255,140,0,0.9)',animation:'bl-chev-pull 1.4s ease-in-out 0.36s infinite'}}>›</span><span style={{fontSize:19,fontWeight:700,color:'rgba(255,140,0,0.9)',animation:'bl-chev-pull 1.4s ease-in-out 0.18s infinite'}}>›</span><span style={{fontSize:24,fontWeight:700,color:'rgba(255,140,0,0.9)',animation:'bl-chev-pull 1.4s ease-in-out 0s infinite'}}>›</span></>:<><span style={{fontSize:18,fontWeight:700,color:'rgba(255,140,0,0.18)'}}>›</span><span style={{fontSize:18,fontWeight:700,color:'rgba(255,140,0,0.18)'}}>›</span></>}</div>
                    <div style={{fontSize:28,fontWeight:800,letterSpacing:'0.22em',color:zipOver||zipHover?'#FF8C00':'rgba(255,255,255,0.82)',transition:'color 0.2s',lineHeight:1}}>ПОРТ</div>
                    <div style={{ display:'flex', gap:2 }}>{(zipOver||zipHover)?<><span style={{fontSize:24,fontWeight:700,color:'rgba(255,140,0,0.9)',animation:'bl-chev-pull 1.4s ease-in-out 0s infinite'}}>‹</span><span style={{fontSize:19,fontWeight:700,color:'rgba(255,140,0,0.9)',animation:'bl-chev-pull 1.4s ease-in-out 0.18s infinite'}}>‹</span><span style={{fontSize:15,fontWeight:700,color:'rgba(255,140,0,0.9)',animation:'bl-chev-pull 1.4s ease-in-out 0.36s infinite'}}>‹</span></>:<><span style={{fontSize:18,fontWeight:700,color:'rgba(255,140,0,0.18)'}}>‹</span><span style={{fontSize:18,fontWeight:700,color:'rgba(255,140,0,0.18)'}}>‹</span></>}</div>
                  </div>
                  <div style={{fontSize:11,color:zipOver||zipHover?'rgba(255,140,0,0.65)':'rgba(255,255,255,0.22)',letterSpacing:'0.05em',transition:'color 0.2s'}}>{zipOver||zipHover?'закинуть ZIP':'перетащите .zip или нажмите'}</div>
                </div>
              </>):(
                <div style={{ display:'flex', flexDirection:'column', gap:4, width:'100%' }}>
                  {[{label:'Чтение архива',t:10},{label:'Импорт треков',t:90},{label:'Финализация',t:95}].map((p,i)=>{const d=zipProgress>p.t;const a=(i===0&&zipProgress<=10)||(i===1&&zipProgress>10)||(i===2&&zipProgress>90);return(
                    <div key={p.label} style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <div style={{width:6,height:6,borderRadius:'50%',background:d?'#4ade80':a?T.orange:'rgba(255,255,255,0.15)'}} />
                      <span style={{fontSize:11,flex:1,textAlign:'left',color:d?'#4ade80':a?T.orange:T.mute,fontWeight:a?600:400}}>{p.label}</span>
                      <span style={{fontSize:11,color:d?'#4ade80':a?T.orange:T.mute}}>{d?'✓':a?`${zipProgress}%`:'—'}</span>
                    </div>);})}
                  <div style={{width:'100%',height:3,borderRadius:2,background:'rgba(255,255,255,0.08)',overflow:'hidden'}}>
                    <div style={{height:'100%',borderRadius:2,width:zipProgress>0?`${zipProgress}%`:'40%',transition:zipProgress>0?'width 0.4s ease':undefined,background:zipProgress>0&&zipProgress<=35?'linear-gradient(90deg,#FF8C00 0%,#ffcc80 50%,#FF8C00 100%)':T.orange,backgroundSize:zipProgress>0&&zipProgress<=35?'300% 100%':undefined,animation:zipProgress===0?'bl-zip-slide 1.4s ease-in-out infinite':zipProgress<=35?'bl-tg-pulse 1.8s linear infinite':undefined}} />
                  </div>
                </div>
              )}
            </div>

            {/* Manual upload toggle */}
            <div onClick={()=>setShowManual(!showManual)} style={{ padding:'6px 10px', cursor:'pointer', color:T.dim, fontSize:11, borderRadius:T.r, marginTop:8, background:showManual?T.surfaceH:'transparent' }}>
              {showManual?'▲ Ручная загрузка':'▶ Ручная загрузка'}
            </div>
            {showManual&&<div style={{ marginTop:8 }}>
              <UploadPanel autoOpenLyrics={pendingLyricsTrackId!==null} pendingTrackId={pendingLyricsTrackId} pendingTrackTitle={pendingLyricsTrackId?pendingLyricsTitle:null} onClose={()=>{setPendingLyricsTrackId(null);setPendingLyricsTitle('');setShowManual(false);setActiveFeedColumn(1);}} onSaved={()=>{setPendingLyricsTrackId(null);setPendingLyricsTitle('');setShowManual(false);setActiveFeedColumn(1);}} />
            </div>}
          </div>
        </div>
      </div>
      <div style={{ display:'flex', justifyContent:'center', gap:8, padding:'8px 0', flexShrink:0 }}>
        {[0,1,2].map(i=>(<div key={i} style={{ width:6, height:6, borderRadius:'50%', background:i===activeFeedColumn?'#FF8C00':'rgba(255,255,255,0.2)', transition:'background 0.2s' }} />))}
      </div>
    </div>
  );
}



// @TC-088: Sec replaced by FeedLayout — kept for potential rollback
// function Sec(...) { ... }
/* function Sec({ s, play, tracks, idx, rec }: { s: ShowcaseSection; play: (i: number) => void; tracks: any[]; idx: number; rec: number[] }) {
  ...
} */
