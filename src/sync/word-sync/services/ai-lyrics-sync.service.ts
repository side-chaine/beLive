import { buildLineMap } from '../line-map.builder';
import { computeLyricsHash } from '../hash';
import type { AudioSource, AlignmentResult } from '../types';
import type { LineMapEntry } from '../line-map.types';
import { getAlignmentCacheVerdict } from './alignment-cache.service';
import { useWordSyncStore } from '../../../stores/wordSync.store';

export type PrepareWordSyncInput = {
  displayLyrics: string;
  hashSourceLyrics: string;
  audioSource: AudioSource;
  audioHash?: string;
  cachedLineMap?: LineMapEntry[] | null;
  cachedAlignmentData?: AlignmentResult | null;
};

export type PrepareWordSyncResult =
  | {
      status: 'ready';
      lyricsHash: string;
      lineMap: LineMapEntry[];
      alignmentData: AlignmentResult;
      degraded: false;
    }
  | {
      status: 'missing' | 'stale-lyrics' | 'stale-audio' | 'stale-source';
      lyricsHash: string;
      lineMap: LineMapEntry[];
      alignmentData: null;
      degraded: boolean;
    };

function isDegradedTrustedLyricsSource(hashSourceLyrics: string): boolean {
  const trimmed = hashSourceLyrics.trim();
  return trimmed.startsWith('{\\rtf');
}

export function prepareWordSyncLayer(
  input: PrepareWordSyncInput
): PrepareWordSyncResult {
  const {
    displayLyrics,
    hashSourceLyrics,
    audioSource,
    audioHash,
    cachedLineMap,
    cachedAlignmentData,
  } = input;

  const { lineMap } = buildLineMap(displayLyrics);
  const lyricsHash = computeLyricsHash(hashSourceLyrics);
  const degraded = isDegradedTrustedLyricsSource(hashSourceLyrics);

  const verdict = getAlignmentCacheVerdict({
    lineMap: cachedLineMap,
    alignmentData: cachedAlignmentData,
    lyricsHash,
    audioHash,
    audioSource,
  });

  if (verdict.ok) {
    useWordSyncStore.setState({
      lineMap: verdict.lineMap,
      alignmentData: verdict.alignmentData,
      lyricsHash,
      audioSource,
      status: 'ready',
      error: null,
      degraded: false,
    });

    return {
      status: 'ready',
      lyricsHash,
      lineMap: verdict.lineMap,
      alignmentData: verdict.alignmentData,
      degraded: false,
    };
  }

  useWordSyncStore.setState({
    lineMap,
    alignmentData: null,
    lyricsHash,
    audioSource,
    status: verdict.status === 'missing' ? 'missing' : 'idle',
    error: null,
    degraded,
  });

  return {
    status: verdict.status,
    lyricsHash,
    lineMap,
    alignmentData: null,
    degraded,
  };
}

export function clearWordSyncLayer(): void {
  useWordSyncStore.getState().clear();
}
