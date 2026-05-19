import { describe, it, expect } from 'vitest';
import { buildLineMap, getLineMapEntry } from './line-map.builder';

describe('buildLineMap', () => {
  it('builds correct map for simple lyrics', () => {
    const lyrics = 'First line\nSecond line\nThird line';
    const { lineMap } = buildLineMap(lyrics);

    expect(lineMap).toHaveLength(3);
    expect(lineMap[0].rawLineIndex).toBe(0);
    expect(lineMap[0].text).toBe('First line');
    expect(lineMap[0].alignable).toBe(true);
    expect(lineMap[0].kind).toBe('lyric');
  });

  it('handles empty lines as separators', () => {
    const lyrics = 'Verse 1\n\nChorus';
    const { lineMap } = buildLineMap(lyrics);

    const separator = lineMap.find(l => l.kind === 'separator');
    expect(separator).toBeDefined();
    expect(separator?.alignable).toBe(false);
  });

  it('preserves rawLineIndex across empty lines', () => {
    const lyrics = 'Line A\n\nLine B';
    const { lineMap } = buildLineMap(lyrics);

    const contentLines = lineMap.filter(l => l.alignable);
    expect(contentLines[0].rawLineIndex).toBe(0);
    expect(contentLines[0].contentLineIndex).toBe(0);
    expect(contentLines[1].rawLineIndex).toBe(2);
    expect(contentLines[1].contentLineIndex).toBe(1);
  });

  it('handles bracket lines as non-alignable', () => {
    const lyrics = '[Intro]\nFirst verse';
    const { lineMap } = buildLineMap(lyrics);

    const bracket = lineMap.find(l => l.kind === 'bracket');
    expect(bracket).toBeDefined();
    expect(bracket?.alignable).toBe(false);
  });

  it('returns lineMap with one separator for empty string', () => {
    const { lineMap } = buildLineMap('');
    // Empty string splits to [''], which becomes a single separator
    expect(lineMap).toHaveLength(1);
    expect(lineMap[0].kind).toBe('separator');
    expect(lineMap[0].alignable).toBe(false);
  });

  it('classifies non-lexical vocables correctly', () => {
    const lyrics = 'Na na na\nReal lyrics here';
    const { lineMap } = buildLineMap(lyrics);

    const nonLexical = lineMap.find(l => l.kind === 'non-lexical');
    expect(nonLexical).toBeDefined();
    expect(nonLexical?.alignable).toBe(true);
  });

  it('counts contentLineIndex correctly for multiple lines', () => {
    const lyrics = 'A\nB\nC\nD';
    const { lineMap } = buildLineMap(lyrics);

    expect(lineMap[0].contentLineIndex).toBe(0);
    expect(lineMap[1].contentLineIndex).toBe(1);
    expect(lineMap[2].contentLineIndex).toBe(2);
    expect(lineMap[3].contentLineIndex).toBe(3);
  });

  it('handles mixed line types', () => {
    const lyrics = '[Verse 1]\nLine one\n\n[Chorus]\nLine two';
    const { lineMap } = buildLineMap(lyrics);

    expect(lineMap).toHaveLength(5);
    expect(lineMap[0].kind).toBe('bracket');
    expect(lineMap[1].kind).toBe('lyric');
    expect(lineMap[2].kind).toBe('separator');
    expect(lineMap[3].kind).toBe('bracket');
    expect(lineMap[4].kind).toBe('lyric');
  });

  it('returns alignableLines array with correct structure', () => {
    const lyrics = 'A\n\nB';
    const { lineMap, alignableLines } = buildLineMap(lyrics);

    expect(alignableLines).toHaveLength(2);
    expect(alignableLines[0].text).toBe('A');
    expect(alignableLines[0].rawLineIndex).toBe(0);
    expect(alignableLines[1].text).toBe('B');
    expect(alignableLines[1].rawLineIndex).toBe(2);
  });
});

describe('getLineMapEntry', () => {
  it('finds entry by rawLineIndex', () => {
    const lyrics = 'A\nB\nC';
    const { lineMap } = buildLineMap(lyrics);

    const entry = getLineMapEntry(lineMap, 1);
    expect(entry).not.toBeNull();
    expect(entry?.text).toBe('B');
  });

  it('returns null for out-of-bounds index', () => {
    const lyrics = 'A\nB';
    const { lineMap } = buildLineMap(lyrics);

    const entry = getLineMapEntry(lineMap, 99);
    expect(entry).toBeNull();
  });

  it('returns entry for valid index even in short map', () => {
    const { lineMap } = buildLineMap('');

    const entry = getLineMapEntry(lineMap, 0);
    expect(entry).not.toBeNull();
    expect(entry?.kind).toBe('separator');
  });
});
