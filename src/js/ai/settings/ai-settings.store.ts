// src/js/ai/settings/ai-settings.store.ts
import { create } from 'zustand';

interface AISettingsState {
  soundEnabled: boolean;
  setSoundEnabled: (v: boolean) => void;
}

export const useAISettingsStore = create<AISettingsState>((set) => ({
  soundEnabled: true,
  setSoundEnabled: (v) => set({ soundEnabled: v }),
}));

export const getSoundEnabled = (): boolean => useAISettingsStore.getState().soundEnabled;
