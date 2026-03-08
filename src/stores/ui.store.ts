import { create } from 'zustand';

interface UIState {
  catalogOpen: boolean;
  karaokeLinesCount: 2 | 4;
  karaokeLyricsScale: number;
  setCatalogOpen: (v: boolean) => void;
  setKaraokeLinesCount: (count: 2 | 4) => void;
  setKaraokeLyricsScale: (scale: number) => void;
}

export const useUIStore = create<UIState>((set) => ({
  catalogOpen: false,
  karaokeLinesCount: 2,
  karaokeLyricsScale: 120,
  setCatalogOpen: (v) => set({ catalogOpen: v }),
  setKaraokeLinesCount: (count) => set({ karaokeLinesCount: count }),
  setKaraokeLyricsScale: (scale) => set({ karaokeLyricsScale: scale }),
}));
