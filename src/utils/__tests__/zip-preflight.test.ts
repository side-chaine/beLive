/**
 * Tests for zip-preflight.ts — calcPreFlight + wouldFitZip + assertZipSize
 */
import { describe, it, expect } from 'vitest';
import { STEM_TRANSCODE_CONFIG } from '../../config/stem-transcode.config';
import { calcPreFlight, wouldFitZip, assertZipSize } from '../zip-preflight';

describe('calcPreFlight', () => {
  const mockStemsData = {
    other: { data: new ArrayBuffer(8_000_000), type: 'audio/mpeg' },
    keys: { data: new ArrayBuffer(6_000_000), type: 'audio/mpeg' },
    guitar: { data: new ArrayBuffer(7_000_000), type: 'audio/mpeg' },
    drums: { data: new ArrayBuffer(10_000_000), type: 'audio/mpeg' },
    bass: { data: new ArrayBuffer(5_000_000), type: 'audio/mpeg' },
  };

  it('returns stemsToTranscode in priority order', () => {
    // Добавляем instrumental чтобы перевалить за threshold (51380224)
    const result = calcPreFlight(
      { stemsData: mockStemsData, instrumentalByteLength: 16_000_000 },
      ['other', 'keys', 'guitar']
    );
    // priorityChain: other → keys → guitar
    expect(result.stemsToTranscode).toEqual(['other', 'keys', 'guitar']);
  });

  it('excludes protected stems from stemsToTranscode', () => {
    const result = calcPreFlight(
      { stemsData: mockStemsData },
      ['other', 'keys', 'guitar', 'drums', 'bass']
    );
    // drums и bass не должны быть в stemsToTranscode
    expect(result.stemsToTranscode).not.toContain('drums');
    expect(result.stemsToTranscode).not.toContain('bass');
  });

  it('returns empty stemsToTranscode when predictedTotal < threshold', () => {
    const smallData = {
      other: { data: new ArrayBuffer(1_000_000), type: 'audio/mpeg' },
    };
    const result = calcPreFlight(
      { stemsData: smallData },
      ['other']
    );
    expect(result.needsTranscode).toBe(false);
    expect(result.stemsToTranscode).toEqual([]);
  });

  it('calculates deficitMB relative to zipSizeLimit', () => {
    // stems total = 36MB, deficit should be 0 (under 50MB)
    const result = calcPreFlight(
      { stemsData: mockStemsData },
      ['other', 'keys', 'guitar']
    );
    expect(result.deficitMB).toBe(0);
  });

  it('returns needsTranscode=true when predicted >= threshold', () => {
    // Добавим instrumental + vocals чтобы перевалить за 49MB
    const bigData = { ...mockStemsData };
    const result = calcPreFlight(
      {
        stemsData: bigData,
        instrumentalByteLength: 35_000_000,
        vocalsByteLength: 10_000_000,
      },
      ['other', 'keys', 'guitar']
    );
    // total = 36MB (stems) + 35MB (inst) + 10MB (vocals) = 81MB
    expect(result.needsTranscode).toBe(true);
    expect(result.stemsToTranscode.length).toBeGreaterThan(0);
  });
});

describe('wouldFitZip', () => {
  it('returns true for bytes under limit', () => {
    expect(wouldFitZip(49_999_999)).toBe(true);
  });

  it('returns false for bytes at limit', () => {
    const limit = STEM_TRANSCODE_CONFIG.zipSizeLimit;
    expect(wouldFitZip(limit)).toBe(false);
  });

  it('returns false for bytes over limit', () => {
    const limit = STEM_TRANSCODE_CONFIG.zipSizeLimit;
    expect(wouldFitZip(limit + 1)).toBe(false);
  });
});

describe('assertZipSize', () => {
  it('throws when blob size >= limit', () => {
    const limit = STEM_TRANSCODE_CONFIG.zipSizeLimit;
    const blob = new Blob([new ArrayBuffer(limit)]);
    expect(() => assertZipSize(blob)).toThrow('ZipSizeHardLimitError');
  });

  it('does not throw when blob size < limit', () => {
    const blob = new Blob([new ArrayBuffer(49_999_999)]);
    expect(() => assertZipSize(blob)).not.toThrow();
  });
});
