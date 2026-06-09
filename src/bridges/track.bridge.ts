import { useTrackStore, TrackMeta } from '../stores/track.store';
import { getAllTracks } from '../services/idb.service';
import { parseTrackName } from '../catalog/types';

// Contains Object URLs for both coverArt and customBg blobs
// Revoked on: syncAll (deferred 1200ms), catalog-cleared, bridge dispose
const _coverArtObjectUrls = new Set<string>();

function revokeAllCoverArtUrls() {
  _coverArtObjectUrls.forEach(url => { try { URL.revokeObjectURL(url); } catch (_) {} });
  _coverArtObjectUrls.clear();
}

// TC-COVER-01: Clear Set without revoking — for double-buffer syncAll
function clearCoverArtUrlSet() {
  _coverArtObjectUrls.clear();
}

// ── Tracks meta from IDB (Phase 2: own connection, no legacy fallback) ──

async function readTracksMetaFromIDB(): Promise<TrackMeta[]> {
  try {
    const tracks = await getAllTracks();
    return tracks.map((t, i) => {
      const parsed = parseTrackName(t.title || '');
      
      // TC-COVER-04: Generate Object URL from blob if available (offline-ready)
      let coverUrl: string | null = null;
      if (t.coverArtBlob) {
        coverUrl = URL.createObjectURL(t.coverArtBlob);
        _coverArtObjectUrls.add(coverUrl);
      } else if (t.coverArtUrl?.startsWith('http')) {
        coverUrl = t.coverArtUrl;
      }

      let customBgUrl: string | null = null;
      if (t.customBgBlob) {
        customBgUrl = URL.createObjectURL(t.customBgBlob);
        _coverArtObjectUrls.add(customBgUrl);
      }

      // 💎 Effective theme: when customBg is active, its theme takes priority over coverTheme.
      // This flows through currentCoverTheme → cover-theme.bridge (FROZEN) → :root CSS vars.
      // When customBg is removed, effectiveTheme reverts to coverTheme automatically.
      const effectiveTheme = t.customBgBlob
        ? (t.customBgTheme || t.coverTheme)
        : t.coverTheme;

      return {
        id: String(t.id ?? ''),
        title: t.title,
        artist: parsed.artist,
        coverArtUrl: coverUrl,
        coverTheme: effectiveTheme || null,
        customBgUrl,
        mvsepStatus: (t as any).mvsepStatus || null,
        index: i,
      };
    });
  } catch {
    return [];
  }
}

export function initTrackBridge(): () => void {
  // TC-COVER-01: Double-buffer syncAll — no broken image gap + error recovery
  const syncAll = async () => {
    const oldUrls = [..._coverArtObjectUrls];
    clearCoverArtUrlSet();  // Only clear, DON'T revoke (URLs still in use by React)

    try {
      const tracksMeta = await readTracksMetaFromIDB();
      const idx = Number((window as any).trackCatalog?.currentTrackIndex ?? -1);
      const currentTrack = tracksMeta[idx] || null;

      useTrackStore.setState({
        tracksMeta,
        currentTrack,
        currentTrackIndex: idx,
        currentCoverTheme: currentTrack?.coverTheme || null,
      });

      // TC-COVER-01: Deferred revoke — crossfade survival (0.6s transition + 0.6s buffer)
      if (oldUrls.length > 0) {
        setTimeout(() => {
          oldUrls.forEach(url => {
            try { URL.revokeObjectURL(url); } catch (_) {}
          });
        }, 1200);
      }
    } catch (err) {
      // TC-COVER-01: Restore old URLs — still in use by React components
      oldUrls.forEach(url => _coverArtObjectUrls.add(url));
      // Explicit theme reset — consumers see default theme
      useTrackStore.setState({ currentCoverTheme: null });
      console.warn('[TrackBridge] syncAll failed, URLs preserved:', err);
    }
  };

  // TC-COVER-07: Debounce syncAll — consolidate multiple events into one IDB read
  let _syncDebounce: ReturnType<typeof setTimeout> | null = null;

  const debouncedSyncAll = () => {
    if (_syncDebounce) clearTimeout(_syncDebounce);
    _syncDebounce = setTimeout(syncAll, 100);  // 100ms buffer for blocks-applied
  };

  const onCatalogCleared = () => {
    // TC-COVER-01: Full revoke when catalog cleared (no components using these URLs)
    revokeAllCoverArtUrls();
    useTrackStore.setState({
      tracksMeta: [],
      currentTrack: null,
      currentTrackIndex: -1,
      currentCoverTheme: null,  // TC-COVER-01: Reset theme on catalog clear
    });
  };

  // TC-COVER-07: Debounced listeners — 3 events → 1 IDB read
  document.addEventListener('track-loaded', debouncedSyncAll);
  document.addEventListener('blocks-applied', debouncedSyncAll);
  // catalog-cleared → DIRECT call (NOT debounced!)
  document.addEventListener('catalog-cleared', onCatalogCleared);
  document.addEventListener('tracks-changed', debouncedSyncAll);

  // Initial sync + retry for late boot
  syncAll();
  const retry = setTimeout(syncAll, 800);

  return () => {
    clearTimeout(retry);
    if (_syncDebounce) clearTimeout(_syncDebounce);
    // TC-COVER-07: Remove debounced listeners
    document.removeEventListener('track-loaded', debouncedSyncAll);
    document.removeEventListener('blocks-applied', debouncedSyncAll);
    document.removeEventListener('catalog-cleared', onCatalogCleared);
    document.removeEventListener('tracks-changed', debouncedSyncAll);
    // TC-COVER-04: Cleanup Object URLs on bridge disposal
    revokeAllCoverArtUrls();
  };
}
