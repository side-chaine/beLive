import { describe, it, expect } from 'vitest';
import { extractExportJsonLyrics } from '../upload.service';

describe('extractExportJsonLyrics (LYRICS-JSON-DROP)', () => {
  it('markers+lyrics string -> set', () => {
    expect(extractExportJsonLyrics({ markers: [], lyrics: 'txt' }, null)).toBe('txt');
  });
  it('txt already set + json lyrics -> txt wins (no overwrite)', () => {
    expect(extractExportJsonLyrics({ markers: [], lyrics: 'json' }, 'from-txt')).toBe('from-txt');
  });
  it('lyrics-only JSON (no markers) -> set', () => {
    expect(extractExportJsonLyrics({ lyrics: 'only' }, null)).toBe('only');
  });
  it('non-string lyrics -> skipped (no crash)', () => {
    expect(extractExportJsonLyrics({ lyrics: 123 as any }, null)).toBe(null);
    expect(extractExportJsonLyrics({ lyrics: ['a'] as any }, 'cur')).toBe('cur');
  });
  it('no lyrics -> passthrough current', () => {
    expect(extractExportJsonLyrics({ markers: [] }, 'cur')).toBe('cur');
    expect(extractExportJsonLyrics({}, null)).toBe(null);
  });
});
