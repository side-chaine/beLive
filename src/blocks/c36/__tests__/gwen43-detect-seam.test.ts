// GWEN43 · волна 2 — seam repair (file 09 §7, finding N6).
// RED до правки: gate() на интерливинге Unforgiven возвращает 'skipped-cost-only'
// (или mode 2), ремонта шва нет. GREEN после: mode 'repaired-seam', граница
// сдвинута с 49 на argmax-зазор k=47, разбиение 38..46 / 47..56 по построению.
//
// Числа — [ЗАМЕР] Гвен file 09 §4/§5, перепроверен 806 (VERIFY v3 §6):
//   MT 46=301.70, 47=314.41 (gap 12.71 ← argmax), 48=318.20, 49=327.77
//   (gap 9.57 ← прод-граница), 50=331.75, 51=341.89 (gap 10.14 ← второй).
//   confidence = 12.71/10.14 = 1.253 ≥ 1.2.
import { describe, it, expect } from 'vitest';
import { gate } from '../gate';
import { applyGatePartition, partitionStats } from '../apply';
import type { Dump, GeniusBlock, LegacyBlock, LrcLine } from '../parse';
import { LIVE_INDICES, FIXED_INDICES, rawDump } from './live-fixture';

//——————————————————————————————————————————————————————————————
// Самодостаточный дамп Unforgiven (57 строк) — реальные таймкоды из FACTS §2,
// реальная форма интерливинга: Chorus3=[38..48,50], Outro=[49,51..56].
//——————————————————————————————————————————————————————————————
const MT: Array<[number, number]> = [
  [0, 55.45], [1, 58.76], [2, 61.94], [3, 65.37], [4, 68.79], [5, 72.34], [6, 75.77], [7, 79.16],
  [8, 84.19], [9, 87.56], [10, 91], [11, 97.34], [12, 101.13], [13, 104.19], [14, 108.32], [15, 111.33],
  [16, 115.09], [17, 118.08], [18, 121.78], [19, 130.78], [20, 134.08], [21, 137.32], [22, 140.98],
  [23, 144.45], [24, 147.81], [25, 151.36], [26, 154.56], [27, 160.38], [28, 163.8], [29, 167.31],
  [30, 173.23], [31, 176.92], [32, 180.26], [33, 184.16], [34, 187.32], [35, 190.92], [36, 193.84],
  [37, 197.54], [38, 272.8], [39, 276.57], [40, 279.9], [41, 283.66], [42, 286.69], [43, 290.6],
  [44, 293.53], [45, 297.31], [46, 301.7], [47, 314.41], [48, 318.2], [49, 327.77], [50, 331.75],
  [51, 341.89], [52, 345.88], [53, 355.62], [54, 359.49], [55, 369.43], [56, 373.46],
];
const M = MT.length;

function idx(a: number, b: number): number[] {
  const out: number[] = [];
  for (let i = a; i <= b; i++) { out.push(i); }
  return out;
}

function makeDump(): { dump: Dump; sets: (number[] | null)[]; lines: string[] } {
  const lrcLines: LrcLine[] = MT.map(([i, t]) => ({ i, t, text: `line ${i}` }));
  const lines = lrcLines.map((l) => l.text);
  // 6 Genius-блоков; первые 4 сплошные (0..37), crossing только Chorus3/Outro.
  const shapes: Array<[string, string, number[]]> = [
    ['Verse 1', 'verse', idx(0, 9)],
    ['Chorus 1', 'chorus', idx(10, 19)],
    ['Verse 2', 'verse', idx(20, 29)],
    ['Chorus 2', 'chorus', idx(30, 37)],
    ['Chorus 3', 'chorus', [...idx(38, 48), 50]],
    ['Outro', 'outro', [49, ...idx(51, 56)]],
  ];
  const blocks: GeniusBlock[] = shapes.map(([label, kind, set]) => ({
    label, kind, lines: set.map((k) => lines[k]),
  }));
  const currentOutput: LegacyBlock[] = shapes.map(([, , set], i) => ({
    i, startIdx: Math.min(...set), endIdx: Math.max(...set), lines: set.length,
  }));
  const legacyLineSets = shapes.map(([, , set]) => [...set]);
  return { dump: { id: 'unforgiven-seam', lrcLines, geniusBlocks: blocks, currentOutput }, sets: legacyLineSets, lines };
}

