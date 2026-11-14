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
import type { GeniusBlock, Range, Dump, LegacyBlock } from './parse.js';
import { detectAttribution, ATTRIBUTION_DEFAULTS, type AttributionParams, type AttributionEvidence } from './attribution.js';

export interface GateDefaults {
  margin: number;
  margin3Rel: number;
}

export const GATE_DEFAULTS: GateDefaults = { margin: 0.02, margin3Rel: 0.05 };

export interface GateResult {
  mode: string;
  blocks: (Range | null)[];
  rule?: string;
  reason?: string[];
  changed?: string[];
  logLine?: string;
  decisions?: Array<{ segment: number[]; verdict: string; cL?: number; cM?: number; reason?: string }>;
  segments?: number[][];
  // Индексы блоков, которым разрешено опустеть (aux без свидетельства).
  changedIdx?: number[];
  zeroWidth?: number[];
  attribution?: AttributionEvidence;
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
// ВНИМАНИЕ: сохраняем оригинальное поведение — блок считается «замапленным»,
// если startIdx задан; endIdx может быть null (legacy NOT MAPPED по endIdx) и
// пропускается как есть. Сужать до «оба индекса» нельзя: ломает калибровки
// (A2 Filler Instrumental), где legacy-инструментал имеет endIdx=null.
export function legacyRanges(currentOutput: LegacyBlock[] | null | undefined): (Range | null)[] {
  return (currentOutput ?? []).map((b) =>
    (b && b.startIdx !== null && b.startIdx !== undefined
      ? { startIdx: b.startIdx, endIdx: b.endIdx }
      : null) as Range | null);
}

// Геометрия legacy — order-agnostic. Единственные НАСТОЯЩИЕ дефекты:
//   • TRUE overlap — одна LRC-строка заявлена 2+ блоками;
//   • TRUE coverage gap — LRC-строка не заявлена никем.
// Не-монотонный порядок блоков (намеренные chrono-нарушения legacy:
// Chorus раньше Verse 1, Post-Chorus backward tiebreaker) — НЕ дефект.
// Старая монотонная проверка prevEnd ложно флагала такие случаи как
// overlap/hole и триггерила тотальный mode-2 override, ломая калибровку.
// Диапазоны legacy → множества. endIdx=null даёт [] (A2 Filler): блок считается
// незамапленным, что КОНСЕРВАТИВНО для attribution (D2 не выполнится).
function legacySetsOf(legacy: (Range | null)[]): (number[] | null)[] {
  return legacy.map((p) =>
    p && p.startIdx !== null && p.startIdx !== undefined ? rangeSet(p.startIdx, p.endIdx) : null);
}

// Развернуть смежный диапазон [s..e] в множество заявленных строк.
function rangeSet(s: number, e: number): number[] {
  const out: number[] = [];
  for (let k = s; k <= e; k++) { out.push(k); }
  return out;
}

// Геометрия по РЕАЛЬНЫМ множествам строк (без lossy [min,max]):
// исключает ложные overlap/hole, которые порождал collapse дырявых
// lineIndices в смежный диапазон. Настоящие дефекты (строка в 2 блоках /
// строка ни в одном) — те же, что и у analyseLegacy на корректном разбиении.
function analyseLegacySets(sets: (number[] | null)[], blocks: GeniusBlock[], m: number): { notMapped: string[]; geometry: string[] } {
  const notMapped: string[] = [], geometry: string[] = [];
  const claimed = new Array<number>(m).fill(0);
  sets.forEach((set, i) => {
    const nonEmpty = blocks[i] && blocks[i].lines.length > 0;
    if (!set || set.length === 0) {
      if (nonEmpty) { notMapped.push(`block ${i} NOT MAPPED`); }
      return;
    }
    for (const k of set) {
      if (k < 0 || k >= m) {
        geometry.push(`line ${k} out-of-bounds (block ${i})`);
        continue;
      }
      claimed[k]++;
    }
  });
  for (let k = 0; k < m; k++) {
    if (claimed[k] > 1) {geometry.push(`overlap at line ${k}`);}
  }
  for (let k = 0; k < m; k++) {
    if (claimed[k] === 0) {geometry.push(`hole at line ${k}`);}
  }
  return { notMapped, geometry };
}

// Главный вход: gate(dump) → { mode, blocks, decisions }
export function gate(dump: Dump, opts: {
  gate?: Partial<GateDefaults>;
  params?: Record<string, number>;
  legacyLineSets?: (number[] | null)[];
  attribution?: Partial<AttributionParams>;
  // mode3=false → НЕ запускать mmodel ради стоимостного сравнения (прод: mode 3
  // всё равно не применяется). Убирает O(k·m²·nG·nL) из нормального пути (F10).
  mode3?: boolean;
} = {}): GateResult {
  const G = { ...GATE_DEFAULTS, ...(opts.gate || {}) };
  const legacy = legacyRanges(dump.currentOutput);
  const blocks = dump.geniusBlocks ?? [];
  const m = dump.lrcLines.length;
  const sets = opts.legacyLineSets ?? legacySetsOf(legacy);
  const { notMapped, geometry } = analyseLegacySets(sets, blocks, m);

  // (1) защита: парсер не видит непустой блок — трек не наш
  if (notMapped.length) {return { mode: 'defer-unclean', reason: notMapped.concat(geometry), blocks: legacy, rule: 'not-mapped' };}

  // (2b) CLASS 2 ATTRIBUTION — ДО модели и ДО цены. Геометрия чиста, но строка
  // отдана не тому блоку. Детектор без DP; ремонт локальный (2 блока).
  // Порядок принципиален: mode 1 (выше) защищает MJ, mode 2 (ниже) — геометрию.
  if (geometry.length === 0) {
    const attr = detectAttribution(blocks, dump.lrcLines, sets, opts.attribution ?? ATTRIBUTION_DEFAULTS);
    if (attr) {
      return {
        mode: 'repaired-attribution', blocks: attr.partition, rule: 'attribution',
        reason: attr.reason, changed: attr.changed, changedIdx: attr.changedIdx,
        zeroWidth: attr.zeroWidth, logLine: attr.logLine, attribution: attr.evidence,
      };
    }
    if (opts.mode3 === false) {
      return { mode: 'skipped-cost-only', blocks: legacy, changedIdx: [], rule: 'cost-only-off' };
    }
  }

  const model = mmodel(blocks, dump.lrcLines, opts);
  if (model.failed || !model.blocks) {return { mode: 'defer-model-failed', blocks: legacy };}
  const problems = validatePartition(model.blocks, blocks, m, model.zeroWidth);
  if (problems.length) {return { mode: 'defer-model-invalid', blocks: legacy, reason: problems };}

  // (2) невалидная геометрия legacy → валидность решает, цена не участвует
  if (geometry.length) {
    const changed: string[] = [];
    const changedIdx: number[] = [];
    blocks.forEach((b, i) => {
      const L = legacy[i], M = model.blocks![i];
      const l = L ? `${L.startIdx}..${L.endIdx}` : null;
      const mm = M ? `${M.startIdx}..${M.endIdx}` : null;
      if (l !== mm) {changed.push(`${b.label} ${l ?? '—'}→${mm ?? '0 строк'}`); changedIdx.push(i);}
    });
    const logLine = `[blocks] overridden-by-validity · ${geometry.join(', ')} · changed ${changed.length}/${blocks.length}: ${changed.join('; ')}`;
    return { mode: 'overridden-by-validity', reason: geometry, blocks: model.blocks!, rule: 'validity', changed, changedIdx, logLine, zeroWidth: [...model.zeroWidth] };
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

    // No-drop guard (§5 reverse-N10): модель без калибровок legacy (chrono
    // tiebreaker, MIN_CANDIDATE_SCORE) может «выиграть» по стоимости, сбросив
    // замапленный блок в NOT MAPPED / zero-width. Это объективно хуже — блок
    // исчезает. Запрещаем override, если хоть один НЕПУСТОЙ legacy-блок
    // сегмента становится пустым в модели. ПУСТЫЕ блоки (0 строк, напр.
    // Guitar Solo) ЗАКОННО становятся zero-width в модели (v1.2) — это не
    // потеря калибровки, а норма; guard на них не срабатывает, иначе
    // Unforgiven глухо уходит в defer-invalid-result.
    let dropped = false;
    for (let x = a; x <= b; x++) {
      const L = legacy[x];
      const Lreal = !!L && L.startIdx !== null && L.endIdx !== null && L.endIdx >= L.startIdx;
      const LnonEmpty = !!blocks[x] && blocks[x].lines.length > 0;
      const Mempty = !model.blocks![x] || model.zeroWidth.has(x);
      if (Lreal && LnonEmpty && Mempty) { dropped = true; break; }
    }
    if (dropped) { decisions.push({ segment: [a, b], verdict: 'defer', reason: 'model drops mapped block' }); continue; }

    const cLreal = segmentCost(scorer, a, assignLegacy), cM = segmentCost(scorer, a, assignModel);
    // Substantial-margin guard: τ=0.02 ловит near-ties, где модель просто
    // предпочитает другое (тоже корректное) положение — «не лучше, просто иначе».
    // Override только при существенном (≥5% от |cL|, GATE_DEFAULTS.margin3Rel)
    // улучшении: genuine defect
    // даёт большой разрыв, калибровочные near-ties (Fix-B и т.п.) — нет.
    const margin3 = Math.max(G.margin, Math.abs(cLreal) * G.margin3Rel);
    if (cM < cLreal - margin3) {
      for (let x = a; x <= b; x++) {output[x] = model.blocks![x] ? { ...(model.blocks![x] as Range) } : null;}
      decisions.push({ segment: [a, b], verdict: 'override', cL: +cLreal.toFixed(4), cM: +cM.toFixed(4) });
    } else {
      decisions.push({ segment: [a, b], verdict: 'defer', cL: +cLreal.toFixed(4), cM: +cM.toFixed(4) });
    }
  }
  const outProblems = validatePartition(output, blocks, m, model.zeroWidth);
  if (outProblems.length) {return { mode: 'defer-invalid-result', blocks: legacy, decisions, reason: outProblems };}
  const changedIdx: number[] = [];
  output.forEach((r, i) => {
    const a = r ? `${r.startIdx}..${r.endIdx}` : null;
    const b = legacy[i] ? `${legacy[i]!.startIdx}..${legacy[i]!.endIdx}` : null;
    if (a !== b) { changedIdx.push(i); }
  });
  return { mode: 'overridden', blocks: output, decisions, segments, changedIdx, zeroWidth: [...model.zeroWidth] };
}
