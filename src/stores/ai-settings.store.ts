import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AiProviderId = 'belive' | 'openrouter-direct' | 'gateway';

export const AI_MODELS = {
  belive: [
    { id: 'deepseek/deepseek-chat-v3-0324:free', shortName: 'DeepSeek V3', costTier: 'free' as const, ctx: 64000 },
    { id: 'deepseek/deepseek-r1:free', shortName: 'DeepSeek R1', costTier: 'free' as const, ctx: 64000 },
    { id: 'meta-llama/llama-4-maverick:free', shortName: 'Llama 4 Maverick', costTier: 'free' as const, ctx: 1000000 },
  ],
  openrouter: [
    { id: 'deepseek/deepseek-chat-v3-0324', shortName: 'DeepSeek V3', costTier: 'free' as const, ctx: 64000 },
    { id: 'deepseek/deepseek-r1', shortName: 'DeepSeek R1', costTier: 'free' as const, ctx: 64000 },
    { id: 'meta-llama/llama-4-maverick', shortName: 'Llama 4 Maverick', costTier: 'free' as const, ctx: 1000000 },
    { id: 'google/gemini-2.0-flash-001', shortName: 'Gemini 2.0 Flash', costTier: 'low' as const, ctx: 1000000 },
    { id: 'openai/gpt-4o-mini', shortName: 'GPT-4o Mini', costTier: 'low' as const, ctx: 128000 },
    { id: 'anthropic/claude-3.5-haiku', shortName: 'Claude 3.5 Haiku', costTier: 'low' as const, ctx: 200000 },
  ],
};

interface AiSettingsState {
  // Provider
  provider: AiProviderId;
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
  setProvider: (p: AiProviderId) => void;
  markVerified: () => void;
  setShowSettings: (show: boolean) => void;
  isConfigured: () => boolean;
  reset: () => void;
}

const initialState = {
  provider: 'belive' as const,
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
      const state = get();
      if (state.provider === 'belive') {
        return true; // Billy всегда доступен для залогиненных юзеров
      }
      return !!state.openRouterApiKey && !!state.modelId;
    },
    reset: () => set(initialState),
    billyMode: 'user' as const,
    setBillyMode: (mode) => set({ billyMode: mode }),
  }), {
    name: 'belive:ai-settings',
    version: 1,
    partialize: (state) => ({
      provider: state.provider,
      openRouterApiKey: state.openRouterApiKey,
      modelId: state.modelId,
      coachName: state.coachName,
      temperature: state.temperature,
      billyMode: state.billyMode,
    }),
  })
);
