import { describe, it, expect } from 'vitest';
import { buildParagraphEditorText, buildParagraphBlocks } from './paragraph-blocks';

/** Фикстура трека Босса: Genius-текст с приклеенным к первой строке заголовком «[Testo di …]» + 7 абзацев. */
const BOSS_PARAGRAPHS = [
  [
    '[Testo di "Ja tebia liubliu"]Mi sto lavando le mani',
    "nell'acqua chiara del mare",
  ],
  [
    'Sei come me',
    'La vita ci ha insegnato a non temere il buio',
  ],
  [
    'Ti cerco nella pioggia',
    'e ti ritrovo nel vento di sera',
  ],
  [
    'Ja tebia liubliu',
    'come il primo giorno che ti ho visto',
  ],
  [
    'Il tempo passa lento',
    'ma il cuore non dimentica',
  ],
  [
    'Se torni a casa mia',
    'la porta sarà ancora aperta',
  ],
  [
    'Cantiamo insieme',
    'fino alla fine della notte',
  ],
];

const BOSS_SOURCE = BOSS_PARAGRAPHS.map(p => p.join('\n')).join('\n\n');

describe('buildParagraphEditorText', () => {
  it('(1) текст Босса: header срезан, 7 абзацев-блоков', () => {
    const result = buildParagraphEditorText(BOSS_SOURCE);
    expect(result).not.toBeNull();

    const paragraphs = result!.split('\n\n');
    expect(paragraphs).toHaveLength(7);
    expect(paragraphs[0].startsWith('Mi sto lavando')).toBe(true);
    expect(result).not.toContain('Testo di');
  });

  it('(2) CRLF нормализуется, абзацы сохранены', () => {
    const crlf = BOSS_SOURCE.replace(/\n/g, '\r\n');
    const result = buildParagraphEditorText(crlf);
    expect(result).not.toBeNull();
    expect(result).not.toContain('\r');
    expect(result!.split('\n\n')).toHaveLength(7);
  });

  it('(3) без пустых строк → null', () => {
    const flat = BOSS_PARAGRAPHS.map(p => p.join(' ')).join('\n');
    expect(buildParagraphEditorText(flat)).toBeNull();
  });

  it('(4) LRC с [mm:ss] → null', () => {
    const lrc = ['[00:12.00]Mi sto lavando le mani', '[00:18.30]Sei come me'].join('\n');
    expect(buildParagraphEditorText(lrc)).toBeNull();
  });

  it('(5) whitespace-only разделители (\n  \n) → абзацы', () => {
    const spaced = BOSS_SOURCE.replace(/\n\n/g, '\n  \n');
    const result = buildParagraphEditorText(spaced);
    expect(result).not.toBeNull();
    expect(result!.split('\n\n')).toHaveLength(7);
    expect(result!.split('\n\n')[0].startsWith('Mi sto lavando')).toBe(true);
    expect(result).not.toContain('\n  \n');
  });
});

// ── D3: buildParagraphBlocks — блоки строятся автоматически из абзацев ──

/**
 * Фикстура Босса (8 абзацев): абзацы 3 и 7 совпадают, 4 и 8 совпадают ⇒
 * fingerprint встречается дважды ⇒ chorus для ВСЕХ вхождений.
 * Ожидаемые типы: v, v, c, c, v, v, c, c.
 */
const BOSS_8_PARAGRAPHS: string[][] = [
  ['Mi sto lavando le mani', "nell'acqua chiara del mare"],
  ['Sei come me', 'La vita ci ha insegnato a non temere il buio'],
  ['Ti cerco nella pioggia', 'e ti ritrovo nel vento di sera'],
  ['Ja tebia liubliu', 'come il primo giorno che ti ho visto'],
  ['Il tempo passa lento', 'ma il cuore non dimentica'],
  ['Se torni a casa mia', 'la porta sarà ancora aperta'],
  ['Ti cerco nella pioggia', 'e ti ritrovo nel vento di sera'],
  ['Ja tebia liubliu', 'come il primo giorno che ti ho visto'],
];

const BOSS_8_SOURCE = BOSS_8_PARAGRAPHS.map(p => p.join('\n')).join('\n\n');

