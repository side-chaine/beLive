// gate.ts — гейт совместимости (B-валидность): M-модель включается только там,
// где она строго лучше legacy, и никогда не меняет замороженные ожидания
// MJ/Runaway. Центр_36, research. Порт /tmp/gate-bval.mjs (спека N10-v12-b).
//
// Три режима:
//   1) NOT MAPPED непустого блока → defer (защита MJ), выход = legacy byte-exact.
//   2) невалидная геометрия legacy (overlap/hole/неполное покрытие) →
//      переопределение по ВАЛИДНОСТИ: модель даёт валидное разбиение, стоимость
//      НЕ сравнивается. Обязателен лог режима 2.
//   3) legacy валиден → посегментно, cM < cL − τ, τ = 0.02, «строго ниже» ТОЛЬКО здесь.
//   no-disputes — Runaway, не тронут.

import { makeBlockCost, mmodel, validatePartition, type Scorer } from './model.js';
import type { GeniusBlock, Range, Dump } from './parse.js';

export interface GateDefaults {
  margin: number;
}

export const GATE_DEFAULTS: GateDefaults = { margin: 0.02 };

export interface GateResult {
  mode: string;
  blocks: (Range | null)[];
  rule?: string;
  reason?: string[];
  changed?: string[];
  logLine?: string;
  decisions?: Array<{ segment: number[]; verdict: string; cL?: number; cM?: number; reason?: string }>;
  segments?: number[][];
}

// Чистота legacy-разбиения: без перекрытий, без дыр, все непустые блоки замаплены.
export function isCleanPartition(partition: (Range | null)[], blocks: GeniusBlock[], m: number): { clean: boolean; problems: string[] } {
  const problems: string[] = [];
  let prevEnd = -1;
  partition.forEach((p, i) => {
    const nonEmpty = blocks[i] && blocks[i].lines.length > 0;
    // v1.2: у ПУСТОГО блока null — норма (A4: пустой блок = якорь таймспана, строк не берёт).
    if (!p) { if (nonEmpty) {problems.push(`block ${i} NOT MAPPED`);} return; }
    if (nonEmpty && (p.startIdx === null || p.startIdx === undefined)) {problems.push(`block ${i} NOT MAPPED`);}
    if (p.startIdx !== null && p.startIdx !== undefined) {
      if (p.startIdx <= prevEnd && !(p.endIdx < p.startIdx)) {problems.push(`overlap at ${i}`);}
      if (p.startIdx > prevEnd + 1) {problems.push(`hole before ${i}`);}
      prevEnd = Math.max(prevEnd, p.endIdx);
    }
  });
  if (prevEnd !== m - 1) {problems.push(`coverage ${prevEnd} != ${m - 1}`);}
  return { clean: problems.length === 0, problems };
}

// Локальная стоимость сегмента блоков [a..b] на общем окне (индексы блоков).
function segmentCost(scorer: Scorer, from: number, assign: (number[] | null)[]): number {
  let cost = 0;
  for (let x = 0; x < assign.length; x++) {
    if (!assign[x]) {continue;} // v1.2: zero-width блок строк не берёт — стоимость 0
    const c = scorer.blockCost(from + x, assign[x]![0], assign[x]![1]);
    if (c === Infinity) {return Infinity;}
    cost += c;
  }
  return cost;
}

// Приведение legacy-выхода дампа к {startIdx,endIdx}[] (или null).
export function legacyRanges(currentOutput: (Range | null)[] | null | undefined): (Range | null)[] {
  return (currentOutput ?? []).map((b) =>
    b && b.startIdx !== null && b.startIdx !== undefined
      ? { startIdx: b.startIdx, endIdx: b.endIdx }
      : null);
}

function analyseLegacy(legacy: (Range | null)[], blocks: GeniusBlock[], m: number): { notMapped: string[]; geometry: string[] } {
  const notMapped: string[] = [], geometry: string[] = [];
  let prevEnd = -1;
  legacy.forEach((p, i) => {
    const nonEmpty = blocks[i] && blocks[i].lines.length > 0;
    if (!p) { if (nonEmpty) {notMapped.push(`block ${i} NOT MAPPED`);} return; }
    if (p.startIdx <= prevEnd) {geometry.push(`overlap at ${i}`);}
    if (p.startIdx > prevEnd + 1) {geometry.push(`hole before ${i}`);}
    prevEnd = Math.max(prevEnd, p.endIdx);
  });
  if (prevEnd !== m - 1) {geometry.push(`coverage ${prevEnd} != ${m - 1}`);}
  return { notMapped, geometry };
}

