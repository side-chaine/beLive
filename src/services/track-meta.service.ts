/**
 * Track Meta Service — fetches track metadata from MusicBrainz + Last.fm
 * Stateless, functional pattern (like cover-art.service.ts)
 * 
 * MusicBrainz: two-step (search → lookup) because
 * search endpoint does NOT support `inc` parameter
 */

import type { TrackMeta, TrackMetaPartial } from '../types/track-meta.types';
import { updateTrackField, getTrack } from './idb.service';
import { parseTrackName } from '../catalog/types';

// ─── MusicBrainz API (CORS-friendly, free, rate-limit: 1 req/sec) ───
const MB_USER_AGENT = 'beLive/1.0 (https://belive.app)';

async function fetchMusicBrainz(
  artist: string,
  title: string,
): Promise<TrackMetaPartial | null> {
  try {
    const query = [artist, title].filter(Boolean).join(' AND ');
    if (!query.trim()) return null;

    // Step 1: Search — get MBID (no `inc` parameter)
    const searchUrl = `https://musicbrainz.org/ws/2/recording?query=${encodeURIComponent(query)}&fmt=json&limit=1`;
    const searchResp = await fetch(searchUrl, {
      headers: { 'User-Agent': MB_USER_AGENT },
    });
    if (!searchResp.ok) return null;

    const searchData = await searchResp.json();
    const rec = searchData.recordings?.[0];
    if (!rec) return null;

    const result: TrackMetaPartial = { mbid: rec.id };

    // Basic tags from search (no counts)
    if (rec.tags?.length) {
      result.genre = rec.tags.filter((t: any) => t.count > 0)
        .sort((a: any, b: any) => b.count - a.count)
        .slice(0, 5)
        .map((t: any) => t.name);
    }

    // Step 2: Lookup — get full details
    if (rec.id) {
      try {
        const lookupUrl = `https://musicbrainz.org/ws/2/recording/${rec.id}?inc=releases+tags+isrcs&fmt=json`;
        const lookupResp = await fetch(lookupUrl, {
          headers: { 'User-Agent': MB_USER_AGENT },
        });
        if (lookupResp.ok) {
          const detail = await lookupResp.json();
          if (detail.isrcs?.length) result.isrc = detail.isrcs[0];
          if (detail.tags?.length) {
            result.genre = detail.tags.sort((a: any, b: any) => b.count - a.count)
              .slice(0, 5)
              .map((t: any) => t.name);
          }
          if (detail.releases?.length) {
            const rel = detail.releases[0];
            if (rel.date) result.releaseDate = rel.date;
            if (rel['label-info']?.[0]?.label?.name) {
              result.label = rel['label-info'][0].label.name;
            }
          }
        }
      } catch {
        // Lookup failed — search data still usable
      }
    }

    return result;
  } catch {
    return null;
  }
}

// ─── Last.fm API ───
const LASTFM_API_KEY = '396cc9b00c1e9601287f8f598bc3ea8f';

async function fetchLastFm(
  artist: string,
  title: string,
): Promise<TrackMetaPartial | null> {
  try {
    const url = `https://ws.audioscrobbler.com/2.0/?method=track.getInfo&api_key=${LASTFM_API_KEY}&artist=${encodeURIComponent(artist || ' ')}&track=${encodeURIComponent(title)}&format=json`;
    const resp = await fetch(url);
    if (!resp.ok) return null;

    const data = await resp.json();
    const track = data.track;
    if (!track) return null;

    const result: TrackMetaPartial = {};

    if (track.toptags?.tag?.length) {
      result.tags = track.toptags.tag.slice(0, 8).map((t: any) => t.name);
    }
    if (track.listeners) result.listeners = Number(track.listeners);
    if (track.playcount) result.playcount = Number(track.playcount);
    if (track.similar?.track?.length) {
      result.similarTracks = track.similar.track.slice(0, 5).map((t: any) => ({
        name: t.name,
        artist: t.artist?.name || '',
        url: t.url || null,
      }));
    }

    return result;
  } catch {
    return null;
  }
}

// ─── Main: fetch + save to IDB ───
function createEmptyMeta(): TrackMeta {
  return {
    genre: null,
    label: null,
    releaseDate: null,
    isrc: null,
    mbid: null,
    tags: null,
    listeners: null,
    playcount: null,
    similarTracks: null,
    bpm: null,
    key: null,
    camelot: null,
    energy: null,
    danceability: null,
    mood: null,
    analysedAt: new Date().toISOString(),
    essentiaVersion: null,
  };
}

export async function fetchTrackMeta(
  trackId: number,
  trackTitle: string,
): Promise<TrackMeta | null> {
  const parsed = parseTrackName(trackTitle);
  const artist = parsed.artist === 'Разное' ? '' : parsed.artist;
  const title = parsed.title;

  if (!title.trim() || title.trim().length < 2) return null;

  let merged = createEmptyMeta();

  // Parallel: MusicBrainz + Last.fm
  const [mbResult, lfResult] = await Promise.allSettled([
    fetchMusicBrainz(artist, title),
    fetchLastFm(artist, title),
  ]);

  if (mbResult.status === 'fulfilled' && mbResult.value) {
    merged = { ...merged, ...mbResult.value };
  }
  if (lfResult.status === 'fulfilled' && lfResult.value) {
    merged = { ...merged, ...lfResult.value };
  }

  // Save to IDB (fire and forget)
  updateTrackField(trackId, { trackMeta: merged }).catch(err => {
    console.warn('[TrackMeta] Failed to save to IDB:', err);
  });

  return merged;
}

/** Load cached meta from IDB */
export async function loadCachedTrackMeta(
  trackId: number,
): Promise<TrackMeta | null> {
  try {
    const track = await getTrack(trackId);
    return track?.trackMeta || null;
  } catch {
    return null;
  }
}