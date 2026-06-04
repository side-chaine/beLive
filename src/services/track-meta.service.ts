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

    // Diagnostic: log lookup results
    console.log('[TrackMeta] MusicBrainz lookup:', {
      mbid: rec.id,
      hasGenre: !!result.genre?.length,
      genreCount: result.genre?.length || 0,
      hasRelease: !!result.releaseDate,
      hasLabel: !!result.label,
      releaseDate: result.releaseDate || 'none',
      label: result.label || 'none',
    });

    return result;
  } catch {
    return null;
  }
}

// ─── Last.fm API ───
const LASTFM_API_KEY = import.meta.env.VITE_LASTFM_API_KEY || '';

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

    // Diagnostic: log raw response structure
    console.log('[TrackMeta] Last.fm response:', {
      artist,
      title,
      httpStatus: resp.status,
      hasTrack: !!data.track,
      hasTags: !!(data.track?.toptags?.tag?.length),
      tagCount: data.track?.toptags?.tag?.length || 0,
      hasSimilar: !!(data.track?.similar?.track?.length),
      similarCount: data.track?.similar?.track?.length || 0,
      listeners: data.track?.listeners || 'none',
      playcount: data.track?.playcount || 'none',
      similarRaw: data.track?.similar?.track?.slice(0, 2) || 'none',
    });
    console.log('[TrackMeta] Last.fm similar raw:', JSON.stringify(data.track?.similar)?.slice(0, 300));

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

// ─── GetSongBPM API ───
const GETSONGBPM_KEY = import.meta.env.VITE_GETSONGBPM_KEY || '';

async function fetchGetSongBPM(
  artist: string,
  title: string,
): Promise<TrackMetaPartial | null> {
  if (!GETSONGBPM_KEY) return null;
  try {
    const query = [artist, title].filter(Boolean).join(' ');
    if (!query.trim()) return null;

    const url = `https://api.getsong.co/search/?api_key=${GETSONGBPM_KEY}&type=both&lookup=song:${encodeURIComponent(title)}+artist:${encodeURIComponent(artist)}`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!resp.ok) return null;

    const data = await resp.json();
    const track = data.search?.[0];
    if (!track) return null;

    const result: TrackMetaPartial = {};
    if (track.tempo) result.bpm = Number(track.tempo);
    if (track.key_of) result.key = track.key_of;
    if (track.open_key) result.camelot = track.open_key;

    console.log('[TrackMeta] GetSongBPM:', {
      artist,
      title,
      bpm: result.bpm ?? 'none',
      key: result.key ?? 'none',
      camelot: result.camelot ?? 'none',
    });

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
    analysisEngine: null,
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

  // Read existing meta from IDB to preserve analysis data (bpm, key, energy etc.)
  const existingTrack = await getTrack(trackId);
  const existingMeta = existingTrack?.trackMeta;

  // Start from existing meta or create empty — preserves audio analysis results!
  let merged: TrackMeta = existingMeta || createEmptyMeta();

  // Update analysedAt only if this is a fresh meta
  if (!existingMeta) {
    merged.analysedAt = new Date().toISOString();
  }

  // Parallel: MusicBrainz + Last.fm + GetSongBPM
  const [mbResult, lfResult, gsbResult] = await Promise.allSettled([
    fetchMusicBrainz(artist, title),
    fetchLastFm(artist, title),
    fetchGetSongBPM(artist, title),
  ]);

  // Merge API results — ONLY overwrite with non-null values
  // This preserves existing analysis fields (bpm, key, camelot, energy, etc.)
  const mergeNonNull = (target: TrackMeta, source: TrackMetaPartial) => {
    for (const [k, v] of Object.entries(source)) {
      if (v != null) (target as any)[k] = v;
    }
  };

  if (mbResult.status === 'fulfilled' && mbResult.value) {
    mergeNonNull(merged, mbResult.value);
  }
  if (lfResult.status === 'fulfilled' && lfResult.value) {
    mergeNonNull(merged, lfResult.value);
  }
  if (gsbResult.status === 'fulfilled' && gsbResult.value) {
    mergeNonNull(merged, gsbResult.value);
  }

  // Diagnostic: log merged result
  console.log('[TrackMeta] Merged result:', {
    trackId,
    artist,
    title,
    hasGenre: !!merged.genre?.length,
    genreCount: merged.genre?.length || 0,
    hasTags: !!merged.tags?.length,
    tagCount: merged.tags?.length || 0,
    hasSimilar: !!merged.similarTracks?.length,
    similarCount: merged.similarTracks?.length || 0,
    hasRelease: !!merged.releaseDate,
    hasLabel: !!merged.label,
    hasBpm: !!merged.bpm,
    hasKey: !!merged.key,
    releaseDate: merged.releaseDate || 'none',
    label: merged.label || 'none',
    bpm: merged.bpm ?? 'none',
    key: merged.key ?? 'none',
  });

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