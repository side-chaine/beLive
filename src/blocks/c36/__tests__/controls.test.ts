// controls.test.ts — положительный и отрицательный контроль песочницы Центра_36.
// Порт /tmp/c36v12/tests/controls.test.js под vitest. Дампы импортируются как JSON
// (resolveJsonModule) — node: модули/typings недоступны в tsc-контексте репо.

import { describe, it, expect } from 'vitest';
import metallicaJson from './dumps/metallica-the-unforgiven-ii.json';
import mjJson from './dumps/mj-real.json';
import runawayJson from './dumps/runaway.json';

import { loadDump, containment, type Dump } from '../parse';
import { mmodel, validatePartition } from '../model';
import { gate } from '../gate';
import { compare, coverageStats } from '../metrics';

const FILES: Record<string, unknown> = {
  metallica: metallicaJson,
  mj: mjJson,
  runaway: runawayJson,
};

function load(name: string): Dump {
  return loadDump(FILES[name] as unknown as Dump);
}

// ── ПОЛОЖИТЕЛЬНЫЙ КОНТРОЛЬ ───────────────────────────────────────────────────

describe('controls — положительный контроль', () => {
  it('P1 · эталон через гейт: 12/12, покрытие 67/67, 0 дыр, 0 дублей', () => {
    const dump = load('metallica');
    const g = gate(dump);
    const cmp = compare(dump.expectedBlocks, g.blocks);
    expect(cmp.exact).toBe(12);
    const st = coverageStats(g.blocks, 67);
    expect(st.covered).toBe(67);
    expect(st.holes.length).toBe(0);
    expect(st.dupes.length).toBe(0);
    expect(g.mode).toBe('overridden');
  });

  it('P2 · Runaway через гейт: побайтовое совпадение с заморозкой, 9/9, без споров', () => {
    const dump = load('runaway');
    const g = gate(dump);
    expect(g.mode).toBe('no-disputes');
    const cmp = compare(dump.currentOutput, g.blocks);
    expect(cmp.exact).toBe(9);
  });

  it('P3 · MJ через гейт: defer-unclean, заморозка сохранена побайтово, Solo = 62..75', () => {
    const dump = load('mj');
    const g = gate(dump);
    expect(g.mode).toBe('defer-unclean');
    const cmp = compare(dump.currentOutput, g.blocks);
    expect(cmp.exact).toBe(16);
    const solo = g.blocks![12];
    expect([solo!.startIdx, solo!.endIdx]).toEqual([62, 75]);
  });

  it('P4 · пустой блок не получает строк, но получает таймспан (Solo: 226.46 → 280.15)', () => {
    const dump = load('metallica');
    const mm = mmodel(dump.geniusBlocks!, dump.lrcLines, {});
    expect(mm.blocks![7]).toBeNull();
    const span = mm.spans.find((s) => s.i === 7);
    expect(span).toBeTruthy();
    expect(span!.timeFromSec).toBe(226.46);
    expect(span!.timeToSec).toBe(280.15);
  });

  it('P5 · робастность: ±25% одиночного веса не меняет исход (ш Чёрные проверки)', () => {
    const dumpM = load('metallica'), dumpR = load('runaway'), dumpJ = load('mj');
    const dims: [string, number][] = [['wAnchor', 0.8], ['wAlign', 1.25], ['dropG', 0.8], ['dropL', 1.25], ['tailPen', 1.25], ['orphan', 0.8]];
    for (const [dim, factor] of dims) {
      const params: Record<string, number> = { [dim]: factor };
      expect(compare(dumpM.expectedBlocks, gate(dumpM, { params }).blocks).exact).toBe(12);
      expect(compare(dumpR.currentOutput, gate(dumpR, { params }).blocks).exact).toBe(9);
      expect(gate(dumpJ, { params }).mode).toBe('defer-unclean');
    }
  });

  it('P6 · три слепых шва: containment 1.0 на шовной и на золотой строке — текст не разделяет', () => {
    const dump = load('metallica');
    const sites: [number, number, number][] = [[2, 14, 15], [5, 31, 32], [9, 45, 46]]; // [blockIdx, seamLine, goldLine]
    for (const [bi, seam, gold] of sites) {
      const anchor = dump.geniusBlocks![bi].lines[0];
      const a = containment(anchor, dump.lrcLines[seam].text);
      const b = containment(anchor, dump.lrcLines[gold].text);
      expect(a).toBe(1.0);
      expect(b).toBe(1.0);
    }
  });
});

