// model.ts — M-модель: монотонное покрытие LRC-строк Genius-блоками (DP).
// Центр_36, research. Ответ на В1: замена «старты + cap» задачей глобального
// выравнивания с монотонным покрытием, без текстовых порогов на швах.
//
// Быстрый путь: на блок один раз строятся матрицы оценок операций
// (1:1 / merge / split + хвосты), затем окна считаются чистой арифметикой DP.

import { wcontain, buildIdf, containment, type LrcLine, type GeniusBlock, type Range } from './parse.js';

export interface ModelParams {
  wAnchor: number;
  wAlign: number;
  wLen: number;
  slack: number;
  dropG: number;
  dropL: number;
  mergePen: number;
  splitPen: number;
  tailPen: number;
  orphan: number;
  idfPower: number;
  eps: number;
}

export const DEFAULTS: ModelParams = {
  wAnchor: 0.5,    // вес якоря (первая строка блока ↔ первая строка окна)
  wAlign: 1.0,     // вес полного выравнивания содержимого окна
  wLen: 0,         // вес приора СЫРОЙ длины окна. ОБЯЗАН быть 0: сырая длина
                   // наказывает легальные сплиты и переворачивает швы Runaway:
                   // замер 0.2 → 5/9, 0.35 → 3/9 (results/sensitivity.json, A6).
                   // Длину держит экономика операций: dropG/dropL/orphan/tailPen.
  slack: 2,        // допуск |len − expected| (только при wLen > 0)
  dropG: 0.5,      // штраф за необъяснённую строку Genius
  dropL: 0.35,     // штраф за неразложенную LRC-строку в окне
  mergePen: 0.08,  // штраф операции склейки (2 Genius → 1 LRC)
  splitPen: 0.08,  // штраф операции разбиения (1 Genius → 2 LRC)
  tailPen: 0.2,    // γ-штраф split/merge за «пустую» вторую строку (анти-leak)
  orphan: 0.6,     // штраф за LRC-строку, отданную пустому блоку
  idfPower: 0,     // idf только в align (якорь всегда чистый containment).
                   // Замер: при tailPen=0.2 оси 0/0.5/1 все дают 9/9; default 0 —
                   // проще и устойчивее (A6). Якорь с idf ЗАПРЕЩЁН — он выбирал
                   // «половину сплита с редкими словами» и ломал Runaway (A3).
  eps: 1e-9,
};

// Якорь блока = чистый containment (семантика legacy _containmentScore,
// бриф §4.3): без idf. idf-якорь выбирал «половину сплита с редкими словами»
// вместо настоящей первой строки и ломал Runaway — замер: стоимость неверной
// разбивки окна была ниже на 0.0549 (A3, results/forbidden-axes.json).

interface Ops {
  S1: Float64Array[];
  S2: Float64Array[];
  S3: Float64Array[];
  nG: number;
  m: number;
}

// ── Матрицы операций блока (строятся один раз на блок) ───────────────────────
// Индексы LRC глобальные. S1[i][j] = score(g[i] → l[j]); S2 — merge (g[i]+g[i+1]
// → l[j]); S3 — split (g[i] → l[j]+l[j+1]); TM/T2 — хвосты для γ-штрафа.
function buildOps(block: GeniusBlock, lrc: LrcLine[], idf: ReturnType<typeof buildIdf>, P: ModelParams): Ops {
  const g = block.lines;
  const m = lrc.length;
  const nG = g.length;
  const S1: Float64Array[] = [], S2: Float64Array[] = [], S3: Float64Array[] = [];
  for (let i = 0; i < nG; i++) {
    S1[i] = new Float64Array(m);
    S2[i] = new Float64Array(m);
    S3[i] = new Float64Array(m);
  }
  for (let i = 0; i < nG; i++) {
    for (let j = 0; j < m; j++) {
      S1[i][j] = wcontain(g[i], lrc[j]!.text, idf);
      if (i + 1 < nG) {
        S2[i][j] = wcontain(g[i] + ' ' + g[i + 1], lrc[j]!.text, idf)
          - P.mergePen - P.tailPen * (1 - wcontain(g[i + 1], lrc[j]!.text, idf));
      } else {S2[i][j] = -1e9;}
      if (j + 1 < m) {
        S3[i][j] = wcontain(g[i], lrc[j]!.text + ' ' + lrc[j + 1]!.text, idf)
          - P.splitPen - P.tailPen * (1 - wcontain(g[i], lrc[j + 1]!.text, idf));
      } else {S3[i][j] = -1e9;}
    }
  }
  return { S1, S2, S3, nG, m };
}

