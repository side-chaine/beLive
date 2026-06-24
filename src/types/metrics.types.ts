// @TC-MET-01: Metrics System — core types
// MetricsCube — единый контракт для ProfileStats

export interface GenreAggregation {
  name: string;
  count: number;
}

export interface MetricsCube {
  // Counters (earned accumulation)
  rehearsals: number;
  practiceSessions: number;
  exercisesCompleted: number;
  totalPlayTimeMs: number;

  // Derived (recomputed on tracks change)
  genres: GenreAggregation[];
  topGenre: string | null;

  // Seeded default
  elo: number;

  // Streak
  lastActiveAt: string | null;
  streakDays: number;

  // UX gating
  hasAnyData: boolean;
}
