import { create } from 'zustand';
import type {
  AlignmentResult,
  AudioSource,
  LineTiming,
  WordTiming,
} from '../sync/word-sync/types';
import type { LineMapEntry } from '../sync/word-sync/line-map.types';
import { shouldEnableWordHighlight } from '../sync/word-sync/confidence';

const ACTIVE_WORD_EPSILON = 0.03;
const ACTIVE_WORD_TIME_OFFSET = 0.18;

type WordSyncStatus = 'idle' | 'ready' | 'missing' | 'loading' | 'error';

interface WordSyncState {
  lineMap: LineMapEntry[];
  alignmentData: AlignmentResult | null;
  lyricsHash: string | null;
  audioSource: AudioSource | null;
  status: WordSyncStatus;
  error: string | null;
  degraded: boolean;

  setLineMap: (lineMap: LineMapEntry[]) => void;
  setAlignmentData: (alignmentData: AlignmentResult | null) => void;
  setLyricsHash: (lyricsHash: string | null) => void;
  setAudioSource: (audioSource: AudioSource | null) => void;
  setStatus: (status: WordSyncStatus) => void;
  setError: (error: string | null) => void;
  setDegraded: (degraded: boolean) => void;
  clear: () => void;

  getLineTiming: (rawLineIndex: number) => LineTiming | null;
  getWordsForLine: (rawLineIndex: number) => WordTiming[];
  hasUsableWordSyncForLine: (rawLineIndex: number) => boolean;
  getActiveWordForLine: (rawLineIndex: number, currentTime: number) => WordTiming | null;
  getFillWordForLine: (rawLineIndex: number, currentTime: number) => WordTiming | null;
}

export const useWordSyncStore = create<WordSyncState>((set, get) => ({
  lineMap: [],
  alignmentData: null,
  lyricsHash: null,
  audioSource: null,
  status: 'idle',
  error: null,
  degraded: false,

  setLineMap: (lineMap) => set({ lineMap }),
  setAlignmentData: (alignmentData) => set({ alignmentData }),
  setLyricsHash: (lyricsHash) => set({ lyricsHash }),
  setAudioSource: (audioSource) => set({ audioSource }),
  setStatus: (status) => set({ status }),
  setError: (error) => set({ error }),
  setDegraded: (degraded) => set({ degraded }),

  clear: () =>
    set({
      lineMap: [],
      alignmentData: null,
      lyricsHash: null,
      audioSource: null,
      status: 'idle',
      error: null,
      degraded: false,
    }),

  getLineTiming: (rawLineIndex) => {
    const alignmentData = get().alignmentData;
    if (!alignmentData) return null;
    return alignmentData.lines.find((line) => line.rawLineIndex === rawLineIndex) ?? null;
  },

  getWordsForLine: (rawLineIndex) => {
    const line = get().getLineTiming(rawLineIndex);
    return line?.words ?? [];
  },

  hasUsableWordSyncForLine: (rawLineIndex) => {
    const line = get().getLineTiming(rawLineIndex);
    if (!line) return false;
    return shouldEnableWordHighlight(line.confidence);
  },

  // Cue-style early selector — uses lookahead for responsive highlighting
  getActiveWordForLine: (rawLineIndex, currentTime) => {
    const line = get().getLineTiming(rawLineIndex);
    if (!line) return null;
    if (!shouldEnableWordHighlight(line.confidence)) return null;
    if (!line.words.length) return null;

    const adjustedTime = currentTime + ACTIVE_WORD_TIME_OFFSET;

    for (const word of line.words) {
      if (
        adjustedTime >= word.start - ACTIVE_WORD_EPSILON &&
        adjustedTime < word.end + ACTIVE_WORD_EPSILON
      ) {
        return word;
      }
    }

    return null;
  },

  // Raw selector for progress/fill effects — no lookahead, exact timing
  getFillWordForLine: (rawLineIndex, currentTime) => {
    const line = get().getLineTiming(rawLineIndex);
    if (!line) return null;
    if (!shouldEnableWordHighlight(line.confidence)) return null;
    if (!line.words.length) return null;

    for (const word of line.words) {
      if (currentTime >= word.start && currentTime < word.end) {
        return word;
      }
    }

    return null;
  },
}));
