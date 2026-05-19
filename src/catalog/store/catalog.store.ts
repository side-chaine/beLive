import { create } from 'zustand';
import type { Playlist, PlaylistEntry, CenterTab, ShowcaseSection, ArtistGroup } from '../types';
import { parseTrackName } from '../types';
import { switchMode } from '../../bridges/mode-switch.bridge';
import * as idb from '../../services/idb.service';
import { useTrackStore } from '../../stores/track.store';
import { loadTrack, getTracksArray } from '../../services/track.actions';

/* ═══════════════════════════════════════════
   Catalog Store — Sprint 37
   3-column catalog state
   Persistence through idb.service (F26)
   ═══════════════════════════════════════════ */

interface CatalogState {
  /* ── Column 1: My Music ── */
  myMusicIds: number[];

  /* ── Column 2: Center ── */
  playlists: Playlist[];
  activeTab: CenterTab;
  isBuilding: boolean;
  buildingName: string;
  buildingTracks: PlaylistEntry[];

  /* ── Column 3: Search ── */
  searchQuery: string;
  showUpload: boolean;

  /* ── Actions: My Music ── */
  setMyMusicIds: (ids: number[]) => void;
  addToMyMusic: (trackId: number) => Promise<void>;
  removeFromMyMusic: (trackId: number) => Promise<void>;
  isInMyMusic: (trackId: number) => boolean;
  syncMyMusicFromLegacy: () => void;

  /* ── Actions: Playlists ── */
  setPlaylists: (p: Playlist[]) => void;
  setActiveTab: (tab: CenterTab) => void;
  startBuildingPlaylist: (name?: string) => void;
  cancelBuilding: () => void;
  setBuildingName: (name: string) => void;
  addToBuildingPlaylist: (entry: PlaylistEntry) => void;
  removeFromBuildingPlaylist: (trackId: number) => void;
  savePlaylist: () => void;
  deletePlaylist: (id: number) => void;
  loadPlaylist: (id: number) => void;
  syncPlaylistsFromLegacy: () => void;

  /* ── Playlist playback ── */
  _activePlaylist: Playlist | null;
  _activePlaylistIndex: number;
  playNextInPlaylist: () => void;

  /* ── Showcase (Афиша) ── */
  showcaseSections: ShowcaseSection[];
  recentTrackIds: number[];
  addRecentTrack: (id: number) => void;

  /* ── Artist grouping ── */
  expandedArtists: string[];
  toggleArtist: (artist: string) => void;
  getGroupedMyMusic: () => ArtistGroup[];

  /* ── Actions: Search ── */
  setSearchQuery: (q: string) => void;
  setShowUpload: (v: boolean) => void;
}

function _defaultShowcase(): ShowcaseSection[] {
  return [
    {
      id: 'welcome',
      title: 'Добро пожаловать',
      type: 'featured',
      items: [{
        id: 'welcome-1',
        title: 'Начните здесь!',
        description: 'Загрузите первый трек через ZIP или Upload',
      }],
    },
    {
      id: 'recent',
      title: 'Недавние',
      type: 'top',
      items: [],
    },
    {
      id: 'exercises',
      title: 'Упражнения: Вокал',
      type: 'exercises',
      items: [
        { id: 'ex-1', title: 'Распевка до-ре-ми', description: 'Базовая распевка для разогрева', sourceType: 'youtube' },
        { id: 'ex-2', title: 'Дыхание: основы', description: 'Диафрагмальное дыхание', sourceType: 'youtube' },
        { id: 'ex-3', title: 'Интервалы: терция и квинта', description: 'Слуховой тренинг', sourceType: 'youtube' },
      ],
    },
    {
      id: 'coming-soon',
      title: 'Скоро',
      type: 'featured',
      items: [{
        id: 'tg-promo',
        title: 'Telegram каталог',
        description: 'Альбомы, коллекции, подборки упражнений — скоро в Афише',
      }],
    },
  ];
}

