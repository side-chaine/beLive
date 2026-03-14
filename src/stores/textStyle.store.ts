import { create } from 'zustand';
import {
  type TransitionSet,
  type WordFocusLevel,
  type WordFxMode,
  type WordCompletedMode,
  type WordTrailDepth,
  type LineActiveLevel,
  type LineNextLevel,
  type LineOthersLevel,
  type LineOthersSource,
  DEFAULT_FONT_SCALES,
  DEFAULT_WORD_FOCUS_LEVEL,
  DEFAULT_WORD_FX_MODE,
  DEFAULT_WORD_COMPLETED_MODE,
  DEFAULT_WORD_TRAIL_DEPTH,
  DEFAULT_LINE_ACTIVE_LEVEL,
  DEFAULT_LINE_NEXT_LEVEL,
  DEFAULT_LINE_OTHERS_LEVEL,
  DEFAULT_LINE_OTHERS_SOURCE,
} from '../types/textStyle.types';

/* ── Persist key ── */
const LS_KEY = 'belive-text-style';

interface PersistedState {
  fontFamily: string;
  styleId: string;
  transitionId: string;
  transitionSet: TransitionSet;
  fontScale: number;
  wordFocusLevel: WordFocusLevel;
  wordFxMode: WordFxMode;
  wordCompletedMode: WordCompletedMode;
  wordTrailDepth: WordTrailDepth;
  lineActiveLevel: LineActiveLevel;
  lineNextLevel: LineNextLevel;
  lineOthersLevel: LineOthersLevel;
  lineOthersSource: LineOthersSource;
}

function loadPersisted(): Partial<PersistedState> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Partial<PersistedState>;
  } catch {
    return {};
  }
}

function savePersisted(s: PersistedState) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(s));
  } catch { /* quota */ }
}

/* ── Store ── */

interface TextStyleState {
  /* Style */
  styleId: string;
  fontFamily: string;
  transitionId: string;
  transitionSet: TransitionSet;
  fontScale: number;

  /* Word FX */
  wordFocusLevel: WordFocusLevel;
  wordFxMode: WordFxMode;
  wordCompletedMode: WordCompletedMode;
  wordTrailDepth: WordTrailDepth;

  /* Line FX */
  lineActiveLevel: LineActiveLevel;
  lineNextLevel: LineNextLevel;
  lineOthersLevel: LineOthersLevel;
  lineOthersSource: LineOthersSource;

  /* Actions */
  setFontFamily: (f: string) => void;
  setStyleId: (id: string) => void;
  setTransitionId: (id: string) => void;
  setTransitionSet: (set: TransitionSet) => void;
  setFontScale: (scale: number) => void;
  setWordFocusLevel: (level: WordFocusLevel) => void;
  setWordFxMode: (mode: WordFxMode) => void;
  setWordCompletedMode: (mode: WordCompletedMode) => void;
  setWordTrailDepth: (depth: WordTrailDepth) => void;
  setLineActiveLevel: (level: LineActiveLevel) => void;
  setLineNextLevel: (level: LineNextLevel) => void;
  setLineOthersLevel: (level: LineOthersLevel) => void;
  setLineOthersSource: (source: LineOthersSource) => void;
  increaseFontScale: (step?: number) => void;
  decreaseFontScale: (step?: number) => void;
  resetFontScale: () => void;
}

const persisted = loadPersisted();

