// BL-048 · GUARD CONTRACT (t76) — негативные тесты гвардов квадратов.
//
// Источник фактов: живой корпус 645 треков (results/run-2026-11-14T15-37-34-172Z.json,
// 339 332 окна), стейджинг 59/149/300/600 ЗАКРЫТ. Базовые числа (финал, 645 треков):
//   rule-D matched 3.9% · rondo g≥4 40.8%/59.2% · GGG k≥3 = 1839 (k=2:11343, k=3:1839)
//   tail-giant 1282 (0.38%) · anaphora-anchor 42.4% · unison-collapse 0.23%
//   font-guard [6,2] = 248 · echo 2.4%.
// (Промежуточные 310 треков: rondo 40/60, anaphora 33%, unison 0.38%, font-guard 89 —
//  см. переписку.) Эти числа — ЭМПИРИЧЕСКОЕ ОБОСНОВАНИЕ порогов; сами пороги
// пинятся ДЕТЕРМИНИРОВАННЫМИ тестами ниже (без сети), чтобы регрессия не могла
// тихо перевернуть g<4 в rondo, k<3 в collapse, или b<3a в tail-giant.
import { describe, it, expect } from 'vitest';
import { splitSquareRuleD } from '../../../utils/block-utils';
import { collectSquareStats, summarizeWindows } from '../corpus/square-corpus';
import iDisappearJson from './dumps/metallica-i-disappear.json';

const iLines: string[] = iDisappearJson.lrcLines.map((l: any) => l.text);

function rep(ch: string, n: number): string[] { return Array(n).fill(ch); }
function distinct(n: number): string[] {
  const a = 'abcdefghijklmnopqrstuvwxyz'.split('');
  return a.slice(0, n);
}
function idx(a: number, b: number): number[] {
  const out: number[] = [];
  for (let i = a; i <= b; i++) { out.push(i); }
  return out;
}

describe('BL-048 guard contract · rondo gmin=4', () => {
  it('POSITIVE: g=4 train (8 идентичных) → rondo (groupSize>=4)', () => {
    const r = splitSquareRuleD(idx(0, 7), rep('X', 8)); // 8 X → g=4, copies=2 → [4,4]
    expect(r.matched).toBe(true);
    expect(r.groupSize).toBe(4);
    expect(r.copies).toBe(2);
  });
  it('NEGATIVE: g=2 train ([a,b]×3) → [2,2,2] — ИСКЛЮЧЁН из rondo (gmin=4), но GGG k=3', () => {
    // brief §12.3: g=2/g=3-рефрены дают ложные [2,2,2,3] — rondo НЕ должен их брать.
    // Не идентичные строки (иначе g=3 перехватит первым по убыванию g).
    const r = splitSquareRuleD(idx(0, 5), ['a', 'b', 'a', 'b', 'a', 'b']);
    expect(r.matched).toBe(true);
    expect(r.split).toEqual([2, 2, 2]);
    expect(r.groupSize).toBe(2); // < 4 → rondoGte4 исключает
    expect(r.copies).toBe(3);    // ≥ 3 → GGG-collapse кандидат (независимый гвард)
  });
  it('NEGATIVE: I Disappear V1/V2 [6,3] (g=3) — НЕ rondo (gmin=4)', () => {
    const r = splitSquareRuleD(idx(0, 8), iLines);
    expect(r.matched).toBe(true);
    expect(r.groupSize).toBe(3);
    expect(r.copies).toBe(2);
  });
});

describe('BL-048 guard contract · GGG k>=3 collapse', () => {
  it('POSITIVE: [a,b,c]×3 → [3,3,3], k=3 → GGG-collapse кандидат', () => {
    // Периодические, но не идентичные (иначе g=4 перехватит первым).
    const r = splitSquareRuleD(idx(0, 8), ['a', 'b', 'c', 'a', 'b', 'c', 'a', 'b', 'c']);
    expect(r.matched).toBe(true);
    expect(r.split).toEqual([3, 3, 3]);
    expect(r.copies).toBe(3);
  });
  it('NEGATIVE: [6,3] (k=2) — НЕ должен коллапсироваться (k<3)', () => {
    const r = splitSquareRuleD(idx(0, 8), rep('X', 6).concat(['d', 'e', 'f']));
    expect(r.matched).toBe(true);
    expect(r.split).toEqual([6, 3]);
    expect(r.copies).toBe(2); // < 3 → не GGG
  });
});

describe('BL-048 guard contract · tail-giant b>=3a', () => {
  it('POSITIVE: square=4 + tail=12 → tail-giant (b>=3a)', () => {
    const lines = rep('X', 4).concat(distinct(12)); // [XXXX + 12 различных], 16 строк
    const stats = collectSquareStats(lines, { minSize: 6, maxSize: 20 });
    expect(stats.some((s) => s.tailGiant)).toBe(true);
  });
  it('NEGATIVE: [6,3] tail(3) < 3*6 — НЕ tail-giant', () => {
    const r = splitSquareRuleD(idx(0, 8), iLines);
    expect(r.split[1] >= 3 * r.split[0]).toBe(false);
  });
  it('NEGATIVE: [6,2] tail(2) < 3*6 — НЕ tail-giant', () => {
    const r = splitSquareRuleD(idx(0, 7), rep('X', 6).concat(['d', 'e']));
    expect(r.split).toEqual([6, 2]);
    expect(r.split[1] >= 3 * r.split[0]).toBe(false);
  });
});

describe('BL-048 guard contract · font-guard [6,2]', () => {
  it('layout [6,2] детектится (3×2-строковая группа + хвост 2)', () => {
    // [a,b]×3 + хвост [c,d] → g=2, copies=3, square=6, tail=2 → [6,2].
    const r = splitSquareRuleD(idx(0, 7), ['a', 'b', 'a', 'b', 'a', 'b', 'c', 'd']);
    expect(r.matched).toBe(true);
    expect(r.split).toEqual([6, 2]);
    expect(r.groupSize).toBe(2);
    expect(r.copies).toBe(3);
  });
});

describe('BL-048 guard contract · partition invariants (regression on real dump)', () => {
  it('счётчики гвардов точно партиционируют matched-окна (I Disappear, 6..20)', () => {
    const stats = collectSquareStats(iLines, { minSize: 6, maxSize: 20 });
    const agg = summarizeWindows(stats, 'I Disappear');
    // каждое matched-окно либо чистый rondo (g>=4), либо ложный риск (g<4)
    expect(agg.rondoGte4 + agg.rondoLt4).toBe(agg.ruleDMatched);
    expect(agg.gggKge3).toBeLessThanOrEqual(agg.ruleDMatched);
    // V1+V2 ([6,3], g=3) гарантированно сидят в rondoLt4, не в rondoGte4
    expect(agg.rondoLt4).toBeGreaterThanOrEqual(2);
  });
});
