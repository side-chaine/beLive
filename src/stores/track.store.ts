import { create } from 'zustand';

export interface TrackMeta {
  id: string;
  title?: string;
  artist?: string;
  index: number;
}

export interface TrackState {
  tracksMeta: TrackMeta[];
  currentTrack: TrackMeta | null;
  currentTrackIndex: number;

  setTracksMeta: (t: TrackMeta[]) => void;
  setCurrentTrack: (t: TrackMeta | null) => void;
  setCurrentTrackIndex: (i: number) => void;
  removeTrack: (id: string) => void;
}

export const useTrackStore = create<TrackState>((set) => ({
  tracksMeta: [],
  currentTrack: null,
  currentTrackIndex: -1,

  setTracksMeta: (t) => set({ tracksMeta: t }),
  setCurrentTrack: (t) => set({ currentTrack: t }),
  setCurrentTrackIndex: (i) => set({ currentTrackIndex: i }),
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