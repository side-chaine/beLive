import { create } from 'zustand';

type AppSurface = 'welcome' | 'app' | 'profile';

interface AppState {
  surface: AppSurface;
  authChecked: boolean;
  setSurface: (s: AppSurface) => void;
  setAuthChecked: (v: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  surface: 'welcome',
  authChecked: false,
  setSurface: (surface) => set({ surface }),
  setAuthChecked: (authChecked) => set({ authChecked }),
}));