// Локальное выравнивание окна [s..e] по готовым матрицам.
function localAlignFast(ops: Ops, s: number, e: number, P: ModelParams): number {
  const nG = ops.nG, nL = e - s + 1;
  if (nL < 0) {return -1e9;}
  const dp = new Float64Array((nG + 1) * (nL + 1)).fill(-1e9);
  const D = (i: number, j: number) => i * (nL + 1) + j;
  dp[D(nG, nL)] = 0;
  for (let i = nG; i >= 0; i--) {
    for (let j = nL; j >= 0; j--) {
      if (i === nG && j === nL) {continue;}
      let best = -1e9;
      const gj = s + j;
      if (i < nG && j < nL) {
        const s1 = ops.S1[i][gj] + dp[D(i + 1, j + 1)];
        if (s1 > best) {best = s1;}
        if (i + 1 < nG) {
          const s2 = ops.S2[i][gj] + dp[D(i + 2, j + 1)];
          if (s2 > best) {best = s2;}
        }
        if (j + 1 < nL) {
          const s3 = ops.S3[i][gj] + dp[D(i + 1, j + 2)];
          if (s3 > best) {best = s3;}
        }
      }
      if (i < nG) { const v = -P.dropG + dp[D(i + 1, j)]; if (v > best) {best = v;} }
      if (j < nL) { const v = -P.dropL + dp[D(i, j + 1)]; if (v > best) {best = v;} }
      dp[D(i, j)] = best;
    }
  }
  return dp[D(0, 0)];
}

// Мягкий prior длины (только при wLen > 0; в DEFAULTS выключен, см. комментарий).
export function lenPenalty(expected: number, actualLen: number, P: ModelParams): number {
  if (expected <= 0) {return actualLen > 0 ? actualLen * P.orphan : 0;}
  const over = Math.abs(actualLen - expected) - P.slack;
  return over > 0 ? (P.wLen * over * over) / Math.max(1, expected) : 0;
}

export interface Scorer {
  blockCost: (bi: number, s: number, e: number) => number;
  idf: ReturnType<typeof buildIdf>;
  P: ModelParams;
  opsOf: (bi: number) => Ops;
}

// Фабрика стоимости блока с кэшем матриц операций.
export function makeBlockCost(blocks: GeniusBlock[], lrc: LrcLine[], params: Partial<ModelParams> = {}): Scorer {
  const P: ModelParams = { ...DEFAULTS, ...params };
  const idf = buildIdf(lrc, P.idfPower);
  const opsCache = new Map<number, Ops>();
  const opsOf = (bi: number): Ops => {
    if (!opsCache.has(bi)) {opsCache.set(bi, buildOps(blocks[bi], lrc, idf, P));}
    return opsCache.get(bi)!;
  };
  const blockCost = (bi: number, s: number, e: number): number => {
    const block = blocks[bi];
    const g = block.lines;
    if (g.length === 0) {
      const n = e - s + 1; // пустой блок не получает строк
      return n > 0 ? n * P.orphan : 0;
    }
    if (e < s) {return Infinity;}
    const win = lrc.slice(s, e + 1);
    const align = localAlignFast(opsOf(bi), s, e, P);
    const anchor = containment(g[0], lrc[s]!.text); // чистый containment — семантика legacy
    const value = P.wAnchor * anchor + P.wAlign * (align / g.length);
    return -value + lenPenalty(g.length, win.length, P);
  };
  return { blockCost, idf, P, opsOf };
}

// Совместимость: стоимость без кэша (для одиночных вызовов в тестах).
export function blockCost(block: GeniusBlock, lrc: LrcLine[], s: number, e: number, _idf: ReturnType<typeof buildIdf> | null, P: Partial<ModelParams>): number {
  const fake = makeBlockCost([block], lrc, P);
  return fake.blockCost(0, s, e);
}

export interface PerBlockInfo {
  i: number;
  label: string;
  kind: string;
  startIdx: number | null;
  endIdx: number | null;
  cost: number;
  anchor: number;
  expectedLines: number;
  zeroWidth?: boolean;
  anchorAt?: number;
}