// Главный вход: gate(dump) → { mode, blocks, decisions }
export function gate(dump: Dump, opts: { gate?: Partial<GateDefaults>; params?: Record<string, number> } = {}): GateResult {
  const G = { ...GATE_DEFAULTS, ...(opts.gate || {}) };
  const legacy = legacyRanges(dump.currentOutput);
  const blocks = dump.geniusBlocks ?? [];
  const m = dump.lrcLines.length;
  const { notMapped, geometry } = analyseLegacy(legacy, blocks, m);

  // (1) защита: парсер не видит непустой блок — трек не наш
  if (notMapped.length) {return { mode: 'defer-unclean', reason: notMapped.concat(geometry), blocks: legacy, rule: 'not-mapped' };}

  const model = mmodel(blocks, dump.lrcLines, opts);
  if (model.failed || !model.blocks) {return { mode: 'defer-model-failed', blocks: legacy };}
  const problems = validatePartition(model.blocks, blocks, m, model.zeroWidth);
  if (problems.length) {return { mode: 'defer-model-invalid', blocks: legacy, reason: problems };}

  // (2) невалидная геометрия legacy → валидность решает, цена не участвует
  if (geometry.length) {
    const changed: string[] = [];
    blocks.forEach((b, i) => {
      const L = legacy[i], M = model.blocks![i];
      const l = L ? `${L.startIdx}..${L.endIdx}` : null;
      const mm = M ? `${M.startIdx}..${M.endIdx}` : null;
      if (l !== mm) {changed.push(`${b.label} ${l ?? '—'}→${mm ?? '0 строк'}`);}
    });
    const logLine = `[blocks] overridden-by-validity · ${geometry.join(', ')} · changed ${changed.length}/${blocks.length}: ${changed.join('; ')}`;
    return { mode: 'overridden-by-validity', reason: geometry, blocks: model.blocks!, rule: 'validity', changed, logLine };
  }

  // (3) валидный legacy → посегментно с τ
  const scorer = makeBlockCost(blocks, dump.lrcLines, model.P);
  const disputed = blocks.map((_b, i) =>
    JSON.stringify(legacy[i] && [legacy[i]!.startIdx, legacy[i]!.endIdx]) !==
    JSON.stringify(model.blocks![i] && [model.blocks![i]!.startIdx, model.blocks![i]!.endIdx]));
  const segments: number[][] = [];
  let i = 0;
  while (i < blocks.length) {
    if (!disputed[i]) { i++; continue; }
    let j = i;
    while (j + 1 < blocks.length && disputed[j + 1]) {j++;}
    segments.push([i, j]); i = j + 1;
  }
  if (!segments.length) {return { mode: 'no-disputes', blocks: legacy, segments: [] };}
  const output: (Range | null)[] = legacy.map((r) => (r ? { ...r } : null));
  const decisions: GateResult['decisions'] = [];
  for (const [a, b] of segments) {
    let prevEnd = -1;
    for (let x = a - 1; x >= 0; x--) {if (output[x]) { prevEnd = output[x]!.endIdx; break; }}
    let nextStart = m;
    for (let x = b + 1; x < blocks.length; x++) {if (output[x]) { nextStart = output[x]!.startIdx; break; }}
    const winFrom = prevEnd + 1, winTo = nextStart - 1;
    const emptyWin = (r: Range | null, x: number): number[] | null =>
      r ? [r.startIdx, r.endIdx] : (model.zeroWidth && model.zeroWidth.has(x) ? null : [winFrom - 1, winFrom - 2]);
    let ok = true;
    for (let x = a; x <= b; x++) {
      for (const r of [legacy[x], model.blocks![x]]) {
        if (r && (r.startIdx < winFrom || r.endIdx > winTo || r.startIdx > r.endIdx)) {ok = false;}
      }
    }
    if (!ok) { decisions.push({ segment: [a, b], verdict: 'defer', reason: 'range outside window' }); continue; }
    const assignLegacy: (number[] | null)[] = [], assignModel: (number[] | null)[] = [];
    for (let x = a; x <= b; x++) { assignLegacy.push(emptyWin(legacy[x], x)); assignModel.push(emptyWin(model.blocks![x], x)); }
    const cL = segmentCost(scorer, a, assignLegacy), cM = segmentCost(scorer, a, assignModel);
    if (cM < cL - G.margin) {
      for (let x = a; x <= b; x++) {output[x] = model.blocks![x] ? { ...(model.blocks![x] as Range) } : null;}
      decisions.push({ segment: [a, b], verdict: 'override', cL: +cL.toFixed(4), cM: +cM.toFixed(4) });
    } else {
      decisions.push({ segment: [a, b], verdict: 'defer', cL: +cL.toFixed(4), cM: +cM.toFixed(4) });
    }
  }
  const outProblems = validatePartition(output, blocks, m, model.zeroWidth);
  if (outProblems.length) {return { mode: 'defer-invalid-result', blocks: legacy, decisions, reason: outProblems };}
  return { mode: 'overridden', blocks: output, decisions, segments };
}
