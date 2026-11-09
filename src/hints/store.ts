import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { HINTS_STORAGE_KEY } from './config';
import type { HintId, HintLocale, HintSignal, HintStats } from './types';

/** Fresh evidence shape. A factory, not a shared object — never mutate it. */
export function emptyStats(): HintStats {
  return { shows: {}, dismisses: {}, facts: {} };
}

interface HintsState {
  /** Master switch — user-owned, lives in their room / menu. ALWAYS wins. */
  enabled: boolean;
  /** null = auto-resolve from where beLive was opened (see locale.ts). */
  localeOverride: HintLocale | null;
  /** Steps the user has actually performed. Never nag about a learned step. */
  completed: HintId[];
  /** Index shown last load — used to avoid an immediate repeat. */
  lastVariant: Partial<Record<HintId, number>>;
  /** Cross-load evidence for the mastery / exposure-budget policies. */
  stats: HintStats;
  setEnabled: (v: boolean) => void;
  toggleEnabled: () => void;
  setLocaleOverride: (v: HintLocale | null) => void;
  complete: (id: HintId) => void;
  noteVariant: (id: HintId, index: number) => void;
  /** One DELIVERED impression (the chalk actually left the screen). */
  noteShow: (id: HintId) => void;
  /** Explicit `×`. One refusal retires a learn-once step immediately. */
  noteDismiss: (id: HintId) => void;
  /** A real observable fact from the app (see HintSignal). */
  noteFact: (name: HintSignal) => void;
  resetTour: () => void;
}

const bump = (bag: Partial<Record<string, number>>, key: string) => ({
  ...bag,
  [key]: (bag[key] ?? 0) + 1,
});

export const useHintsStore = create<HintsState>()(
  persist(
    (set) => ({
      enabled: true,
      localeOverride: null,
      completed: [],
      lastVariant: {},
      stats: emptyStats(),
      setEnabled: (enabled) => set({ enabled }),
      toggleEnabled: () => set((s) => ({ enabled: !s.enabled })),
      setLocaleOverride: (localeOverride) => set({ localeOverride }),
      complete: (id) => set((s) => (
        s.completed.includes(id) ? s : { completed: [...s.completed, id] }
      )),
      noteVariant: (id, index) => set((s) => ({
        lastVariant: { ...s.lastVariant, [id]: index },
      })),
      noteShow: (id) => set((s) => ({
        stats: { ...s.stats, shows: bump(s.stats.shows, id) },
      })),
      noteDismiss: (id) => set((s) => ({
        stats: { ...s.stats, dismisses: bump(s.stats.dismisses, id) },
      })),
      noteFact: (name) => set((s) => ({
        stats: { ...s.stats, facts: bump(s.stats.facts, name) },
      })),
      resetTour: () => set({
        enabled: true,
        completed: [],
        lastVariant: {},
        stats: emptyStats(),
      }),
    }),
    {
      name: HINTS_STORAGE_KEY,
      partialize: (s) => ({
        enabled: s.enabled,
        localeOverride: s.localeOverride,
        completed: s.completed,
        lastVariant: s.lastVariant,
        stats: s.stats,
      }),
      /**
       * Backward compatibility with `belive:hints-v1` written before `stats`
       * existed. No version bump, no data loss: old keys survive, the new
       * evidence object is filled with fresh empty counters.
       */
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<HintsState>;
        return {
          ...current,
          ...p,
          stats: {
            shows: p.stats?.shows ?? {},
            dismisses: p.stats?.dismisses ?? {},
            facts: p.stats?.facts ?? {},
          },
        };
      },
    },
  ),
);

/**
 * One random variant per load, but never the one from the previous load.
 * Pure so it can be unit-tested without a DOM.
 */
export function pickVariantIndex(count: number, last?: number): number {
  if (count <= 1) {return 0;}
  const i = Math.floor(Math.random() * count);
  if (last === undefined || i !== last) {return i;}
  // Pick uniformly from the remaining `count - 1` indexes.
  return (i + 1 + Math.floor(Math.random() * (count - 1))) % count;
}
