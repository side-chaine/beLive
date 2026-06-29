import { describe, it, expect } from 'vitest';
import { parseTaggedLyrics } from './tagged-lyrics.parser';

describe('parseTaggedLyrics', () => {

  it('parses bracket format [Verse 1]', () => {
    const result = parseTaggedLyrics('[Verse 1]\nLine one\nLine two');
    expect(result.hasStructure).toBe(true);
    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0].type).toBe('verse');
    expect(result.blocks[0].number).toBe(1);
    expect(result.blocks[0].label).toBe('Verse 1');
    expect(result.blocks[0].contentLines).toEqual(['Line one', 'Line two']);
  });

  it('parses bracket format with artist [Verse 1: Chester]', () => {
    const result = parseTaggedLyrics('[Verse 1: Chester Bennington]\nSome lyrics');
    expect(result.blocks[0].type).toBe('verse');
    expect(result.blocks[0].artist).toBe('Chester Bennington');
    expect(result.blocks[0].number).toBe(1);
  });

  it('parses RU bracket [Куплет]', () => {
    const result = parseTaggedLyrics('[Куплет]\nСлова песни');
    expect(result.blocks[0].type).toBe('verse');
  });

  it('parses RU bracket [Припев]', () => {
    const result = parseTaggedLyrics('[Припев]\nПрипев слова');
    expect(result.blocks[0].type).toBe('chorus');
  });

  it('parses prefix format Chorus:', () => {
    const result = parseTaggedLyrics('Chorus:\nI tried so hard');
    expect(result.blocks[0].type).toBe('chorus');
    expect(result.blocks[0].confidence).toBe(0.9);
  });

  it('parses no-space number [Verse2]', () => {
    const result = parseTaggedLyrics('[Verse2]\nSome text');
    expect(result.blocks[0].type).toBe('verse');
    expect(result.blocks[0].number).toBe(2);
  });

  it('skips unknown bracket tags', () => {
    const result = parseTaggedLyrics('[Note: sing softly]\nLa la la');
    expect(result.hasStructure).toBe(false);
    expect(result.unmatchedTags).toContain('Note: sing softly');
  });

  it('returns hasStructure false for empty input', () => {
    const result = parseTaggedLyrics('');
    expect(result.hasStructure).toBe(false);
    expect(result.blocks).toHaveLength(0);
  });

  it('returns hasStructure false for text without tags', () => {
    const result = parseTaggedLyrics('Just some text\nAnother line');
    expect(result.hasStructure).toBe(false);
  });

  it('handles mixed EN + RU tags', () => {
    const text = '[Verse 1]\nEnglish verse\n\n[Припев]\nRussian chorus';
    const result = parseTaggedLyrics(text);
    expect(result.blocks).toHaveLength(2);
    expect(result.blocks[0].type).toBe('verse');
    expect(result.blocks[1].type).toBe('chorus');
  });

  it('marks soft aliases as reviewRequired', () => {
    const result = parseTaggedLyrics('[Hook]\nCatchy part');
    expect(result.blocks[0].type).toBe('hook');
    expect(result.blocks[0].reviewRequired).toBe(true);
  });

  it('marks exact matches as not reviewRequired', () => {
    const result = parseTaggedLyrics('[Chorus]\nI tried so hard');
    expect(result.blocks[0].reviewRequired).toBe(false);
  });

  it('handles multiple blocks with boundaries', () => {
    const text = [
      '[Verse 1]',
      'Line A',
      'Line B',
      '',
      '[Chorus]',
      'Line C',
      'Line D',
    ].join('\n');
    const result = parseTaggedLyrics(text);
    expect(result.blocks).toHaveLength(2);
    expect(result.blocks[0].contentLines).toEqual(['Line A', 'Line B']);
    expect(result.blocks[1].contentLines).toEqual(['Line C', 'Line D']);
  });

  it('trims empty lines at block boundaries', () => {
    const text = '[Verse 1]\n\nActual content\n\n[Chorus]\nChorus line';
    const result = parseTaggedLyrics(text);
    expect(result.blocks[0].contentLines).toEqual(['Actual content']);
  });

  it('calculates coverage ratio', () => {
    const text = 'Untagged line\n[Verse 1]\nTagged line';
    const result = parseTaggedLyrics(text);
    expect(result.coverage).toBe(0.5);
  });

  it('handles case insensitive tags', () => {
    const result = parseTaggedLyrics('[CHORUS]\nLoud part');
    expect(result.blocks[0].type).toBe('chorus');
  });

  it('handles pre-chorus variations', () => {
    const r1 = parseTaggedLyrics('[Pre-Chorus]\nBuilding up');
    expect(r1.blocks[0].type).toBe('prechorus');

    const r2 = parseTaggedLyrics('[Prechorus]\nBuilding up');
    expect(r2.blocks[0].type).toBe('prechorus');

    const r3 = parseTaggedLyrics('[Предприпев]\nНарастание');
    expect(r3.blocks[0].type).toBe('prechorus');
  });

  it('does not match lyric lines with colons as prefix tags', () => {
    const text = '[Verse 1]\nDear Mom: I miss you\nAnother line';
    const result = parseTaggedLyrics(text);
    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0].contentLines).toContain('Dear Mom: I miss you');
  });

  it('handles instrumental as instrumental type', () => {
    const result = parseTaggedLyrics('[Instrumental]\n');
    expect(result.blocks[0].type).toBe('instrumental');
    expect(result.blocks[0].reviewRequired).toBe(false);
  });

  it('handles Genius format with featured artist', () => {
    const text = '[Chorus: ft. Jay-Z]\nWe run this town';
    const result = parseTaggedLyrics(text);
    expect(result.blocks[0].type).toBe('chorus');
  });
});

