import { create } from 'zustand';

interface UIState {
  catalogOpen: boolean;
  karaokeLinesCount: 2 | 4;
  karaokeLyricsScale: number;
  activeFeedColumn: number;
  catalogTab: 'catalog' | 'my-music' | 'upload';
  setCatalogOpen: (v: boolean) => void;
  setKaraokeLinesCount: (count: 2 | 4) => void;
  setKaraokeLyricsScale: (scale: number) => void;
  setActiveFeedColumn: (col: number) => void;
  setCatalogTab: (tab: 'catalog' | 'my-music' | 'upload') => void;
}

export const useUIStore = create<UIState>((set) => ({
  catalogOpen: false,
  karaokeLinesCount: 2,
  karaokeLyricsScale: 120,
  activeFeedColumn: 1,
  catalogTab: 'catalog',
  setCatalogOpen: (v) => set({ catalogOpen: v }),
  setKaraokeLinesCount: (count) => set({ karaokeLinesCount: count }),
  setKaraokeLyricsScale: (scale) => set({ karaokeLyricsScale: scale }),
  setActiveFeedColumn: (col) => set({ activeFeedColumn: col }),
  setCatalogTab: (tab) => set({ catalogTab: tab }),
}));
