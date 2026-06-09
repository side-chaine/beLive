import { create } from 'zustand';
import type { CoverArtTheme } from '../types/cover-theme.types';

export interface TrackMeta {
  id: string;
  title?: string;
  artist?: string;
  coverArtUrl?: string | null;
  coverTheme?: CoverArtTheme | null;
  /** Custom background Object URL (runtime only, not persisted).
   *  When set, takes priority over coverArtUrl for background rendering. */
  customBgUrl?: string | null;
  index: number;
  mvsepStatus?: 'processing' | 'done' | 'failed' | 'timeout' | null;
}

export interface TrackState {
  tracksMeta: TrackMeta[];
  currentTrack: TrackMeta | null;
  currentTrackIndex: number;
  currentCoverTheme: CoverArtTheme | null;
  hasBlockScenes: boolean;

  setTracksMeta: (t: TrackMeta[]) => void;
  setCurrentTrack: (t: TrackMeta | null) => void;
  setCurrentTrackIndex: (i: number) => void;
  removeTrack: (id: string) => void;
  setCurrentCoverTheme: (theme: CoverArtTheme | null) => void;
  setHasBlockScenes: (v: boolean) => void;
}

export const useTrackStore = create<TrackState>((set) => ({
  tracksMeta: [],
  currentTrack: null,
  currentTrackIndex: -1,
  currentCoverTheme: null,
  hasBlockScenes: false,

  setTracksMeta: (t) => set({ tracksMeta: t }),
  setCurrentTrack: (t) => set({ currentTrack: t }),
  setCurrentTrackIndex: (i) => set({ currentTrackIndex: i }),
  setCurrentCoverTheme: (theme) => set({ currentCoverTheme: theme }),
  setHasBlockScenes: (hasBlockScenes) => set({ hasBlockScenes }),
  removeTrack: (id) => set((state) => {
    const removedIndex = state.tracksMeta.findIndex((t) => t.id === id);
    if (removedIndex === -1) return state;

    const nextTracksMeta = state.tracksMeta.filter((t) => t.id !== id);
    const shouldShiftIndex = removedIndex <= state.currentTrackIndex;
    const nextIndexBase = shouldShiftIndex
      ? Math.max(0, state.currentTrackIndex - 1)
      : state.currentTrackIndex;
    const nextIndex = nextTracksMeta.length === 0 ? -1 : nextIndexBase;

    return {
      tracksMeta: nextTracksMeta,
      currentTrackIndex: nextIndex,
    };
  }),
}));