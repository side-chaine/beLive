// metrics.ts — сравнение разбиений: точное совпадение, покрытие, дыры, дубли.
// Центр_36, research. Порт /tmp/c36v12/src/metrics.js.

import type { LegacyRange, Range } from './parse.js';

export interface CompareRow {
  i: number;
  target: string;
  actual: string;
  delta: number | string;
  ok: boolean;
}

export interface CompareResult {
  exact: number;
  total: number;
  perBlock: CompareRow[];
}

// target/actual: массивы {startIdx, endIdx, lines?} или null, по одному на блок.
// NOT MAPPED (null) у цели и факта считается совпадением.
export function compare(target: (LegacyRange | null)[] | null | undefined, actual: (LegacyRange | null)[] | null | undefined): CompareResult {
  const n = Math.max(target?.length ?? 0, actual?.length ?? 0);
  const perBlock: CompareRow[] = [];
  const norm = (r: Range | null | undefined) => {
    if (r == null || r.startIdx === null || r.startIdx === undefined) {return null;}
    return `${r.startIdx}..${r.endIdx}`;
  };
  let exact = 0;
  for (let i = 0; i < n; i++) {
    const t = (target?.[i] ?? null) as Range | null;
    const a = (actual?.[i] ?? null) as Range | null;
    const same = norm(t) === norm(a);
    if (same) {exact += 1;}
    const ts = norm(t), as = norm(a);
    perBlock.push({
      i,
      target: ts ?? 'NOT MAPPED',
      actual: as ?? 'NOT MAPPED',
      delta: same ? 0
        : (ts === null || as === null) ? 'map/null'
        : `Δstart=${(a?.startIdx ?? 0) - (t?.startIdx ?? 0)},Δend=${(a?.endIdx ?? 0) - (t?.endIdx ?? 0)}`,
      ok: !!same,
    });
  }
  return { exact, total: n, perBlock };
}

// Покрытие/дыры/дубли по фактическому разбиению (ranges only, без модели блоков).
export function coverageStats(partition: (LegacyRange | null)[], m: number): { covered: number; total: number; holes: number[]; dupes: number[]; mappedBlocks: number } {
  const cover = new Array(m).fill(0);
  let mappedBlocks = 0;
  for (const p of partition) {
    if (!p || p.startIdx === null || p.endIdx === null) {continue;}
    mappedBlocks += 1;
    for (let i = p.startIdx; i <= p.endIdx; i++) {cover[i] += 1;}
  }
  const holes: number[] = [], dupes: number[] = [];
  cover.forEach((c, i) => {
    if (c === 0) {holes.push(i);}
    if (c > 1) {dupes.push(i);}
  });
  return { covered: m - holes.length, total: m, holes, dupes, mappedBlocks };
}

export function fmtTable(rows: string[][]): string {
  if (!rows.length) {return '(пусто)';}
  const widths = rows[0].map((_, c) => Math.max(...rows.map((r) => String(r[c]).length)));
  return rows.map((r) => '| ' + r.map((c, j) => String(c).padEnd(widths[j])).join(' | ') + ' |').join('\n');
}
