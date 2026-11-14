// t72-mode2-path.test.ts — end-to-end покрытие адаптера на путях, которые
// раньше были мёртвыми. Центр_42, BL-042 ITER-3.
//
// Зачем: до ITER-2 ветка 'overridden-by-validity' не срабатывала НИ НА ОДНОЙ
// фикстуре (ITER-1). Теперь она живая и делает ШИРОКИЕ перезаписи. Ни один
// тест не гнал её через wiring+apply на реальных данных.
import { describe, it, expect } from 'vitest';
import { runC36Gate } from '../wiring';
import { partitionStats, type ApplyBlock } from '../apply';
import { genius, lrc, LIVE_INDICES, FIXED_INDICES } from './live-fixture';

const L = lrc();
const TEXT = L.map((x) => x.text);
const MARKERS = L.map((x) => ({ time: x.t ?? 0 }));
const GENIUS = genius().map((b) => ({ label: b.label, type: b.kind, contentLines: b.lines }));
const mk = (ind: number[][]): ApplyBlock[] =>
  ind.map((s) => ({ lineIndices: [...s], contentLines: s.map((k) => TEXT[k]) }));
const stats = (b: ApplyBlock[]) => partitionStats(b.map((x) => x.lineIndices), TEXT.length);

describe('mode 2 сквозь wiring+apply · genuine overlap на реальных данных', () => {
  // Инжекция НАСТОЯЩЕГО overlap: Chorus 1 дополнительно заявляет строку 22,
  // которая принадлежит Interlude. Это не chrono-нарушение и не gap-fill.
  const withOverlap = () => LIVE_INDICES.map((s, i) => (i === 2 ? [...s, 22] : [...s]));

  it('W1 · дефект геометрии детектируется: dupes=[22], holes=[]', () => {
    const st = stats(mk(withOverlap()));
    expect(st.dupes).toEqual([22]);
    expect(st.holes).toEqual([]);
  });

  it('W2 · mode 2 применяется, геометрия вылечена, покрытие полное', () => {
    const blocks = mk(withOverlap());
    const rep = runC36Gate(blocks, GENIUS, TEXT, MARKERS);
    expect(rep.mode).toBe('overridden-by-validity');
    expect(rep.apply.verdict).toBe('applied');
    const st = stats(blocks);
    expect(st.dupes).toEqual([]);
    expect(st.holes).toEqual([]);
    expect(st.covered).toBe(54);
    expect(st.outOfBounds).toEqual([]);
  });

  it('W3 · шов починен и на этом пути: Interlude=[], Verse3=[22..31]', () => {
    const blocks = mk(withOverlap());
    runC36Gate(blocks, GENIUS, TEXT, MARKERS);
    expect(blocks[3].lineIndices).toEqual([]);
    expect(blocks[4].lineIndices).toEqual([22, 23, 24, 25, 26, 27, 28, 29, 30, 31]);
  });

  it('W4 · DOCUMENTED COARSENESS: mode 2 сплющивает gap-fill изменённых блоков', () => {
    // V1 в живом legacy = [0..9,12,15] (дырявый). Mode 2 берёт смежный диапазон
    // модели → [0..8]. Это осознанная грубость mode 2 (валидность важнее
    // атрибуции), в отличие от mode 2b, который трогает ровно 2 блока.
    const blocks = mk(withOverlap());
    runC36Gate(blocks, GENIUS, TEXT, MARKERS);
    expect(blocks[0].lineIndices).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(blocks[1].lineIndices).toEqual([9, 10, 11, 12, 13, 14, 15, 16, 17]);
  });

  it('W5 · contentLines опустевшего Interlude = исходный Genius и на mode 2', () => {
    const blocks = mk(withOverlap());
    runC36Gate(blocks, GENIUS, TEXT, MARKERS);
    expect(blocks[3].contentLines).toEqual(['Hey, yeah, yeah']);
  });
});

describe('mode 2b · границы применимости (документированные ограничения)', () => {
  it('W6 · ОДИН ремонт за вызов: второй шов остаётся (residual, BL-044)', () => {
    // Два независимых шва по паттерну I Disappear, разные лексиконы.
    const text = ['alpha beta gamma', 'delta epsilon zeta', 'hey', 'went',
      'chi psi omega', 'ohh', 'rising', 'tau upsilon phi', 'aaa bbb ccc', 'ddd eee fff'];
    const g = [
      { label: 'Verse 1', type: 'verse', contentLines: ['alpha beta gamma', 'delta epsilon zeta'] },
      { label: 'Interlude 1', type: 'interlude', contentLines: ['hey yeah'] },
      { label: 'Verse 2', type: 'verse', contentLines: ['hey went', 'chi psi omega'] },
      { label: 'Interlude 2', type: 'interlude', contentLines: ['ohh whoa'] },
      { label: 'Verse 3', type: 'verse', contentLines: ['ohh rising', 'tau upsilon phi'] },
      { label: 'Verse 4', type: 'verse', contentLines: ['aaa bbb ccc', 'ddd eee fff'] },
    ];
    const blocks: ApplyBlock[] = [[0, 1], [2], [3, 4], [5], [6, 7], [8, 9]]
      .map((s) => ({ lineIndices: [...s], contentLines: s.map((k) => text[k]) }));
    const rep = runC36Gate(blocks, g, text, text.map((_x, i) => ({ time: i })));
    expect(rep.mode).toBe('repaired-attribution');
    expect(rep.apply.changed).toEqual([1, 2]);          // первый шов
    expect(blocks[1].lineIndices).toEqual([]);
    expect(blocks[2].lineIndices).toEqual([2, 3, 4]);
    expect(blocks[3].lineIndices).toEqual([5]);         // ВТОРОЙ шов не тронут — residual
    expect(blocks[4].lineIndices).toEqual([6, 7]);
    const st = partitionStats(blocks.map((b) => b.lineIndices), text.length);
    expect(st.holes).toEqual([]);
    expect(st.dupes).toEqual([]);
  });

  it('W7 · починенный partition → wiring ИНЕРТЕН (идемпотентность на уровне адаптера)', () => {
    const blocks = mk(FIXED_INDICES);
    const snap = JSON.parse(JSON.stringify(blocks));
    const rep = runC36Gate(blocks, GENIUS, TEXT, MARKERS);
    // Фактический режим здесь — 'defer-unclean' (F16): пустой aux с непустым
    // Genius неотличим от NOT MAPPED на слое mode 1. Инертность важнее ярлыка.
    console.log('W7 mode on fixed baseline =', rep.mode);
    expect(rep.apply.verdict).toBe('noop-mode');
    expect(blocks).toEqual(snap);
  });
});
