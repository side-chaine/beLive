// apply.ts — атомарное применение результата гейта. Центр_42, BL-042.
//
// KILLER-2: инлайн-версия патчила ЧАСТИЧНО — `if (!gb) continue` оставлял строки
// zero-width блоку (→ overlap с переписанным соседом), `if (differs && co)` не
// давал строк пустому в legacy блоку (→ hole). Лечили геометрию и ломали её.
//
// Контракт:
//   • применяем только разрешённые режимы;
//   • меняем ТОЛЬКО g.changedIdx — остальные блоки сохраняют РЕАЛЬНЫЕ lineIndices;
//   • опустеть может только блок из g.zeroWidth;
//   • всё разбиение проверяется на МНОЖЕСТВАХ до записи; любое ухудшение → откат.
import type { GateResult } from './gate.js';

export interface ApplyBlock { lineIndices: number[]; contentLines?: string[] }

export interface PartitionStats {
  mappedBlocks: number; covered: number;
  holes: number[]; dupes: number[]; outOfBounds: number[];
}

export function partitionStats(partition: readonly (readonly number[])[], m: number): PartitionStats {
  const claims = new Array<number>(m).fill(0);
  const outOfBounds: number[] = [];
  let mappedBlocks = 0;
  for (const set of partition) {
    if (set.length > 0) { mappedBlocks += 1; }
    for (const k of set) {
      if (!Number.isInteger(k) || k < 0 || k >= m) { outOfBounds.push(k); continue; }
      claims[k] += 1;
    }
  }
  const holes: number[] = [], dupes: number[] = [];
  for (let k = 0; k < m; k++) {
    if (claims[k] === 0) { holes.push(k); } else if (claims[k] > 1) { dupes.push(k); }
  }
  return { mappedBlocks, covered: m - holes.length, holes, dupes, outOfBounds };
}

// mode 3 ('overridden') НЕ включён: mmodel — другой алгоритм, чем prod-пайплайн.
export const APPLY_MODES_DEFAULT: readonly string[] = ['overridden-by-validity', 'repaired-attribution'];

export type ApplyVerdict = 'noop-mode' | 'noop-identical' | 'applied' | 'rolled-back';

export interface ApplyReport {
  verdict: ApplyVerdict; mode: string; changed: number[]; problems: string[];
  before: PartitionStats; after: PartitionStats;
}

export interface ApplyOptions {
  displayLines: readonly string[];
  allowModes?: readonly string[];
  geniusLines?: readonly (readonly string[])[];
}

export function applyGatePartition(blocks: ApplyBlock[], g: GateResult, opts: ApplyOptions): ApplyReport {
  const m = opts.displayLines.length;
  const allow = opts.allowModes ?? APPLY_MODES_DEFAULT;
  const before = partitionStats(blocks.map((b) => b.lineIndices ?? []), m);
  const base: ApplyReport = { verdict: 'noop-mode', mode: g.mode, changed: [], problems: [], before, after: before };
  if (!allow.includes(g.mode)) { return base; }
  if (g.blocks.length !== blocks.length) {
    return { ...base, verdict: 'rolled-back', problems: [`arity ${g.blocks.length} != ${blocks.length}`] };
  }
  const idx = g.changedIdx ?? [];
  if (idx.length === 0) { return { ...base, verdict: 'noop-identical' }; }

  const droppable = new Set<number>(g.zeroWidth ?? []);
  const next: number[][] = blocks.map((b) => [...(b.lineIndices ?? [])]);
  const problems: string[] = [];
  const changed: number[] = [];

  for (const i of idx) {
    if (!Number.isInteger(i) || i < 0 || i >= blocks.length) { problems.push(`bad index ${String(i)}`); continue; }
    const gb = g.blocks[i] ?? null;
    if (gb === null) {
      if ((blocks[i].lineIndices ?? []).length === 0) { continue; }
      if (!droppable.has(i)) { problems.push(`block ${i}: model drops mapped block (not zero-width)`); continue; }
      next[i] = []; changed.push(i); continue;
    }
    const s = gb.startIdx, e = gb.endIdx;
    if (!Number.isInteger(s) || !Number.isInteger(e) || e < s || s < 0 || e >= m) {
      problems.push(`block ${i}: bad model range ${String(s)}..${String(e)}`); continue;
    }
    const arr: number[] = [];
    for (let k = s; k <= e; k++) { arr.push(k); }
    if (arr.join(',') === (blocks[i].lineIndices ?? []).join(',')) { continue; }
    next[i] = arr; changed.push(i);
  }

  if (problems.length) { return { ...base, verdict: 'rolled-back', problems }; }
  if (changed.length === 0) { return { ...base, verdict: 'noop-identical' }; }

  const after = partitionStats(next, m);
  const degrade: string[] = [];
  if (after.outOfBounds.length) { degrade.push(`out-of-bounds ${after.outOfBounds.join(',')}`); }
  const bh = new Set(before.holes), bd = new Set(before.dupes);
  for (const k of after.holes) { if (!bh.has(k)) { degrade.push(`new hole at ${k}`); } }
  for (const k of after.dupes) { if (!bd.has(k)) { degrade.push(`new dupe at ${k}`); } }
  if (after.holes.length > before.holes.length) { degrade.push('holes grew'); }
  if (after.dupes.length > before.dupes.length) { degrade.push('dupes grew'); }
  if (degrade.length) { return { ...base, verdict: 'rolled-back', changed, problems: degrade, after }; }

  for (const i of changed) {
    blocks[i].lineIndices = next[i];
    if (next[i].length > 0) {
      blocks[i].contentLines = next[i].map((k) => opts.displayLines[k]);
    } else if (opts.geniusLines?.[i]) {
      blocks[i].contentLines = [...opts.geniusLines[i]];
    }
  }
  return { ...base, verdict: 'applied', changed, after };
}