export const useCatalogStore = create<CatalogState>((set, get) => ({
  /* ── Initial state ── */
  myMusicIds: [],
  playlists: [],
  activeTab: 'playlists',
  isBuilding: false,
  buildingName: '',
  buildingTracks: [],
  searchQuery: '',
  showUpload: false,
  _activePlaylist: null,
  _activePlaylistIndex: 0,
  showcaseSections: _defaultShowcase(),
  recentTrackIds: [],
  expandedArtists: [],

  /* ── My Music ── */

  setMyMusicIds: (ids) => set({ myMusicIds: ids }),

  addToMyMusic: async (trackId) => {
    await idb.addToMyMusic(trackId);
    set(s => ({
      myMusicIds: s.myMusicIds.includes(trackId)
        ? s.myMusicIds
        : [...s.myMusicIds, trackId],
    }));
  },

  removeFromMyMusic: async (trackId) => {
    await idb.removeFromMyMusic(trackId);
    set(s => ({
      myMusicIds: s.myMusicIds.filter(id => id !== trackId),
    }));
  },

  isInMyMusic: (trackId) => get().myMusicIds.includes(trackId),

  syncMyMusicFromLegacy: () => {
    idb.getMyMusicIds().then(ids => set({ myMusicIds: ids }));
  },

  /* ── Playlists ── */

  setPlaylists: (p) => set({ playlists: p }),

  setActiveTab: (tab) => set({ activeTab: tab }),

  startBuildingPlaylist: (name) => set({
    isBuilding: true,
    buildingName: name !== undefined ? name : '',
    buildingTracks: [],
  }),

  cancelBuilding: () => set({
    isBuilding: false,
    buildingName: '',
    buildingTracks: [],
  }),

  setBuildingName: (name) => set({ buildingName: name }),

  addToBuildingPlaylist: (entry) => set(s => ({
    buildingTracks: s.buildingTracks.some(e => e.trackId === entry.trackId)
      ? s.buildingTracks
      : [...s.buildingTracks, entry],
  })),

  removeFromBuildingPlaylist: (trackId) => set(s => ({
    buildingTracks: s.buildingTracks.filter(e => e.trackId !== trackId),
  })),

  savePlaylist: () => {
    const { isBuilding, buildingName, buildingTracks, playlists } = get();
    if (!isBuilding || buildingTracks.length === 0) return;

    // Auto-generate name if empty
    let name = buildingName.trim();
    if (!name) {
      const titles = buildingTracks.map(t => {
        // Shorten track title: take last part after " - "
        const parts = t.title.split(' - ');
        return parts[parts.length - 1].trim().slice(0, 20);
      });
      if (titles.length <= 2) {
        name = titles.join(' + ');
      } else {
        name = `${titles[0]} ... ${titles[titles.length - 1]} (${titles.length})`;
      }
    }

    const newPlaylist: Playlist = {
      id: Date.now(),
      name,
      tracks: [...buildingTracks],
    };

    const updated = [...playlists, newPlaylist];
    set({
      playlists: updated,
      isBuilding: false,
      buildingName: '',
      buildingTracks: [],
    });

    idb.savePlaylists(updated);
  },

  deletePlaylist: (id) => {
    const updated = get().playlists.filter(p => p.id !== id);
    set({ playlists: updated });

    idb.savePlaylists(updated);
  },

  loadPlaylist: (id) => {
    const playlist = get().playlists.find(p => p.id === id);
    if (!playlist || playlist.tracks.length === 0) return;

    // Close catalog first
    document.dispatchEvent(new CustomEvent('catalog-close'));

    // Switch to Rehearsal + Deck(Mix)
    switchMode('rehearsal');
    // RESIDUE: no known listeners found in repo-wide scan as of 2025-07.
    // Kept as protective compatibility signal. Do not remove without explicit architectural decision.
    document.dispatchEvent(new CustomEvent('sync-editor-closed'));
    document.dispatchEvent(new CustomEvent('deck-set-tab', { detail: { tab: 'mix', expanded: true } }));

    // Start sequential playback (same pattern as legacy _playPlaylistSequentially)
    const ae = (window as any).audioEngine;

    set({ _activePlaylist: playlist, _activePlaylistIndex: 0 });

    let index = 0;
    const playNext = () => {
      if (index >= playlist.tracks.length) {
        set({ _activePlaylist: null, _activePlaylistIndex: 0 });
        console.log('[CatalogStore] Playlist finished:', playlist.name);
        return;
      }

      const entry = playlist.tracks[index];
      const all = getTracksArray();
      // Find track by ID first, then by title match
      let candidate = all.find((x: any) => x.id === entry.trackId);
      if (!candidate) {
        candidate = all.find((x: any) => (x.title || '').includes(entry.title));
      }
      if (!candidate) {
        console.warn('[CatalogStore] Track not found, skipping:', entry.title);
        index++;
        playNext();
        return;
      }

      const trackIdx = all.indexOf(candidate);
      set({ _activePlaylistIndex: index });
      console.log('[CatalogStore] Playlist:', playlist.name, 'track', index + 1, '/', playlist.tracks.length, '-', candidate.title);

      const loadPromise = loadTrack(trackIdx, { autoplay: true, openSyncEditor: false });

      // loadTrack may return Promise or undefined
      Promise.resolve(loadPromise).then(() => {
        if (ae && typeof ae.onBothEnded === 'function') {
          const unsub = ae.onBothEnded(() => {
            // Cleanup this callback
            if (typeof unsub === 'function') { try { unsub(); } catch (_) {} }
            // Advance to next track
            index++;
            playNext();
          });
        } else {
          // Fallback: use duration timeout
          const dur = candidate.duration || 0;
          setTimeout(() => { index++; playNext(); }, Math.max(500, dur * 1000));
        }
      }).catch((err: any) => {
        console.warn('[CatalogStore] loadTrack failed, skipping:', err);
        index++;
        playNext();
      });
    };

    playNext();
    console.log('[CatalogStore] Starting playlist:', playlist.name, playlist.tracks.length, 'tracks');
  },

  playNextInPlaylist: () => {
    // Sequential playback is now handled by recursive onBothEnded in loadPlaylist.
    // This action is kept for potential manual "skip" feature.
    console.log('[CatalogStore] playNextInPlaylist — sequential handled by onBothEnded chain');
  },

  syncPlaylistsFromLegacy: () => {
    idb.loadPlaylists().then(pl => set({ playlists: pl }));
  },

  /* ── Search ── */

  setSearchQuery: (q) => set({ searchQuery: q }),
  setShowUpload: (v) => set({ showUpload: v }),

  /* ── Showcase ── */

  addRecentTrack: (id) => {
    set(s => {
      const filtered = s.recentTrackIds.filter(x => x !== id);
      const updated = [id, ...filtered].slice(0, 5); // keep last 5
      return { recentTrackIds: updated };
    });
  },

  /* ── Artist grouping ── */

  toggleArtist: (artist) => set(s => ({
    expandedArtists: s.expandedArtists.includes(artist)
      ? s.expandedArtists.filter(a => a !== artist)
      : [...s.expandedArtists, artist],
  })),

  getGroupedMyMusic: () => {
    const state = get();
    const allTracks = useTrackStore.getState().tracksMeta;

    const groups: Record<string, ArtistGroup> = {};

    for (const trackId of state.myMusicIds) {
      const track = allTracks.find(t => Number(t.id) === trackId);
      if (!track) continue;

      const fullTitle = track.title || `Track ${trackId}`;
      const parsed = parseTrackName(fullTitle);

      if (!groups[parsed.artist]) {
        groups[parsed.artist] = {
          artist: parsed.artist,
          tracks: [],
          expanded: state.expandedArtists.includes(parsed.artist),
        };
      }
      groups[parsed.artist].tracks.push({
        id: trackId,
        title: parsed.title,
        index: track.index,
        fullTitle,
        coverArtUrl: track.coverArtUrl,
      });
    }

    // Sort: artists with most tracks first, "Разное" last
    return Object.values(groups).sort((a, b) => {
      if (a.artist === 'Разное') return 1;
      if (b.artist === 'Разное') return -1;
      return b.tracks.length - a.tracks.length;
    });
  },
}));
