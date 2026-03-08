import { create } from 'zustand';

interface PianoState {
  /** Overlay visible */
  open: boolean;
  /** Mic pitch detection active */
  micActive: boolean;

  togglePiano: () => void;
  setMicActive: (v: boolean) => void;
}

export const usePianoStore = create<PianoState>((set) => ({
  open: false,
  micActive: false,

  togglePiano: () =>
    set((s) => {
      if (s.open) return { open: false, micActive: false };
      return { open: true };
    }),

  setMicActive: (v) => set({ micActive: v }),
}));
