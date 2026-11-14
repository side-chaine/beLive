// t72-reverse-n10.test.ts — §5 guardrail 5: перефразированная aux-строка.
// Обратная сторона N10: aux-блок (Interlude) с ПЕРЕФРАЗИРОВАННОЙ первой
// строкой (точного совпадения с LRC нет) обязан остаться zero-width (null) —
// гейт не ловит ложный override «aux получает строки» и не ломает соседей.
// Дамп конструируется напрямую: loadDump перестраивает geniusBlocks из
// geniusRaw, поэтому здесь задаём Dump явно.
import { describe, it, expect } from 'vitest';
import { type Dump } from '../parse';
import { gate } from '../gate';
import { mmodel } from '../model';

const synth: Dump = {
  lrcLines: [
    { i: 0, t: 0, text: 'we were born to play' },
    { i: 1, t: 1, text: 'underneath the stars' },
    { i: 2, t: 2, text: 'the night is calling us' },
    { i: 3, t: 3, text: 'to the great unknown' },
    { i: 4, t: 4, text: 'hold on to the light' },
    { i: 5, t: 5, text: 'we will rise again' },
    { i: 6, t: 6, text: 'breaking through the dark' },
    { i: 7, t: 7, text: 'nothing can stop us now' },
    { i: 8, t: 8, text: 'we are the chosen ones' },
    { i: 9, t: 9, text: 'forever we are free' },
  ],
  geniusBlocks: [
    { label: 'Verse 1', kind: 'verse', lines: ['we were born to play', 'underneath the stars', 'the night is calling us', 'to the great unknown', 'hold on to the light'] },
    { label: 'Interlude', kind: 'interlude', lines: ['rephrased break here we go'] },
    { label: 'Verse 2', kind: 'verse', lines: ['we will rise again', 'breaking through the dark', 'nothing can stop us now', 'we are the chosen ones', 'forever we are free'] },
  ],
  currentOutput: [
    { i: 0, label: 'Verse 1', startIdx: 0, endIdx: 4, lines: 5 },
    { i: 1, label: 'Interlude', startIdx: null, endIdx: null, lines: 0 },
    { i: 2, label: 'Verse 2', startIdx: 5, endIdx: 9, lines: 5 },
  ],
};

describe('t72 · reverse-N10 — перефразированная aux-строка не ловит ложный override', () => {
  it('модель держит перефразированный aux как zero-width (null)', () => {
    const mm = mmodel(synth.geniusBlocks!, synth.lrcLines);
    expect(mm.failed).not.toBe(true);
    expect(mm.blocks![1]).toBeNull();
    expect(mm.zeroWidth.has(1)).toBe(true);
  });

  it('гейт НЕ ложно override-ит aux в «получает строки» и сохраняет соседей byte-exact', () => {
    const g = gate(synth);
    // Перефразированный aux (Interlude) в legacy пуст (null) — это ЗАКОННО: гейт не
    // ловит ложный override «aux получает строки». Допустимые режимы:
    //   • defer-unclean — гейт признаёт NOT MAPPED и сохраняет legacy byte-exact
    //     (aux остаётся null, соседи не тронуты);
    //   • no-disputes / overridden — если гейт видит, что модель держит aux
    //     zero-width и соседи совпадают.
    // Во ВСЕХ случаях: aux остаётся null, соседи byte-exact (это и есть §5-защита).
    expect(['defer-unclean', 'no-disputes', 'overridden', 'overridden-by-validity'].includes(g.mode)).toBe(true);
    expect(g.blocks[1]).toBeNull();
    expect([g.blocks[0]!.startIdx, g.blocks[0]!.endIdx]).toEqual([0, 4]);
    expect([g.blocks[2]!.startIdx, g.blocks[2]!.endIdx]).toEqual([5, 9]);
  });
});
