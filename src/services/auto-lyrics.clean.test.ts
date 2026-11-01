/**
 * auto-lyrics.clean.test.ts — D3: extractCleanLyrics отбрасывает bracket-only строки
 * (plain-ветка). TC-002 invariant: `track.lyrics` не содержит тегов.
 */

import { describe, it, expect } from 'vitest';
import { extractCleanLyrics } from './auto-lyrics.service';

describe('extractCleanLyrics (D3 — bracket-only lines dropped)', () => {
  it('(1) plain-текст с header-строкой Genius: header срезан, лирика сохранена', () => {
    const geniusText = [
      '[Testo di "Ja tebia liubliu"]',
      'Mi sto lavando le mani',
      "nell'acqua chiara del mare",
      '',
      'Sei come me',
      'La vita ci ha insegnato a non temere il buio',
    ].join('\n');

    const lines = extractCleanLyrics(geniusText);

    expect(lines).toEqual([
      'Mi sto lavando le mani',
      "nell'acqua chiara del mare",
      'Sei come me',
      'La vita ci ha insegnato a non temere il buio',
    ]);
    expect(lines.some(l => /^\s*\[[^\]]+\]\s*$/.test(l))).toBe(false);
  });

  it('(2) bracket-only строки в начале/середине/конце — выброшены; скобки внутри текста остаются', () => {
    const geniusText = [
      '[ti:Ja tebia liubliu]',
      '[ar:Some Artist]',
      'Mi sto lavando le mani',
      '[Testo di "Ja tebia liubliu"]',
      "nell'acqua chiara del mare",
      'Ja tebia [love] liubliu',
      '[00:00.00]',
    ].join('\n');

    const lines = extractCleanLyrics(geniusText);

    expect(lines).toEqual([
      'Mi sto lavando le mani',
      "nell'acqua chiara del mare",
      'Ja tebia [love] liubliu',
    ]);
  });
});
