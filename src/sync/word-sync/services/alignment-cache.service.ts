import type { LineMapEntry } from '../line-map.types';
import type { AlignmentResult, AudioSource } from '../types';

export type AlignmentCacheInput = {
  lineMap?: LineMapEntry[] | null;
  alignmentData?: AlignmentResult | null;
  lyricsHash: string;
  audioHash?: string;
  audioSource: AudioSource;
};

export type AlignmentCacheStatus =
  | 'ready'
  | 'missing'
  | 'stale-lyrics'
  | 'stale-audio'
  | 'stale-source'
  | 'stale-provider';

export type AlignmentCacheVerdict =
  | {
      ok: true;
      status: 'ready';
      lineMap: LineMapEntry[];
      alignmentData: AlignmentResult;
    }
  | {
      ok: false;
      status: Exclude<AlignmentCacheStatus, 'ready'>;
    };

function hasLineMap(lineMap?: LineMapEntry[] | null): lineMap is LineMapEntry[] {
  return Array.isArray(lineMap) && lineMap.length > 0;
}

function hasAlignmentData(
  alignmentData?: AlignmentResult | null
): alignmentData is AlignmentResult {
  return !!alignmentData && Array.isArray(alignmentData.lines) && alignmentData.lines.length > 0;
}

export function getAlignmentCacheVerdict(
  input: AlignmentCacheInput
): AlignmentCacheVerdict {
  const { lineMap, alignmentData, lyricsHash, audioHash, audioSource } = input;

  if (!hasLineMap(lineMap) || !hasAlignmentData(alignmentData)) {
    return { ok: false, status: 'missing' };
  }

  if (alignmentData.lyricsHash !== lyricsHash) {
    return { ok: false, status: 'stale-lyrics' };
  }

  if (alignmentData.audioSource !== audioSource) {
    return { ok: false, status: 'stale-source' };
  }

  if (
    audioHash &&
    alignmentData.audioHash &&
    alignmentData.audioHash !== audioHash
  ) {
    return { ok: false, status: 'stale-audio' };
  }

  // F46: Reject mock provider alignments - they should not be persisted/hydrated
  if (alignmentData.provider === 'mock') {
    return { ok: false, status: 'stale-provider' };
  }

  return {
    ok: true,
    status: 'ready',
    lineMap,
    alignmentData,
  };
}

export function hasUsableAlignmentCache(input: AlignmentCacheInput): boolean {
  return getAlignmentCacheVerdict(input).ok;
}