export const useTextStyleStore = create<TextStyleState>((set, get) => ({
  styleId: persisted.styleId ?? 'concert',
  fontFamily: persisted.fontFamily ?? "'Oswald', sans-serif",
  transitionId: persisted.transitionId ?? 'explosion',
  transitionSet: persisted.transitionSet ?? 'A',
  fontScale: persisted.fontScale ?? DEFAULT_FONT_SCALES['concert'],
  wordFocusLevel: persisted.wordFocusLevel ?? DEFAULT_WORD_FOCUS_LEVEL,
  wordFxMode: persisted.wordFxMode ?? DEFAULT_WORD_FX_MODE,
  wordCompletedMode: persisted.wordCompletedMode ?? DEFAULT_WORD_COMPLETED_MODE,
  wordTrailDepth: persisted.wordTrailDepth ?? DEFAULT_WORD_TRAIL_DEPTH,
  lineActiveLevel: persisted.lineActiveLevel ?? DEFAULT_LINE_ACTIVE_LEVEL,
  lineNextLevel: persisted.lineNextLevel ?? DEFAULT_LINE_NEXT_LEVEL,
  lineOthersLevel: persisted.lineOthersLevel ?? DEFAULT_LINE_OTHERS_LEVEL,
  lineOthersSource: persisted.lineOthersSource ?? DEFAULT_LINE_OTHERS_SOURCE,

  setFontFamily: (f) => {
    set({ fontFamily: f });
    const s = get();
    savePersisted({
      fontFamily: f,
      styleId: s.styleId,
      transitionId: s.transitionId,
      transitionSet: s.transitionSet,
      fontScale: s.fontScale,
      wordFocusLevel: s.wordFocusLevel,
      wordFxMode: s.wordFxMode,
      wordCompletedMode: s.wordCompletedMode,
      wordTrailDepth: s.wordTrailDepth,
      lineActiveLevel: s.lineActiveLevel,
      lineNextLevel: s.lineNextLevel,
      lineOthersLevel: s.lineOthersLevel,
      lineOthersSource: s.lineOthersSource,
    });
  },

  setStyleId: (id) => {
    const scale = DEFAULT_FONT_SCALES[id] ?? 1.0;
    set({ styleId: id, fontScale: scale });
    const s = get();
    savePersisted({
      fontFamily: s.fontFamily,
      styleId: id,
      transitionId: s.transitionId,
      transitionSet: s.transitionSet,
      fontScale: scale,
      wordFocusLevel: s.wordFocusLevel,
      wordFxMode: s.wordFxMode,
      wordCompletedMode: s.wordCompletedMode,
      wordTrailDepth: s.wordTrailDepth,
      lineActiveLevel: s.lineActiveLevel,
      lineNextLevel: s.lineNextLevel,
      lineOthersLevel: s.lineOthersLevel,
      lineOthersSource: s.lineOthersSource,
    });
  },

  setTransitionId: (id) => {
    set({ transitionId: id });
    const s = get();
    savePersisted({
      fontFamily: s.fontFamily,
      styleId: s.styleId,
      transitionId: id,
      transitionSet: s.transitionSet,
      fontScale: s.fontScale,
      wordFocusLevel: s.wordFocusLevel,
      wordFxMode: s.wordFxMode,
      wordCompletedMode: s.wordCompletedMode,
      wordTrailDepth: s.wordTrailDepth,
      lineActiveLevel: s.lineActiveLevel,
      lineNextLevel: s.lineNextLevel,
      lineOthersLevel: s.lineOthersLevel,
    });
  },

  setTransitionSet: (ts) => {
    set({ transitionSet: ts });
    const s = get();
    savePersisted({
      fontFamily: s.fontFamily,
      styleId: s.styleId,
      transitionId: s.transitionId,
      transitionSet: ts,
      fontScale: s.fontScale,
      wordFocusLevel: s.wordFocusLevel,
      wordFxMode: s.wordFxMode,
      wordCompletedMode: s.wordCompletedMode,
      wordTrailDepth: s.wordTrailDepth,
      lineActiveLevel: s.lineActiveLevel,
      lineNextLevel: s.lineNextLevel,
      lineOthersLevel: s.lineOthersLevel,
      lineOthersSource: s.lineOthersSource,
    });
  },

  setFontScale: (scale) => {
    const clamped = Math.max(0.5, Math.min(3.0, scale));
    set({ fontScale: clamped });
    const s = get();
    savePersisted({
      fontFamily: s.fontFamily,
      styleId: s.styleId,
      transitionId: s.transitionId,
      transitionSet: s.transitionSet,
      fontScale: clamped,
      wordFocusLevel: s.wordFocusLevel,
      wordFxMode: s.wordFxMode,
      wordCompletedMode: s.wordCompletedMode,
      wordTrailDepth: s.wordTrailDepth,
      lineActiveLevel: s.lineActiveLevel,
      lineNextLevel: s.lineNextLevel,
      lineOthersLevel: s.lineOthersLevel,
      lineOthersSource: s.lineOthersSource,
    });
  },

  setWordFocusLevel: (level) => {
    set({ wordFocusLevel: level });
    const s = get();
    savePersisted({
      fontFamily: s.fontFamily,
      styleId: s.styleId,
      transitionId: s.transitionId,
      transitionSet: s.transitionSet,
      fontScale: s.fontScale,
      wordFocusLevel: level,
      wordFxMode: s.wordFxMode,
      wordCompletedMode: s.wordCompletedMode,
      wordTrailDepth: s.wordTrailDepth,
      lineActiveLevel: s.lineActiveLevel,
      lineNextLevel: s.lineNextLevel,
      lineOthersLevel: s.lineOthersLevel,
      lineOthersSource: s.lineOthersSource,
    });
  },

  setWordFxMode: (mode) => {
    set({ wordFxMode: mode });
    const s = get();
    savePersisted({
      fontFamily: s.fontFamily,
      styleId: s.styleId,
      transitionId: s.transitionId,
      transitionSet: s.transitionSet,
      fontScale: s.fontScale,
      wordFocusLevel: s.wordFocusLevel,
      wordFxMode: mode,
      wordCompletedMode: s.wordCompletedMode,
      wordTrailDepth: s.wordTrailDepth,
      lineActiveLevel: s.lineActiveLevel,
      lineNextLevel: s.lineNextLevel,
      lineOthersLevel: s.lineOthersLevel,
      lineOthersSource: s.lineOthersSource,
    });
  },

  setWordCompletedMode: (mode) => {
    set({ wordCompletedMode: mode });
    const s = get();
    savePersisted({
      fontFamily: s.fontFamily,
      styleId: s.styleId,
      transitionId: s.transitionId,
      transitionSet: s.transitionSet,
      fontScale: s.fontScale,
      wordFocusLevel: s.wordFocusLevel,
      wordFxMode: s.wordFxMode,
      wordCompletedMode: mode,
      wordTrailDepth: s.wordTrailDepth,
      lineActiveLevel: s.lineActiveLevel,
      lineNextLevel: s.lineNextLevel,
      lineOthersLevel: s.lineOthersLevel,
    });
  },

  setLineActiveLevel: (level) => {
    set({ lineActiveLevel: level });
    const s = get();
    savePersisted({
      fontFamily: s.fontFamily,
      styleId: s.styleId,
      transitionId: s.transitionId,
      transitionSet: s.transitionSet,
      fontScale: s.fontScale,
      wordFocusLevel: s.wordFocusLevel,
      wordFxMode: s.wordFxMode,
      wordCompletedMode: s.wordCompletedMode,
      wordTrailDepth: s.wordTrailDepth,
      lineActiveLevel: level,
      lineNextLevel: s.lineNextLevel,
      lineOthersLevel: s.lineOthersLevel,
      lineOthersSource: s.lineOthersSource,
    });
  },

  setLineNextLevel: (level) => {
    set({ lineNextLevel: level });
    const s = get();
    savePersisted({
      fontFamily: s.fontFamily,
      styleId: s.styleId,
      transitionId: s.transitionId,
      transitionSet: s.transitionSet,
      fontScale: s.fontScale,
      wordFocusLevel: s.wordFocusLevel,
      wordFxMode: s.wordFxMode,
      wordCompletedMode: s.wordCompletedMode,
      wordTrailDepth: s.wordTrailDepth,
      lineActiveLevel: s.lineActiveLevel,
      lineNextLevel: level,
      lineOthersLevel: s.lineOthersLevel,
      lineOthersSource: s.lineOthersSource,
    });
  },

  setLineOthersLevel: (level) => {
    set({ lineOthersLevel: level });
    const s = get();
    savePersisted({
      fontFamily: s.fontFamily,
      styleId: s.styleId,
      transitionId: s.transitionId,
      transitionSet: s.transitionSet,
      fontScale: s.fontScale,
      wordFocusLevel: s.wordFocusLevel,
      wordFxMode: s.wordFxMode,
      wordCompletedMode: s.wordCompletedMode,
      wordTrailDepth: s.wordTrailDepth,
      lineActiveLevel: s.lineActiveLevel,
      lineNextLevel: s.lineNextLevel,
      lineOthersLevel: level,
      lineOthersSource: s.lineOthersSource,
    });
  },

  setLineOthersSource: (source) => {
    set({ lineOthersSource: source });
    const s = get();
    savePersisted({
      fontFamily: s.fontFamily,
      styleId: s.styleId,
      transitionId: s.transitionId,
      transitionSet: s.transitionSet,
      fontScale: s.fontScale,
      wordFocusLevel: s.wordFocusLevel,
      wordFxMode: s.wordFxMode,
      wordCompletedMode: s.wordCompletedMode,
      wordTrailDepth: s.wordTrailDepth,
      lineActiveLevel: s.lineActiveLevel,
      lineNextLevel: s.lineNextLevel,
      lineOthersLevel: s.lineOthersLevel,
      lineOthersSource: source,
    });
  },

  setWordTrailDepth: (depth) => {
    set({ wordTrailDepth: depth });
    const s = get();
    savePersisted({
      fontFamily: s.fontFamily,
      styleId: s.styleId,
      transitionId: s.transitionId,
      transitionSet: s.transitionSet,
      fontScale: s.fontScale,
      wordFocusLevel: s.wordFocusLevel,
      wordFxMode: s.wordFxMode,
      wordCompletedMode: s.wordCompletedMode,
      wordTrailDepth: depth,
      lineActiveLevel: s.lineActiveLevel,
      lineNextLevel: s.lineNextLevel,
      lineOthersLevel: s.lineOthersLevel,
      lineOthersSource: s.lineOthersSource,
    });
  },

  increaseFontScale: (step = 0.1) => {
    const s = get();
    s.setFontScale(s.fontScale + step);
  },

  decreaseFontScale: (step = 0.1) => {
    const s = get();
    s.setFontScale(s.fontScale - step);
  },

  resetFontScale: () => {
    const s = get();
    const def = DEFAULT_FONT_SCALES[s.styleId] ?? 1.0;
    s.setFontScale(def);
  },
}));
