import { describe, it, expect } from 'vitest';
import { getAlignmentCacheVerdict, hasUsableAlignmentCache } from './alignment-cache.service';
import type { LineMapEntry } from '../line-map.types';
import type { AlignmentResult } from '../types';

const validLineMap: LineMapEntry[] = [
  { rawLineIndex: 0, kind: 'lyric', contentLineIndex: 0, text: 'Hello', alignable: true },
];

const makeAlignment = (overrides: Partial<AlignmentResult> = {}): AlignmentResult => ({
  source: 'ai-aligner',
  version: 1,
  audioSource: 'vocal-stem',
  lyricsHash: 'fnv1a:12345678',
  provider: 'mms_fa',
  lines: [{ 
    rawLineIndex: 0, 
    contentLineIndex: 0, 
    text: 'Hello', 
    start: 0, 
    end: 1, 
    confidence: 0.9, 
    words: [] 
  }],
  ...overrides,
});

describe('getAlignmentCacheVerdict', () => {
  it('returns missing when lineMap is null', () => {
    const result = getAlignmentCacheVerdict({
      lineMap: null,
      alignmentData: makeAlignment(),
      lyricsHash: 'fnv1a:12345678',
      audioSource: 'vocal-stem',
    });
    expect(result.ok).toBe(false);
    expect(result.status).toBe('missing');
  });

  it('returns missing when alignmentData is null', () => {
    const result = getAlignmentCacheVerdict({
      lineMap: validLineMap,
      alignmentData: null,
      lyricsHash: 'fnv1a:12345678',
      audioSource: 'vocal-stem',
    });
    expect(result.ok).toBe(false);
    expect(result.status).toBe('missing');
  });

  it('returns missing when lineMap is empty array', () => {
    const result = getAlignmentCacheVerdict({
      lineMap: [],
      alignmentData: makeAlignment(),
      lyricsHash: 'fnv1a:12345678',
      audioSource: 'vocal-stem',
    });
    expect(result.ok).toBe(false);
    expect(result.status).toBe('missing');
  });

  it('returns missing when alignmentData has empty lines', () => {
    const result = getAlignmentCacheVerdict({
      lineMap: validLineMap,
      alignmentData: { ...makeAlignment(), lines: [] },
      lyricsHash: 'fnv1a:12345678',
      audioSource: 'vocal-stem',
    });
    expect(result.ok).toBe(false);
    expect(result.status).toBe('missing');
  });

  it('returns stale-lyrics when hash does not match', () => {
    const result = getAlignmentCacheVerdict({
      lineMap: validLineMap,
      alignmentData: makeAlignment({ lyricsHash: 'fnv1a:aaaaaaaa' }),
      lyricsHash: 'fnv1a:bbbbbbbb',
      audioSource: 'vocal-stem',
    });
    expect(result.ok).toBe(false);
    expect(result.status).toBe('stale-lyrics');
  });

  it('returns stale-source when audioSource does not match', () => {
    const result = getAlignmentCacheVerdict({
      lineMap: validLineMap,
      alignmentData: makeAlignment({ audioSource: 'mix' }),
      lyricsHash: 'fnv1a:12345678',
      audioSource: 'vocal-stem',
    });
    expect(result.ok).toBe(false);
    expect(result.status).toBe('stale-source');
  });

  it('returns stale-audio when audioHash does not match', () => {
    const result = getAlignmentCacheVerdict({
      lineMap: validLineMap,
      alignmentData: makeAlignment({ audioHash: 'hash1' }),
      lyricsHash: 'fnv1a:12345678',
      audioSource: 'vocal-stem',
      audioHash: 'hash2',
    });
    expect(result.ok).toBe(false);
    expect(result.status).toBe('stale-audio');
  });

  it('does NOT return stale-audio when audioHash is not provided', () => {
    const result = getAlignmentCacheVerdict({
      lineMap: validLineMap,
      alignmentData: makeAlignment({ audioHash: undefined }),
      lyricsHash: 'fnv1a:12345678',
      audioSource: 'vocal-stem',
      audioHash: undefined,
    });
    expect(result.ok).toBe(true);
    expect(result.status).toBe('ready');
  });

  it('returns stale-provider for mock provider', () => {
    const result = getAlignmentCacheVerdict({
      lineMap: validLineMap,
      alignmentData: makeAlignment({ provider: 'mock' }),
      lyricsHash: 'fnv1a:12345678',
      audioSource: 'vocal-stem',
    });
    expect(result.ok).toBe(false);
    expect(result.status).toBe('stale-provider');
  });

  it('returns ready when everything matches', () => {
    const alignment = makeAlignment();
    const result = getAlignmentCacheVerdict({
      lineMap: validLineMap,
      alignmentData: alignment,
      lyricsHash: 'fnv1a:12345678',
      audioSource: 'vocal-stem',
    });
    expect(result.ok).toBe(true);
    expect(result.status).toBe('ready');
    if (result.ok) {
      expect(result.lineMap).toBe(validLineMap);
      expect(result.alignmentData).toBe(alignment);
    }
  });

  it('returns ready with different audio sources', () => {
    const result = getAlignmentCacheVerdict({
      lineMap: validLineMap,
      alignmentData: makeAlignment({ audioSource: 'mix' }),
      lyricsHash: 'fnv1a:12345678',
      audioSource: 'mix',
    });
    expect(result.ok).toBe(true);
    expect(result.status).toBe('ready');
  });
});

describe('hasUsableAlignmentCache', () => {
  it('returns true for ready alignment', () => {
    const result = hasUsableAlignmentCache({
      lineMap: validLineMap,
      alignmentData: makeAlignment(),
      lyricsHash: 'fnv1a:12345678',
      audioSource: 'vocal-stem',
    });
    expect(result).toBe(true);
  });

  it('returns false for missing alignment', () => {
    const result = hasUsableAlignmentCache({
      lineMap: null,
      alignmentData: makeAlignment(),
      lyricsHash: 'fnv1a:12345678',
      audioSource: 'vocal-stem',
    });
    expect(result).toBe(false);
  });

  it('returns false for stale alignment', () => {
    const result = hasUsableAlignmentCache({
      lineMap: validLineMap,
      alignmentData: makeAlignment({ provider: 'mock' }),
      lyricsHash: 'fnv1a:12345678',
      audioSource: 'vocal-stem',
    });
    expect(result).toBe(false);
  });
});
