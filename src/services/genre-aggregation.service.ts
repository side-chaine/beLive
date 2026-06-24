// @TC-MET-03: Genre Aggregation Service — reads IDB tracks, computes top genres
// Used by metrics.bridge to update metrics.store.genres

import { useTrackStore } from '../stores/track.store';
import { loadCachedTrackMeta } from './track-meta.service';
import type { GenreAggregation } from '../types/metrics.types';

/**
 * Aggregate genres from all user tracks.
 * Reads trackMeta from IDB (already cached by track-meta.service).
 * Returns top-N genres sorted by frequency.
 *
 * Called on:
 * - tracks-changed event (new track added)
 * - first metrics sync after OAuth
 */
export async function aggregateGenres(): Promise<GenreAggregation[]> {
  const tracks = useTrackStore.getState().tracksMeta;
  if (tracks.length === 0) return [];

  const genreMap = new Map<string, number>();

  // Iterate tracks in parallel batches of 5 (avoid IDB contention)
  const BATCH_SIZE = 5;
  for (let i = 0; i < tracks.length; i += BATCH_SIZE) {
    const batch = tracks.slice(i, i + BATCH_SIZE);
    const metas = await Promise.allSettled(
      batch.map((t) => loadCachedTrackMeta(Number(t.id)))
    );

    for (const result of metas) {
      if (result.status === 'fulfilled' && result.value?.genre) {
        for (const g of result.value.genre) {
          const key = g.toLowerCase().trim();
          if (key) {
            genreMap.set(key, (genreMap.get(key) || 0) + 1);
          }
        }
      }
    }
  }

  // Sort by frequency, return top-5
  return Array.from(genreMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}
