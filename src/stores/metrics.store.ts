// @TC-MET-01: Metrics Store — Zustand + localStorage persist
// Single source of truth for ProfileStats metrics. READ-ONLY for UI.

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { MetricsCube, GenreAggregation } from '../types/metrics.types';

interface MetricsActions {
  incrementRehearsal: () => void;
  incrementPractice: () => void;
  setExercisesCompleted: (n: number) => void;
  addPlayTimeMs: (ms: number) => void;
  recomputeGenres: (agg: GenreAggregation[]) => void;
  touchLastActive: () => void;
  recomputeStreak: () => void;
  setElo: (elo: number) => void;
}

export type MetricsState = MetricsCube & MetricsActions;

function recomputeHasAnyData(s: MetricsCube): boolean {
  return s.rehearsals > 0 ||
    s.practiceSessions > 0 ||
    s.exercisesCompleted > 0 ||
    s.totalPlayTimeMs > 0 ||
    s.genres.length > 0;
}

export const useMetricsStore = create<MetricsState>()(
  persist(
    (set, get) => ({
      // ─── State ───
      rehearsals: 0,
      practiceSessions: 0,
      exercisesCompleted: 0,
      totalPlayTimeMs: 0,
      genres: [],
      topGenre: null,
      elo: 1500,
      lastActiveAt: null,
      streakDays: 0,
      hasAnyData: false,

      // ─── Actions (called ONLY by metrics.bridge, NEVER by UI) ───
      incrementRehearsal: () => {
        set((s) => ({ rehearsals: s.rehearsals + 1 }));
        get().touchLastActive();
      },

      incrementPractice: () => {
        set((s) => ({ practiceSessions: s.practiceSessions + 1 }));
        get().touchLastActive();
      },

      setExercisesCompleted: (n) => {
        set((s) => ({
          exercisesCompleted: Math.max(s.exercisesCompleted, n),
        }));
        get().touchLastActive();
      },

      addPlayTimeMs: (ms) => {
        set((s) => ({ totalPlayTimeMs: s.totalPlayTimeMs + ms }));
      },

      recomputeGenres: (agg) => {
        const sorted = [...agg].sort((a, b) => b.count - a.count);
        set({
          genres: sorted.slice(0, 5),
          topGenre: sorted[0]?.name ?? null,
        });
      },

      touchLastActive: () => {
        const now = new Date().toISOString();
        set({ lastActiveAt: now });
        get().recomputeStreak();
      },

      recomputeStreak: () => {
        const last = get().lastActiveAt;
        if (!last) {
          set({ streakDays: 0 });
          return;
        }
        const lastDate = new Date(last);
        const today = new Date();
        const diffDays = Math.floor((today.getTime() - lastDate.getTime()) / 86400000);
        if (diffDays === 0) {
          // Same day — streak unchanged
        } else if (diffDays === 1) {
          set((s) => ({ streakDays: s.streakDays + 1 }));
        } else if (diffDays > 1) {
          set({ streakDays: 1 }); // Reset to 1 (today counts)
        }
      },

      setElo: (elo) => set({ elo }),
    }),
    {
      name: 'belive:metrics',
      version: 1,
      partialize: (s) => ({
        rehearsals: s.rehearsals,
        practiceSessions: s.practiceSessions,
        exercisesCompleted: s.exercisesCompleted,
        totalPlayTimeMs: s.totalPlayTimeMs,
        genres: s.genres,
        topGenre: s.topGenre,
        elo: s.elo,
        lastActiveAt: s.lastActiveAt,
        streakDays: s.streakDays,
        // hasAnyData — computed, not persisted
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.hasAnyData = recomputeHasAnyData(state);
        }
      },
    }
  )
);
