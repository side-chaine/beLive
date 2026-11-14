// BL-050-lite (rule D, exact LRC train, NO wiring): чистая функция
// splitSquareRuleD → [6,3] для I Disappear V1/V2, FALLBACK иначе.
import { describe, it, expect } from 'vitest';
import { splitSquareRuleD } from '../../../utils/block-utils';
import iDisappearJson from './dumps/metallica-i-disappear.json';
import mjJson from './dumps/mj-real.json';

const iLines: string[] = iDisappearJson.lrcLines.map((l: any) => l.text);
const mjLines: string[] = mjJson.lrcLines.map((l: any) => l.text);

function indices(a: number, b: number): number[] {
  const out: number[] = [];
  for (let i = a; i <= b; i++) { out.push(i); }
  return out;
}

function sum(parts: number[]): number {
  return parts.reduce((s, x) => s + x, 0);
}

describe('BL-050-lite · rule D exact train', () => {
  it('I Disappear V1 (idx 0..8) → [6,3] (2 копии группы 3 + хвост 3)', () => {
    const r = splitSquareRuleD(indices(0, 8), iLines);
    expect(r.matched).toBe(true);
    expect(r.groupSize).toBe(3);
    expect(r.copies).toBe(2);
    expect(r.split).toEqual([6, 3]);
    expect(sum(r.split)).toBe(9);
  });

  it('I Disappear V2 (idx 9..17) → [6,3] (2 копии группы 3 + хвост 3)', () => {
    const r = splitSquareRuleD(indices(9, 17), iLines);
    expect(r.matched).toBe(true);
    expect(r.groupSize).toBe(3);
    expect(r.copies).toBe(2);
    expect(r.split).toEqual([6, 3]);
    expect(sum(r.split)).toBe(9);
  });

  it('Chorus (idx 18..21, 4 строки) → FALLBACK [4] (n<6, не делим)', () => {
    const r = splitSquareRuleD(indices(18, 21), iLines);
    expect(r.matched).toBe(false);
    expect(r.split).toEqual([4]);
  });

  it('Chorus 1 (idx 22..31, 10 строк) → FALLBACK [4,6], НЕ [6,4] (lite = точный, без near-θ)', () => {
    // Строка 26 «And I went down» ≠ строка 23 «And I went» → точный поезд не
    // срабатывает. [6,4] даёт BL-050-FULL через near-θ (У8), НЕ lite.
    const r = splitSquareRuleD(indices(22, 31), iLines);
    expect(r.matched).toBe(false);
    expect(r.split).toEqual([4, 6]);
    expect(sum(r.split)).toBe(10);
  });

  it('MJ Verse 2 (8 различных строк) → FALLBACK [4,4] (нет повтора g≥2)', () => {
    // mj-real.json: Verse 2 = idx 15..22, все строки различны.
    const r = splitSquareRuleD(indices(15, 22), mjLines);
    expect(r.matched).toBe(false);
    expect(r.split).toEqual([4, 4]);
    expect(sum(r.split)).toBe(8);
  });

  it('FALLBACK нулевой регрессии: повторяет computeBalancedSplit для случайного блока', () => {
    // 7 различных строк → FALLBACK должен дать [3,4] как computeBalancedSplit(7).
    const distinct = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    const r = splitSquareRuleD(indices(0, 6), distinct);
    expect(r.matched).toBe(false);
    expect(r.split).toEqual([3, 4]);
  });
});
