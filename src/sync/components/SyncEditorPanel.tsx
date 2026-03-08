import React, { useRef, useEffect, useCallback } from 'react';
import { useSyncStore } from '../store/sync.store';
import { useAudioStore } from '../../stores/audio.store';
import { useLyricsStore } from '../../stores/lyrics.store';
import { useMarkersStore } from '../../stores/markers.store';
import { WaveformCanvas } from './WaveformCanvas';
import { requestCloseSync } from '../bridge/sync.bridge';
import { getTrack } from '../../services/idb.service';
import { useTrackStore } from '../../stores/track.store';

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const SOURCE_CYCLE = ['mix', 'instrumental', 'vocal'] as const;
const SOURCE_LABELS = { instrumental: 'I', vocal: 'V', mix: 'M' } as const;

export default function SyncEditorPanel() {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeSync = requestCloseSync;
  const zoomIn = useSyncStore((s) => s.zoomIn);
  const zoomOut = useSyncStore((s) => s.zoomOut);
  const followPlayhead = useSyncStore((s) => s.followPlayhead);
  const toggleFollow = useSyncStore((s) => s.toggleFollow);
  const markersVisible = useSyncStore((s) => s.markersVisible);
  const toggleMarkersVisible = useSyncStore((s) => s.toggleMarkersVisible);
  const isDirty = useSyncStore((s) => s.isDirty);
  const undo = useSyncStore((s) => s.undo);
  const redo = useSyncStore((s) => s.redo);
  const undoStack = useSyncStore((s) => s.undoStack);
  const redoStack = useSyncStore((s) => s.redoStack);
  const markClean = useSyncStore((s) => s.markClean);
  const sourceMode = useSyncStore((s) => s.sourceMode);
  const setSourceMode = useSyncStore((s) => s.setSourceMode);
  const currentTime = useAudioStore((s) => s.currentTime);
  const instrumentalVolume = useAudioStore((s) => s.instrumentalVolume);
  const vocalsVolume = useAudioStore((s) => s.vocalsVolume);

  // Publish --bl-deck-height
  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      document.documentElement.style.setProperty(
        '--bl-deck-height', `${entry.contentRect.height}px`
      );
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Sync slider with actual audioEngine values on mount
  useEffect(() => {
    const ae = (window as any).audioEngine;
    if (!ae) return;
    const iVol = ae.instrumentalGain?.gain?.value ?? 1;
    const vVol = ae.vocalsGain?.gain?.value ?? 1;
    useAudioStore.setState({
      instrumentalVolume: iVol,
      vocalsVolume: vVol,
    });
  }, []);

  const cycleSource = useCallback(() => {
    const idx = SOURCE_CYCLE.indexOf(sourceMode);
    setSourceMode(SOURCE_CYCLE[(idx + 1) % SOURCE_CYCLE.length]);
  }, [sourceMode, setSourceMode]);

  const handleSave = useCallback(async () => {
    try {
      const mm = (window as any).markerManager;
      if (!mm) {
        console.error('[Sync] markerManager not available');
        return;
      }

      // 1. Save to IndexedDB via legacy
      const success = mm.saveMarkersToTrack?.();
      console.log('[Sync] save to track:', success);

      // 2. JSON file download — get full track from IDB
      const meta = useTrackStore.getState().currentTrack;
      if (success && meta?.id) {
        const fullTrack = await getTrack(Number(meta.id));
        if (!fullTrack) { console.warn('[Sync] track not found in IDB'); return; }
        const markers = mm.getMarkers?.() || [];

        let textBlocks: any[] = [];
        const ld = (window as any).lyricsDisplay;
        if (ld?.textBlocks && Array.isArray(ld.textBlocks)) {
          textBlocks = ld.textBlocks;
        }

        const trackData = {
          id: fullTrack.id,
          title: fullTrack.title,
          savedAt: new Date().toISOString(),
          markers: markers,
          lyrics: fullTrack.lyrics || '',
          textBlocks: textBlocks,
        };

        const jsonData = JSON.stringify(trackData, null, 2);
        const utf8BomJsonData = '\uFEFF' + jsonData;
        const fileName = `text_track_${fullTrack.title}.json`;

        const blob = new Blob([utf8BomJsonData], {
          type: 'application/json;charset=utf-8',
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();

        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 100);

        console.log('[Sync] JSON downloaded:', fileName);
      }
    } catch (e) {
      console.error('[Sync] save error:', e);
    }

    markClean();
    closeSync();
  }, [closeSync, markClean]);

  const handleCancel = useCallback(() => {
    // Revert to state when editor was opened (first snapshot)
    const stack = useSyncStore.getState().undoStack;
    if (stack.length > 0) {
      const original = stack[0];
      const mm = (window as any).markerManager;
      if (mm) {
        mm.markers = original.map((m: any) => ({ ...m }));
        try { mm._notifySubscribers?.('markersReset', null); } catch(e) {}
        useMarkersStore.setState({ markers: [...mm.markers] });
      }
    }
    markClean();
    // Stay in editor — do NOT close
  }, [markClean]);

  // ─── Place marker on key "1" (React handler) ──────
  const placeMarker = useCallback(() => {
    const ae = (window as any).audioEngine;
    if (!ae) return;

    const currentTime = ae.getCurrentTime?.() ?? 0;
    const { markers: allMarkers, addMarker } = useMarkersStore.getState();
    const totalLines = useLyricsStore.getState().lines.length;

    if (totalLines === 0) {
      console.warn('[Sync] no lyrics lines available');
      return;
    }

    // Find marked line indices
    const markedSet = new Set<number>();
    for (const m of allMarkers) {
      if (m.lineIndex != null) markedSet.add(m.lineIndex);
    }

    // Find next unmarked line (start from 0, find first gap)
    let targetLine = -1;
    for (let i = 0; i < totalLines; i++) {
      if (!markedSet.has(i)) {
        targetLine = i;
        break;
      }
    }

    if (targetLine === -1) {
      console.log('[Sync] all lines already have markers');
      return;
    }

    // Push undo before placing
    useSyncStore.getState().pushUndo();

    // Place marker via store (delegates to legacy MM, bridge syncs back)
    addMarker(targetLine, currentTime);
    console.log('[Sync] marker placed: line', targetLine, 'at', currentTime.toFixed(2) + 's');
  }, []);

  // Keydown listener for "1"
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      // Skip if typing in input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      // Skip if not in sync editor
      if (!useSyncStore.getState().open) return;

      if (e.key === '1') {
        e.preventDefault();
        e.stopPropagation();
        placeMarker();
      }
    };

    document.addEventListener('keydown', handleKey, true); // capture phase!
    return () => document.removeEventListener('keydown', handleKey, true);
  }, [placeMarker]);

  const handleVolumeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = Number(e.target.value) / 100;
      const ae = (window as any).audioEngine;
      if (sourceMode === 'instrumental') {
        ae?.setInstrumentalVolume?.(v);
        useAudioStore.setState({ instrumentalVolume: v });
      } else if (sourceMode === 'vocal') {
        ae?.setVocalsVolume?.(v);
        useAudioStore.setState({ vocalsVolume: v });
      }
      // Persist to localStorage (sync with Rehearsal mode policy)
      try {
        const st = useAudioStore.getState();
        localStorage.setItem('bl-rehearsal-volumes', JSON.stringify({
          vocalsVolume: st.vocalsVolume,
          instrumentalVolume: st.instrumentalVolume,
        }));
      } catch (e2) {}
    },
    [sourceMode]
  );

  const btn: React.CSSProperties = {
    background: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    color: 'rgba(255, 255, 255, 0.5)',
    borderRadius: '4px',
    padding: '4px 10px',
    cursor: 'pointer',
    fontSize: '12px',
    whiteSpace: 'nowrap',
    transition: 'all 0.15s',
  };

  const btnActive: React.CSSProperties = {
    ...btn,
    color: 'rgba(255, 255, 255, 0.85)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    boxShadow: 'inset 0 0 6px rgba(255, 140, 0, 0.3)',
  };

  return (
    <div ref={panelRef} className="sync-editor-panel" style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      height: '240px',
      background: '#0a0a0f',
      borderTop: '1px solid rgba(255, 255, 255, 0.04)',
      zIndex: 90,
      display: 'flex', flexDirection: 'column',
      color: 'var(--bl-c-text-primary, #fff)',
    }}>

      <WaveformCanvas />

      {/* Single control row */}
      <div style={{
        display: 'flex', alignItems: 'center',
        padding: '4px 10px', gap: '5px',
        height: '36px', flexShrink: 0,
        background: '#0a0a0f',
        borderTop: '1px solid rgba(255, 255, 255, 0.04)',
      }}>

        {/* Back — highlighted */}
        <button onClick={closeSync} style={{
          background: 'rgba(99, 102, 241, 0.15)',
          border: '1px solid rgba(99, 102, 241, 0.3)',
          color: 'rgba(165, 170, 255, 0.9)',
          borderRadius: '4px',
          padding: '4px 10px',
          cursor: 'pointer',
          fontSize: '12px',
          fontWeight: 600,
          height: '28px',
          transition: 'all 0.15s',
        }}>Back</button>

        <div style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,0.06)', margin: '0 3px' }} />

        {/* Loop toggle */}
        <button onClick={() => {
          const hasLoop = (window as any).__syncHasLoop?.();
          if (hasLoop) {
            (window as any).__syncClearLoop?.();
          }
        }} style={{
          ...btn, height: '28px',
          ...((window as any).__syncHasLoop?.() ? {
            color: 'rgba(255, 255, 255, 0.85)',
            boxShadow: 'inset 0 0 6px rgba(255, 140, 0, 0.3)',
          } : {}),
        }}>
          {(window as any).__syncHasLoop?.() && <span style={{
            display: 'inline-block', width: '5px', height: '5px',
            borderRadius: '50%', background: '#FF8C00',
            boxShadow: '0 0 4px #FF8C00',
            marginRight: '4px', verticalAlign: 'middle',
          }} />}
          Loop
        </button>

        {/* Follow + Markers — lamp effect */}
        <button onClick={toggleFollow}
          style={{ ...(followPlayhead ? btnActive : btn), height: '28px' }}>
          {followPlayhead && <span style={{
            display: 'inline-block', width: '5px', height: '5px',
            borderRadius: '50%', background: '#FF8C00',
            boxShadow: '0 0 4px #FF8C00',
            marginRight: '4px', verticalAlign: 'middle',
          }} />}
          Follow
        </button>
        <button onClick={toggleMarkersVisible}
          style={{ ...(markersVisible ? btnActive : btn), height: '28px' }}>
          {markersVisible && <span style={{
            display: 'inline-block', width: '5px', height: '5px',
            borderRadius: '50%', background: '#FF8C00',
            boxShadow: '0 0 4px #FF8C00',
            marginRight: '4px', verticalAlign: 'middle',
          }} />}
          Markers
        </button>

        <div style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,0.06)', margin: '0 3px' }} />

        {/* Zoom — center area */}
        <button onClick={zoomOut} style={{
          ...btn, width: '28px', height: '28px', padding: 0, fontSize: '15px',
        }}>−</button>
        <button onClick={zoomIn} style={{
          ...btn, width: '28px', height: '28px', padding: 0, fontSize: '15px',
        }}>+</button>

        <div style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,0.06)', margin: '0 3px' }} />

        {/* Source + Volume */}
        <button onClick={cycleSource} style={{
          ...btn, width: '28px', height: '28px',
          padding: 0, fontWeight: 600, fontSize: '12px',
        }}>
          {SOURCE_LABELS[sourceMode]}
        </button>

        {sourceMode !== 'mix' && (
          <input
            type="range"
            min="0"
            max="100"
            value={Math.round(
              (sourceMode === 'instrumental'
                ? instrumentalVolume
                : vocalsVolume) * 100
            )}
            onChange={handleVolumeChange}
            style={{
              width: '60px', height: '3px', cursor: 'pointer',
              accentColor: sourceMode === 'instrumental' ? '#00bcd4' : '#e91e63',
            }}
          />
        )}

        <button style={{ ...btn, height: '28px' }} onClick={placeMarker}>Add</button>

        {/* Undo/Redo */}
        <button onClick={undo} disabled={undoStack.length === 0}
          style={{
            ...btn, height: '28px', width: '28px', padding: 0,
            fontSize: '14px',
            opacity: undoStack.length === 0 ? 0.25 : 0.7,
            cursor: undoStack.length === 0 ? 'default' : 'pointer',
          }}
          title="Undo">↩</button>
        <button onClick={redo} disabled={redoStack.length === 0}
          style={{
            ...btn, height: '28px', width: '28px', padding: 0,
            fontSize: '14px',
            opacity: redoStack.length === 0 ? 0.25 : 0.7,
            cursor: redoStack.length === 0 ? 'default' : 'pointer',
          }}
          title="Redo">↪</button>

        <div style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,0.06)', margin: '0 3px' }} />

        {/* Delete marker */}
        <button onClick={() => {
          const fn = (window as any).__syncDeleteMarker;
          if (fn) fn();
        }} style={{
          ...btn, height: '28px', padding: '4px 8px',
          fontSize: '11px',
        }} title="Delete nearest marker">Del</button>



        <div style={{ flex: 1 }} />

        {/* Time */}
        <span style={{
          fontFamily: 'monospace', fontSize: '11px',
          color: 'rgba(255, 255, 255, 0.3)',
          fontVariantNumeric: 'tabular-nums',
          minWidth: '40px', textAlign: 'right',
        }}>
          {formatTime(currentTime)}
        </span>

        {/* Cancel — only when dirty */}
        {isDirty && (
          <button onClick={handleCancel} style={{
            ...btn, height: '28px',
            color: 'rgba(255, 255, 255, 0.5)',
          }}>Cancel</button>
        )}

        {/* Save — glows green when dirty */}
        <button onClick={handleSave} style={{
          ...btn, height: '28px', fontWeight: 500,
          ...(isDirty ? {
            background: 'rgba(34, 197, 94, 0.2)',
            borderColor: 'rgba(34, 197, 94, 0.5)',
            color: '#22c55e',
            boxShadow: '0 0 8px rgba(34, 197, 94, 0.3)',
          } : {}),
        }}>Save</button>
      </div>
    </div>
  );
}
