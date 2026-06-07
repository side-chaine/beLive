import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AiSettingsState {
  // Provider
  provider: 'openrouter-direct' | 'gateway' | 'belive';
  // OpenRouter
  openRouterApiKey: string;
  // Model
  modelId: string;
  // Coach
  coachName: string;
  // Parameters
  temperature: number;
  // Status
  lastVerifiedAt: string | null;
  showSettings: boolean;
  /** Billy mode: 'user' = vocal coach, 'tech' = technical diagnostics */
  billyMode: 'user' | 'tech';
  /** Switch Billy mode */
  setBillyMode: (mode: 'user' | 'tech') => void;

  // Actions
  setOpenRouterApiKey: (key: string) => void;
  setModelId: (id: string) => void;
  setCoachName: (name: string) => void;
  setTemperature: (t: number) => void;
  setProvider: (p: 'openrouter-direct' | 'gateway') => void;
  markVerified: () => void;
  setShowSettings: (show: boolean) => void;
  isConfigured: () => boolean;
  reset: () => void;
}

const initialState = {
  provider: 'openrouter-direct' as const,
  openRouterApiKey: '',
  modelId: '',
  coachName: 'Билли',
  temperature: 0.7,
  lastVerifiedAt: null as string | null,
  showSettings: false,
  billyMode: 'user' as const,
};

export const useAiSettingsStore = create<AiSettingsState>()(
  persist((set, get) => ({
    ...initialState,
    setOpenRouterApiKey: (key) => set({ openRouterApiKey: key }),
    setModelId: (id) => set({ modelId: id }),
    setCoachName: (name) => set({ coachName: name }),
    setTemperature: (t) => set({ temperature: t }),
    setProvider: (p) => set({ provider: p }),
    markVerified: () => set({ lastVerifiedAt: new Date().toISOString() }),
    setShowSettings: (show: boolean) => set({ showSettings: show }),
    isConfigured: () => {
      const s = get();
      return !!s.openRouterApiKey && !!s.modelId;
    },
    reset: () => set(initialState),
    billyMode: 'user' as const,
    setBillyMode: (mode) => set({ billyMode: mode }),
  }), {
    name: 'belive:ai-settings',
    version: 1,
  })
);
