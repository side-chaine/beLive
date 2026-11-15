// BL-050-full: полный сплиттер (rule D на логических + near-θ + вторичные
// предикаты + min-containment + GIGO). Каждая ячейка = позитивный gold +
// негативный контроль + инвариант разбиения (диспатч CEO_Orch, §12.4/§12.8).
import { describe, it, expect } from 'vitest';
import {
  splitSquareFull,
  createSubBlocksFull,
  exactTrain,
  nearTrain,
  rondoTrain,
  lineSimilarity,
  CONF,
  NEAR_THETA,
} from '../square-full';
import { createSubBlocks } from '../../../utils/block-utils';
import iDisappearJson from './dumps/metallica-i-disappear.json';
import mjJson from './dumps/mj-real.json';

const iLines: string[] = iDisappearJson.lrcLines.map((l: any) => l.text);
const mjLines: string[] = mjJson.lrcLines.map((l: any) => l.text);

function idx(a: number, b: number): number[] {
  const out: number[] = [];
  for (let i = a; i <= b; i++) { out.push(i); }
  return out;
}

const sum = (xs: number[]): number => xs.reduce((s, x) => s + x, 0);

/** Инвариант любого результата: покрытие без дыр, ≤4 юнита, римские 1:1. */
function assertInvariant(units: number[], roman: string[], n: number): void {
  expect(sum(units)).toBe(n);
  expect(units.every((u) => u > 0)).toBe(true);
  expect(units.length).toBeLessThanOrEqual(4);
  expect(roman.length).toBe(units.length);
  expect(new Set(roman).size).toBe(roman.length);
}

describe('BL-050-full · exact-train (gold §12.8)', () => {
  it('I Disappear V1 (0..8) → [6,3], conf 0.95', () => {
    const r = splitSquareFull(idx(0, 8), iLines);
    expect(r.mode).toBe('exact-train');
    expect(r.units).toEqual([6, 3]);
    expect(r.groupSize).toBe(3);
    expect(r.copies).toBe(2);
    expect(r.conf).toBeCloseTo(CONF.exactTrain, 5);
    expect(r.roman).toEqual(['I', 'II']);
    assertInvariant(r.units, r.roman, 9);
  });

  it('I Disappear V2 (9..17) → [6,3]', () => {
    const r = splitSquareFull(idx(9, 17), iLines);
    expect(r.mode).toBe('exact-train');
    expect(r.units).toEqual([6, 3]);
    assertInvariant(r.units, r.roman, 9);
  });
});

describe('BL-050-full · near-train θ (V3/Chorus 1 → [6,4])', () => {
  it('Chorus 1 (22..31) → [6,4] через near-θ (не exact)', () => {
    const r = splitSquareFull(idx(22, 31), iLines);
    expect(r.mode).toBe('near-train');
    expect(r.units).toEqual([6, 4]);
    expect(r.groupSize).toBe(3);
    expect(r.conf).toBeCloseTo(CONF.nearTrain, 5);
    assertInvariant(r.units, r.roman, 10);
  });

  it('НЕГАТИВ: min-containment, а не Жаккар — «and i went» ⊂ «and i went down»', () => {
    expect(lineSimilarity('and i went', 'and i went down')).toBe(1);
    // Жаккар дал бы 2/3 = 0.667 < θ → группа бы не собралась.
  });

  it('НЕГАТИВ: далёкие строки ниже θ → near не срабатывает', () => {
    const t = ['alpha beta', 'gamma delta', 'epsilon zeta', 'eta theta',
      'iota kappa', 'lambda mu', 'nu xi', 'omicron pi'];
    expect(nearTrain(t, NEAR_THETA)).toBeNull();
  });

  it('strict-якорь (дефолт): g=2 с одной fuzzy-строкой → НЕ near (weak не доказательство)', () => {
    // Sad But True: 2-строчная группа, совпала 1 строка из 2 (exact=0.5).
    const t = [
      'hey im your life', 'im the one who takes you there',
      'hey im your life', 'im the one who cares',
      'different line here', 'another line here',
    ];
    expect(nearTrain(t, NEAR_THETA)).toBeNull();          // strict по умолчанию
    expect(nearTrain(t, NEAR_THETA, false)).not.toBeNull(); // loose — opt-out для диагностики
    const r = splitSquareFull(idx(0, 5), t);
    expect(r.mode).not.toBe('near-train');
    assertInvariant(r.units, r.roman, 6);
  });
});

