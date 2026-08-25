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
  // W4a: instrumentalVolume/vocalsVolume REMOVED — use stem.store.stemVolumes instead
  // ADDITIVE: piano state (migrated from pianoStore)
  pianoOpen: boolean;
  micActive: boolean;
  setPlaying: (v: boolean) => void;
  setCurrentTime: (v: number) => void;
  setDuration: (v: number) => void;
  setHasVocals: (v: boolean) => void;
  setPlaybackRate: (v: number) => void;
  setVocalMixEnabled: (v: boolean) => void;
  setMicEnabled: (v: boolean) => void;
  // MICRO-PACK-FALLBACK: V3 boot status for metrics/UI
  v3BootStatus: { status: 'ok' | 'failed'; attempts: number; at: number };
  setV3BootStatus: (s: { status: 'ok' | 'failed'; attempts: number; at: number }) => void;
  // W4a: setInstrumentalVolume/setVocalsVolume REMOVED — use stem.store.setStemVolume instead
  // ADDITIVE: piano actions (migrated from pianoStore)
  togglePiano: () => void;
  setMicActive: (v: boolean) => void;
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
  // W4a: Volume state lives in stem.store.stemVolumes
  // ADDITIVE: piano state (migrated from pianoStore)
  pianoOpen: false,
  micActive: false,
  setPlaying: (v) => set({ isPlaying: v }),
  setCurrentTime: (v) => set({ currentTime: v }),
  setDuration: (v) => set({ duration: v }),
  setHasVocals: (v) => set({ hasVocals: v }),
  setPlaybackRate: (v) => set({ playbackRate: v }),
  setVocalMixEnabled: (v) => set({ vocalMixEnabled: v }),
  setMicEnabled: (v) => set({ micEnabled: v }),
  // MICRO-PACK-FALLBACK: V3 boot status
  v3BootStatus: { status: 'ok', attempts: 0, at: 0 },
  setV3BootStatus: (s) => set({ v3BootStatus: s }),
  // ADDITIVE: piano actions (migrated from pianoStore)
  togglePiano: () =>
    set((s) => {
      if (s.pianoOpen) return { pianoOpen: false, micActive: false };
      return { pianoOpen: true };
    }),
  setMicActive: (v) => set({ micActive: v }),
}));
