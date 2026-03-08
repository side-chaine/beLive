import { create } from 'zustand';

interface AudioState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  hasVocals: boolean;
  playbackRate: number;
  vocalMixEnabled: boolean;
  micEnabled: boolean;
  micVolume: number;
  instrumentalVolume: number;
  vocalsVolume: number;
  setPlaying: (v: boolean) => void;
  setCurrentTime: (v: number) => void;
  setDuration: (v: number) => void;
  setHasVocals: (v: boolean) => void;
  setPlaybackRate: (v: number) => void;
  setVocalMixEnabled: (v: boolean) => void;
  setMicEnabled: (v: boolean) => void;
  setInstrumentalVolume: (v: number) => void;
  setVocalsVolume: (v: number) => void;
}

export const useAudioStore = create<AudioState>((set) => ({
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  hasVocals: false,
  playbackRate: 1,
  vocalMixEnabled: false,
  micEnabled: false,
  micVolume: 1,
  instrumentalVolume: 1,
  vocalsVolume: 1,
  setPlaying: (v) => set({ isPlaying: v }),
  setCurrentTime: (v) => set({ currentTime: v }),
  setDuration: (v) => set({ duration: v }),
  setHasVocals: (v) => set({ hasVocals: v }),
  setPlaybackRate: (v) => set({ playbackRate: v }),
  setVocalMixEnabled: (v) => set({ vocalMixEnabled: v }),
  setMicEnabled: (v) => set({ micEnabled: v }),
   setInstrumentalVolume: (v) => set({ instrumentalVolume: v }),
  setVocalsVolume: (v) => set({ vocalsVolume: v }),
}));
