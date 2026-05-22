// src/services/track.orchestrator.ts
// F40: Track loading — all 14 steps from TC.loadTrack (L410-533)
// Legacy engines (LD, MM, AE, WE) called via window.* — NOT abstracted.

import {
  clearWordSyncLayer,
  prepareWordSyncLayer,
} from '../sync/word-sync/services/ai-lyrics-sync.service';
import { BUILTIN_STEMS } from '../stem/stemTypes';
import type { StemLoadMap } from '../stem/stemTypes';
import type { StemDataEntry } from './idb.service';
import { getTrack as getTrackFromIDB } from './idb.service';
import { useStemStore } from '../stem/stem.store';

export interface LoadTrackOptions {
  autoplay?: boolean;
  openSyncEditor?: boolean;
}

let _autoplayTimer: ReturnType<typeof setTimeout> | null = null;
// W3min: Track all stem blob URLs for cleanup (replaces _prevIUrl/_prevVUrl)
let _prevStemUrls: Map<string, string> = new Map(); // stemId → blobUrl

let _pendingJump: { direction: number; timer: ReturnType<typeof setTimeout> | null } = {
  direction: 0,
  timer: null,
};

export async function loadTrack(index: number, opts: LoadTrackOptions = {}): Promise<void> {
  // Cancel previous autoplay timer
  if (_autoplayTimer !== null) {
    clearTimeout(_autoplayTimer);
    _autoplayTimer = null;
  }
  const tc = (window as any).trackCatalog;
  if (!tc?.tracks || index < 0 || index >= tc.tracks.length) return;

  // ── Timing instrumentation ──
  const _t0 = performance.now();
  let _ts = _t0;
  const _mark = (label: string) => {
    const now = performance.now();
    if (import.meta.env.DEV) console.log(`[OrchTiming] ${label}: ${(now - _ts).toFixed(1)}ms (total: ${(now - _t0).toFixed(1)}ms)`);
    _ts = now;
  };

  // Steps 1-2: save prev id, update index BEFORE events
  const prevId = tc.currentTrackIndex >= 0 && tc.currentTrackIndex < tc.tracks.length
    ? tc.tracks[tc.currentTrackIndex]?.id : null;
  let track = tc.tracks[index];
  tc.currentTrackIndex = index;

  // TC-85-03: Always re-read track from IDB on load.
  // The needsFreshRead optimization (skip IDB read when stemsData in memory)
  // caused stale data bugs:
  //   - VOC re-runs on every load (dataVersion not synced to in-memory)
  //   - LRC Picker changes not picked up (lyrics/syncMarkers stale)
  //   - TC-006 false migrations from stale markers
  // IDB read is ~50-100ms on track load (already 1-3s total), acceptable cost.
  try {
    const freshTrack = await getTrackFromIDB(track.id);
    if (freshTrack) {
      track = freshTrack;
      tc.tracks[index] = freshTrack;
    }
  } catch (_) {
    console.warn('[Orchestrator] IDB fresh read failed, using catalog snapshot');
  }
  _mark('Steps 1-2: IDB read');

  // Step 3: before-track-change (loop.bridge + lyrics.bridge listen)
  try { document.dispatchEvent(new CustomEvent('before-track-change',
    { detail: { fromTrackId: prevId, toTrackId: track.id } })); } catch (_) {}

  // Step 4: clear previous lyrics/blocks
  const ld = (window as any).lyricsDisplay;
  try { ld?.clearAllTextBlocks?.(); } catch (_) {}
  try { ld?.fullReset?.(); } catch (_) {}
  try { clearWordSyncLayer(); } catch (_) {}
  _mark('Steps 3-4: Clear prev state');

  // Step 5: loading overlay show
  const ov = document.getElementById('loading-overlay');
  if (ov) ov.classList.remove('hidden');

  try {
    // Step 6: WE refs (stub properties)
    const we = (window as any).waveformEditor;
    if (we) {
      we.currentTrackId = track.id;
      we.lastLoadedFile = track.lyricsFileName || track.title;
    }

    // Step 7: RTF parsing via rtfService
    const raw = track.lyricsOriginalContent || track.lyrics;
    let lyrics = track.lyrics || track.lyricsOriginalContent;
    if (raw && typeof raw === 'string' && raw.startsWith('{\\rtf')) {
      try {
        const p = await (window as any).rtfService?.parseRtf(raw);
        if (p) lyrics = p;
      } catch (_) {}
    }
    _mark('Steps 6-7: RTF parse');

    // Step 8: load lyrics/blocks into LD
    if (track.blocksData?.length > 0 && ld) {
      await ld.loadImportedBlocks(track.blocksData, lyrics, false);
    } else if (ld) {
      await ld.reloadLyrics(lyrics, track.duration, false);
    }
    _mark('Step 8: Load lyrics');

    // TC-003: Index mismatch assertion — verify markers reference valid ld.lyrics indices
    if (import.meta.env.DEV && track.syncMarkers?.length > 0 && ld?.lyrics?.length) {
      const m1Markers = track.syncMarkers.filter((m: any) => m.markerType !== 'M2');
      const maxLine = Math.max(...m1Markers.map((m: any) => m.lineIndex));
      const ldLen = ld.lyrics.length;
      if (maxLine >= ldLen) {
        console.error(
          `[TC-003] INDEX MISMATCH! Max marker lineIndex=${maxLine} ` +
          `>= ld.lyrics.length=${ldLen}. Markers reference non-existent lines!`
        );
      } else {
        console.log(`[TC-003] INDEX CHECK: maxLine=${maxLine} < ld.lyrics.length=${ldLen} → OK`);
      }
    }

    // TC-006 + TC-007: Auto-migrate tracks with bracket tags in lyrics
    if (ld?.lyrics?.length) {
      // TC-85-01: Use track.syncMarkers instead of mm.markers.
      // mm.markers may still belong to the PREVIOUS track at this point
      // (they are only set at Step 11a, AFTER this migration check).
      // Using track.syncMarkers ensures we check the CURRENT track's markers.
      const m1Markers = (track.syncMarkers || []).filter((m: any) => m.markerType !== 'M2');
      const maxLine = m1Markers.length > 0
        ? Math.max(...m1Markers.map((m: any) => m.lineIndex))
        : -1;
      // TC-85-04: Only use outOfBounds as a trigger if we can actually fix it.
      // When markers reference more lines than lyrics has, removing bracket tags
      // won't help (line count doesn't change). The mismatch is a data integrity
      // issue that needs different handling (re-sync or re-import).
      // Only run migration when bracket tags are actually present and removable.
      const hasBracketTags = ld.lyrics.some(
        (line: string) => /^\s*\[[^\]]+\]\s*$/.test(line.trim())
      );
      if (hasBracketTags) {
        // Keep outOfBounds log for diagnostics but don't use as migration trigger
        const outOfBounds = m1Markers.length > 0 && maxLine >= ld.lyrics.length;
        if (outOfBounds) {
          console.warn(
            `[TC-85-04] MARKER/LYRICS MISMATCH: maxMarkerLine=${maxLine} ` +
            `>= lyricsLines=${ld.lyrics.length}. ${m1Markers.length} markers reference ` +
            `non-existent lines. Re-sync or re-import this track.`
          );
        }
        const originalContent = track.lyricsOriginalContent;

        if (originalContent) {
          // Import extractCleanLyrics dynamically
          const { extractCleanLyrics } = await import('../services/auto-lyrics.service');
          const cleanLines = extractCleanLyrics(originalContent);

          // Update ld.lyrics in place
          ld.lyrics = cleanLines;

          // TC-007: Invalidate word-sync if indices shifted
          if (track.alignmentData && track.lineMap) {
            const alignmentLines = (track.alignmentData as any).lines || [];
            const maxAlignedLine = alignmentLines.length > 0
              ? Math.max(...alignmentLines.map((l: any) => l.rawLineIndex ?? l.contentLineIndex ?? 0))
              : -1;

            if (maxAlignedLine >= cleanLines.length) {
              const { updateTrackField } = await import('./idb.service');
              await updateTrackField(track.id, {
                alignmentData: null,
                lineMap: null,
              });

              console.warn(
                `[TC-007] Invalidated word-sync for "${track.title}": ` +
                `maxAlignedLine=${maxAlignedLine} >= cleanLines.length=${cleanLines.length}`
              );
            }
          }

          // Persist clean lyrics to IDB
          const { updateTrackField } = await import('./idb.service');
          await updateTrackField(track.id, { lyrics: cleanLines.join('\n') });

          console.log(
            `[TC-006] MIGRATED "${track.title}": ` +
            `${ld.lyrics.length} → ${cleanLines.length} lines ` +
            `(removed bracket tags)`
          );
        } else {
          console.warn(
            `[TC-006] Cannot migrate "${track.title}": no lyricsOriginalContent`
          );
        }
      }
    }

    // Step 9+10: Audio loading — strategy depends on stemsEnabled
    _prevStemUrls.forEach(url => { try { URL.revokeObjectURL(url); } catch (_) {} });
    _prevStemUrls.clear();

    _mark('Step 9a: Blob URL creation (instrumental)');
    // Instrumental Blob URL — ALWAYS created (master clock)
    const iUrl = URL.createObjectURL(
      new Blob([track.instrumentalData], { type: track.instrumentalType }));
    _prevStemUrls.set('instrumental', iUrl);

    const ae = (window as any).audioEngine;
    // TC-10.15: Loading decision based on stemsMode (tumbler preference),
    // not stemsEnabled (playback state). User wants stems → load stems.
    // stemsEnabled is passed to AudioEngine for mute/unmute decisions.
    const st = useStemStore.getState();
    let stemsEnabled = st.stemsEnabled;

    // Boot restore: if store was reset but IDB remembers
    if (!stemsEnabled && track.stemsMode && !st._stemsBootRestored) {
      // Page reload: store was at default false, IDB remembers true
      stemsEnabled = true;
      st.setStemsEnabled(true);
      st.setStemsMode(true);
      ae?.setStemsEnabled?.(true);
    }

    const shouldLoadStems = st.stemsMode || stemsEnabled;
    const hasStemsData = !!(track.stemsData && Object.keys(track.stemsData).length > 0);

    if (shouldLoadStems && hasStemsData) {
      // ════════════════════════════════════════════════
      // PROGRESSIVE: Blob URL only for instrumental.
      // Vocals + stems passed as ArrayBuffer — no extra Blob URLs!
      // ════════════════════════════════════════════════
      const additionalStems: StemLoadMap = {};

      // Vocals: pass ArrayBuffer directly (no Blob URL!)
      if (track.vocalsData) {
        additionalStems['vocals'] = {
          data: track.vocalsData,
          type: track.vocalsType,
          role: 'vocal',
        };
      }

      // Additional stems: pass ArrayBuffer directly
      if (track.stemsData) {
        for (const [stemId, entry] of Object.entries(track.stemsData) as [string, StemDataEntry][]) {
          // ★1 Duplicate vocals guard — vocals handled via track.vocalsData above
          if (stemId === 'vocals') continue;

          const stemDef = BUILTIN_STEMS[stemId];
          additionalStems[stemId] = {
            data: entry.data,
            type: entry.type,
            role: stemDef?.role ?? 'music',
          };
        }
      }

      _mark('Step 9b: AudioEngine.loadTrack (progressive)');

      const numAdditional = Object.keys(additionalStems).length;
      await ae.loadTrack(
        iUrl,
        null,
        numAdditional > 0 ? additionalStems : undefined,
        { progressive: true, stemsEnabled }
      );
      _mark('Step 10: AudioEngine.loadTrack complete (progressive)');

    } else {
      // ════════════════════════════════════════════════
      // NON-PROGRESSIVE: inst + voc Blob URLs, ★6 no stems
      // ════════════════════════════════════════════════
      let vUrl: string | null = null;
      if (track.vocalsData) {
        vUrl = URL.createObjectURL(
          new Blob([track.vocalsData], { type: track.vocalsType }));
        _prevStemUrls.set('vocals', vUrl);
      }

      const additionalStems: StemLoadMap = {};
      // ★6 Only load stems when stemsEnabled=true
      if (stemsEnabled && track.stemsData) {
        for (const [stemId, entry] of Object.entries(track.stemsData) as [string, StemDataEntry][]) {
          // ★1 Duplicate vocals guard
          if (stemId === 'vocals') continue;

          const blobUrl = URL.createObjectURL(
            new Blob([entry.data], { type: entry.type }));
          _prevStemUrls.set(stemId, blobUrl);
          const stemDef = BUILTIN_STEMS[stemId];
          additionalStems[stemId] = {
            url: blobUrl,
            role: stemDef?.role ?? 'music',
          };
        }
      }

      _mark('Step 9b: AudioEngine.loadTrack (non-progressive)');

      const numAdditional = Object.keys(additionalStems).length;
      await ae.loadTrack(
        iUrl,
        vUrl,
        numAdditional > 0 ? additionalStems : undefined,
        { progressive: false, stemsEnabled }
      );
      _mark('Step 10: AudioEngine.loadTrack complete (non-progressive)');
    }

    // Step 11a: markers AFTER audio loaded
    const mm = (window as any).markerManager;
    if (track.syncMarkers?.length > 0) {
      mm?.setMarkers(track.syncMarkers);
      _mark('Step 11a: setMarkers');
      mm?.updateMarkerColors();
      _mark('Step 11a: updateMarkerColors');
    } else {
      mm?.resetMarkers();
      _mark('Step 11a: resetMarkers');
    }

    // TC-85-02: Guard — detect lyrics/marker mismatch (corrupted IDB recovery)
    if (import.meta.env.DEV && mm?.markers && ld?.lyrics) {
      const currentM1 = mm.markers.filter((m: any) => m.markerType !== 'M2');
      const maxMarkerLine = currentM1.length > 0
        ? Math.max(...currentM1.map((m: any) => m.lineIndex))
        : -1;
      if (maxMarkerLine >= ld.lyrics.length) {
        console.error(
          `[TC-85-02] LYRICS/MARKER MISMATCH! maxMarkerLine=${maxMarkerLine} ` +
          `>= ld.lyrics.length=${ld.lyrics.length}. ` +
          `This track may have corrupted lyrics from a previous TC-006 false migration.`
        );
      }
    }

    // ─── Step 11a.5: Vocal Onset Correction (VOC) — ASYNC ───
    // No more double-decode! Uses saved audioBuffer from StemPlayer.
    // Progressive: waits for vocals stem to load (Phase 2).
    // Non-progressive: vocals already loaded, buffer available immediately.
    const needsL3 = (!track.dataVersion || track.dataVersion < 4) && track.blocksData && track.blocksData.length > 0;
    const needsL2 = (!track.dataVersion || track.dataVersion < 3) && !needsL3;

    if ((needsL2 || needsL3) && track.syncMarkers?.length > 0) {
      // Fire-and-forget — do NOT await VOC
      (async () => {
        try {
          // Wait for vocals stem to be ready (instant if already loaded)
          const vocalReady = await ae.awaitStemReady?.('vocals', 15000);
          if (!vocalReady) {
            console.warn('[VOC] Vocals stem not ready after 15s, skipping VOC');
            return;
          }

          const audioBuffer = ae.getStemAudioBuffer?.('vocals');
          if (!audioBuffer) {
            console.warn('[VOC] No vocals audioBuffer available, skipping');
            return;
          }

          // Guard: if playback > 5s, only persist to IDB — don't shift markers in runtime
          const playbackPosition = ae.getCurrentTime?.() ?? 0;
          const runtimeUpdate = playbackPosition < 5;

          // ★7 Dynamic import — confirmed correct by SCAN-8.V3
          const { detectVocalOffset, applyOffsetToMarkers, detectMultiAnchorOffsets, applyMultiAnchorCorrection } = await import('./vocal-onset.service');
          const { updateTrackField } = await import('./idb.service');

          if (needsL3) {
            // L3: Multi-anchor correction
            const result = detectMultiAnchorOffsets(audioBuffer, track.syncMarkers, track.blocksData);
            if (result.applied) {
              const correctedMarkers = applyMultiAnchorCorrection(track.syncMarkers, result.anchors);
              if (runtimeUpdate) {
                mm?.setMarkers(correctedMarkers);
                mm?.updateMarkerColors();
              }
              await updateTrackField(track.id, { syncMarkers: correctedMarkers, dataVersion: 4 });
            } else {
              // L3 fallback to L2
              const l2Result = detectVocalOffset(audioBuffer, track.syncMarkers);
              if (l2Result.applied) {
                const correctedMarkers = applyOffsetToMarkers(track.syncMarkers, l2Result.offset);
                if (runtimeUpdate) {
                  mm?.setMarkers(correctedMarkers);
                  mm?.updateMarkerColors();
                }
                // TC-85-05: dataVersion=4 (not 3!) to break infinite VOC re-run cycle.
                // L3 was attempted and fell back to L2. Saving dataVersion=3 would cause
                // needsL3=true on next load (3 < 4), triggering L3 again → fail → L2 → save 3 → ∞
                console.info(`[VOC] L2 applied (L3 fallback): offset=${l2Result.offset.toFixed(3)}s, dataVersion=4, runtimeUpdate=${runtimeUpdate}`);
                await updateTrackField(track.id, { syncMarkers: correctedMarkers, dataVersion: 4 });
              }
            }
          } else {
            // L2: Linear offset correction
            const result = detectVocalOffset(audioBuffer, track.syncMarkers);
            if (result.applied) {
              const correctedMarkers = applyOffsetToMarkers(track.syncMarkers, result.offset);
              if (runtimeUpdate) {
                mm?.setMarkers(correctedMarkers);
                mm?.updateMarkerColors();
              }
              // TC-85-05: dataVersion=4 to prevent L3 re-run on next load.
              console.info(`[VOC] L2 applied (no L3): offset=${result.offset.toFixed(3)}s, dataVersion=4, runtimeUpdate=${runtimeUpdate}`);
              await updateTrackField(track.id, { syncMarkers: correctedMarkers, dataVersion: 4 });
            }
          }

          console.log(`[VOC] Async complete (playback=${playbackPosition.toFixed(1)}s, runtimeUpdate=${runtimeUpdate})`);
        } catch (e) {
          console.warn('[VOC] Async vocal onset detection failed:', e);
        }
      })();
      _mark('Step 11a.5: VOC async started');
    }

    // Step 11b: word-sync hydration
    try {
      const wsInput = {
        displayLyrics: typeof lyrics === 'string' ? lyrics : '',
        hashSourceLyrics: typeof raw === 'string' ? raw : '',
        audioSource: track.vocalsData ? 'vocal-stem' as const : 'instrumental' as const,
        cachedLineMap: track.lineMap,
        cachedAlignmentData: track.alignmentData,
      };
      _mark('Step 11b: word-sync input ready');
      prepareWordSyncLayer(wsInput);
      _mark('Step 11b: prepareWordSyncLayer done');
    } catch (err) {
      console.warn('[Orchestrator] prepareWordSyncLayer failed:', err);
      _mark('Step 11b: prepareWordSyncLayer FAILED');
    }
    _mark('Step 11: Markers + word-sync');

    // Step 11.5: Apply transition preset from track record
    const savedPreset = track.transitionPreset;
    if (savedPreset != null) {  // guard: null/undefined = не трогать plate.store
      try {
        const { usePlateStore } = await import('../stores/plate.store');
        usePlateStore.getState().setTransitionPreset(savedPreset);
      } catch (_) {}
    }
    _mark('Step 11.5: Apply transition preset');

    // Step 12: delayed block sanitization
    setTimeout(() => {
      try {
        if (ld?.textBlocks) ld.textBlocks = ld._sanitizeBlocks(ld.textBlocks);
      } catch (_) {}
    }, 100);

    // Step 13: autoplay
    if (opts.autoplay) {
      _autoplayTimer = setTimeout(async () => {
        _autoplayTimer = null;
        try { await ae.play(); } catch (_) {}
      }, 200);
    }

    // Step 14: sync editor (default: OPEN unless explicitly false)
    if (opts.openSyncEditor !== false && we) {
      we.show();
      const iEd = ae?.hybridEngine?.instrumentalUrl || track.instrumentalUrl || track.audioUrl;
      const vEd = ae?.hybridEngine?.vocalsUrl || track.vocalsUrl;
      if (iEd || vEd) we.loadDualWaveforms(iEd, vEd).catch(() => {});
    }
    _mark('Steps 12-14: Autoplay + SyncEditor');
    // ─── Step 15: Async audio analysis (fire-and-forget) ───
    (async () => {
      try {
        const { analyzeAndPersist } = await import('./audio-analysis.service');
        const result = await analyzeAndPersist(track.id);
        if (result) {
          // Update UI if TrackInfoBoard is open for this track
          try {
            const { useTrackInfoStore } = await import('../stores/trackInfo.store');
            const state = useTrackInfoStore.getState();
            if (state.isOpen && state.trackId === track.id) {
              state.mergeMeta({
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
          } catch (_) {}
          console.log(`[AudioAnalysis] Track ${track.id}: BPM=${result.bpm}, Key=${result.key}, Energy=${result.energy}`);
        }
      } catch (e) {
        console.warn('[AudioAnalysis] Failed:', e);
      }
    })();
    _mark('Step 15: Audio analysis async started');
  } catch (e: unknown) {
    if ((e as { name?: string })?.name === 'AbortError') return;
    console.error('Error loading track:', e);
    // TC-COVER-05: Fallback event for critical load errors
    document.dispatchEvent(new CustomEvent('track-load-failed', { detail: { error: (e as Error)?.message || 'Unknown error' } }));
  } finally {
    if (ov) ov.classList.add('hidden');
  }
}

export async function loadStemsOnDemand(): Promise<void> {
  const tc = (window as any).trackCatalog;
  const ae = (window as any).audioEngine;
  if (!tc?.tracks || !ae?.loadAdditionalStems) return;

  const track = tc.tracks[tc.currentTrackIndex];
  if (!track) return;

  // Read fresh stemsData from IDB
  let stemsData = track.stemsData;
  if (!stemsData || Object.keys(stemsData).length === 0) {
    try {
      const freshTrack = await getTrackFromIDB(track.id);
      if (freshTrack?.stemsData) stemsData = freshTrack.stemsData;
    } catch (_) {}
  }

  if (!stemsData || Object.keys(stemsData).length === 0) {
    console.warn('[loadStemsOnDemand] No stemsData found');
    return;
  }

  // Build StemLoadMap
  const additionalStems: StemLoadMap = {};

  if (track.vocalsData && !ae.stems?.has?.('vocals')) {
    additionalStems['vocals'] = {
      data: track.vocalsData,
      type: track.vocalsType,
      role: 'vocal',
    };
  }

  for (const [stemId, entry] of Object.entries(stemsData) as [string, any][]) {
    if (stemId === 'vocals') continue;
    if (ae.stems?.has?.(stemId)) continue;

    const stemDef = BUILTIN_STEMS[stemId];
    additionalStems[stemId] = {
      data: entry.data,
      type: entry.type,
      role: stemDef?.role ?? 'music',
    };
  }

  if (Object.keys(additionalStems).length === 0) {
    console.log('[loadStemsOnDemand] All stems already loaded');
    return;
  }

  console.log(`[loadStemsOnDemand] Loading ${Object.keys(additionalStems).length} stems on-demand`);

  await ae.loadAdditionalStems(additionalStems);

  // After loading: if stemsEnabled, mute instrumental + unmute stems
  const stemsEnabled = useStemStore.getState().stemsEnabled;
  if (stemsEnabled) {
    ae.setStemVolume?.('instrumental', 0);
    for (const stemId of Object.keys(additionalStems)) {
      if (stemId !== 'vocals') {
        ae.setStemVolume?.(stemId, 1);
      }
    }
    ae.setStemVolume?.('vocals', 1);
  }
}

export function queueTrackJump(delta: number): void {
  _pendingJump.direction += delta;
  if (_pendingJump.timer !== null) {
    clearTimeout(_pendingJump.timer);
  }
  _pendingJump.timer = setTimeout(() => {
    const jump = _pendingJump.direction;
    _pendingJump.direction = 0;
    _pendingJump.timer = null;
    if (jump === 0) return;

    const tc = (window as any).trackCatalog;
    if (!tc?.tracks?.length) return;

    let target = tc.currentTrackIndex + jump;
    target = Math.max(0, Math.min(target, tc.tracks.length - 1));

    if (target !== tc.currentTrackIndex) {
      loadTrack(target, { autoplay: true, openSyncEditor: false });
    }
  }, 250);
}

(window as any).queueTrackJump = queueTrackJump;

// F40: Register for legacy callers (TC.loadTrack wrapper, CV2 L555)
(window as any).trackOrchestrator = loadTrack;
