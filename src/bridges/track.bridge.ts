import { useTrackStore, TrackMeta } from '../stores/track.store';
import { getAllTracks } from '../services/idb.service';
import { parseTrackName } from '../catalog/types';

// ── Tracks meta from IDB (Phase 2: own connection, no legacy fallback) ──

async function readTracksMetaFromIDB(): Promise<TrackMeta[]> {
  try {
    const tracks = await getAllTracks();
    return tracks.map((t, i) => {
      const parsed = parseTrackName(t.title || '');
      return {
        id: String(t.id ?? ''),
        title: t.title,
        artist: parsed.artist,
        index: i,
      };
    });
  } catch {
    return [];
  }
}

export function initTrackBridge(): () => void {
  const syncAll = async () => {
    const tracksMeta = await readTracksMetaFromIDB();
    // Single TC ref: currentTrackIndex (event-driven, not polling)
    const idx = Number((window as any).trackCatalog?.currentTrackIndex ?? -1);
    useTrackStore.setState({
      tracksMeta,
      currentTrack: tracksMeta[idx] || null,
      currentTrackIndex: idx,
    });
  };

  const onCatalogCleared = () =>
    useTrackStore.setState({ tracksMeta: [], currentTrack: null, currentTrackIndex: -1 });

  document.addEventListener('track-loaded', syncAll);
  document.addEventListener('blocks-applied', syncAll);
  document.addEventListener('catalog-cleared', onCatalogCleared);
  document.addEventListener('tracks-changed', syncAll);

  // Initial sync + retry for late boot
  syncAll();
  const retry = setTimeout(syncAll, 800);

  return () => {
    clearTimeout(retry);
    document.removeEventListener('track-loaded', syncAll);
    document.removeEventListener('blocks-applied', syncAll);
    document.removeEventListener('catalog-cleared', onCatalogCleared);
    document.removeEventListener('tracks-changed', syncAll);
  };
}