describe('GWEN43 волна 2 · detectSeam / repaired-seam (file 09 §7)', () => {
  it('S1 · RED-ядро: интерливинг Unforgiven даёт mode=repaired-seam, граница k=47', () => {
    const { dump, sets } = makeDump();
    const g = gate(dump, { legacyLineSets: sets, mode3: false });
    expect(g.mode).toBe('repaired-seam');
    expect(g.changedIdx).toEqual([4, 5]);
    expect(g.blocks[4]).toEqual({ startIdx: 38, endIdx: 46 });
    expect(g.blocks[5]).toEqual({ startIdx: 47, endIdx: 56 });
  });

  it('S2 · инвариант покрытия: 9+10=19, дыр/дублей нет, пересечение ∅', () => {
    const { dump, sets } = makeDump();
    const g = gate(dump, { legacyLineSets: sets, mode3: false });
    const prev = idx(g.blocks[4]!.startIdx, g.blocks[4]!.endIdx);
    const next = idx(g.blocks[5]!.startIdx, g.blocks[5]!.endIdx);
    expect(prev).toEqual(idx(38, 46));
    expect(next).toEqual(idx(47, 56));
    expect(prev.length + next.length).toBe(19);
    expect(prev.filter((x) => next.includes(x))).toEqual([]);
    const all = [...prev, ...next].sort((a, b) => a - b);
    expect(all).toEqual(idx(38, 56));
  });

  it('S3 · apply-слой применяет repaired-seam (не noop-mode)', () => {
    const { sets, lines } = makeDump();
    const blocks = sets.map((s) => ({ lineIndices: [...(s ?? [])] }));
    const dump: Dump = {
      lrcLines: MT.map(([i, t]) => ({ i, t, text: lines[i] })),
      geniusBlocks: [
        { label: 'Verse 1', kind: 'verse', lines: blocks[0].lineIndices.map((k) => lines[k]) },
        { label: 'Chorus 1', kind: 'chorus', lines: blocks[1].lineIndices.map((k) => lines[k]) },
        { label: 'Verse 2', kind: 'verse', lines: blocks[2].lineIndices.map((k) => lines[k]) },
        { label: 'Chorus 2', kind: 'chorus', lines: blocks[3].lineIndices.map((k) => lines[k]) },
        { label: 'Chorus 3', kind: 'chorus', lines: blocks[4].lineIndices.map((k) => lines[k]) },
        { label: 'Outro', kind: 'outro', lines: blocks[5].lineIndices.map((k) => lines[k]) },
      ],
    };
    const g = gate(dump, { legacyLineSets: sets, mode3: false });
    const rep = applyGatePartition(blocks, g, { displayLines: lines });
    expect(rep.verdict).toBe('applied');
    expect(rep.changed).toEqual([4, 5]);
    expect(blocks[4].lineIndices).toEqual(idx(38, 46));
    expect(blocks[5].lineIndices).toEqual(idx(47, 56));
    const st = partitionStats(blocks.map((b) => b.lineIndices), M);
    expect(st.holes).toEqual([]);
    expect(st.dupes).toEqual([]);
  });

  it('S4 · НЕГАТИВ: I Disappear 2b fires первым → seam не вызывается, AC1c byte-exact', () => {
    // Живой I Disappear LIVE: 2b (attribution Interlude→Verse3) имеет приоритет.
    // detectSeam вызывается ТОЛЬКО при отказе 2b — здесь он не вызывается вовсе.
    const d = rawDump();
    const g = gate(d, { legacyLineSets: LIVE_INDICES.map((s) => (s.length ? [...s] : null)), mode3: false });
    expect(g.mode).toBe('repaired-attribution');
    expect(g.changedIdx).toEqual([3, 4]);
    const got = g.blocks.map((r) => (r ? idx(r.startIdx, r.endIdx) : []));
    expect(got).toEqual(FIXED_INDICES);
  });

  it('S5 · НЕГАТИВ: whole-block-out-of-order (спаны не вложены) → crossing False', () => {
    // Полное покрытие 0..19, чтобы геометрия была чистой и детектор реально
    // был вызван. Chorus целиком раньше Verse: min(prev)=0 < min(next)=10,
    // но max(prev)=9 < 10 → вложенного спана НЕТ, crossing=F.
    const lrcLines: LrcLine[] = MT.slice(0, 20).map(([i, t]) => ({ i, t, text: `line ${i}` }));
    const lines = lrcLines.map((l) => l.text);
    const dump: Dump = {
      lrcLines,
      geniusBlocks: [
        { label: 'Chorus', kind: 'chorus', lines: idx(0, 9).map((k) => lines[k]) },
        { label: 'Verse', kind: 'verse', lines: idx(10, 19).map((k) => lines[k]) },
      ],
    };
    const sets: (number[] | null)[] = [idx(0, 9), idx(10, 19)];
    const g = gate(dump, { legacyLineSets: sets, mode3: false });
    expect(g.mode).not.toBe('repaired-seam');
  });
});
