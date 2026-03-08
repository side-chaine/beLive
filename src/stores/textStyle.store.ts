import { create } from 'zustand';
import {
  type TransitionSet,
  DEFAULT_FONT_SCALES,
} from '../types/textStyle.types';

/* ── Persist key ── */
const LS_KEY = 'belive-text-style';

interface PersistedState {
  fontFamily: string;
  styleId: string;
  transitionId: string;
  transitionSet: TransitionSet;
  fontScale: number;
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

  /* Actions */
  setFontFamily: (f: string) => void;
  setStyleId: (id: string) => void;
  setTransitionId: (id: string) => void;
  setTransitionSet: (set: TransitionSet) => void;
  setFontScale: (scale: number) => void;
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

  setFontFamily: (f) => {
    set({ fontFamily: f });
    const s = get();
    savePersisted({
      fontFamily: f,
      styleId: s.styleId,
      transitionId: s.transitionId,
      transitionSet: s.transitionSet,
      fontScale: s.fontScale,
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
