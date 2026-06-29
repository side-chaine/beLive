import { describe, it, expect } from 'vitest';
import { resolveBlockAlias, BLOCK_ALIAS_MAP } from './block-taxonomy';

describe('resolveBlockAlias', () => {
  it('resolves verse', () => {
    expect(resolveBlockAlias('verse')?.type).toBe('verse');
    expect(resolveBlockAlias('Verse')?.type).toBe('verse');
    expect(resolveBlockAlias('VERSE')?.type).toBe('verse');
  });

  it('resolves chorus', () => {
    expect(resolveBlockAlias('chorus')?.type).toBe('chorus');
    expect(resolveBlockAlias('refrain')?.type).toBe('chorus');
  });

  it('resolves RU куплет', () => {
    expect(resolveBlockAlias('куплет')?.type).toBe('verse');
    expect(resolveBlockAlias('Куплет')?.type).toBe('verse');
  });

  it('resolves RU припев', () => {
    expect(resolveBlockAlias('припев')?.type).toBe('chorus');
  });

  it('marks soft aliases as reviewRequired', () => {
    expect(resolveBlockAlias('hook')?.reviewRequired).toBe(true);
    expect(resolveBlockAlias('interlude')?.reviewRequired).toBe(false);
    expect(resolveBlockAlias('проигрыш')?.type).toBe('instrumental');
    expect(resolveBlockAlias('проигрыш')?.reviewRequired).toBe(false);
  });

  it('marks exact aliases as not reviewRequired', () => {
    expect(resolveBlockAlias('verse')?.reviewRequired).toBe(false);
    expect(resolveBlockAlias('chorus')?.reviewRequired).toBe(false);
    expect(resolveBlockAlias('куплет')?.reviewRequired).toBe(false);
  });

  it('returns null for unknown tags', () => {
    expect(resolveBlockAlias('produced by')).toBeNull();
    expect(resolveBlockAlias('yeah')).toBeNull();
    expect(resolveBlockAlias('softly')).toBeNull();
  });

  it('normalizes ё to е', () => {
    // Normalization converts ё→е, so 'припёв' resolves to 'припев' → chorus
    expect(resolveBlockAlias('припёв')?.type).toBe('chorus');
  });

  it('handles v shorthand', () => {
    expect(resolveBlockAlias('v')?.type).toBe('verse');
  });

  it('all aliases resolve to valid types', () => {
    const validTypes = new Set(['intro','verse','prechorus','chorus','postchorus','bridge','interlude','outro','hook','solo','instrumental','build','drop','breakdown','spoken','rap']);
    for (const [alias, entry] of Object.entries(BLOCK_ALIAS_MAP)) {
      expect(validTypes.has(entry.type)).toBe(true);
    }
  });
});
