// wiring.ts — адаптер prod-пайплайна к c36. Центр_42, BL-042.
import { gate, type GateResult } from './gate.js';
import { applyGatePartition, type ApplyBlock, type ApplyReport } from './apply.js';
import type { AttributionParams } from './attribution.js';
import type { Dump, GeniusBlock, LegacyBlock, LrcLine } from './parse.js';

export interface GeniusSourceBlock { label?: string; type?: string; contentLines?: string[] }
export interface WiringMarker { time?: number | null }
export interface WiringReport { mode: string; logLine?: string; apply: ApplyReport; gate: GateResult }

const KIND_MAP: Record<string, string> = {
  'verse': 'verse', 'chorus': 'chorus', 'bridge': 'bridge',
  'pre-chorus': 'prechorus', 'prechorus': 'prechorus',
  'post-chorus': 'postchorus', 'postchorus': 'postchorus',
  'intro': 'intro', 'outro': 'outro',
  'interlude': 'interlude', 'break': 'interlude',
  'instrumental': 'instrumental', 'instrumental-break': 'instrumental',
  'solo': 'solo', 'hook': 'hook', 'refrain': 'refrain',
};
export function toC36Kind(type: string | undefined): string {
  const raw = String(type ?? '').toLowerCase();
  return KIND_MAP[raw] ?? raw;
}

export const WIRING_MAX_M = 600;

const EMPTY_STATS = { mappedBlocks: 0, covered: 0, holes: [], dupes: [], outOfBounds: [] };

export function runC36Gate(
  blocks: ApplyBlock[],
  genius: readonly GeniusSourceBlock[],
  displayLines: readonly string[],
  markers: readonly WiringMarker[],
  opts: { attribution?: Partial<AttributionParams> } = {},
): WiringReport {
  const m = displayLines.length;
  if (blocks.length === 0 || m === 0 || m > WIRING_MAX_M) {
    return { mode: 'skipped', apply: { verdict: 'noop-mode', mode: 'skipped', changed: [], problems: [], before: EMPTY_STATS, after: EMPTY_STATS }, gate: { mode: 'skipped', blocks: [] } };
  }
  const lrcLines: LrcLine[] = displayLines.map((text, i) => {
    const t = markers[i]?.time;
    return t == null ? { text } : { text, t };
  });
  // .filter(trim) — паритет с legacy expectedLines (F4): блок из пробелов не nonEmpty.
  const geniusLines = genius.map((b) => (b.contentLines ?? []).filter((l) => l.trim().length > 0));
  const geniusBlocks: GeniusBlock[] = genius.map((b, i) => ({
    label: b.label ?? '', kind: toC36Kind(b.type), lines: geniusLines[i],
  }));
  const currentOutput: LegacyBlock[] = blocks.map((b, i) => {
    const set = b.lineIndices ?? [];
    return set.length === 0
      ? { i, startIdx: null, endIdx: null, lines: 0 }
      : { i, startIdx: Math.min(...set), endIdx: Math.max(...set), lines: set.length };
  });
  // РЕАЛЬНЫЕ множества: дыры и не-монотонность доходят до анализа без lossy-схлопывания.
  const legacyLineSets: (number[] | null)[] = blocks.map((b) => {
    const set = b.lineIndices ?? [];
    return set.length > 0 ? [...set] : null;
  });

  const dump: Dump = { lrcLines, geniusBlocks, currentOutput };
  const g = gate(dump, { legacyLineSets, mode3: false, ...(opts.attribution ? { attribution: opts.attribution } : {}) });
  const apply = applyGatePartition(blocks, g, { displayLines, geniusLines });
  return g.logLine ? { mode: g.mode, logLine: g.logLine, apply, gate: g } : { mode: g.mode, apply, gate: g };
}
