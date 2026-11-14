// attribution.ts — CLASS 2 ATTRIBUTION: aux-блок держит строки, которые
// объективно принадлежат следующему блоку. Центр_42, BL-042 ITER-2.
//
// N10 (I Disappear) — НЕ геометрический дефект: partition валиден (полное
// покрытие, уникальность), но строка 22 отдана Interlude вместо Verse 3.
// Mode 2 (валидность) его не видит; mode 3 (цена) блокируется no-drop guard'ом.
// Отсюда — детектор по СВИДЕТЕЛЬСТВУ, не по цене.
//
// Решение = A (детектор) + B (разрешение на дроп через zeroWidth).
// Ремонт строго локальный: меняются РОВНО два блока (aux и следующий).
//
// Ограничения scope:
//   • только направление aux → СЛЕДУЮЩИЙ блок (обратный шов — отдельная задача);
//   • один ремонт за вызов (первый по Genius-порядку);
//   • exact-match остаётся primary (паритет с model.zeroWidth), Jaccard — только
//     rescue и только в ЛОКАЛЬНОМ окне.
import { AUX_KINDS, containment, words, type GeniusBlock, type LrcLine, type Range } from './parse.js';

// SSOT — parse.ts. Ре-экспорт сохраняет существующие импорты (attribution A9).
export { AUX_KINDS };

export interface AttributionParams {
  enabled: boolean;
  thetaLow: number;
  thetaHigh: number;
  deltaMin: number;
  delta: number;
  maxStolen: number;
}
export const ATTRIBUTION_DEFAULTS: AttributionParams = {
  enabled: true, thetaLow: 0.6, thetaHigh: 0.8, deltaMin: 0.3, delta: 0.2, maxStolen: 2,
};
const EPS = 1e-9;

function norm(s: string | null | undefined): string {
  return String(s ?? '').toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
}
function tset(s: string): Set<string> { return new Set(words(s)); }
function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) { return 0; }
  let inter = 0;
  for (const w of a) { if (b.has(w)) { inter += 1; } }
  const union = a.size + b.size - inter;
  return union > 0 ? inter / union : 0;
}
function sortedUnique(set: readonly number[]): number[] {
  return [...new Set(set)].sort((a, b) => a - b);
}
function isContiguous(a: readonly number[]): boolean {
  for (let k = 1; k < a.length; k++) { if (a[k] !== a[k - 1] + 1) { return false; } }
  return true;
}
function rangeOf(set: readonly number[]): Range | null {
  return set.length ? { startIdx: set[0], endIdx: set[set.length - 1] } : null;
}

export interface AttributionEvidence {
  auxIdx: number; nextIdx: number;
  stolen: number[]; anchorAt: number;
  nextAnchorBefore: number; nextAnchorAfter: number; gain: number; auxClaim: number;
}
export interface AttributionRepair {
  partition: (Range | null)[];
  changedIdx: number[];
  zeroWidth: number[];
  changed: string[];
  reason: string[];
  logLine: string;
  evidence: AttributionEvidence;
}

