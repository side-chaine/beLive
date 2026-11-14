// t72-mutation.test.ts — MUTATION-ОРАКУЛ (Q6). Центр_42, BL-042.
// baseline = починенный partition; инжектим известный дефект → harness обязан
// вернуть РОВНО baseline.
import { describe, it, expect } from 'vitest';
import { gate } from '../gate';
import { applyGatePartition, partitionStats } from '../apply';
import { genius, lrc, setsOf, blocksOf, LIVE_INDICES, FIXED_INDICES } from './live-fixture';
import type { Dump, LegacyBlock } from '../parse';

const G = genius(), L = lrc(), TEXT = L.map((x) => x.text);

function dumpOf(ind: number[][]): Dump {
  const currentOutput: LegacyBlock[] = ind.map((s, i) => s.length
    ? { i, startIdx: Math.min(...s), endIdx: Math.max(...s), lines: s.length }
    : { i, startIdx: null, endIdx: null, lines: 0 });
  return { lrcLines: L, geniusBlocks: G, currentOutput };
}
function repair(ind: number[][]) {
  const blocks = blocksOf(ind, TEXT);
  const g = gate(dumpOf(ind), { legacyLineSets: setsOf(ind), mode3: false });
  const rep = applyGatePartition(blocks, g, { displayLines: TEXT, geniusLines: G.map((b) => b.lines) });
  return { g, rep, out: blocks.map((b) => [...b.lineIndices]) };
}
function steal(k: number): number[][] {
  return LIVE_INDICES.map((s, i) => {
    if (i === 3) { return FIXED_INDICES[4].slice(0, k); }
    if (i === 4) { return FIXED_INDICES[4].slice(k); }
    return [...s];
  });
}

describe('mutation-оракул · N10 inject → repair → byte-equal baseline', () => {
  it('M1 · инъекция 1 строки (реальный LIVE-дефект) → ровно baseline', () => {
    const mut = steal(1);
    expect(mut).toEqual(LIVE_INDICES);
    const { g, rep, out } = repair(mut);
    expect(g.mode).toBe('repaired-attribution');
    expect(rep.verdict).toBe('applied');
    expect(out).toEqual(FIXED_INDICES);
  });

  it('M2 · инъекция 2 строк → ровно baseline', () => {
    const { rep, out } = repair(steal(2));
    expect(rep.verdict).toBe('applied');
    expect(out).toEqual(FIXED_INDICES);
  });

  it('M3 · baseline НЕ мутирован → ремонта нет, byte-exact (regression-rate 0)', () => {
    const { rep, out } = repair(FIXED_INDICES);
    expect(['noop-mode', 'noop-identical']).toContain(rep.verdict);
    expect(out).toEqual(FIXED_INDICES);
  });

  it('M4 · POISON: aux получает своё точное свидетельство → ремонта НЕТ', () => {
    const g2 = G.map((b, i) => (i === 3 ? { ...b, lines: [TEXT[22]] } : b));
    const ind = steal(1);
    const blocks = blocksOf(ind, TEXT);
    const d: Dump = { lrcLines: L, geniusBlocks: g2, currentOutput: dumpOf(ind).currentOutput };
    const gg = gate(d, { legacyLineSets: setsOf(ind), mode3: false });
    const rep = applyGatePartition(blocks, gg, { displayLines: TEXT });
    expect(['noop-mode', 'noop-identical']).toContain(rep.verdict);
    expect(blocks.map((b) => b.lineIndices)).toEqual(ind);
  });

  it('M5 · «не хуже» на всех мутациях: дыры/дубли не растут, чужие блоки не пустеют', () => {
    for (const k of [1, 2]) {
      const ind = steal(k);
      const before = partitionStats(ind, TEXT.length);
      const { out } = repair(ind);
      const after = partitionStats(out, TEXT.length);
      expect(after.holes.length).toBeLessThanOrEqual(before.holes.length);
      expect(after.dupes.length).toBeLessThanOrEqual(before.dupes.length);
      for (let i = 0; i < out.length; i++) {
        if (i !== 3 && ind[i].length > 0) { expect(out[i].length, `block ${i} emptied`).toBeGreaterThan(0); }
      }
    }
  });

  it('M6 · инвариант локальности: изменены РОВНО [3,4] ни при одной мутации', () => {
    for (const k of [1, 2]) {
      const { g } = repair(steal(k));
      expect(g.changedIdx).toEqual([3, 4]);
    }
  });
});
