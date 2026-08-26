import { create } from 'zustand';

interface LyricsState {
  lines: string[];
  activeLineIndex: number;
  activeBlockId: string | null;
  lyricsReady: boolean;
  setLines: (lines: string[]) => void;
  setActiveLineIndex: (idx: number) => void;
  setActiveBlockId: (id: string | null) => void;
  setLyricsReady: (v: boolean) => void;
}

export const useLyricsStore = create<LyricsState>((set) => ({
  lines: [],
  activeLineIndex: -1,
  activeBlockId: null,
  lyricsReady: false,
  setLines: (lines) => set({ lines }),
  setActiveLineIndex: (idx) => set({ activeLineIndex: idx }),
  setActiveBlockId: (id) => set({ activeBlockId: id }),
  setLyricsReady: (v) => set({ lyricsReady: v }),
}));

// BAC-001 (VMO-035): SAFE-side FOUC gate for lyrics.
// The frozen track.orchestrator populates a RAW lyrics mirror (before word-sync
// processing) which would otherwise paint early. We keep RehearsalLyrics hidden
// until the LATE signal arrives, so that early raw mirror is never flashed.
// False on track-change; true on the late V3 `track-loaded` / post-process
// `lyrics-rendered` (NOT the early raw mirror from the orchestrator).
if (typeof document !== 'undefined') {
  const onTrackChange = () => useLyricsStore.getState().setLyricsReady(false);
  const onTrackReady = () => useLyricsStore.getState().setLyricsReady(true);
  document.addEventListener('before-track-change', onTrackChange);
  document.addEventListener('track-change', onTrackChange);
  document.addEventListener('track-loaded', onTrackReady);
  document.addEventListener('lyrics-rendered', onTrackReady);
}