/** Line-space как его даёт extractCleanLyrics: без header, без пустых строк. */
const BOSS_8_LINE_SPACE = BOSS_8_PARAGRAPHS.flat();

describe('buildParagraphBlocks (D3)', () => {
  it('(1) текст Босса: 8 блоков, типы v,v,c,c,v,v,c,c, имена Куплет N / Припев N', () => {
    const blocks = buildParagraphBlocks(BOSS_8_SOURCE, BOSS_8_LINE_SPACE);

    expect(blocks).toHaveLength(8);
    expect(blocks.map(b => b.type)).toEqual(['verse', 'verse', 'chorus', 'chorus', 'verse', 'verse', 'chorus', 'chorus']);
    expect(blocks.map(b => b.name)).toEqual([
      'Куплет 1',
      'Куплет 2',
      'Припев 1',
      'Припев 2',
      'Куплет 3',
      'Куплет 4',
      'Припев 3',
      'Припев 4',
    ]);
    expect(blocks.map(b => b.id)).toEqual(BOSS_8_PARAGRAPHS.map((_, i) => `auto-para-block-${i}`));
  });

  it('(2) lineIndices в lineSpace без header (header срезан, индексы с 0)', () => {
    const source = [
      '[Testo di "Ja tebia liubliu"]Mi sto lavando le mani',
      "nell'acqua chiara del mare",
      '',
      'Sei come me',
      'La vita ci ha insegnato a non temere il buio',
      '',
      'Ti cerco nella pioggia',
      'e ti ritrovo nel vento di sera',
      '',
      'Il tempo passa lento',
      'ma il cuore non dimentica',
    ].join('\n');

    const blocks = buildParagraphBlocks(source, BOSS_8_LINE_SPACE);

    expect(blocks).toHaveLength(4);
    expect(blocks.map(b => b.lineIndices)).toEqual([[0, 1], [2, 3], [4, 5], [8, 9]]);
    // header не попал ни в один блок
    const flat = blocks.flatMap(b => b.lineIndices);
    expect(flat).toEqual([0, 1, 2, 3, 4, 5, 8, 9]);
  });

  it('(3) абзацев < 2 → [] (один абзац, LRC, пусто)', () => {
    expect(buildParagraphBlocks('Sei come me\nLa vita ci ha insegnato a non temere il buio', BOSS_8_LINE_SPACE)).toEqual([]);
    expect(buildParagraphBlocks('', BOSS_8_LINE_SPACE)).toEqual([]);
    expect(buildParagraphBlocks('[00:12.00]Sei come me\n[00:18.30]La vita', BOSS_8_LINE_SPACE)).toEqual([]);
  });

  it('(4) дубли строк: курсор движется вперёд, индексы не переиспользуются', () => {
    const source = ['Ami', 'Ami', '', 'Ami', 'Ami', '', 'Ami', 'Ami'].join('\n');
    const lineSpace = ['Ami', 'Ami', 'Ami', 'Ami', 'Ami', 'Ami'];

    const blocks = buildParagraphBlocks(source, lineSpace);

    expect(blocks).toHaveLength(3);
    expect(blocks.map(b => b.lineIndices)).toEqual([[0, 1], [2, 3], [4, 5]]);
    // одинаковый fingerprint у всех → все chorus
    expect(blocks.map(b => b.type)).toEqual(['chorus', 'chorus', 'chorus']);
    expect(blocks.map(b => b.name)).toEqual(['Припев 1', 'Припев 2', 'Припев 3']);
  });

  it('(5) CRLF и bracket-метаданные внутри абзаца: 8 блоков, те же fingerprint', () => {
    const source = '[ti:Ja tebia liubliu]\r\n' + BOSS_8_PARAGRAPHS.map(p => p.join('\r\n')).join('\r\n\r\n');
    const blocks = buildParagraphBlocks(source, BOSS_8_LINE_SPACE);

    expect(blocks).toHaveLength(8);
    expect(blocks.map(b => b.type)).toEqual(['verse', 'verse', 'chorus', 'chorus', 'verse', 'verse', 'chorus', 'chorus']);
  });
});