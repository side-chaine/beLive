import { create } from 'zustand';

interface LyricsState {
  lines: string[];
  activeLineIndex: number;
  activeBlockId: string | null;
  setLines: (lines: string[]) => void;
  setActiveLineIndex: (idx: number) => void;
  setActiveBlockId: (id: string | null) => void;
}

export const useLyricsStore = create<LyricsState>((set) => ({
  lines: [],
  activeLineIndex: -1,
  activeBlockId: null,
  setLines: (lines) => set({ lines }),
  setActiveLineIndex: (idx) => set({ activeLineIndex: idx }),
  setActiveBlockId: (id) => set({ activeBlockId: id }),
}));
