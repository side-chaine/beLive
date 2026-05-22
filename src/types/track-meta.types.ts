/**
 * Track Meta — technical & contextual data for Track Info Board
 * Sources: MusicBrainz API, Last.fm API, Essentia.js (Phase 2)
 */

export interface TrackMeta {
  // MusicBrainz API
  genre: string[] | null;
  label: string | null;
  releaseDate: string | null;
  isrc: string | null;
  mbid: string | null;

  // Last.fm API
  tags: string[] | null;
  listeners: number | null;
  playcount: number | null;
  similarTracks: SimilarTrack[] | null;

  // Essentia.js (Phase 2 — null until integrated)
  bpm: number | null;
  key: string | null;
  camelot: string | null;
  energy: number | null;
  danceability: number | null;
  mood: string | null;

  // Metadata
  analysedAt: string | null;
  analysisEngine: string | null;
}

export interface SimilarTrack {
  name: string;
  artist: string;
  url: string | null;
}

export type AiExpert = 'vocal-coach' | 'track-analyst' | 'structure-expert' | 'harmonic-match';

/** Future: Track Comparison for Obsidian-like graph */
export interface TrackComparison {
  trackA: { id: number; title: string; meta: TrackMeta | null };
  trackB: { id: number; title: string; meta: TrackMeta | null };
  compatibility: {
    keyMatch: boolean;
    camelotDistance: number;
    bpmDiff: number;
    bpmCompatible: boolean;
    genreMatch: boolean;
    sameArtist: boolean;
  };
}

export type TrackMetaPartial = Partial<TrackMeta>;