// legacy.ts — эмуляция текущего пайплайна (research, НЕ копия кода 1b63ead).
// Гипотеза H2 по фактам брифа §4: якорь по первой строке (TC-122), поиск в окне
// проекции (σ), скидка уникальности, cap по expectedLines + эластичность,
// цепочка fallback, пустой блок = gap, NOT MAPPED при провале якоря.
// Порт /tmp/c36v12/src/legacy.js. Утверждать побайтовое совпадение с 1b63ead
// НЕЛЬЗЯ — кода у Центра нет.

import { containment, type LrcLine, type GeniusBlock } from './parse.js';

export interface LegacyDefaults {
  minCandidateScore: number;
  sigma: number;
  uniquenessPower: number;
  elasticity: number;
  cgpMin: number;
  tieBreak: 'earliest' | 'latest';
}

export const LEGACY_DEFAULTS: LegacyDefaults = {
  minCandidateScore: 0.45, // MIN_CANDIDATE_SCORE
  sigma: 2,                // окно поиска якоря вокруг проекции
  uniquenessPower: 0.5,   // UNIQUENESS_POWER: скидка score / (1+nOccurrences)^p
  elasticity: 1,          // эластичность cap
  cgpMin: 0.9,            // порог CGP Pass 2.5 (не откалиброван, :611)
  tieBreak: 'earliest',   // порядок при равных score: 'earliest' | 'latest'
};

export interface LegacyBlock {
  i: number;
  label: string;
  kind: string;
  startIdx: number | null;
  endIdx: number | null;
  lines: number;
}

export interface LegacyResult {
  blocks: LegacyBlock[];
  log: Array<Record<string, unknown>>;
  P: LegacyDefaults;
}

// Скор кандидата = containment × скидка уникальности.
export function candidateScore(anchorText: string, lrcLines: LrcLine[], idx: number, params: LegacyDefaults): number {
  const base = containment(anchorText, lrcLines[idx]!.text);
  if (base < params.minCandidateScore) {return 0;}
  let occ = 0;
  for (const l of lrcLines) {if (containment(anchorText, l.text) >= params.minCandidateScore) {occ += 1;}}
  const uniq = Math.pow(occ, -params.uniquenessPower); // occ>=1 → скидка ≤ 1
  return base * uniq;
}

