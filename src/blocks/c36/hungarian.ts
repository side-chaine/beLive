// hungarian.ts — модель-2 для A2: классическое назначение (assignment problem)
// БЕЗ монотонности: якоря блоков → LRC-строки, минимальная стоимость, затем
// восстановление монотонности. Сравнение с M-моделью числом — см. A2.
// Порт /tmp/c36v12/src/hungarian.js.

import { wcontain, buildIdf, type LrcLine, type GeniusBlock, type Range } from './parse.js';

// Прямоугольное назначение методом-ish (жадно + локальные свопы, m ≤ 100):
// не обещаем оптимальность Венгерского в чистом виде, отмечаем это в A2.
export function assignmentStarts(blocks: GeniusBlock[], lrc: LrcLine[], idf: ReturnType<typeof buildIdf>): (number | null)[] {
  const m = lrc.length;
  const jobs = blocks.map((b) => ({ i: blocks.indexOf(b), anchor: b.lines[0] ?? '', expected: b.lines.length }));
  // cost[bi][line] = 1 − wcontain(anchor, line) − бонус близости ожидаемой длины
  const cost = jobs.map((jb) => {
    const row = new Array(m);
    for (let s = 0; s < m; s++) {
      const sim = wcontain(jb.anchor, lrc[s]!.text, idf);
      row[s] = sim === 0 ? 1.5 : 1 - sim;
    }
    return row;
  });
  // Жадное назначение по одному (минимальная стоимость среди свободных строк)
  const free = new Set<number>(lrc.map((_, s) => s));
  const assign: (number | null)[] = new Array(jobs.length).fill(null);
  const order = jobs.map((_, i) => i);
  for (const bi of order) {
    let bestS = -1, bestC = Infinity;
    for (const s of free) {if (cost[bi][s] < bestC) { bestC = cost[bi][s]; bestS = s; }}
    if (bestS >= 0) { assign[bi] = bestS; free.delete(bestS); }
  }
  return assign;
}

// Восстановление монотонности: пересортировка назначений по возрастанию.
export function repairMonotone(assign: (number | null)[]): { startsByRank: number[]; repaired: (number | null)[]; violationsBefore: number } {
  const pairs = assign.map((s, i) => [s, i] as [number, number]).filter(([s]) => s !== null);
  const before = pairs.map(([s, i]) => ({ block: i, line: s }));
  let violations = 0;
  for (let x = 1; x < before.length; x++) {if (before[x].line <= before[x - 1].line) {violations++;}}
  const sorted = [...pairs].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const out: (number | null)[] = new Array(assign.length).fill(null);
  sorted.forEach(([, i], rank) => { out[i] = rank; }); // новый монотонный порядок
  return { startsByRank: sorted.map(([s]) => s), repaired: out, violationsBefore: violations };
}

export interface HungarianResult {
  blocks: (Range | null)[];
  violationsBefore: number;
  assignRaw: (number | null)[];
}

export function hungarianModel(blocks: GeniusBlock[], lrc: LrcLine[]): HungarianResult {
  const idf = buildIdf(lrc, 0.5);
  const nonEmpty = blocks.map((b, i) => ({ b, i })).filter((x) => x.b.lines.length > 0);
  const assign = assignmentStarts(nonEmpty.map((x) => x.b), lrc, idf);
  const rep = repairMonotone(assign);
  const m = lrc.length;
  // ранги → строки: блок с ранком r получает rep.startsByRank[r]
  const startsByBlock = new Array(blocks.length).fill(null);
  nonEmpty.forEach((x, idx) => { startsByBlock[x.i] = rep.startsByRank[rep.repaired[idx] as number]; });
  const out: (Range | null)[] = blocks.map((_b, i) => {
    if (startsByBlock[i] === null) {return null;}
    const s = startsByBlock[i] as number;
    const e = i === blocks.length - 1 ? m - 1 : s; // конец = следующий старт − 1 — ниже пересчёт
    return { startIdx: s, endIdx: e } as Range;
  });
  // концы: end_i = start_{i+1} − 1 (в порядке блоков), последний — m−1
  const nonEmptyIdx = blocks.map((b, i) => (b.lines.length > 0 ? i : -1)).filter((x) => x >= 0);
  for (let j = 0; j < nonEmptyIdx.length; j++) {
    const bi = nonEmptyIdx[j];
    (out[bi] as Range).endIdx = j + 1 < nonEmptyIdx.length ? (out[nonEmptyIdx[j + 1]] as Range).startIdx - 1 : m - 1;
    if ((out[bi] as Range).endIdx < (out[bi] as Range).startIdx) {(out[bi] as Range).endIdx = (out[bi] as Range).startIdx;} // защита от инверсии
  }
  return { blocks: out, violationsBefore: rep.violationsBefore, assignRaw: assign };
}
