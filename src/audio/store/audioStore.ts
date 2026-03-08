/**
 * beLive AudioEngine v2 — Zustand Audio Store.
 * React-friendly state derived from AudioEngineV2 events.
 */

import { create } from 'zustand';

interface AudioState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  hasVocals: boolean;
  playbackRate: number;
  loopActive: boolean;
  loopStart: number | null;
  loopEnd: number | null;

  setPlaying: (v: boolean) => void;
  setCurrentTime: (t: number) => void;
  setDuration: (d: number) => void;
  setHasVocals: (v: boolean) => void;
  setPlaybackRate: (r: number) => void;
  setLoop: (active: boolean, start: number | null, end: number | null) => void;
}

export const useAudioStoreV2 = create<AudioState>((set) => ({
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  hasVocals: false,
  playbackRate: 1.0,
  loopActive: false,
  loopStart: null,
  loopEnd: null,

  setPlaying: (v) => set({ isPlaying: v }),
  setCurrentTime: (t) => set({ currentTime: t }),
  setDuration: (d) => set({ duration: d }),
  setHasVocals: (v) => set({ hasVocals: v }),
  setPlaybackRate: (r) => set({ playbackRate: r }),
  setLoop: (active, start, end) => set({
    loopActive: active,
    loopStart: start,
    loopEnd: end,
  }),
}));