describe('Genius noise filter', () => {
  it('removes "See Artist Live" lines', () => {
    const text = '[Verse 1]\nLyric line\nSee Linkin Park Live\nMore lyrics';
    const result = parseTaggedLyrics(text);
    expect(result.blocks[0].contentLines).not.toContain('See Linkin Park Live');
    expect(result.blocks[0].contentLines).toContain('Lyric line');
    expect(result.blocks[0].contentLines).toContain('More lyrics');
  });

  it('removes "Get tickets" lines', () => {
    const text = '[Chorus]\nChorus line\nGet tickets as low as $91';
    const result = parseTaggedLyrics(text);
    expect(result.blocks[0].contentLines).not.toContain('Get tickets as low as $91');
  });

  it('removes "You might also like"', () => {
    const text = '[Verse 1]\nLine 1\nYou might also like\nLine 2';
    const result = parseTaggedLyrics(text);
    const allContent = result.blocks[0].contentLines.join(' ');
    expect(allContent).not.toContain('You might also like');
  });

  it('removes price-only lines', () => {
    const text = '[Verse 1]\nLyric\n$91\nMore lyric';
    const result = parseTaggedLyrics(text);
    expect(result.blocks[0].contentLines).not.toContain('$91');
  });

  it('preserves empty lines between blocks', () => {
    const text = '[Verse 1]\nLine A\n\n[Chorus]\nLine B';
    const result = parseTaggedLyrics(text);
    expect(result.blocks).toHaveLength(2);
  });

  it('removes Genius embed patterns', () => {
    const text = '[Verse 1]\nLyric line\n45Embed';
    const result = parseTaggedLyrics(text);
    expect(result.blocks[0].contentLines).toHaveLength(1);
  });

  it('removes Genius Romanizations', () => {
    const text = '[Verse 1]\nLyric line\nGenius Romanizations\nAnother line';
    const result = parseTaggedLyrics(text);
    expect(result.blocks[0].contentLines).not.toContain('Genius Romanizations');
  });

  it('removes Genius Translations', () => {
    const text = '[Chorus]\nChorus line\nGenius Translations\nNext line';
    const result = parseTaggedLyrics(text);
    expect(result.blocks[0].contentLines).not.toContain('Genius Translations');
  });

  it('handles multiple noise patterns in one text', () => {
    const text = [
      'See Linkin Park Live',
      '[Verse 1]',
      'Actual lyric',
      'Get tickets as low as $50',
      'More lyrics',
      '$91',
    ].join('\n');
    const result = parseTaggedLyrics(text);
    const allContent = result.blocks[0].contentLines.join('\n');
    expect(allContent).not.toContain('See Linkin Park Live');
    expect(allContent).not.toContain('Get tickets as low as');
    expect(allContent).not.toContain('$91');
    expect(allContent).toContain('Actual lyric');
    expect(allContent).toContain('More lyrics');
  });

  it('removes all lines between "You might also like" and next tag', () => {
    const text = [
      '[Verse 1]',
      'Real lyric line',
      'You might also like',
      'In the End',
      'Linkin Park',
      'Heavy Is the Crown',
      'Linkin Park',
      'ROSÉ & Bruno Mars - APT. (Romanized)',
      'Genius Romanizations',
      '[Chorus]',
      'Chorus lyric line',
    ].join('\n');
    const result = parseTaggedLyrics(text);
    expect(result.blocks).toHaveLength(2);
    expect(result.blocks[0].contentLines).toEqual(['Real lyric line']);
    expect(result.blocks[1].contentLines).toEqual(['Chorus lyric line']);
  });

  it('handles "You might also like" at end of text', () => {
    const text = [
      '[Verse 1]',
      'Some lyrics',
      'You might also like',
      'Random track name',
      'Random artist',
    ].join('\n');
    const result = parseTaggedLyrics(text);
    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0].contentLines).toEqual(['Some lyrics']);
  });

  it('handles multiple "You might also like" sections', () => {
    const text = [
      '[Verse 1]',
      'Verse lyrics',
      'You might also like',
      'Noise 1',
      '[Chorus]',
      'Chorus lyrics',
      'You might also like',
      'Noise 2',
      '[Verse 2]',
      'Verse 2 lyrics',
    ].join('\n');
    const result = parseTaggedLyrics(text);
    expect(result.blocks).toHaveLength(3);
    expect(result.blocks[0].contentLines).toEqual(['Verse lyrics']);
    expect(result.blocks[1].contentLines).toEqual(['Chorus lyrics']);
    expect(result.blocks[2].contentLines).toEqual(['Verse 2 lyrics']);
  });
});
