// @TC-MET-03: Genre Aggregation Service — reads IDB tracks, computes top genres
// READ-ONLY. Does NOT fetch metadata. Only filters and aggregates cached data.

import { useTrackStore } from '../stores/track.store';
import { loadCachedTrackMeta } from './track-meta.service';
import type { GenreAggregation } from '../types/metrics.types';

const GENRE_CANONICAL: Record<string, string> = {
  'nu metal': 'Metal',
  'alternative metal': 'Metal',
  'heavy metal': 'Metal',
  'trash metal': 'Metal',
  'death metal': 'Metal',
  'thrash metal': 'Metal',
  'symphonic metal': 'Metal',
  'alternative rock': 'Rock',
  'alternative': 'Rock',
  'hard rock': 'Rock',
  'indie rock': 'Rock',
  'progressive rock': 'Rock',
  'classic rock': 'Rock',
  'psychedelic rock': 'Rock',
  'punk rock': 'Rock',
  'garage rock': 'Rock',
  'hip-hop': 'Hip-Hop',
  'hip hop': 'Hip-Hop',
  'electronic': 'Electronic',
  'electronica': 'Electronic',
  'edm': 'Electronic',
  'dance': 'Electronic',
  'house': 'Electronic',
  'techno': 'Electronic',
  'trance': 'Electronic',
  'dubstep': 'Electronic',
};

/** Normalize and canonicalize a genre tag to its primary form */
function canonicalize(genre: string): string | null {
  const normalized = genre.toLowerCase().trim();
  if (!normalized) return null;

  // 1. Direct canonical match
  if (GENRE_CANONICAL[normalized]) return GENRE_CANONICAL[normalized];

  // 2. Word-boundary match in canonical map
  for (const [key, value] of Object.entries(GENRE_CANONICAL)) {
    const regex = new RegExp(`\\b${key}\\b`, 'i');
    if (regex.test(normalized)) return value;
  }

  // 3. Not in canonical — drop
  return null;
}

/**
 * Aggregate genres from all user tracks.
 * Filters: excludes artist names, canonicalizes subgenres, counts only real genres.
 * Returns top-N canonical genres sorted by frequency.
 */
export async function aggregateGenres(): Promise<GenreAggregation[]> {
  const tracks = useTrackStore.getState().tracksMeta;
  if (tracks.length === 0) return [];

  // Build artist name set for exclusion
  const artistNames = new Set(
    tracks
      .map(t => t.artist?.toLowerCase().trim())
      .filter(Boolean) as string[]
  );

  const genreMap = new Map<string, number>();

  // Iterate tracks in parallel batches of 5 (avoid IDB contention)
  const BATCH_SIZE = 5;
  for (let i = 0; i < tracks.length; i += BATCH_SIZE) {
    const batch = tracks.slice(i, i + BATCH_SIZE);
    const metas = await Promise.allSettled(
      batch.map((t) => loadCachedTrackMeta(Number(t.id)))
    );

    for (const result of metas) {
      if (result.status !== 'fulfilled' || !result.value?.genre) continue;

      const seen = new Set<string>(); // dedup per track
      for (const g of result.value.genre) {
        const raw = g.toLowerCase().trim();
        if (!raw) continue;

        // Exclude artist names
        if (artistNames.has(raw)) continue;

        // Canonicalize
        const canonical = canonicalize(raw);
        if (!canonical || seen.has(canonical)) continue;

        seen.add(canonical);
        genreMap.set(canonical, (genreMap.get(canonical) || 0) + 1);
      }
    }
  }

  // Sort by frequency, return top-5
  return Array.from(genreMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}
