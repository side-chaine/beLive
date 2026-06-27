import React, { useRef, useEffect, useCallback, useState } from 'react';
import { useSyncStore } from '../store/sync.store';
import { useAudioStore } from '../../stores/audio.store';
import { useStemStore } from '../../stem/stem.store';
import { useLyricsStore } from '../../stores/lyrics.store';
import { useMarkersStore } from '../../stores/markers.store';
import { WaveformCanvas } from './WaveformCanvas';
import { requestCloseSync } from '../bridge/sync.bridge';
import { getTrack, updateTrackField } from '../../services/idb.service';
import { useTrackStore } from '../../stores/track.store';
import { useWordSyncStore } from '../../stores/wordSync.store';
import { lyricsAlignService } from '../word-sync/services/lyrics-align.service';
import { buildAlignmentJobRequest } from '../word-sync/services/alignment-request.builder';
import { fetchLrcVersions, parseLrcVersion } from '../../services/auto-lyrics.service';
import type { LrcVersion } from '../../services/auto-lyrics.service';
import { uploadBlobToTelegram } from '../../services/tg-upload.service';
import { generateTrackZip } from '../../sync/services/zip-export.service';

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
  const instrumentalVolume = useStemStore((s) => s.stemVolumes['instrumental'] ?? 1);
  const vocalsVolume = useStemStore((s) => s.stemVolumes['vocals'] ?? 1);
  const wordSyncStatus = useWordSyncStore((s) => s.status);
  const providerName = lyricsAlignService.getProvider().name;
  const wordSyncLineMap = useWordSyncStore((s) => s.lineMap);
  const wordSyncLyricsHash = useWordSyncStore((s) => s.lyricsHash);
  const wordSyncAudioSource = useWordSyncStore((s) => s.audioSource);
  const wordSyncDegraded = useWordSyncStore((s) => s.degraded);
  const wordSyncError = useWordSyncStore((s) => s.error);
  const markers = useMarkersStore((s) => s.markers);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const exportInFlightRef = useRef(false);
  const exportBlobRef = useRef<Blob | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const uploadXhrRef = useRef<XMLHttpRequest | null>(null);
  const publishTokenRef = useRef<symbol | null>(null);
  const publishTrackIdRef = useRef<string | number | null>(null);
  const publishInFlightRef = useRef(false);
  const [publishStatus, setPublishStatus] = useState<'idle' | 'packing' | 'uploading' | 'done' | 'error'>('idle');

  // TC-LRCPICKER-02: LRC Version Picker state
  const [lrcVersions, setLrcVersions] = useState<LrcVersion[]>([]);
  const [lrcPickerOpen, setLrcPickerOpen] = useState(false);
  const [lrcLoading, setLrcLoading] = useState(false);
  const lrcPickerRef = useRef<HTMLDivElement>(null);
  const [lrcPickerPos, setLrcPickerPos] = useState<{top: number; right: number}>({top: 0, right: 0});
  const [lrcSelectedVersionId, setLrcSelectedVersionId] = useState<number | null>(null);

  // TC-LRCPICKER-11: Navigation state
  const storeLineCount = useLyricsStore(s => s.lines.length);
  const lrcSelectedIndex = lrcVersions.findIndex(v => v.id === lrcSelectedVersionId);
  const lrcHasPrev = lrcSelectedIndex > 0;
  const lrcHasNext = lrcSelectedIndex >= 0 && lrcSelectedIndex < lrcVersions.length - 1;
  const lrcCurrentLineCount = lrcSelectedIndex >= 0 && lrcVersions[lrcSelectedIndex]
    ? lrcVersions[lrcSelectedIndex].lineCount
    : storeLineCount;

  // TC-LRCPICKER-05: Dropdown height for smart positioning
  const DROPDOWN_HEIGHT = 340;  // maxHeight 300px + padding/border ~40px

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
    useStemStore.getState().setStemVolume('instrumental', iVol);
    useStemStore.getState().setStemVolume('vocals', vVol);
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

  const handleExportZip = useCallback(async () => {
    if (isExporting || exportInFlightRef.current) return;
    exportInFlightRef.current = true;
    setIsExporting(true);
    setExportProgress(0);
    try {
      const mm = (window as any).markerManager;
      const ld = (window as any).lyricsDisplay;
      if (!mm || !ld) {
        console.error('[Sync] markerManager or lyricsDisplay not available');
        return;
      }

      mm.saveMarkersToTrack?.();
      setExportProgress(3);

      const meta = useTrackStore.getState().currentTrack;
      if (!meta) {
        console.warn('[Sync] no current track');
        return;
      }

      const liveMarkers = mm.getMarkers?.() || [];
      const liveTextBlocks = ld.textBlocks || [];

      // Generate ZIP via extracted service
      setExportProgress(5);
      const blob = await generateTrackZip(
        { trackId: Number(meta.id), liveMarkers, liveTextBlocks },
        { onProgress: (pct) => setExportProgress(pct) },
      );

      setExportProgress(98);
      exportBlobRef.current = blob;

      // Download (only if not publish mode)
      if (!publishInFlightRef.current) {
        const trackName = meta.title || 'track';
        const safeName = trackName.replace(/[<>:"/\\|?*]/g, '_');
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${safeName}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        console.log('[Sync] ZIP exported:', `${safeName}.zip`);
      }

      setExportProgress(100);
      markClean();

      // Publish mode — upload after generation
      if (publishInFlightRef.current && publishTokenRef.current) {
        const publishMeta = useTrackStore.getState().currentTrack;
        if (publishMeta && Number(publishMeta.id) === publishTrackIdRef.current) {
          setIsUploading(true);
          setPublishStatus('uploading');
          setUploadProgress(0);

          const publishBlob = exportBlobRef.current!;
          const artist = publishMeta.artist || 'Unknown Artist';
          const title = publishMeta.title || 'Unknown Track';

          const result = await uploadBlobToTelegram(
            publishBlob, artist, title,
            {
              onProgress: (pct) => setUploadProgress(pct),
              onDone: () => {
                document.dispatchEvent(new CustomEvent('tg-upload-complete', {
                  detail: { title, artist }
                }));
              },
            },
          );

          setIsUploading(false);
          publishInFlightRef.current = false;
          publishTokenRef.current = null;
          publishTrackIdRef.current = null;

          if (result.success) {
            setPublishStatus('done');
            setUploadProgress(100);
          } else {
            setPublishStatus('error');
            setUploadProgress(0);
            const fallbackUrl = URL.createObjectURL(publishBlob);
            const fallbackA = document.createElement('a');
            fallbackA.href = fallbackUrl;
            fallbackA.download = `${title.replace(/[<>:"/\\|?*]/g, '_')}.zip`;
            document.body.appendChild(fallbackA);
            fallbackA.click();
            document.body.removeChild(fallbackA);
            URL.revokeObjectURL(fallbackUrl);
          }
        } else {
          publishInFlightRef.current = false;
          publishTokenRef.current = null;
          publishTrackIdRef.current = null;
          setPublishStatus('error');
        }
      }
    } catch (e) {
      console.error('[Sync] ZIP export error:', e);
      if (publishInFlightRef.current) {
        setPublishStatus('error');
      }
    } finally {
      exportInFlightRef.current = false;
      setIsExporting(false);
      setExportProgress(0);
      if (publishInFlightRef.current) {
        if (!exportBlobRef.current) {
          setPublishStatus('error');
        }
        publishInFlightRef.current = false;
        publishTokenRef.current = null;
        publishTrackIdRef.current = null;
      }
    }
  }, [isExporting, markClean]);

  // Cleanup при unmount — предотвращает утечку blob и прерывает upload
  useEffect(() => {
    return () => {
      exportBlobRef.current = null;
      if (uploadXhrRef.current) {
        uploadXhrRef.current.abort();
        uploadXhrRef.current = null;
      }
    };
  }, []);

  const uploadToTelegram = useCallback(async () => {
    const blob = exportBlobRef.current;
    if (!blob || isUploading) return;

    const meta = useTrackStore.getState().currentTrack;
    if (!meta) return;
    const artist = meta.artist || 'Unknown Artist';
    const title = meta.title || 'Unknown Track';

    setIsUploading(true);
    setUploadProgress(0);

    const result = await uploadBlobToTelegram(
      blob, artist, title,
      {
        onProgress: (pct) => setUploadProgress(pct),
        onDone: () => {
          console.log('[Sync] ZIP uploaded to TG');
          document.dispatchEvent(new CustomEvent('tg-upload-complete', {
            detail: { title, artist }
          }));
        },
        onError: (status) => {
          console.error('[Sync] TG upload failed:', status);
        },
      },
    );

    setIsUploading(false);
    if (result.success) {
      setUploadProgress(100);
    } else {
      setUploadProgress(0);
    }
  }, [isUploading]);

  const handlePublishToBeLive = useCallback(() => {
    if (isExporting || publishInFlightRef.current) return;
    const meta = useTrackStore.getState().currentTrack;
    if (!meta) return;
    publishInFlightRef.current = true;
    publishTokenRef.current = Symbol('publish');
    publishTrackIdRef.current = Number(meta.id);
    setPublishStatus('packing');
    handleExportZip();
  }, [isExporting, handleExportZip]);

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

  const placeM2Marker = useCallback(() => {
    const mm = (window as any).markerManager;
    if (mm?._addM2Marker) {
      mm._addM2Marker();
    }
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
      } else if (e.key === '2') {
        e.preventDefault();
        e.stopPropagation();
        placeM2Marker();
      }
    };

    document.addEventListener('keydown', handleKey, true); // capture phase!
    return () => document.removeEventListener('keydown', handleKey, true);
  }, [placeMarker, placeM2Marker]);

  const handleVolumeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = Number(e.target.value) / 100;
      const ae = (window as any).audioEngine;
      if (sourceMode === 'instrumental') {
        ae?.setInstrumentalVolume?.(v);
        useStemStore.getState().setStemVolume('instrumental', v);
      } else if (sourceMode === 'vocal') {
        ae?.setVocalsVolume?.(v);
        useStemStore.getState().setStemVolume('vocals', v);
      }
      // Persist to localStorage (sync with Rehearsal mode policy)
      try {
        const st = useStemStore.getState();
        localStorage.setItem('bl-rehearsal-volumes', JSON.stringify({
          vocalsVolume: st.stemVolumes['vocals'] ?? 1,
          instrumentalVolume: st.stemVolumes['instrumental'] ?? 1,
        }));
      } catch (e2) {}
    },
    [sourceMode]
  );

  const handleAlignLyrics = useCallback(async () => {
    if (!wordSyncLineMap.length || !wordSyncLyricsHash || !wordSyncAudioSource) {
      useWordSyncStore.getState().setStatus('error');
      useWordSyncStore.getState().setError('Word-sync layer is not ready');
      return;
    }

    if (wordSyncDegraded) {
      useWordSyncStore.getState().setStatus('error');
      useWordSyncStore.getState().setError('Trusted lyrics source is degraded');
      return;
    }

    useWordSyncStore.getState().setError(null);
    useWordSyncStore.getState().setStatus('loading');

    try {
      const anchors = markers
        .filter((m) => typeof m.lineIndex === 'number' && typeof m.time === 'number')
        .map((m) => ({
          rawLineIndex: m.lineIndex,
          time: m.time,
          kind: 'line' as const,
          hard: true,
        }));

      const request = buildAlignmentJobRequest({
        mode: 'anchored',
        lineMap: wordSyncLineMap,
        lyricsHash: wordSyncLyricsHash,
        audioSource: wordSyncAudioSource,
        anchors,
      });

      const response = await lyricsAlignService.align(request);

      if (!response.ok) {
        useWordSyncStore.getState().setStatus('error');
        useWordSyncStore.getState().setError(response.error);
        return;
      }

      useWordSyncStore.getState().setAlignmentData(response.result);
      useWordSyncStore.getState().setStatus('ready');
      useWordSyncStore.getState().setError(null);

      const trackState = useTrackStore.getState();
      const storeMeta =
        trackState.currentTrackIndex >= 0 &&
        trackState.currentTrackIndex < trackState.tracksMeta.length
          ? trackState.tracksMeta[trackState.currentTrackIndex]
          : null;

      const legacyCatalog = (window as any).trackCatalog;
      const legacyTrack =
        legacyCatalog?.currentTrackIndex >= 0 &&
        legacyCatalog?.currentTrackIndex < (legacyCatalog?.tracks?.length ?? 0)
          ? legacyCatalog.tracks[legacyCatalog.currentTrackIndex]
          : null;

      const currentTrackIdRaw = storeMeta?.id ?? legacyTrack?.id ?? null;
      const currentTrackId =
        currentTrackIdRaw != null ? Number(currentTrackIdRaw) : NaN;

      if (Number.isFinite(currentTrackId)) {
        try {
          await updateTrackField(currentTrackId, {
            alignmentData: response.result,
            lineMap: useWordSyncStore.getState().lineMap,
          });

          console.log('Word-sync persistence saved', {
            trackId: currentTrackId,
            hasAlignmentData: !!response.result,
            lineMapSize: useWordSyncStore.getState().lineMap.length,
          });
        } catch (persistError) {
          console.warn('Word-sync persistence failed:', persistError);
        }
      } else {
        console.warn(
          'Word-sync persistence skipped: invalid current track id',
          currentTrackIdRaw
        );
      }
    } catch (error) {
      useWordSyncStore.getState().setStatus('error');
      useWordSyncStore.getState().setError(
        error instanceof Error ? error.message : 'Alignment failed'
      );
    }
  }, [
    wordSyncLineMap,
    wordSyncLyricsHash,
    wordSyncAudioSource,
    wordSyncDegraded,
    markers,
  ]);

  // TC-LRCPICKER-02: LRC Version Picker handlers
  const handleLrcPicker = useCallback(async () => {
    if (lrcPickerOpen) {
      setLrcPickerOpen(false);
      return;
    }

    // Calculate position BEFORE opening dropdown
    const calculatePosition = () => {
      if (!lrcPickerRef.current) return { top: 0, right: 0 };
      const rect = lrcPickerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;

      // If not enough room below, open ABOVE button
      if (spaceBelow < DROPDOWN_HEIGHT) {
        return {
          top: rect.top - DROPDOWN_HEIGHT - 4,  // 4px gap above
          right: window.innerWidth - rect.right,
        };
      }

      // Open below button
      return {
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right,
      };
    };

    // Skip fetch if already loaded — just recalculate position and show
    if (lrcVersions.length > 0) {
      setLrcPickerPos(calculatePosition());
      setLrcPickerOpen(true);
      return;
    }

    setLrcLoading(true);
    try {
      // ─── Get track info ───
      const tc = (window as any).trackCatalog;
      const ae = (window as any).audioEngine;

      // Duration: from audioEngine (most reliable)
      const duration = ae?.audio?.duration
        || ae?.getDuration?.()
        || 0;

      // Artist + Title: from trackCatalog
      let artistName = '';
      let trackName = '';

      if (tc) {
        const idx = tc.currentTrackIndex;
        const track = tc.tracks?.[idx];
        if (track) {
          artistName = track.artist || '';
          trackName = track.title || '';
        }
      }

      // Fallback: parse from title if artist is empty
      // Title often contains "Artist - Title" format
      if (!artistName && trackName.includes(' - ')) {
        const parts = trackName.split(' - ');
        artistName = parts[0].trim();
        trackName = parts.slice(1).join(' - ').trim();
      }

      // Another fallback: from track store
      if (!artistName || !trackName) {
        const ts = useTrackStore.getState();
        const current = ts.currentTrack;
        if (current) {
          if (!artistName) artistName = current.artist || '';
          if (!trackName) {
            trackName = current.title || '';
            // Same "Artist - Title" split
            if (!artistName && trackName.includes(' - ')) {
              const parts = trackName.split(' - ');
              artistName = parts[0].trim();
              trackName = parts.slice(1).join(' - ').trim();
            }
          }
        }
      }

      if (!artistName || !trackName) {
        console.warn('[LRC-Picker] No track info available');
        setLrcLoading(false);
        return;
      }

      console.log(
        `[LRC-Picker] Searching: artist="${artistName}" ` +
        `title="${trackName}" duration=${Math.round(duration)}s`
      );

      const versions = await fetchLrcVersions(
        artistName,
        trackName,
        Math.round(duration)
      );
      setLrcVersions(versions);

      // Auto-select first version if none selected yet
      if (lrcSelectedVersionId === null && versions.length > 0) {
        setLrcSelectedVersionId(versions[0].id);
      }

      // Calculate position BEFORE opening — sync with render
      setLrcPickerPos(calculatePosition());
      setLrcPickerOpen(true);

      console.log(`[LRC-Picker] ${versions.length} versions loaded`);
    } catch (e) {
      console.warn('[LRC-Picker] Failed:', e);
    } finally {
      setLrcLoading(false);
    }
  }, [lrcPickerOpen, lrcVersions.length]);

  const handleLrcVersionSelect = useCallback(async (version: LrcVersion) => {
    try {
      setLrcPickerOpen(false);
      
      const tc = (window as any).trackCatalog;
      const tIdx = tc?.currentTrackIndex;
      const legacyTrack = tc?.tracks?.[tIdx];
      const ld = (window as any).lyricsDisplay;
      const mm = (window as any).markerManager;
      
      if (!ld || !mm || !legacyTrack) {
        console.warn('[LRC-Picker] Missing runtime dependencies');
        return;
      }

      const geniusText = legacyTrack.lyricsOriginalContent || undefined;
      console.log(`[LRC-Picker] geniusText: ${geniusText ? `${geniusText.length} chars` : 'NONE'}`);

      const result = parseLrcVersion(version, geniusText);

      console.log(
        `[LRC-Picker] Applying version #${version.id}: ` +
        `${result.markers.length} markers, ${result.lyricsLines.length} lines, ${result.blocks.length} blocks`
      );

      // ─── STEP 1: Load blocks + lyrics DIRECTLY ───
      // loadImportedBlocks sets ld.lyrics synchronously, bypasses _processLyrics
      // TC-LRC-03: Preserve existing blocks when LRC version returns empty
      // blocks=[] from parser = "no blocks in this LRC format" (NOT "user deleted blocks")
      // Existing blocks are still valid — tied to the track, not the LRC version
      const blocksToApply = result.blocks.length > 0 
        ? result.blocks 
        : (ld.textBlocks || []);
      
      if (result.blocks.length === 0 && (ld.textBlocks || []).length > 0) {
        console.log(`[LRC-Picker] Preserving ${ld.textBlocks.length} existing blocks (LRC returned none)`);
      }
      
      ld.loadImportedBlocks(
        blocksToApply,
        result.lyricsLines.join('\n'),
        true
      );
      
      // ─── STEP 2: Sync store FROM ld.lyrics (exact match, closes GUARD race) ───
      // Must happen BEFORE mm.setMarkers() so markers.bridge reads correct length
      if (Array.isArray(ld.lyrics) && ld.lyrics.length > 0) {
        useLyricsStore.setState({ lines: [...ld.lyrics] });
      }
      
      // ─── STEP 3: Set markers (store length matches ld.lyrics.length) ───
      mm.setMarkers(result.markers);
      mm.updateMarkerColors();

      // ─── STEP 4: Track selected version ───
      setLrcSelectedVersionId(version.id);

      // ─── STEP 5: Persist to IDB ───
      if (legacyTrack.id) {
        await updateTrackField(Number(legacyTrack.id), {
          lyrics: result.lyricsLines.join('\n'),
          lyricsOriginalContent: geniusText || undefined,
          syncMarkers: result.markers,
          blocksData: result.blocks.length > 0 ? result.blocks : undefined,
          dataVersion: 2,
        });
      }

      console.log(`[LRC-Picker] Version #${version.id} applied ✅`);
    } catch (e) {
      console.warn('[LRC-Picker] Apply failed:', e);
    }
  }, []);

  // TC-LRCPICKER-11: Navigation handlers
  const handleLrcPrev = useCallback(() => {
    if (lrcHasPrev) handleLrcVersionSelect(lrcVersions[lrcSelectedIndex - 1]);
  }, [lrcHasPrev, lrcSelectedIndex, lrcVersions, handleLrcVersionSelect]);

  const handleLrcNext = useCallback(() => {
    if (lrcHasNext) handleLrcVersionSelect(lrcVersions[lrcSelectedIndex + 1]);
  }, [lrcHasNext, lrcSelectedIndex, lrcVersions, handleLrcVersionSelect]);

  // TC-LRCPICKER-02: Close dropdown on outside click
  useEffect(() => {
    if (!lrcPickerOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (lrcPickerRef.current && !lrcPickerRef.current.contains(e.target as Node)) {
        setLrcPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [lrcPickerOpen]);

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

        <button
          style={{
            ...btn,
            height: '28px',
            padding: '4px 8px',
            fontSize: '11px',
          }}
          onClick={() => {
            (window as any).waveformEditor?._openNewBlockEditor?.();
          }}
          title="Open Block Editor"
        >
          Blocks
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

        {/* Word-sync status */}
        <span style={{
          fontFamily: 'monospace',
          fontSize: '10px',
          color: 'rgba(255, 255, 255, 0.25)',
          marginLeft: '8px',
        }}>
          {providerName}:{wordSyncStatus}
        </span>

        {/* TC-LRCPICKER-11: Lines navigation group */}
        <div ref={lrcPickerRef} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 0, marginLeft: '8px' }}>
          {/* ‹ Prev */}
          <button
            onClick={handleLrcPrev}
            disabled={!lrcHasPrev || lrcLoading}
            style={{
              background: 'transparent',
              color: lrcHasPrev ? 'rgba(255, 255, 255, 0.7)' : 'rgba(255, 255, 255, 0.2)',
              borderTop: '1px solid rgba(255, 255, 255, 0.18)',
              borderRight: 'none',
              borderBottom: '1px solid rgba(255, 255, 255, 0.18)',
              borderLeft: '1px solid rgba(255, 255, 255, 0.18)',
              borderRadius: '6px 0 0 6px',
              padding: '4px 8px',
              fontSize: '13px',
              lineHeight: 1,
              cursor: lrcHasPrev ? 'pointer' : 'default',
              opacity: lrcLoading ? 0.4 : 1,
              transition: 'color 0.15s',
            }}
            title="Previous version"
          >‹</button>

          {/* Lines count + dropdown trigger */}
          <button
            onClick={handleLrcPicker}
            disabled={lrcLoading}
            style={{
              background: lrcPickerOpen ? 'rgba(255, 140, 0, 0.12)' : 'transparent',
              color: lrcPickerOpen ? 'rgba(255, 140, 0, 0.95)' : 'rgba(255, 255, 255, 0.8)',
              borderTop: `1px solid ${lrcPickerOpen ? 'rgba(255, 140, 0, 0.45)' : 'rgba(255, 255, 255, 0.18)'}`,
              borderRight: 'none',
              borderBottom: `1px solid ${lrcPickerOpen ? 'rgba(255, 140, 0, 0.45)' : 'rgba(255, 255, 255, 0.18)'}`,
              borderLeft: 'none',
              borderRadius: 0,
              padding: '4px 10px',
              fontSize: '11px',
              fontWeight: 500,
              cursor: 'pointer',
              opacity: lrcLoading ? 0.6 : 1,
              minWidth: '80px',
              textAlign: 'center',
              transition: 'background 0.15s, color 0.15s',
            }}
            title="Browse versions from lrclib.net"
          >
            {lrcLoading ? '⏳ Lines' : lrcVersions.length === 0 ? 'Lines' : `${lrcCurrentLineCount} Lines`}
          </button>

          {/* › Next */}
          <button
            onClick={handleLrcNext}
            disabled={!lrcHasNext || lrcLoading}
            style={{
              background: 'transparent',
              color: lrcHasNext ? 'rgba(255, 255, 255, 0.7)' : 'rgba(255, 255, 255, 0.2)',
              borderTop: '1px solid rgba(255, 255, 255, 0.18)',
              borderRight: '1px solid rgba(255, 255, 255, 0.18)',
              borderBottom: '1px solid rgba(255, 255, 255, 0.18)',
              borderLeft: 'none',
              borderRadius: '0 6px 6px 0',
              padding: '4px 8px',
              fontSize: '13px',
              lineHeight: 1,
              cursor: lrcHasNext ? 'pointer' : 'default',
              opacity: lrcLoading ? 0.4 : 1,
              transition: 'color 0.15s',
            }}
            title="Next version"
          >›</button>

          {/* Dropdown */}
          {lrcPickerOpen && lrcVersions.length > 0 && (
            <div style={{
              position: 'fixed',
              top: `${lrcPickerPos.top}px`,
              right: `${lrcPickerPos.right}px`,
              background: 'rgba(20, 20, 35, 0.97)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '8px',
              minWidth: '280px',
              maxWidth: '340px',
              maxHeight: '300px',
              overflowY: 'auto',
              zIndex: 9999,
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
            }}>
              <div style={{
                padding: '8px 12px',
                fontSize: '10px',
                color: 'rgba(255, 255, 255, 0.35)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
              }}>
                {lrcVersions.length} version{lrcVersions.length !== 1 ? 's' : ''} from lrclib.net
              </div>
              {lrcVersions.map((v, idx) => (
                <button
                  key={v.id}
                  onClick={() => handleLrcVersionSelect(v)}
                  style={{
                    display: 'block',
                    width: '100%',
                    background: v.id === lrcSelectedVersionId
                      ? 'rgba(255, 140, 0, 0.15)'
                      : 'transparent',
                    border: 'none',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                    padding: '10px 12px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    color: 'rgba(255, 255, 255, 0.8)',
                    fontSize: '11px',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background =
                      'rgba(255, 255, 255, 0.06)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background =
                      v.id === lrcSelectedVersionId ? 'rgba(255, 140, 0, 0.15)' : 'transparent';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 600, minWidth: '40px' }}>
                      {Math.floor(v.duration / 60)}:{String(Math.floor(v.duration % 60)).padStart(2, '0')}
                    </span>
                    <span style={{ color: 'rgba(255, 255, 255, 0.45)', fontSize: '10px' }}>
                      {v.lineCount} lines
                    </span>
                    {v.id === lrcSelectedVersionId && (
                      <span style={{
                        fontSize: '9px',
                        background: 'rgba(255, 140, 0, 0.3)',
                        color: '#ff8c00',
                        padding: '1px 6px',
                        borderRadius: '8px',
                        fontWeight: 600,
                      }}>
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <div style={{
                    color: 'rgba(255, 255, 255, 0.3)',
                    fontSize: '10px',
                    marginTop: '2px'
                  }}>
                    Δ {v.durationDelta.toFixed(1)}s from track
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* No versions found */}
          {lrcPickerOpen && lrcVersions.length === 0 && !lrcLoading && (
            <div style={{
              position: 'fixed',
              top: `${lrcPickerPos.top}px`,
              right: `${lrcPickerPos.right}px`,
              background: 'rgba(20, 20, 35, 0.97)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '8px',
              padding: '16px 20px',
              minWidth: '200px',
              zIndex: 9999,
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
              color: 'rgba(255, 255, 255, 0.4)',
              fontSize: '11px',
              textAlign: 'center',
            }}>
              No synced versions found
            </div>
          )}
        </div>

        <button
          onClick={handleAlignLyrics}
          disabled={
            wordSyncStatus === 'loading' ||
            !wordSyncLineMap.length ||
            !wordSyncLyricsHash ||
            !wordSyncAudioSource ||
            wordSyncDegraded
          }
          style={{
            background: 'transparent',
            color: 'rgba(255, 255, 255, 0.65)',
            border: '1px solid rgba(255, 255, 255, 0.18)',
            borderRadius: '6px',
            padding: '4px 8px',
            fontSize: '11px',
            cursor: 'pointer',
            marginLeft: '8px',
            opacity: wordSyncStatus === 'loading' ? 0.6 : 1,
          }}
          title={wordSyncDegraded ? 'Trusted lyrics source is degraded' : 'Run lyrics alignment'}
        >
          {wordSyncStatus === 'loading' ? 'Aligning…' : 'Align'}
        </button>

        {wordSyncError ? (
          <span style={{
            fontFamily: 'monospace',
            fontSize: '10px',
            color: 'rgba(255, 120, 120, 0.8)',
            marginLeft: '8px',
          }}>
            {wordSyncError}
          </span>
        ) : null}

        {/* Cancel — only when dirty */}
        {isDirty && (
          <button onClick={handleCancel} style={{
            ...btn, height: '28px',
            color: 'rgba(255, 255, 255, 0.5)',
          }}>Cancel</button>
        )}

        {/* ZIP export — compact archive button with progress fill */}
        <button onClick={handleExportZip} disabled={isExporting} style={{
          ...btn, height: '28px', fontWeight: 500,
          position: 'relative',
          overflow: 'hidden',
          background: 'rgba(59, 130, 246, 0.1)',
          borderColor: 'rgba(59, 130, 246, 0.3)',
          color: 'rgba(147, 197, 253, 0.9)',
          opacity: isExporting ? 1 : 1,
          cursor: isExporting ? 'wait' : 'pointer',
        }} title="Export track as ZIP archive">
          {isExporting && exportProgress > 0 && (
            <div style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: `${exportProgress}%`,
              background: 'rgba(74, 158, 255, 0.25)',
              transition: 'width 1s ease-out',
              pointerEvents: 'none',
            }} />
          )}
          <span style={{ position: 'relative', zIndex: 1 }}>
            {isExporting ? 'Packing...' : 'ZIP'}
          </span>
        </button>

        {/* TG upload — отправка ZIP в Telegram каталог */}
        <button onClick={uploadToTelegram} disabled={!exportBlobRef.current || isUploading} style={{
          ...btn, height: '28px', fontWeight: 500,
          position: 'relative',
          overflow: 'hidden',
          background: isUploading ? 'rgba(34, 197, 94, 0.15)' : 'rgba(34, 197, 94, 0.08)',
          borderColor: isUploading ? 'rgba(34, 197, 94, 0.4)' : 'rgba(34, 197, 94, 0.2)',
          color: isUploading ? 'rgba(34, 197, 94, 0.9)' : 'rgba(74, 222, 128, 0.7)',
          opacity: exportBlobRef.current ? 1 : 0.4,
          cursor: !exportBlobRef.current || isUploading ? 'wait' : 'pointer',
        }} title="Upload track to Telegram catalog">
          {isUploading && uploadProgress > 0 && (
            <div style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: `${uploadProgress}%`,
              background: 'rgba(34, 197, 94, 0.2)',
              transition: 'width 0.5s ease-out',
              pointerEvents: 'none',
            }} />
          )}
          <span style={{ position: 'relative', zIndex: 1 }}>
            {isUploading ? `${uploadProgress}%` : '📤 TG'}
          </span>
        </button>

        {/* Publish — generate ZIP + auto-upload to TG */}
        <button
          onClick={handlePublishToBeLive}
          disabled={isExporting || publishInFlightRef.current}
          style={{
            ...btn, height: '28px', fontWeight: 500,
            position: 'relative',
            overflow: 'hidden',
            background: publishStatus === 'done'
              ? 'rgba(34, 197, 94, 0.2)'
              : publishStatus === 'error'
                ? 'rgba(239, 68, 68, 0.15)'
                : publishInFlightRef.current
                  ? 'rgba(168, 85, 247, 0.2)'
                  : 'rgba(168, 85, 247, 0.1)',
            borderColor: publishStatus === 'done'
              ? 'rgba(34, 197, 94, 0.5)'
              : publishStatus === 'error'
                ? 'rgba(239, 68, 68, 0.4)'
                : publishInFlightRef.current
                  ? 'rgba(168, 85, 247, 0.4)'
                  : 'rgba(168, 85, 247, 0.25)',
            color: publishStatus === 'done'
              ? '#22c55e'
              : publishStatus === 'error'
                ? 'rgba(239, 68, 68, 0.9)'
                : publishInFlightRef.current
                  ? 'rgba(168, 85, 247, 0.9)'
                  : 'rgba(192, 132, 252, 0.7)',
            cursor: publishInFlightRef.current ? 'wait' : 'pointer',
          }}
          title="Generate ZIP and publish to beLive catalog"
        >
          {publishInFlightRef.current && publishStatus === 'packing' && (
            <div style={{
              position: 'absolute', left: 0, top: 0, bottom: 0,
              width: '100%',
              background: 'linear-gradient(90deg, transparent, rgba(168, 85, 247, 0.2), transparent)',
              animation: 'pulse 1.5s ease-in-out infinite',
              pointerEvents: 'none',
            }} />
          )}
          <span style={{ position: 'relative', zIndex: 1 }}>
            {publishStatus === 'done'
              ? 'Published'
              : publishStatus === 'error'
                ? 'Failed'
                : publishInFlightRef.current && publishStatus === 'uploading'
                  ? `Publish ${uploadProgress}%`
                  : publishInFlightRef.current
                    ? 'Packing...'
                    : 'Publish'}
          </span>
        </button>

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
