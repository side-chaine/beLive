// apply.test.ts — звуковость применения (KILLER-2). Центр_42, BL-042.
import { describe, it, expect } from 'vitest';
import { applyGatePartition, partitionStats, type ApplyBlock } from '../apply';
import type { GateResult } from '../gate';

const L = ['a', 'b', 'c', 'd', 'e', 'f'];
const mk = (...s: number[][]): ApplyBlock[] => s.map((x) => ({ lineIndices: [...x] }));
const G = (blocks: ({ startIdx: number; endIdx: number } | null)[], changedIdx: number[], extra: Partial<GateResult> = {}): GateResult =>
  ({ mode: 'repaired-attribution', blocks, changedIdx, ...extra });
const R = (s: number, e: number) => ({ startIdx: s, endIdx: e });

describe('apply · атомарность и откат', () => {
  it('P1 · неразрешённый режим → ни одна строка не тронута', () => {
    const b = mk([0, 1], [2, 3]); const snap = JSON.parse(JSON.stringify(b));
    const r = applyGatePartition(b, { mode: 'overridden', blocks: [R(0, 3), null], changedIdx: [0, 1] }, { displayLines: L });
    expect(r.verdict).toBe('noop-mode'); expect(b).toEqual(snap);
  });

  it('P2 · KILLER-2a: zero-width блок ОСВОБОЖДАЕТ строки (иначе overlap)', () => {
    const b = mk([0, 1], [2], [3, 4, 5]);
    const r = applyGatePartition(b, G([R(0, 1), null, R(2, 5)], [1, 2], { zeroWidth: [1] }), { displayLines: L });
    expect(r.verdict).toBe('applied');
    expect(b[1].lineIndices).toEqual([]);
    expect(b[2].lineIndices).toEqual([2, 3, 4, 5]);
    const st = partitionStats(b.map((x) => x.lineIndices), 6);
    expect(st.dupes).toEqual([]); expect(st.holes).toEqual([]);
  });

  it('P3 · опустеть может ТОЛЬКО zero-width → полный откат', () => {
    const b = mk([0, 1], [2], [3, 4, 5]); const snap = JSON.parse(JSON.stringify(b));
    const r = applyGatePartition(b, G([R(0, 1), null, R(2, 5)], [1, 2]), { displayLines: L });
    expect(r.verdict).toBe('rolled-back');
    expect(r.problems.join()).toMatch(/drops mapped block/);
    expect(b).toEqual(snap);
  });

  it('P4 · KILLER-2b: пустому в legacy блоку строки ВЫДАЮТСЯ', () => {
    const b = mk([0, 1], [], [4, 5]);
    const r = applyGatePartition(b, G([R(0, 1), R(2, 3), R(4, 5)], [1]), { displayLines: L });
    expect(r.verdict).toBe('applied');
    expect(b[1].lineIndices).toEqual([2, 3]);
    expect(partitionStats(b.map((x) => x.lineIndices), 6).holes).toEqual([]);
  });

  it('P5 · блоки ВНЕ changedIdx сохраняют РЕАЛЬНЫЕ дырявые индексы', () => {
    const b = mk([0, 2], [4, 5]);
    const r = applyGatePartition(b, G([R(0, 2), R(3, 5)], [1]), { displayLines: L });
    expect(r.verdict).toBe('applied');
    expect(b[0].lineIndices).toEqual([0, 2]);
    expect(b[1].lineIndices).toEqual([3, 4, 5]);
  });

  it('P6 · новая дыра → откат', () => {
    const b = mk([0, 1, 2], [3, 4, 5]); const snap = JSON.parse(JSON.stringify(b));
    const r = applyGatePartition(b, G([R(0, 1), R(3, 5)], [0], { zeroWidth: [] }), { displayLines: L });
    expect(r.verdict).toBe('rolled-back'); expect(b).toEqual(snap);
  });

  it('P7 · выход за границы → откат', () => {
    const b = mk([0, 1], [2, 3, 4, 5]);
    expect(applyGatePartition(b, G([R(0, 1), R(2, 9)], [1]), { displayLines: L }).verdict).toBe('rolled-back');
  });

  it('P8 · новый дубль → откат', () => {
    const b = mk([0, 1], [2, 3, 4, 5]); const snap = JSON.parse(JSON.stringify(b));
    const r = applyGatePartition(b, G([R(0, 2), R(2, 5)], [0]), { displayLines: L });
    expect(r.verdict).toBe('rolled-back'); expect(b).toEqual(snap);
  });

  it('P9 · contentLines: замапленный ≡ LRC, опустевший → ИСХОДНЫЙ Genius', () => {
    const b: ApplyBlock[] = [{ lineIndices: [0] }, { lineIndices: [1], contentLines: ['STOLEN LRC'] }, { lineIndices: [2, 3, 4, 5] }];
    applyGatePartition(b, G([R(0, 0), null, R(1, 5)], [1, 2], { zeroWidth: [1] }),
      { displayLines: L, geniusLines: [['a'], ['GENIUS AUX'], ['c']] });
    expect(b[2].contentLines).toEqual(['b', 'c', 'd', 'e', 'f']);
    expect(b[1].contentLines).toEqual(['GENIUS AUX']);
  });

  it('P10 · идемпотентность: повтор → noop-identical', () => {
    const b = mk([0, 1], [2], [3, 4, 5]);
    const g = G([R(0, 1), null, R(2, 5)], [1, 2], { zeroWidth: [1] });
    expect(applyGatePartition(b, g, { displayLines: L }).verdict).toBe('applied');
    const snap = JSON.parse(JSON.stringify(b));
    expect(applyGatePartition(b, g, { displayLines: L }).verdict).toBe('noop-identical');
    expect(b).toEqual(snap);
  });
});
