import { create } from 'zustand';

type AppMode = 'concert' | 'karaoke' | 'rehearsal' | 'live';

interface ModeState {
  mode: AppMode;
  setMode: (m: AppMode) => void;
}

export const useModeStore = create<ModeState>((set) => ({
  mode: 'rehearsal',
  setMode: (m) => set({ mode: m }),
}));

