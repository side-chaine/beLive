import { create } from 'zustand';
import type { TrackMeta, AiExpert } from '../types/track-meta.types';

interface AiMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface TrackInfoState {
  // Overlay
  isOpen: boolean;
  trackId: number | null;
  isFirstReveal: boolean;

  // Meta data
  meta: TrackMeta | null;
  isFetchingApi: boolean;

  // AI Expert (Phase 1B — stub)
  activeExpert: AiExpert | null;
  aiMessages: AiMessage[];
  isAiStreaming: boolean;

  // Internal
  _revealedTracks: Set<number>;
  _clickedBlockType: string | null;

  // Actions — Overlay
  open: (trackId: number) => void;
  close: () => void;

  // Actions — Meta
  setMeta: (meta: TrackMeta) => void;
  mergeMeta: (partial: Partial<TrackMeta>) => void;
  setFetchingApi: (v: boolean) => void;

  // Actions — AI (Phase 1B stub)
  setActiveExpert: (expert: AiExpert | null) => void;
  addAiMessage: (msg: AiMessage) => void;
  appendAiToken: (token: string) => void;
  setAiStreaming: (v: boolean) => void;
  clearAiMessages: () => void;
  setClickedBlockType: (type: string) => void;

  // Reset
  reset: () => void;
}

const initialState = {
  isOpen: false,
  trackId: null as number | null,
  isFirstReveal: true,
  meta: null as TrackMeta | null,
  isFetchingApi: false,
  activeExpert: null as AiExpert | null,
  aiMessages: [] as AiMessage[],
  isAiStreaming: false,
  _clickedBlockType: null as string | null,
  _revealedTracks: new Set<number>(),
};

export const useTrackInfoStore = create<TrackInfoState>((set, get) => ({
  ...initialState,
  open: (trackId) => {
    const isFirstReveal = !get()._revealedTracks.has(trackId);
    set({ isOpen: true, trackId, isFirstReveal });
    if (isFirstReveal) {
      const next = new Set(get()._revealedTracks);
      next.add(trackId);
      set({ _revealedTracks: next });
    }
  },
  close: () => set({ isOpen: false }),
  setMeta: (meta) => set({ meta }),
  mergeMeta: (partial) => set((s) => ({
    meta: s.meta ? { ...s.meta, ...partial } : partial as TrackMeta,
  })),
  setFetchingApi: (v) => set({ isFetchingApi: v }),
  setActiveExpert: (expert) => set({ activeExpert: expert }),
  addAiMessage: (msg) => set((s) => ({
    aiMessages: [...s.aiMessages, msg],
  })),
  appendAiToken: (token) => set((s) => {
    const msgs = [...s.aiMessages];
    const last = msgs[msgs.length - 1];
    if (last?.role === 'assistant') {
      msgs[msgs.length - 1] = { ...last, content: last.content + token };
    }
    return { aiMessages: msgs };
  }),
  setAiStreaming: (v) => set({ isAiStreaming: v }),
  clearAiMessages: () => set({ aiMessages: [] }),
  setClickedBlockType: (type) => set({ _clickedBlockType: type }),
  reset: () => set(initialState),
}));

// Auto-close on track change
if (typeof document !== 'undefined') {
  document.addEventListener('before-track-change', () => {
    useTrackInfoStore.getState().close();
  });
}