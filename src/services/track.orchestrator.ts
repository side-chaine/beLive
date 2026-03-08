// src/services/track.orchestrator.ts
// F40: Track loading — all 14 steps from TC.loadTrack (L410-533)
// Legacy engines (LD, MM, AE, WE) called via window.* — NOT abstracted.

export interface LoadTrackOptions {
  autoplay?: boolean;
  openSyncEditor?: boolean;
}

export async function loadTrack(index: number, opts: LoadTrackOptions = {}): Promise<void> {
  const tc = (window as any).trackCatalog;
  if (!tc?.tracks || index < 0 || index >= tc.tracks.length) return;

  // Steps 1-2: save prev id, update index BEFORE events
  const prevId = tc.currentTrackIndex >= 0 && tc.currentTrackIndex < tc.tracks.length
    ? tc.tracks[tc.currentTrackIndex]?.id : null;
  const track = tc.tracks[index];
  tc.currentTrackIndex = index;

  // Step 3: before-track-change (loop.bridge + lyrics.bridge listen)
  try { document.dispatchEvent(new CustomEvent('before-track-change',
    { detail: { fromTrackId: prevId, toTrackId: track.id } })); } catch (_) {}

  // Step 4: clear previous lyrics/blocks
  const ld = (window as any).lyricsDisplay;
  try { ld?.clearAllTextBlocks?.(); } catch (_) {}
  try { ld?.fullReset?.(); } catch (_) {}

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

    // Step 7: RTF parsing via rtfService (fixed: original had dead \r check)
    const raw = track.lyricsOriginalContent || track.lyrics;
    let lyrics = raw;
    if (raw && typeof raw === 'string' && raw.startsWith('{\\rtf')) {
      try {
        const p = await (window as any).rtfService?.parseRtf(raw);
        if (p) lyrics = p;
      } catch (_) {}
    }

    // Step 8: load lyrics/blocks into LD
    if (track.blocksData?.length > 0 && ld) {
      await ld.loadImportedBlocks(track.blocksData, lyrics, false);
    } else if (ld) {
      await ld.reloadLyrics(lyrics, track.duration, false);
    }

    // Step 9: Blob URLs from ArrayBuffer
    const iUrl = URL.createObjectURL(
      new Blob([track.instrumentalData], { type: track.instrumentalType }));
    let vUrl: string | null = null;
    if (track.vocalsData) {
      vUrl = URL.createObjectURL(
        new Blob([track.vocalsData], { type: track.vocalsType }));
    }

    // Step 10: audio engine load (triggers 'track-loaded' event)
    const ae = (window as any).audioEngine;
    await ae.loadTrack(iUrl, vUrl);

    // Step 11: markers AFTER audio loaded
    const mm = (window as any).markerManager;
    if (track.syncMarkers?.length > 0) {
      mm?.setMarkers(track.syncMarkers);
      mm?.updateMarkerColors();
    } else {
      mm?.resetMarkers();
    }

    // Step 12: delayed block sanitization
    setTimeout(() => {
      try {
        if (ld?.textBlocks) ld.textBlocks = ld._sanitizeBlocks(ld.textBlocks);
      } catch (_) {}
    }, 100);

    // Step 13: autoplay
    if (opts.autoplay) {
      setTimeout(async () => { try { await ae.play(); } catch (_) {} }, 200);
    }

    // Step 14: sync editor (default: OPEN unless explicitly false)
    if (opts.openSyncEditor !== false && we) {
      we.show();
      const iEd = ae?.hybridEngine?.instrumentalUrl || track.instrumentalUrl || track.audioUrl;
      const vEd = ae?.hybridEngine?.vocalsUrl || track.vocalsUrl;
      if (iEd || vEd) we.loadDualWaveforms(iEd, vEd).catch(() => {});
    }
  } catch (e: unknown) {
    if ((e as { name?: string })?.name === 'AbortError') return;
    console.error('Error loading track:', e);
  } finally {
    if (ov) ov.classList.add('hidden');
  }
}

// F40: Register for legacy callers (TC.loadTrack wrapper, CV2 L555)
(window as any).trackOrchestrator = loadTrack;
