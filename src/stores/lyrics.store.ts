import { create } from 'zustand';
import { useBlocksStore } from './blocks.store';

interface LyricsState {
  lines: string[];
  activeLineIndex: number;
  activeBlockId: string | null;
  lyricsReady: boolean;
  structurePending: boolean;
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
  structurePending: false,
  setLines: (lines) => set({ lines }),
  setActiveLineIndex: (idx) => set({ activeLineIndex: idx }),
  setActiveBlockId: (id) => set({ activeBlockId: id }),
  setLyricsReady: (v) => set({ lyricsReady: v }),
}));

// BAC-001 (VMO-035): SAFE-side FOUC gate for lyrics.
// The track loader (ex-track.orchestrator, снесён Волной B) populates a RAW lyrics mirror (before word-sync
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

// ── D-CASE 7 (FOUC gate): structurePending — плашку строим только после blocks-зеркала.
// Арм: before-track-change (синхронные tc-данные, loader fresh-read ДО Step 3).
// Релиз: blocks>0 (подписка) ИЛИ flush-сиблинг ИЛИ watchdog 4000мс (raw-деградация).
let _structWatchdog: ReturnType<typeof setTimeout> | null = null;
const clearStructWatchdog = () => { if (_structWatchdog) { clearTimeout(_structWatchdog); _structWatchdog = null; } };
const releaseStruct = () => { clearStructWatchdog(); if (useLyricsStore.getState().structurePending) useLyricsStore.setState({ structurePending: false }); };
const onBeforeTrackChangeArm = (e: Event) => {
  const detail = (e as CustomEvent).detail as { toTrackId?: string } | undefined;
  if (!detail?.toTrackId) return;              // bare Event (delete/clearAll) — арма нет
  clearStructWatchdog();
  const tc = (window as any).trackCatalog;     // свежий при каждом событии, без кэша
  const track = tc?.tracks?.find((t: any) => t.id === detail.toTrackId);
  const hasStructure = !!track?.blocksData?.length
    || !!track?.syncMarkers?.some((m: any) => m.blockType && m.blockType !== 'unknown');
  useLyricsStore.setState({ structurePending: hasStructure });  // ре-арм атомарно
  if (hasStructure) {
    // 006-фикс: 1200 мерилось от АРМА, blocks приходят ~1400-1500 (V3 1132-1205 + зеркало +300) — сырость при каждом свитче; 4000 = патология-fallback, норма закрывается blocks-subscribe.
    _structWatchdog = setTimeout(() => { _structWatchdog = null; releaseStruct(); }, 4000);
  }
};

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
    // D-CASE 7: flush открыл гейт, а blocks уже здесь → снять structurePending тем же тиком
    if (state.lyricsReady && !prev.lyricsReady && useLyricsStore.getState().structurePending && useBlocksStore.getState().blocks.length > 0) {
      releaseStruct();
    }
  });

  // D-CASE 7: аддитив-listener'ы — арм на before-track-change, релиз по blocks>0.
  document.addEventListener('before-track-change', onBeforeTrackChangeArm);
  useBlocksStore.subscribe((state) => { if (state.blocks.length > 0) releaseStruct(); });
}