export function detectAttribution(
  blocks: readonly GeniusBlock[],
  lrc: readonly LrcLine[],
  legacySets: readonly (readonly number[] | null)[],
  params: Partial<AttributionParams> = {},
): AttributionRepair | null {
  const P: AttributionParams = { ...ATTRIBUTION_DEFAULTS, ...params };
  if (!P.enabled) { return null; }
  const m = lrc.length;
  if (m === 0 || blocks.length === 0) { return null; }

  const sets: number[][] = blocks.map((_b, i) => {
    const raw = legacySets[i];
    if (!raw || raw.length === 0) { return []; }
    const s = sortedUnique(raw);
    return s.every((k) => Number.isInteger(k) && k >= 0 && k < m) ? s : [];
  });
  const lrcNorm = new Set(lrc.map((l) => norm(l.text)));
  const text = (from: number, to: number): string =>
    lrc.slice(from, to + 1).map((l) => l.text).join(' ');

  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (!AUX_KINDS.has(b.kind) || b.lines.length === 0) { continue; }   // D1, D2
    const mine = sets[i];
    if (mine.length === 0 || mine.length > P.maxStolen) { continue; }   // D2, D3
    if (!isContiguous(mine)) { continue; }                             // D3

    const auxAnchor = b.lines[0];
    const auxNorm = norm(auxAnchor);
    if (auxNorm === '') { continue; }                                  // D4
    if (lrcNorm.has(auxNorm)) { continue; }                            // D5 exact primary

    let j = -1;
    for (let x = i + 1; x < blocks.length; x++) {
      if (blocks[x].lines.length > 0 && sets[x].length > 0) { j = x; break; }
    }
    if (j < 0) { continue; }                                           // D7
    const next = sets[j];
    const auxMin = mine[0], auxMax = mine[mine.length - 1], nextMin = next[0];
    if (auxMax + 1 !== nextMin) { continue; }                          // D8

    let prevMax = -1;
    for (let x = i - 1; x >= 0; x--) { if (sets[x].length) { prevMax = sets[x][sets[x].length - 1]; break; } }
    const winFrom = prevMax + 1, winTo = nextMin - 1;
    const auxSet = tset(auxAnchor);
    let rescued = false;
    for (let k = winFrom; k <= winTo; k++) {
      if (jaccard(auxSet, tset(lrc[k].text)) + EPS >= P.thetaHigh) { rescued = true; break; }
    }
    if (rescued) { continue; }                                         // D6

    const stolenText = text(auxMin, auxMax);
    if (tset(stolenText).size === 0) { continue; }                     // D9 анти-filler

    const nextAnchor = blocks[j].lines[0];
    const before = containment(nextAnchor, lrc[nextMin].text);
    const after = containment(nextAnchor, text(auxMin, nextMin));      // split-aware
    const gain = after - before;
    if (!(before + EPS < P.thetaLow)) { continue; }                    // D10
    if (!(after + EPS >= P.thetaHigh)) { continue; }                   // D11
    if (!(gain + EPS >= P.deltaMin)) { continue; }                     // D12

    let auxClaim = 0;
    for (let k = auxMin; k <= nextMin; k++) {
      const v = jaccard(auxSet, tset(lrc[k].text));
      if (v > auxClaim) { auxClaim = v; }
    }
    if (!(auxClaim + P.delta <= after + EPS)) { continue; }            // D13

    const partition: (Range | null)[] = sets.map((s) => rangeOf(s));
    partition[i] = null;
    partition[j] = { startIdx: auxMin, endIdx: next[next.length - 1] };
    const evidence: AttributionEvidence = {
      auxIdx: i, nextIdx: j, stolen: [...mine], anchorAt: auxMin,
      nextAnchorBefore: +before.toFixed(4), nextAnchorAfter: +after.toFixed(4),
      gain: +gain.toFixed(4), auxClaim: +auxClaim.toFixed(4),
    };
    const changed = [
      `${b.label} ${auxMin}..${auxMax}→0 строк`,
      `${blocks[j].label} ${nextMin}..${next[next.length - 1]}→${auxMin}..${next[next.length - 1]}`,
    ];
    return {
      partition, changedIdx: [i, j], zeroWidth: [i], changed,
      reason: [`attribution: aux ${i} has no witness, next ${j} anchor ${before.toFixed(2)}→${after.toFixed(2)}`],
      logLine: `[blocks] repaired-attribution · anchor@${auxMin} · changed 2/${blocks.length}: `
        + `${changed.join('; ')} · next ${before.toFixed(2)}→${after.toFixed(2)} (gain ${gain.toFixed(2)}), `
        + `auxClaim ${auxClaim.toFixed(2)}`,
      evidence,
    };
  }
  return null;
}