// Пайплайн H2. Возвращает разбиение той же формы, что currentOutput дампов.
export function legacyEmu(blocks: GeniusBlock[], lrc: LrcLine[], params: Partial<LegacyDefaults> = {}): LegacyResult {
  const P = { ...LEGACY_DEFAULTS, ...params };
  const m = lrc.length;
  const starts = new Array(blocks.length).fill(null);
  const ends = new Array(blocks.length).fill(null);
  const log: Array<Record<string, unknown>> = [];

  const nonEmptyIdx: number[] = [];
  blocks.forEach((b, i) => { if (b.lines.length > 0) {nonEmptyIdx.push(i);} });

  // 1) Старты непустых блоков: последовательно, окно вокруг проекции.
  let prevStart: number | null = null, prevExpected = 0;
  for (let j = 0; j < nonEmptyIdx.length; j++) {
    const bi = nonEmptyIdx[j];
    const anchor = blocks[bi].lines[0];
    const expected = blocks[bi].lines.length;
    const floor = prevStart === null ? 0 : prevStart + 1;
    const projected = prevStart === null ? 0 : prevStart + prevExpected;
    const lo = Math.max(floor, projected - P.sigma);
    const hi = Math.min(m - 1, projected + P.sigma);
    let cands: Array<{ s: number; sc: number }> = [];
    for (let s = lo; s <= hi; s++) {
      const sc = candidateScore(anchor, lrc, s, P);
      if (sc > 0) {cands.push({ s, sc });}
    }
    let start;
    if (cands.length === 0) {
      start = Math.min(m - 1, Math.max(floor, projected)); // цепочка (fallback)
      log.push({ block: bi, label: blocks[bi].label, mode: 'chain', start, reason: 'no candidate in window' });
    } else {
      cands.sort((a, b) => (P.tieBreak === 'latest'
        ? (b.sc - a.sc) || (b.s - a.s)
        : (b.sc - a.sc) || (a.s - b.s)));
      start = cands[0].s;
      log.push({ block: bi, label: blocks[bi].label, mode: 'anchor', start, score: +cands[0].sc.toFixed(3) });
    }
    starts[bi] = start;
    prevStart = start;
    prevExpected = expected;
  }

  // 2) NOT MAPPED: якорь не найден и цепочка за пределами окна + запас.
  for (const bi of nonEmptyIdx) {
    const entry = log.find((e) => e.block === bi && e.mode === 'chain');
    if (!entry) {continue;}
    const floor = bi === nonEmptyIdx[0] ? 0 : starts[nonEmptyIdx[nonEmptyIdx.indexOf(bi) - 1]] + 1;
    const projected = entry.start as number;
    if (projected > floor + P.sigma + Math.max(2, P.sigma)) {
      starts[bi] = null;
      entry.mode = 'not-mapped';
    }
  }

  // 3) Концы: end = next.start − 1, затем cap = min(end, start + expected + elasticity).
  const mappedNonEmpty = nonEmptyIdx.filter((i) => starts[i] !== null);
  for (let j = 0; j < mappedNonEmpty.length; j++) {
    const bi = mappedNonEmpty[j];
    const expected = blocks[bi].lines.length;
    const nextStart = j + 1 < mappedNonEmpty.length ? (starts[mappedNonEmpty[j + 1]] as number) : m;
    let end = nextStart - 1;
    const cap = (starts[bi] as number) + expected + P.elasticity - 1;
    const capped = Math.min(end, cap);
    ends[bi] = capped;
    if (capped !== end) {log.push({ block: bi, label: blocks[bi].label, mode: 'cap', end: capped, uncapped: end });}
  }

  // 4) Пустые блоки: gap [prevEnd+1 .. nextStart−1] (TC-6C gap-assign).
  for (let i = 0; i < blocks.length; i++) {
    if (blocks[i].lines.length > 0) {continue;}
    let prevEnd = -1;
    for (let a = i - 1; a >= 0; a--) {if (ends[a] !== null && starts[a] !== null) { prevEnd = ends[a] as number; break; }}
    let nextStart = m;
    for (let b = i + 1; b < blocks.length; b++) {if (starts[b] !== null) { nextStart = starts[b] as number; break; }}
    if (prevEnd + 1 <= nextStart - 1) {
      starts[i] = prevEnd + 1;
      ends[i] = nextStart - 1;
      log.push({ block: i, label: blocks[i].label, mode: 'gap-assign', start: starts[i], end: ends[i] });
    }
  }

  const out: LegacyBlock[] = blocks.map((b, i) => ({
    i, label: b.label, kind: b.kind,
    startIdx: starts[i], endIdx: ends[i],
    lines: starts[i] === null ? 0 : (ends[i] as number) - (starts[i] as number) + 1,
  }));
  return { blocks: out, log, P };
}

// 5) CGP Pass 2.5 (эмулированный): сдвиг границы, если первая строка СЛЕДУЮЩЕГО
//    блока лежит в текущем конце и score ≥ cgpMin; слабые (score < cgpMin) — skip.
export function cgpPass(partition: LegacyResult, blocks: GeniusBlock[], lrc: LrcLine[], params: Partial<LegacyDefaults> = {}): LegacyResult {
  const P = { ...LEGACY_DEFAULTS, ...params };
  const log: Array<Record<string, unknown>> = [];
  const out = partition.blocks.map((b) => ({ ...b }));
  for (let i = 0; i + 1 < out.length; i++) {
    const cur = out[i], next = out[i + 1];
    if (cur.startIdx === null || !next || next.startIdx === null) {continue;}
    if (blocks[i].lines.length === 0) {continue;}
    const nextAnchor = blocks[i + 1].lines[0];
    const currentScore = containment(blocks[i].lines[0], lrc[cur.startIdx]!.text);
    if (currentScore < P.cgpMin) { log.push({ i, skip: true, currentScore }); continue; }
    const boundaryScore = containment(nextAnchor, lrc[cur.endIdx as number]!.text);
    if (boundaryScore >= P.cgpMin) {
      // граница идёт вперёд на 1: последняя строка уходит следующему блоку
      cur.endIdx = (cur.endIdx as number) - 1;
      next.startIdx = (next.startIdx as number) + 1;
      log.push({ i, shift: +1, boundaryScore });
    }
  }
  return { blocks: out, log, P };
}
