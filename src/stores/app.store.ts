import { create } from 'zustand';

type AppSurface = 'welcome' | 'app' | 'profile';

/**
 * @deprecated Используйте useUserProfileStore (surface, authChecked, setSurface, setAuthChecked)
 * Мигрировано в user-profile.store.ts — Фаза 4
 */
interface AppState {
  surface: AppSurface;
  authChecked: boolean;
  setSurface: (s: AppSurface) => void;
  setAuthChecked: (v: boolean) => void;
}

/** @deprecated Используйте useUserProfileStore */
export const useAppStore = create<AppState>((set) => ({
  surface: 'welcome',
  authChecked: false,
  setSurface: (surface) => set({ surface }),
  setAuthChecked: (authChecked) => set({ authChecked }),
}));
