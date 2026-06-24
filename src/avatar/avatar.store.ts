// @TC-AVATAR: Avatar Visual Engine — minimal Zustand store
// 6 fields: state, mode, preset + setters. Rest is derived from other stores.

import { create } from 'zustand';

export type AvatarStateId = 'idle' | 'happy' | 'listening' | 'sing' | 'error' | 'reactive';
export type AvatarMode = 'full' | 'compact' | 'micro';
export type AvatarPresetId = 'default' | 'silhouette';

interface AvatarState {
  /** Current visual state */
  state: AvatarStateId;
  /** Display mode (surface-dependent) */
  mode: AvatarMode;
  /** Avatar visual preset */
  preset: AvatarPresetId;

  setState: (s: AvatarStateId) => void;
  setMode: (m: AvatarMode) => void;
  setPreset: (p: AvatarPresetId) => void;
}

export const useAvatarStore = create<AvatarState>((set) => ({
  state: 'idle',
  mode: 'full',
  preset: 'silhouette',

  setState: (state) => set({ state }),
  setMode: (mode) => set({ mode }),
  setPreset: (preset) => set({ preset }),
}));