export interface ModelResult {
  blocks: (Range | null)[] | null;
  spans: Array<{ i: number; label: string; timeFromSec: number | null; timeToSec: number | null; lineFrom: number; lineTo: number }>;
  cost: number | null;
  perBlock: (PerBlockInfo | undefined)[];
  degenerate?: boolean;
  failed?: boolean;
  P: ModelParams;
  idf: ReturnType<typeof buildIdf>;
  m: number;
  starts?: number[];
  zeroWidth: Set<number>;
}

// ── Глобальный DP по стартам непустых блоков ────────────────────────────────
// Инварианты результата: монотонность, полное покрытие [0..m-1], без дыр/дублей,
// непустые блоки ≥ 1 строки, пустые блоки не получают строк.
export function mmodel(blocks: GeniusBlock[], lrc: LrcLine[], opts: { params?: Partial<ModelParams> } = {}): ModelResult {
  const P: ModelParams = { ...DEFAULTS, ...(opts.params ?? {}) };
  const { blockCost, idf } = makeBlockCost(blocks, lrc, P);
  const m = lrc.length;
  const idxNonEmpty: number[] = [];
  blocks.forEach((b, i) => { if (b.lines.length > 0) {idxNonEmpty.push(i);} });
  const k = idxNonEmpty.length;
  // ── v1.2 ── добавочный блок без свидетельств в LRC берёт 0 строк.
  // Свидетельство — точное совпадение текста первой строки блока с какой-то
  // строкой LRC (нормализация: регистр, пунктуация, пробелы). containment тут
  // не годится: «Hey, yeah, yeah» ⊂ «Yeah, hey, hey, hey, yeah, yeah» даёт 1.0
  // на общем словаре припевных междометий — три ложных попадания на трек.
  const norm = (s: string | null | undefined) => String(s || '').toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
  const AUX_KINDS = new Set(['interlude', 'instrumental', 'outro']);
  const lrcNorm = new Set(lrc.map((l) => norm(l.text)));
  const zeroWidth = new Set<number>();
  for (const bi of idxNonEmpty) {
    const b = blocks[bi];
    if (!AUX_KINDS.has(b.kind)) { continue; }
    if (!lrcNorm.has(norm(b.lines[0]))) { zeroWidth.add(bi); }
  }
  if (k === 0 || m === 0) {
    return { blocks: blocks.map(() => null), spans: [], cost: 0, perBlock: [], degenerate: true, P, idf, m, zeroWidth };
  }

  const INF = Infinity;
  const dp = Array.from({ length: k + 1 }, () => new Float64Array(m + 1).fill(INF));
  const back = Array.from({ length: k + 1 }, () => new Int32Array(m + 1).fill(-1));
  dp[0][0] = 0;
  for (let j = 0; j < k; j++) {
    for (let s = 0; s <= m; s++) {
      if (dp[j][s] === INF) {continue;}
      // v1.2: блок без свидетельств обязан занять нулевое окно [s..s-1], cost 0.
      // Это жёсткое ограничение, а не опция: иначе DP предпочтёт украсть строку
      // (стоимость −1.5 против 0) и вернётся к дефекту N10.
      if (zeroWidth.has(idxNonEmpty[j])) {
        const cand0 = dp[j][s];
        const better0 = cand0 < dp[j + 1][s] - P.eps
          || (Math.abs(cand0 - dp[j + 1][s]) <= P.eps && s > back[j + 1][s]);
        if (better0) {
          dp[j + 1][s] = cand0;
          back[j + 1][s] = s;
        }
        continue;
      }
      for (let e = s; e < m; e++) {
        const c = blockCost(idxNonEmpty[j], s, e);
        if (c === Infinity) {break;}
        const sNext = e + 1;
        const cand = dp[j][s] + c;
        const better = cand < dp[j + 1][sNext] - P.eps
          || (Math.abs(cand - dp[j + 1][sNext]) <= P.eps && s > back[j + 1][sNext]);
        if (better) {
          dp[j + 1][sNext] = cand;
          back[j + 1][sNext] = s;
        }
      }
    }
  }
  // dp[k][m]: все k непустых блоков покрывают [0..m-1] без дыр и дублей.
  if (dp[k][m] === INF) {
    return { blocks: null, spans: [], cost: null, perBlock: [], failed: true, P, idf, m, zeroWidth };
  }
  const bestC = dp[k][m];
  const startsArr = new Array(k).fill(-1);
  let cursor = m;
  for (let j = k - 1; j >= 0; j--) {
    startsArr[j] = back[j + 1][cursor];
    if (startsArr[j] < 0) {
      return { blocks: null, spans: [], cost: null, perBlock: [], failed: true, P, idf, m, zeroWidth };
    }
    cursor = startsArr[j];
  }
  const ends = startsArr.map((s, j) => (zeroWidth.has(idxNonEmpty[j]) ? s - 1 : (j === k - 1 ? m - 1 : startsArr[j + 1] - 1)));

  const outBlocks: (Range | null)[] = new Array(blocks.length).fill(null);
  const perBlock: (PerBlockInfo | undefined)[] = [];
  for (let j = 0; j < k; j++) {
    const bi = idxNonEmpty[j];
    if (zeroWidth.has(bi)) {
      // v1.2: строк не берёт; садится на пустой anchor в зазоре [startIdx..startIdx]
      perBlock[bi] = {
        i: bi, label: blocks[bi].label, kind: blocks[bi].kind,
        startIdx: null, endIdx: null, cost: 0, anchor: 0,
        expectedLines: blocks[bi].lines.length, zeroWidth: true, anchorAt: startsArr[j],
      };
      continue;
    }
    outBlocks[bi] = { startIdx: startsArr[j], endIdx: ends[j], lines: ends[j] - startsArr[j] + 1 } as Range;
    perBlock[bi] = {
      i: bi, label: blocks[bi].label, kind: blocks[bi].kind,
      startIdx: startsArr[j], endIdx: ends[j],
      cost: blockCost(bi, startsArr[j], ends[j]),
      anchor: containment(blocks[bi].lines[0], lrc[startsArr[j]]!.text),
      expectedLines: blocks[bi].lines.length,
    };
  }
  // Таймспан пустых блоков (роль «якорь таймлайна», см. A4)
  const spans: ModelResult['spans'] = [];
  for (let i = 0; i < blocks.length; i++) {
    if (blocks[i].lines.length === 0) {
      let prev = -1, next = m;
      for (let a = i - 1; a >= 0; a--) {if (outBlocks[a]) { prev = (outBlocks[a] as Range).endIdx; break; }}
      for (let b = i + 1; b < blocks.length; b++) {if (outBlocks[b]) { next = (outBlocks[b] as Range).startIdx; break; }}
      spans.push({
        i, label: blocks[i].label,
        timeFromSec: prev >= 0 ? lrc[prev]!.t ?? null : null,
        timeToSec: next < m ? lrc[next]!.t ?? null : null,
        lineFrom: prev, lineTo: next,
      });
    }
  }
  return { blocks: outBlocks, spans, cost: bestC, perBlock, starts: startsArr, zeroWidth, P, idf, m };
}

