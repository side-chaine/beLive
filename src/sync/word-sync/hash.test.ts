import { describe, it, expect } from 'vitest';
import { computeLyricsHash, normalizeLyricsForHash } from './hash';

describe('lyrics hash computation', () => {
  it('produces consistent hash for same text', () => {
    const h1 = computeLyricsHash('Hello world');
    const h2 = computeLyricsHash('Hello world');
    expect(h1).toBe(h2);
  });

  it('normalizes CRLF to LF', () => {
    const h1 = computeLyricsHash('Line1\r\nLine2');
    const h2 = computeLyricsHash('Line1\nLine2');
    expect(h1).toBe(h2);
  });

  it('normalizes CR to LF', () => {
    const h1 = computeLyricsHash('Line1\rLine2');
    const h2 = computeLyricsHash('Line1\nLine2');
    expect(h1).toBe(h2);
  });

  it('produces different hash for different text', () => {
    const h1 = computeLyricsHash('Hello');
    const h2 = computeLyricsHash('World');
    expect(h1).not.toBe(h2);
  });

  it('produces fnv1a: prefixed hash', () => {
    const h = computeLyricsHash('test');
    expect(h).toMatch(/^fnv1a:[0-9a-f]{8}$/);
  });

  it('handles empty string', () => {
    const h = computeLyricsHash('');
    expect(h).toMatch(/^fnv1a:[0-9a-f]{8}$/);
  });

  it('handles multiple line breaks', () => {
    const h1 = computeLyricsHash('Line1\r\nLine2\r\nLine3');
    const h2 = computeLyricsHash('Line1\nLine2\nLine3');
    expect(h1).toBe(h2);
  });
});

describe('normalizeLyricsForHash', () => {
  it('converts CRLF to LF', () => {
    const result = normalizeLyricsForHash('Line1\r\nLine2');
    expect(result).toBe('Line1\nLine2');
  });

  it('converts CR to LF', () => {
    const result = normalizeLyricsForHash('Line1\rLine2');
    expect(result).toBe('Line1\nLine2');
  });

  it('preserves existing LF', () => {
    const result = normalizeLyricsForHash('Line1\nLine2');
    expect(result).toBe('Line1\nLine2');
  });
});
