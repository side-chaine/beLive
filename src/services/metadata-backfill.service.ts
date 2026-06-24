// @TC-MET-03b: Metadata Backfill — sequential fetchTrackMeta for tracks without genres
// Respects MusicBrainz 1 req/sec rate limit. Silent background — UI not blocked.

import { fetchTrackMeta, loadCachedTrackMeta, _inFlight } from './track-meta.service';

// _inFlight is defined in track-meta.service.ts (module-level Set)

/**
 * Backfill missing track metadata sequentially (1 req/sec).
 * Skips tracks that:
 * - already have cached meta in IDB
 * - have no title
 * - are currently being fetched by DNA panel (_inFlight)
 */
export async function backfillMissingMeta(tracks: { id: number | string; title?: string }[]): Promise<void> {
  for (const t of tracks) {
    const trackId = Number(t.id);
    if (!trackId || !Number.isFinite(trackId)) continue;

    // Skip tracks already being fetched by DNA panel
    if (_inFlight.has(trackId)) continue;

    // Skip tracks with no title (can't fetch metadata without it)
    if (!t.title || t.title.trim().length < 2) continue;

    // Check if already cached
    const cached = await loadCachedTrackMeta(trackId);
    if (cached?.genre?.length && cached.genre.length > 0) continue;

    // Lock: prevent concurrent fetch (DNA panel + backfill)
    _inFlight.add(trackId);

    try {
      const result = await fetchTrackMeta(trackId, t.title);
      if (result) {
        // Metadata fetched and saved to IDB by fetchTrackMeta
      }
    } catch {
      // Silent fail — retry on next tracks-changed
    } finally {
      _inFlight.delete(trackId);
    }

    // MusicBrainz rate limit: 1 req/sec
    await sleep(1000);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}