describe('BL-050-full · вторичные предикаты §12.4', () => {
  it('closed square + addition: 6 строк [0,1]==[2,3] → [4,2], conf 0.70', () => {
    const t = ['a', 'b', 'a', 'b', 'c', 'd'];
    const r = splitSquareFull(idx(0, 5), t);
    expect(r.mode).toBe('pair-exact-square');
    expect(r.units).toEqual([4, 2]);
    expect(r.conf).toBeCloseTo(CONF.pairExactSquare, 5);
    assertInvariant(r.units, r.roman, 6);
  });

  it('рондо S20: [G4]-вставка-[G4]-хвост → [4,3,4,3], conf 0.65', () => {
    const G = ['g1', 'g2', 'g3', 'g4'];
    const t = [...G, 'i1', 'i2', 'i3', ...G, 't1', 't2', 't3'];
    const r = splitSquareFull(idx(0, 13), t);
    expect(r.mode).toBe('rondo');
    expect(r.units).toEqual([4, 3, 4, 3]);
    expect(r.conf).toBeCloseTo(CONF.rondo, 5);
    assertInvariant(r.units, r.roman, 14);
  });

  it('НЕГАТИВ: рондо g=2 НЕ классифицируется (rondo gmin=4)', () => {
    const t = ['a', 'b', 'x', 'a', 'b', 'y'];
    expect(rondoTrain(t)).toBeNull();
    expect(splitSquareFull(idx(0, 5), t).mode).not.toBe('rondo');
  });
});

describe('BL-050-full · GIGO-гварды', () => {
  it('unison-collapse: 8 идентичных → один юнит [8], conf 0.95', () => {
    const t = Array(8).fill('same line');
    const r = splitSquareFull(idx(0, 7), t);
    expect(r.mode).toBe('unison');
    expect(r.units).toEqual([8]);
    expect(r.conf).toBeCloseTo(CONF.unison, 5);
    assertInvariant(r.units, r.roman, 8);
  });

  it('GGG-collapse: k=3 повторов группы 4 → единый [12], guard ggg-collapse', () => {
    const G = ['g1', 'g2', 'g3', 'g4'];
    const t = [...G, ...G, ...G];
    const r = splitSquareFull(idx(0, 11), t);
    expect(r.guard).toBe('ggg-collapse');
    expect(r.units).toEqual([12]);
    expect(r.copies).toBe(3);
    assertInvariant(r.units, r.roman, 12);
  });

  it('НЕГАТИВ: k=2 НЕ коллапсируется → [4,4]', () => {
    const G = ['g1', 'g2', 'g3', 'g4'];
    const r = splitSquareFull(idx(0, 7), [...G, ...G]);
    expect(r.guard).not.toBe('ggg-collapse');
    expect(r.units).toEqual([4, 4]);
  });

  it('tail-giant b≥3a: [4,12] отклоняется → FALLBACK computeBalancedSplit', () => {
    const t = ['x', 'x', 'x', 'x', 'a', 'b', 'c', 'd',
      'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l'];
    const r = splitSquareFull(idx(0, 15), t);
    expect(r.mode).toBe('fallback');
    expect(r.guard).toBe('guard-rejected');
    assertInvariant(r.units, r.roman, 16);
  });

  it('n<6 → fallback [n], guard n<6', () => {
    const r = splitSquareFull(idx(0, 3), ['a', 'b', 'c', 'd']);
    expect(r.mode).toBe('fallback');
    expect(r.guard).toBe('n<6');
    expect(r.units).toEqual([4]);
  });

  it('MJ Verse 2 (15..22, 8 различных) → [4,4], без exact/near', () => {
    const r = splitSquareFull(idx(15, 22), mjLines);
    expect(r.units).toEqual([4, 4]);
    expect(['exact-train', 'near-train']).not.toContain(r.mode);
    assertInvariant(r.units, r.roman, 8);
  });
});

