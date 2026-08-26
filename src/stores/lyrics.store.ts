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
// processing); the frozen lyrics.bridge then syncs that mirror into this store
// EARLY — on the early `lyrics-rendered` event (orchestrator Step 8) — with the
// unprocessed raw text. That raw mirror must NEVER be flashed.
// Fix: hold any `lines` written while lyricsReady===false in a buffer and publish
// them to consumers ONLY once the LATE V3 `track-loaded` flips lyricsReady true.
// This gates EVERY consumer of useLyricsStore.lines at once (RehearsalLyrics,
// NowPlaying, LiveSubtitle, KaraokeLyricsBoard, WagonTrain, TrackInfo,
// BlockScenesModal, …) WITHOUT touching any frozen file.
// We do NOT open the gate on `lyrics-rendered` — it fires early from the frozen
// orchestrator with the unprocessed raw mirror.
let _rawLyricsBuffer: string[] = [];

if (typeof document !== 'undefined') {
  let _watchdog: ReturnType<typeof setTimeout> | null = null;
  const clearWatchdog = () => {
    if (_watchdog) { clearTimeout(_watchdog); _watchdog = null; }
  };
  const armWatchdog = () => {
    if (_watchdog) return;
    _watchdog = setTimeout(() => {
      _watchdog = null;
      // Safety net: if the late `track-loaded` never arrived (V2-only fallback
      // or boot-ordering race), reveal the buffered lyrics instead of hiding
      // them forever. The subscriber below will flush the buffer.
      if (!useLyricsStore.getState().lyricsReady) {
        useLyricsStore.setState({ lyricsReady: true });
      }
    }, 5000);
  };

  const onTrackChange = () => {
    _rawLyricsBuffer = [];
    clearWatchdog();
    useLyricsStore.getState().setLyricsReady(false);
  };
  const onTrackReady = () => {
    clearWatchdog();
    useLyricsStore.getState().setLyricsReady(true);
  };
  document.addEventListener('before-track-change', onTrackChange);
  document.addEventListener('track-loaded', onTrackReady);

  // Hold early raw lines until the late signal arrives.
  useLyricsStore.subscribe((state, prev) => {
    // Buffer: lines arrived while not ready → hide them from all consumers.
    if (!state.lyricsReady && state.lines.length > 0) {
      _rawLyricsBuffer = state.lines;
      useLyricsStore.setState({ lines: [] });
      armWatchdog();
      return;
    }
    // Flush: gate just opened → publish the buffered (now safe) lines.
    if (state.lyricsReady && !prev.lyricsReady && _rawLyricsBuffer.length > 0) {
      useLyricsStore.setState({ lines: _rawLyricsBuffer });
      _rawLyricsBuffer = [];
    }
  });
}