// Валидация разбиения: монотонность, покрытие без дыр, непустые блоки ≥ 1 строки.
export function validatePartition(partition: (Range | null)[] | null, blocks: GeniusBlock[], m: number, zeroWidthSet: Set<number> | null = null): string[] {
  const problems: string[] = [];
  let prevEnd = -1;
  (partition ?? []).forEach((p, i) => {
    const isNonEmpty = blocks[i] && blocks[i].lines.length > 0;
    if (isNonEmpty && (!p || p.startIdx === null)) {
      // v1.2: добавочный блок без свидетельств в LRC законно не мапится (0 строк).
      if (zeroWidthSet && zeroWidthSet.has(i)) { return; }
      problems.push(`block ${i} not mapped`); return;
    }
    if (!isNonEmpty && p && p.startIdx !== null) {problems.push(`block ${i} empty but has lines`);}
    if (isNonEmpty && p) {
      if (p.endIdx < p.startIdx) {problems.push(`block ${i} empty range`);}
      if (p.startIdx <= prevEnd) {problems.push(`block ${i} overlaps previous (start ${p.startIdx} <= prevEnd ${prevEnd})`);}
      if (p.startIdx > prevEnd + 1) {problems.push(`hole before block ${i}: [${prevEnd + 1}..${p.startIdx - 1}]`);}
      prevEnd = p.endIdx;
    }
  });
  if (prevEnd !== m - 1) {problems.push(`coverage ends at ${prevEnd}, expected ${m - 1}`);}
  return problems;
}
