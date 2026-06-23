/* ── Catalog Types — Sprint 37 ── */

/** Track metadata (already exists in track.store, re-export shape) */
export interface CatalogTrack {
  id: number;
  title: string;
  artist?: string;
  index: number;
  hasLyrics?: boolean;
  hasVocals?: boolean;
  hasMarkers?: boolean;
}

/** Entry in a playlist */
export interface PlaylistEntry {
  trackId: number;
  title: string;
  addedAt: string;
}

/** Saved playlist */
export interface Playlist {
  id: number;
  name: string;
  tracks: PlaylistEntry[];
}

/** My Music entry (IDB shape) */
export interface MyMusicEntry {
  trackId: number;
  addedAt: string;
}

/** Center column tabs */
export type CenterTab = 'playlists' | 'history' | 'trends';

/** Track states for UI (future: download progress) */
export type TrackState = 'remote' | 'downloading' | 'local' | 'playing' | 'ready' | 'error';

/* ── Artist Parsing ── */

export interface ParsedTrackName {
  artist: string;
  title: string;
}

/** Parse track title into artist + title */
export function parseTrackName(raw: string): ParsedTrackName {
  if (!raw || !raw.trim()) return { artist: '', title: raw || '' };

  let s = raw.trim();

  // Remove leading track number: "01 - ", "01. ", "01_"
  s = s.replace(/^\d+[\s._-]+/, '');

  // Try separators with spaces: " - ", " — ", " – ", " _ "
  const spacedSep = / [-—–_] /;
  if (spacedSep.test(s)) {
    const idx = s.search(spacedSep);
    const artist = s.slice(0, idx).trim();
    const title = s.slice(idx).replace(/^[\s\-—–_]+/, '').trim();
    if (artist.length >= 2 && title.length >= 1) {
      return { artist, title };
    }
  }

  // Try dash without spaces: "Artist-Track"
  const dashIdx = s.indexOf('-');
  if (dashIdx > 1 && dashIdx < s.length - 1) {
    const artist = s.slice(0, dashIdx).trim();
    const title = s.slice(dashIdx + 1).trim();
    if (artist.length >= 2 && title.length >= 1) {
      return { artist, title };
    }
  }

  // Try em-dash without spaces
  for (const ch of ['—', '–']) {
    const idx = s.indexOf(ch);
    if (idx > 1 && idx < s.length - 1) {
      const artist = s.slice(0, idx).trim();
      const title = s.slice(idx + 1).trim();
      if (artist.length >= 2 && title.length >= 1) {
        return { artist, title };
      }
    }
  }

  // No separator found → artist unknown
  return { artist: '', title: s };
}

/**
 * Strip square-bracket meta tags from a track title for search queries.
 * Removes "[bonus track]", "[remastered]", "[explicit]", etc.
 * Does NOT mutate source title; returns a cleaned copy.
 * Falls back to trimmed raw title if sanitization yields empty string.
 */
export function sanitizeTrackTitleForSearch(raw: string): string {
  const cleaned = raw
    .replace(/\s*\[[^\]]*\]\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || raw.trim();
}

/* ── Grouped Tracks ── */

export interface ArtistGroup {
  artist: string;
  tracks: { id: number; title: string; index: number; fullTitle: string; coverArtUrl?: string | null }[];
  expanded: boolean;
}

/* ── Showcase (Афиша) ── */

export type SectionType = 'featured' | 'top' | 'exercises' | 'collection';

export interface ShowcaseItem {
  id: string;
  title: string;
  artist?: string;
  coverUrl?: string;
  description?: string;
  trackCount?: number;
  tags?: string[];
  sourceUrl?: string;  // YouTube, TG, etc.
  sourceType?: 'local' | 'youtube' | 'telegram' | 'external';
}

export interface ShowcaseSection {
  id: string;
  title: string;
  type: SectionType;
  items: ShowcaseItem[];
}

/* ── Stems ── */

export interface StemSlot {
  id: string;
  type: 'drums' | 'bass' | 'guitar' | 'keys' | 'other' | 'custom';
  label: string;
  file: File | null;
}

export const DEFAULT_STEM_SLOTS: Omit<StemSlot, 'id' | 'file'>[] = [
  { type: 'drums',  label: 'Drums' },
  { type: 'bass',   label: 'Bass' },
  { type: 'guitar', label: 'Guitar' },
  { type: 'keys',   label: 'Keys' },
  { type: 'other',  label: 'Other' },
];