// ── ОТРИЦАТЕЛЬНЫЙ КОНТРОЛЬ ───────────────────────────────────────────────────

describe('controls — отрицательный контроль', () => {
  it('N1 · перемешанный LRC: гейт не падает, разбиение валидно, золото НЕ совпадает', () => {
    const dump = load('metallica');
    const shuffled = { ...dump, lrcLines: [...dump.lrcLines] };
    const texts = shuffled.lrcLines.map((l) => l.text);
    const permuted = [...texts];
    for (let i = permuted.length - 1; i > 0; i--) {
      const j = (i * 31 + 7) % (i + 1);
      [permuted[i], permuted[j]] = [permuted[j], permuted[i]];
    }
    shuffled.lrcLines = shuffled.lrcLines.map((l, i) => ({ ...l, text: permuted[i] }));
    const g = gate(shuffled);
    const cmp = compare(dump.expectedBlocks, g.blocks);
    expect(cmp.exact < 12).toBe(true);
    if (g.mode !== 'defer-unclean' && g.mode !== 'defer-invalid-result' && g.mode !== 'defer-model-failed') {
      expect(validatePartition(g.blocks, shuffled.geniusBlocks!, 67, null).length).toBe(0);
    }
  });

  it('N2 · пустой LRC: деградация без падения', () => {
    const dump = load('metallica');
    const mm = mmodel(dump.geniusBlocks!, []);
    expect(mm.degenerate).toBe(true);
    expect(mm.blocks!.filter((b) => b).length).toBe(0);
  });

  it('N3 · один блок Genius: весь трек одним блоком', () => {
    const lrc = [
      { i: 0, t: 0, text: 'alpha beta gamma' },
      { i: 1, t: 1, text: 'delta epsilon zeta' },
      { i: 2, t: 2, text: 'eta theta iota' },
    ];
    const blocks = [{ label: 'Verse 1', kind: 'verse', lines: ['alpha beta gamma', 'eta theta iota'] }];
    const mm = mmodel(blocks, lrc, {});
    expect([mm.blocks![0]!.startIdx, mm.blocks![0]!.endIdx]).toEqual([0, 2]);
  });

  it('N4 · все блоки пустые: ни один не получает строк, падения нет', () => {
    const lrc = [{ i: 0, t: 0, text: 'alpha beta' }, { i: 1, t: 1, text: 'gamma delta' }];
    const blocks = [
      { label: 'Intro', kind: 'intro', lines: [] },
      { label: 'Solo', kind: 'solo', lines: [] },
    ];
    const mm = mmodel(blocks, lrc, {});
    expect(mm.degenerate).toBe(true);
    expect(mm.blocks!.filter(Boolean).length).toBe(0);
  });

  it('N5 · единственная (недублированная) шовная строка: детерминизм и конвенция C2', () => {
    const lrc = [
      { i: 0, t: 0, text: 'alpha beta' },
      { i: 1, t: 1, text: 'beta gamma' },
      { i: 2, t: 2, text: 'gamma delta' },
    ];
    const blocks = [
      { label: 'A', kind: 'verse', lines: ['alpha beta', 'beta gamma'] },
      { label: 'B', kind: 'verse', lines: ['beta gamma', 'gamma delta'] },
    ];
    const mm = mmodel(blocks, lrc, {});
    expect([mm.blocks![0]!.startIdx, mm.blocks![0]!.endIdx]).toEqual([0, 0]);
    expect([mm.blocks![1]!.startIdx, mm.blocks![1]!.endIdx]).toEqual([1, 2]);
    expect(validatePartition(mm.blocks, blocks, 3, null).length).toBe(0);
  });

  it('N6 · NOT MAPPED защита: неоспоримые NOT MAPPED-блоки MJ не мапятся гейтом', () => {
    const dump = load('mj');
    const g = gate(dump);
    expect(g.blocks![13]).toBeNull();
    expect(g.blocks![14]).toBeNull();
  });

  it('N7 · датасет-инвариант: expectedBlocks покрывает 67 строк без пересечений (самопроверка золота)', () => {
    const dump = load('metallica');
    let cover = 0, prevEnd = -1;
    for (const b of dump.expectedBlocks!) {
      if (b.startIdx === null) {continue;}
      expect(b.startIdx > prevEnd).toBe(true);
      prevEnd = b.endIdx;
      cover += b.endIdx - b.startIdx + 1;
    }
    expect(cover).toBe(67);
  });
});
