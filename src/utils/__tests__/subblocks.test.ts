// BL-050-ui: слой вплавки движка в UI — roman-метки и ширина ∝ времени.
import { describe, it, expect } from 'vitest';
import { createSubBlocksSmart, subBlocksOf, subBlockWeights } from '../subblocks';
import type { SubBlock } from '../block-utils';

function sub(id: string, indices: number[]): SubBlock {
  return { id, lineIndices: indices, isFirst: false, isLast: false };
}

describe('createSubBlocksSmart · контур движка для UI', () => {
  it('GOLD: exact-train → roman I/II и юниты [6,3]', () => {
    const lines = [
      'a', 'b', 'c', 'a', 'b', 'c', 'x', 'y', 'z',
    ];
    const src = { lineIndices: lines.map((_, i) => i) };
    const { blocks, result } = createSubBlocksSmart(src, lines);
    expect(blocks.map((b) => b.lineIndices.length)).toEqual([6, 3]);
    expect(result.mode).toBe('exact-train');
    expect(result.roman).toEqual(['I', 'II']);
    expect(result.roman.length).toBe(blocks.length);
  });

  it('НЕГАТИВ: без logical-слоя движок идёт по LRC (fallback на различных строках)', () => {
    const lines = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const src = { lineIndices: lines.map((_, i) => i) };
    const { result } = createSubBlocksSmart(src, lines);
    expect(result.mode).toBe('fallback');
    expect(result.roman).toEqual(['I', 'II']);
  });

  it('ИНВАРИАНТ: подблоки покрывают блок без дыр и перекрытий', () => {
    const lines = ['a', 'b', 'c', 'a', 'b', 'c', 'x', 'y', 'z'];
    const src = { lineIndices: lines.map((_, i) => i) };
    const blocks = subBlocksOf(src, lines);
    const flat = blocks.flatMap((b) => b.lineIndices);
    expect(flat).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('пустой блок → пусто, без падения', () => {
    const { blocks, result } = createSubBlocksSmart({ lineIndices: [] }, []);
    expect(blocks).toEqual([]);
    expect(result.guard).toBe('empty');
  });
});

describe('subBlockWeights · ширина ∝ времени (У13)', () => {
  const subs = [sub('s0', [0, 1]), sub('s1', [2, 3]), sub('s2', [4, 5])];

  it('GOLD: веса = длительности юнитов, не число строк', () => {
    const t = new Map([[0, 0], [2, 10], [4, 25], [6, 40]]);
    const w = subBlockWeights(subs, (li) => t.get(li), 6);
    expect(w).toEqual([10, 15, 15]);
  });

  it('НЕГАТИВ: нет маркеров → все null (UI падает на число строк)', () => {
    const w = subBlockWeights(subs, () => undefined, 6);
    expect(w).toEqual([null, null, null]);
  });

  it('НЕГАТИВ: частичные маркеры → тоже все null (единицы не смешиваем)', () => {
    const t = new Map([[0, 0], [2, 10]]);
    const w = subBlockWeights(subs, (li) => t.get(li), 6);
    expect(w).toEqual([null, null, null]);
  });

  it('ИНВАРИАНТ: сумма весов = длительность блока', () => {
    const t = new Map([[0, 5], [2, 12], [4, 30], [6, 44]]);
    const w = subBlockWeights(subs, (li) => t.get(li), 6);
    expect((w as number[]).reduce((a, b) => a + b, 0)).toBe(39);
  });
});

describe('GWEN43 · wave0 вес-кап по инструментальному зазору', () => {
  // Гвен file 08 D6: волна 0 не зависит от шва/Period/gate. Хвостовой зазор
  // 75.26s (гитарное соло) и отсутствующий маркер last+1 не должны раздувать
  // последнюю пилюлю / давать все-null.
  const duo = [sub('s0', [0, 1]), sub('s1', [2, 3])];
  const D_MED = 3.675;

  it('RED: хвостовой зазор 75.26s капится до d_med, а не 85s', () => {
    // s1: первая строка 14.09, последняя 27.805, блок заканчивается на 103.35
    const t = new Map([[0, 0], [2, 14.09], [3, 27.805], [4, 103.35]]);
    const w = subBlockWeights(duo, (li) => t.get(li), 4, D_MED);
    expect(w?.[0]).toBeCloseTo(14.09, 2);
    expect(w?.[1]).toBeCloseTo(27.805 + D_MED - 14.09, 2); // 17.39, не 89.26
  });

  it('RED: отсутствующий маркер blockEndLine не даёт все-null', () => {
    const t = new Map([[0, 0], [2, 14.09], [3, 27.805]]);
    const w = subBlockWeights(duo, (li) => t.get(li), 4, D_MED);
    expect(w?.[0]).toBeCloseTo(14.09, 2);
    expect(w?.[1]).toBeCloseTo(27.805 + D_MED - 14.09, 2);
    expect(w?.some((v) => v == null)).toBe(false);
  });

  it('НЕГАТИВ: обычный зазор (< 4·d_med) не меняется', () => {
    const t = new Map([[0, 0], [2, 14.09], [3, 27.805], [4, 33]]);
    const w = subBlockWeights(duo, (li) => t.get(li), 4, D_MED);
    expect(w?.[0]).toBeCloseTo(14.09, 2);
    expect(w?.[1]).toBeCloseTo(33 - 14.09, 2); // 18.91 — кап НЕ применён
  });
});
