// live-fixture.ts — РЕАЛЬНЫЙ prod-выход blockFirstLineSync (I Disappear),
// снят CEO в ITER-1 (ITER1_01_PROBE_STDOUT.md, «LIVE blocks»). Не дамп:
// дамповый currentOutput ОТЛИЧАЕТСЯ от живого (V1/V2 переплетены gap-fill'ом).
// Это baseline mutation-оракула: ground truth без ручной разметки.
import iDisappearJson from './dumps/metallica-i-disappear.json';
import { loadDump, parseGeniusRaw, type Dump, type GeniusBlock, type LrcLine } from '../parse';

export const LIVE_KINDS = ['verse', 'verse', 'chorus', 'interlude', 'verse', 'chorus', 'bridge', 'instrumental', 'chorus'];
export const LIVE_INDICES: number[][] = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 12, 15],
  [10, 11, 13, 14, 16, 17],
  [18, 19, 20, 21],
  [22],
  [23, 24, 25, 26, 27, 28, 29, 30, 31],
  [32, 33, 34, 35, 36, 37, 38, 39, 40],
  [41, 42, 43, 44],
  [],
  [45, 46, 47, 48, 49, 50, 51, 52, 53],
];
// Ожидаемое после ремонта: РОВНО два блока изменены, остальные byte-exact.
export const FIXED_INDICES: number[][] = LIVE_INDICES.map((s, i) =>
  i === 3 ? [] : i === 4 ? [22, 23, 24, 25, 26, 27, 28, 29, 30, 31] : [...s]);

export function rawDump(): Dump & { lrcRaw?: string } { return iDisappearJson as unknown as Dump & { lrcRaw?: string }; }
export function lrc(): LrcLine[] { return loadDump(rawDump()).lrcLines; }
export function genius(): GeniusBlock[] {
  return parseGeniusRaw(rawDump().geniusRaw).map((b, i) => ({ ...b, kind: LIVE_KINDS[i] }));
}
export function setsOf(ind: number[][]): (number[] | null)[] { return ind.map((s) => (s.length ? [...s] : null)); }
export function blocksOf(ind: number[][], lines: string[]): { lineIndices: number[]; contentLines?: string[] }[] {
  return ind.map((s) => ({ lineIndices: [...s], contentLines: s.map((k) => lines[k]) }));
}
