/**
 * Track Actions — isolation layer for legacy trackCatalog calls
 * F29: All React components call these instead of window.trackCatalog directly
 * F40: loadTrack delegates to track.orchestrator.ts
 */

import { loadTrack as orchestrateLoadTrack } from './track.orchestrator';
import { parseTrackName } from '../catalog/types';
import { useTrackStore } from '../stores/track.store';

export function loadTrack(index: number, options?: { autoplay?: boolean; openSyncEditor?: boolean }): void {
  // MVSEP guard: block playback for tracks still being processed
  const tracks = getTracksArray();
  const track = tracks[index];
  if (track?.mvsepStatus && track.mvsepStatus !== 'done') {
    const w = window as any;
    if (w.showAppNotification) {
      w.showAppNotification('⏳ Трек ещё обрабатывается. Дождитесь завершения.', 'info');
    }
    return;
  }

  // TC-099-01: Optimistic track name — visible immediately, bridge confirms via IDB later
  if (track) {
    const parsed = parseTrackName(track.title || '');
    useTrackStore.setState({
      currentTrack: {
        id: String(track.id ?? ''),
        title: track.title,
        artist: parsed.artist,
        coverArtUrl: track.coverArtUrl?.startsWith('http') ? track.coverArtUrl : null,
        coverTheme: track.coverTheme || null,
        index,
        mvsepStatus: track.mvsepStatus || null,
      },
      currentTrackIndex: index,
    });
  }
  orchestrateLoadTrack(index, options ?? { autoplay: true, openSyncEditor: false });
}

export async function deleteTrack(id: number): Promise<void> {
  const w = window as any;
  const idb = w.idbService;
  const tc = w.trackCatalog;
  if (!idb || id === undefined) return;

  try {
    await idb.deleteTrack(id);

    if (tc) {
      const deletedIndex = tc.tracks.findIndex((t: any) => t.id === id);
      if (deletedIndex !== -1) {
        tc.tracks.splice(deletedIndex, 1);

        if (deletedIndex === tc.currentTrackIndex) {
          document.dispatchEvent(new Event('before-track-change'));
          if (w.audioEngine) w.audioEngine.stop();
          tc.currentTrackIndex = -1;
          if (w.lyricsDisplay?.clearAllTextBlocks) w.lyricsDisplay.clearAllTextBlocks();
          if (w.lyricsDisplay?.fullReset) w.lyricsDisplay.fullReset();
          if (w.lyricsDisplay) {
            w.lyricsDisplay.lyrics = [];
            w.lyricsDisplay.fullText = '';
          }
          if (w.markerManager?.resetMarkers) w.markerManager.resetMarkers();
        } else if (deletedIndex < tc.currentTrackIndex) {
          tc.currentTrackIndex--;
        }

        if (w.waveformEditor && w.waveformEditor.currentTrackId === id) {
          w.waveformEditor.currentTrackId = null;
          w.waveformEditor.lastLoadedFile = null;
        }

        if (tc.tracks.length === 0 && w.idbService?.setCatalogCleared) {
          w.idbService.setCatalogCleared();
        }
      } else {
        const idb = w.idbService;
        if (idb?.getAllTracks) {
          const fresh = await idb.getAllTracks();
          tc.tracks.length = 0;
          tc.tracks.push(...fresh);
        }
      }
    }
    document.dispatchEvent(new CustomEvent('tracks-changed', { detail: { source: 'track-delete' } }));
  } catch (e) {
    console.error('Error deleting track:', e);
  }
}

export function getTracksArray(): any[] {
  const tc = (window as any).trackCatalog;
  return tc?.tracks || [];
}

export function saveLyricsBlocks(
  trackId: number | string,
  blocksData: any,
  newLyricsText?: string
): void {
  const w = window as any;
  const tc = w.trackCatalog;
  const idb = w.idbService;
  if (!tc) return;

  const track = tc.tracks.find((t: any) => t.id === trackId);
  if (!track) {
    w.showAppNotification?.('Track not found for saving blocks and lyrics.', 'error');
    return;
  }

  track.blocksData = blocksData;
  if (newLyricsText !== undefined) track.lyrics = newLyricsText;
  track.lastModified = new Date();

  if (idb?.saveTrack) {
    idb.saveTrack(track).then(() => {
      w.showAppNotification?.(`Lyric blocks for "${track.title}" saved.`, 'success');
    }).catch((err: any) => {
      w.showAppNotification?.(`Error saving blocks: ${err.message}`, 'error');
    });
  }
}

export function initTrackEventListeners(): void {
  document.addEventListener('save-track-markers', ((event: Event) => {
    const detail = (event as CustomEvent).detail;
    if (!detail?.trackId || !detail?.markers) return;

    const w = window as any;
    const tc = w.trackCatalog;
    const idb = w.idbService;
    if (!tc) return;

    const track = tc.tracks.find((t: any) => t.id === detail.trackId);
    if (!track) {
      console.error('Track not found:', detail.trackId);
      return;
    }

    track.syncMarkers = JSON.parse(JSON.stringify(detail.markers));

    if (idb?.saveTrack) {
      idb.saveTrack(track);
    }
  }) as EventListener);
}

export async function clearAllTracks(): Promise<boolean> {
  const w = window as any;
  const idb = w.idbService;
  if (!idb) return false;

  if (!confirm('Вы уверены, что хотите удалить ВСЕ треки из каталога? Это действие невозможно отменить!')) {
    return false;
  }

  try {
    document.dispatchEvent(new Event('before-track-change'));
    await idb.clearAllTracks();

    if (w.audioEngine) w.audioEngine.stop();

    const tc = w.trackCatalog;
    if (tc) {
      tc.tracks = [];
      tc.currentTrackIndex = -1;
    }

    if (w.waveformEditor) {
      w.waveformEditor.currentTrackId = null;
      w.waveformEditor.lastLoadedFile = null;
    }

    if (w.lyricsDisplay) {
      if (w.lyricsDisplay.clearAllTextBlocks) w.lyricsDisplay.clearAllTextBlocks();
      if (w.lyricsDisplay.fullReset) w.lyricsDisplay.fullReset();
      w.lyricsDisplay.lyrics = [];
      w.lyricsDisplay.fullText = '';
    }

    if (w.markerManager?.resetMarkers) w.markerManager.resetMarkers();

    document.dispatchEvent(new CustomEvent('catalog-cleared'));
    return true;
  } catch (e) {
    console.error('Ошибка при очистке каталога:', e);
    return false;
  }
}

export async function importMarkersFromFile(file: File): Promise<void> {
  const w = window as any;
  try {
    if (!w.markerManager) return;

    const text = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        let content = reader.result as string;
        if (content.charCodeAt(0) === 0xFEFF) {
          content = content.substring(1);
        }
        resolve(content);
      };
      reader.onerror = () => reject(new Error('Error reading file: ' + file.name));
      reader.readAsText(file, 'UTF-8');
    });

    const ok = w.markerManager.importMarkers(text);
    if (ok) {
      w.showNotification?.('Markers imported successfully', 'success');
    } else {
      w.showNotification?.('Invalid markers format', 'error');
    }
  } catch (error: any) {
    console.error('Error importing markers:', error);
    w.showNotification?.('Error importing markers: ' + error.message, 'error');
  }
}

if (typeof window !== 'undefined') {
  (window as any).clearAllTracksAction = clearAllTracks;
  (window as any).importMarkersAction = importMarkersFromFile;
}
