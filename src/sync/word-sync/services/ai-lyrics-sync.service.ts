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
      status: 'missing' | 'stale-lyrics' | 'stale-audio' | 'stale-source' | 'stale-provider';
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

  // PERF DIAG: granular timing to find the 137s bottleneck
  const _t0 = performance.now();
  if (import.meta.env.DEV) {
    console.log(`[WordSync] input sizes: displayLyrics=${displayLyrics.length}, hashSource=${hashSourceLyrics.length}`);
  }

  const { lineMap } = buildLineMap(displayLyrics);
  if (import.meta.env.DEV) console.log(`[WordSync] buildLineMap: ${(performance.now() - _t0).toFixed(1)}ms (${lineMap.length} entries)`);

  const lyricsHash = computeLyricsHash(hashSourceLyrics);
  if (import.meta.env.DEV) console.log(`[WordSync] computeLyricsHash: ${(performance.now() - _t0).toFixed(1)}ms → ${lyricsHash}`);

  const degraded = isDegradedTrustedLyricsSource(hashSourceLyrics);

  const verdict = getAlignmentCacheVerdict({
    lineMap: cachedLineMap,
    alignmentData: cachedAlignmentData,
    lyricsHash,
    audioHash,
    audioSource,
  });
  if (import.meta.env.DEV) console.log(`[WordSync] getAlignmentCacheVerdict: ${(performance.now() - _t0).toFixed(1)}ms → ok=${verdict.ok} status=${verdict.status}`);

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
    if (import.meta.env.DEV) console.log(`[WordSync] setState(ready): ${(performance.now() - _t0).toFixed(1)}ms`);

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
  if (import.meta.env.DEV) console.log(`[WordSync] setState(missing): ${(performance.now() - _t0).toFixed(1)}ms`);

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