describe('BL-050-full · logical → LRC align (§12.1 В10 / К1)', () => {
  it('rule D по логическим строкам маппится на границу LRC-группы', () => {
    // 12 LRC-строк, 4 логических (S18: 1 логич. = 3 LRC).
    const lrc = ['l0', 'l1', 'l2', 'l3', 'l4', 'l5', 'l6', 'l7', 'l8', 'l9', 'l10', 'l11'];
    const logical = ['a', 'b', 'a', 'b'];       // 2 копии группы 2
    const logicalToLrc = [0, 3, 6, 9];
    const r = splitSquareFull(idx(0, 11), lrc, { logicalLines: logical, logicalToLrc });
    expect(r.mode).toBe('pair-exact-square');   // g=2 → closed square + addition
    expect(r.units).toEqual([6, 6]);            // логич. [4] → LRC [6,6]
    assertInvariant(r.units, r.roman, 12);
  });

  it('НЕГАТИВ: невалидный маппинг (немонотонный) → fallback, не падение', () => {
    const lrc = Array.from({ length: 12 }, (_, i) => `l${i}`);
    const r = splitSquareFull(idx(0, 11), lrc, {
      logicalLines: ['a', 'b', 'a', 'b'],
      logicalToLrc: [0, 6, 3, 9],               // 6 → 3 немонотонно
    });
    expect(r.mode).toBe('fallback');
    assertInvariant(r.units, r.roman, 12);
  });
});

describe('BL-050-full · wiring createSubBlocksFull', () => {
  it('I Disappear V1 → 2 подблока [6,3] + контур exact-train', () => {
    const { blocks, result } = createSubBlocksFull(idx(0, 8), iLines);
    expect(blocks.map((b) => b.lineIndices.length)).toEqual([6, 3]);
    expect(blocks[0].isFirst).toBe(true);
    expect(blocks[1].isLast).toBe(true);
    expect(result.mode).toBe('exact-train');
  });

  it('НЕГАТИВ: forcedSplit с неверным покрытием игнорируется (zero-regression)', () => {
    // Покрытие 5 ≠ 9 → forced отбрасывается, balanced [4,5].
    const { blocks } = createSubBlocksFull(idx(0, 8), iLines, {});
    expect(blocks.map((b) => b.lineIndices.length)).toEqual([6, 3]);
    const legacy = createSubBlocks(idx(0, 8), 6, iLines);
    expect(legacy.map((b) => b.lineIndices.length).reduce((a, b) => a + b, 0)).toBe(9);
  });
});

describe('BL-050-full · инварианты', () => {
  it('exactTrain выбирает наибольший g с ≥2 копиями', () => {
    const t = ['a', 'b', 'c', 'a', 'b', 'c', 'a', 'b', 'c'];
    const tr = exactTrain(t);
    expect(tr?.groupSize).toBe(3);
    expect(tr?.copies).toBe(3);
  });

  it('конф-тиры §12.6 монотонны: exact > near > pair > rondo > anaphora > fallback', () => {
    const tiers = [CONF.exactTrain, CONF.nearTrain, CONF.pairExactSquare, CONF.rondo, CONF.anaphora, CONF.fallback];
    for (let i = 1; i < tiers.length; i++) { expect(tiers[i]).toBeLessThan(tiers[i - 1]); }
  });
});
