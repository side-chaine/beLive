// bl049.test.ts — §12.6 governance (BL-049 v2). 8 ячеек по контракту §6-тест.
// learningDisabled = true (без обучения поведение детерминировано).
// Только классы/паттерны, 0 хардкода имён треков.
import { describe, it, expect } from 'vitest';
import {
  splitSquareFull,
  isValidLrcProjection,
  type SquareFullResult,
  type SquareMode,
} from '../square-full';
import {
  routeDecision,
  computeEffConf,
  runDualOracle,
  unitsAgree,
  type LearnedState,
} from '../bl049-router';
import { LearnedSplitStore } from '../learned-splits';
import { projectLineLink, LineLink } from '../../../sync/word-sync/line-link';

function mkResult(over: Partial<SquareFullResult>): SquareFullResult {
  return {
    mode: 'near-train' as SquareMode,
    units: [],
    roman: [],
    conf: 0,
    tRatio: null,
    groupSize: 0,
    copies: 0,
    guard: null,
    ...over,
  };
}

describe('BL-049 · роутинг §2', () => {
  // 1. anaphora → AI (не auto/human)
  it('anaphora → ai (эксплицитный dual-oracle тир)', () => {
    const r = mkResult({ mode: 'anaphora', conf: 0.55, tRatio: 2.1 });
    const d = routeDecision({ result: r });
    expect(d).toBe('ai');
    expect(d).not.toBe('auto');
    expect(d).not.toBe('human');
  });

  // 2. isochrony-fail: near tRatio=2.1 → без +0.1; anaphora → ai (не auto)
  it('isochrony-fail: нет двойного бампа, anaphora не уходит в auto', () => {
    const near = mkResult({ mode: 'near-train', conf: 0.75, tRatio: 2.1 });
    // Роутер бамп НЕ навешивает: effConf === result.conf.
    expect(computeEffConf(near)).toBe(0.75);
    expect(routeDecision({ result: near })).toBe('auto');

    const ana = mkResult({ mode: 'anaphora', conf: 0.55, tRatio: 2.1 });
    // anaphora форсируется 0.55 без бампа → AI-тир (не auto).
    expect(computeEffConf(ana)).toBe(0.55);
    expect(routeDecision({ result: ana })).toBe('ai');
  });

  // 3. dual-oracle-disagree → human
  it('dual-oracle: разногласие → human', () => {
    const r = mkResult({ mode: 'anaphora', conf: 0.55, tRatio: null });
    const unitsA = [6, 3];
    const unitsB = [4, 5];
    const out = runDualOracle(unitsA, unitsB, 9, 'anaphora');
    expect(out.agreed).toBe(false);
    expect(routeDecision({ result: r, dualOracle: out })).toBe('human');
  });

  // 4. dual-oracle-both-wrong → human (согласие есть, но проекция невалидна)
  it('dual-oracle: оба сошлись на невалидном → human', () => {
    const r = mkResult({ mode: 'anaphora', conf: 0.55, tRatio: null });
    const unitsA = [6, 3];
    const unitsB = [6, 3];
    // n=20, но сумма units=9 → проекция не покрывает n → invalid.
    const out = runDualOracle(unitsA, unitsB, 20, 'anaphora');
    expect(out.agreed).toBe(true);
    expect(out.valid).toBe(false);
    expect(routeDecision({ result: r, dualOracle: out })).toBe('human');
  });

  // 5. learned-cell: seeded → correctUnits; no-learn guard → null (обычный train)
  it('learned: seeded даёт units; learningDisabled → null (негатив)', () => {
    const store = new LearnedSplitStore();
    store.setDisabled(false);

    const learned = mkResult({
      mode: 'near-train', conf: 0.75, units: [4, 4], groupSize: 4, copies: 2,
    });
    const key = LearnedSplitStore.patternKey(learned);
    store.record(learned);
    const hit = store.resolve(key, 8);
    expect(hit).not.toBeNull();
    expect(hit!.units).toEqual([4, 4]); // correctUnits

    // no-learn guard (learningDisabled=true) → learned НЕ подставляется.
    store.setDisabled(true);
    expect(store.resolve(key, 8)).toBeNull();
  });

  // 6. learned-lockin-override: запертый неверный learned → human-override освобождает
  it('learned-lockin-override: invalidate освобождает залоченный hit', () => {
    const store = new LearnedSplitStore();
    store.setDisabled(false);
    const learned = mkResult({
      mode: 'near-train', conf: 0.75, units: [4, 4], groupSize: 4, copies: 2,
    });
    const key = LearnedSplitStore.patternKey(learned);
    // два наблюдения → confirmed (min-observations) → lock-in.
    store.record(learned);
    store.record(learned);
    const hit = store.resolve(key, 8);
    expect(hit).not.toBeNull();
    const state: LearnedState = LearnedSplitStore.toLearnedState(hit!);
    expect(state.confirmed).toBe(true);
    expect(routeDecision({ result: learned, learned: state })).toBe('auto');

    // human-override снимает lock → resolve null → роутинг освобождён.
    store.invalidate(key);
    expect(store.resolve(key, 8)).toBeNull();
  });

  // 7. S19-removed: 'S19' никогда не эмитится; fallback/guard-rejected → human
  it('S19-removed: гвард S19 отсутствует, fallback → human', () => {
    // Через движок: ни один результат не несёт гвард 'S19'.
    const lines = [
      'a b c', 'd e f', 'g h i', 'j k l', 'm n o', 'p q r', 's t u', 'v w x',
    ];
    const idxs = lines.map((_, i) => i);
    for (const n of [6, 7, 8]) {
      const res = splitSquareFull(idxs.slice(0, n), lines.slice(0, n));
      expect(res.guard).not.toBe('S19');
    }

    // fallback с guard-rejected → human (ветка 3 таблицы).
    const fb = mkResult({ mode: 'fallback', conf: 0, guard: 'guard-rejected' });
    expect(routeDecision({ result: fb })).toBe('human');

    // 'S19' НЕ магический гвард: только mode/conf управляют роутингом.
    const withS19 = mkResult({ mode: 'near-train', conf: 0.75, guard: 'S19' });
    expect(routeDecision({ result: withS19 })).toBe('auto');
  });

  // 8. isValidLrcProjection-shared: консистентен между движком и LineLink
  it('isValidLrcProjection-shared: движок и LineLink согласны', () => {
    const cases: Array<{ bounds: number[]; n: number; valid: boolean }> = [
      { bounds: [0, 3, 6, 9], n: 9, valid: true },
      { bounds: [0, 3, 3, 9], n: 9, valid: false }, // не строго возрастает
      { bounds: [0, 3, 6], n: 9, valid: false }, // последняя != n
      { bounds: [1, 3, 6, 9], n: 9, valid: false }, // не начинается с 0
    ];
    for (const c of cases) {
      const engine = isValidLrcProjection(c.bounds, c.n);
      const link = projectLineLink(c.bounds, c.n);
      expect(engine).toBe(c.valid);
      expect(link.status === 'valid').toBe(c.valid);
      expect(link.bounds === null).toBe(!c.valid);
    }
    // LineLink (class) даёт тот же результат, что предикат.
    const ll = new LineLink([0, 4, 8], 8);
    expect(ll.status).toBe('valid');
    expect(ll.bounds).toEqual([0, 4, 8]);
    expect(isValidLrcProjection([0, 4, 8], 8)).toBe(true);
    // семья архетипов: перестановка → согласие.
    expect(unitsAgree([6, 3], [3, 6])).toBe(true);
    expect(unitsAgree([6, 3], [6, 4])).toBe(false);
  });
});
