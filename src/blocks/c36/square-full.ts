// square-full.ts — BL-050-full (бриф §12.3–12.6).
//
// Полный сплиттер квадрата: rule D на ЛОГИЧЕСКИХ (Genius) строках с
// логическим→LRC маппингом, near-train матчер (θ=0.8, min-containment),
// вторичные предикаты §12.4 (closed square + addition → [4,2], рондо S20),
// min-containment хвоста, GIGO-гварды и контур §12.6
// {mode, units, roman, conf, tRatio}.
//
// FALLBACK = computeBalancedSplit → нулевая регрессия по построению.

import {
  computeBalancedSplit,
  createSubBlocks,
  detectEchoBreakPoint,
  normalizeText,
  type RuleDResult,
  type SubBlock,
} from '../../utils/block-utils.js';

// ─── Константы (бриф §12.3, §12.5, §12.6) ───────────────────────────────────

/** near-train порог. Окно калибровки — (0.750, 0.800]; θ=0.8 на границе. */
export const NEAR_THETA = 0.8;

/** Рондо-классификация требует g ≥ 4 (g=2/g=3 — ложные [2,2,2,3]). */
export const RONDO_G_MIN = 4;

/** GGG-collapse: поезд из k ≥ 3 повторов группы → единый repeat-юнит. */
export const GGG_K_COLLAPSE = 3;

/** tail-giant: хвост b ≥ 3a → разрез отклоняется (таблица). */
export const TAIL_GIANT_RATIO = 3;

/** Изохронность: t-ratio ≤ 1.4 → +0.1 к conf. */
export const T_RATIO_MAX = 1.4;
export const T_RATIO_CONF_BUMP = 0.1;

/** Потолок юнитов: Римские не выше IV. */
export const MAX_UNITS = 4;

/** conf-тиры §12.6. */
export const CONF = {
  unison: 0.95,
  exactTrain: 0.95,
  nearTrain: 0.75,
  pairExactSquare: 0.70,
  rondo: 0.65,
  anaphora: 0.55,
  fallback: 0,
} as const;

const ROMAN = ['I', 'II', 'III', 'IV'] as const;

// ─── Типы ───────────────────────────────────────────────────────────────────

export type SquareMode =
  | 'unison'
  | 'exact-train'
  | 'near-train'
  | 'pair-exact-square'
  | 'rondo'
  | 'anaphora'
  | 'fallback';

export interface SquareFullOpts {
  /** Логические (Genius) строки блока — rule D идёт по ним. */
  logicalLines?: readonly string[];
  /** logical index → локальный LRC index (0..n-1). Длина = logicalLines.length. */
  logicalToLrc?: readonly number[];
  /** Таймкоды LRC-строк, выровненные с lineIndices (локально). */
  times?: readonly (number | null)[];
  /** Переопределение θ (калибровка на корпусе). */
  theta?: number;
}

export interface SquareFullResult {
  mode: SquareMode;
  /** Размеры юнитов, напр. [6,3]. */
  units: number[];
  /** Римские метки юнитов (I..IV). */
  roman: string[];
  /** Уверенность 0..1 (§12.6). */
  conf: number;
  /** Изохронность копий (max/min), null если таймкодов нет. */
  tRatio: number | null;
  groupSize: number;
  copies: number;
  /** Сработавший гвард (null — чисто). */
  guard: string | null;
}

// ─── Утилиты ────────────────────────────────────────────────────────────────

function tokens(text: string): Set<string> {
  return new Set(text.split(/\s+/).filter((w) => w.length > 0));
}

/**
 * min-containment: доля токенов МЕНЬШЕЙ строки, покрытая большей.
 * "and i went" ⊂ "and i went down" → 1.0 (не 2/3, как у Жаккара).
 * Это ключ к near-train: короткая вариация строки не режет группу.
 */
export function lineSimilarity(a: string, b: string): number {
  if (a === b) {return 1;}
  const A = tokens(a);
  const B = tokens(b);
  if (A.size === 0 || B.size === 0) {return 0;}
  let inter = 0;
  for (const w of A) {if (B.has(w)) {inter++;}}
  return inter / Math.min(A.size, B.size);
}

interface Train {
  split: number[];
  groupSize: number;
  copies: number;
}

/** Точный поезд: непрерывные полные копии группы g (PRIMARY — равенство). */
export function exactTrain(texts: readonly string[]): Train | null {
  const n = texts.length;
  for (let g = Math.floor(n / 2); g >= 2; g--) {
    if (2 * g > n) {continue;}
    let copies = 1;
    while ((copies + 1) * g <= n) {
      let ok = true;
      for (let k = 0; k < g; k++) {
        if (texts[k] !== texts[copies * g + k]) {ok = false; break;}
      }
      if (!ok) {break;}
      copies++;
    }
    if (copies < 2) {continue;}
    const square = copies * g;
    const tail = n - square;
    return { split: tail === 0 ? Array(copies).fill(g) : [square, tail], groupSize: g, copies };
  }
  return null;
}

/**
 * Near-train: как exactTrain, но совпадение строки — min-containment ≥ θ.
 * Требуется majority-якорь (≥ половины строк группы точны), иначе
 * near-матчер ловит случайные повторы.
 */
export function nearTrain(texts: readonly string[], theta = NEAR_THETA): Train | null {
  const n = texts.length;
  const minExact = (g: number): number => Math.ceil(g / 2);

  const copyMatches = (g: number, base: number): { sim: number; exact: number } => {
    let sum = 0;
    let exact = 0;
    for (let k = 0; k < g; k++) {
      const a = texts[k];
      const b = texts[base + k];
      if (a === b) {exact++;}
      sum += lineSimilarity(a, b);
    }
    return { sim: sum / g, exact };
  };

  for (let g = Math.floor(n / 2); g >= 2; g--) {
    if (2 * g > n) {continue;}
    const first = copyMatches(g, g);
    if (first.sim < theta || first.exact < minExact(g)) {continue;}

    let copies = 2;
    while ((copies + 1) * g <= n) {
      const next = copyMatches(g, copies * g);
      if (next.sim < theta || next.exact < minExact(g)) {break;}
      copies++;
    }
    const square = copies * g;
    const tail = n - square;
    return { split: tail === 0 ? Array(copies).fill(g) : [square, tail], groupSize: g, copies };
  }
  return null;
}

/**
 * Рондо S20: [G]-вставка-[G]-хвост → [g, ins, g, tail].
 * Despacito hook = [4,3,4,3]. Требует g ≥ RONDO_G_MIN.
 */
export function rondoTrain(texts: readonly string[]): Train | null {
  const n = texts.length;
  for (let g = Math.floor(n / 3); g >= RONDO_G_MIN; g--) {
    for (let ins = 1; 2 * g + ins <= n; ins++) {
      let ok = true;
      for (let k = 0; k < g; k++) {
        if (texts[k] !== texts[g + ins + k]) {ok = false; break;}
      }
      if (!ok) {continue;}
      const tail = n - (2 * g + ins);
      const split = tail > 0 ? [g, ins, g, tail] : [g, ins, g];
      return { split, groupSize: g, copies: 2 };
    }
  }
  return null;
}

// ─── Основная функция ───────────────────────────────────────────────────────

function fallbackResult(n: number, guard: string | null): SquareFullResult {
  const units = computeBalancedSplit(n);
  return {
    mode: 'fallback',
    units,
    roman: units.map((_, i) => ROMAN[i] ?? String(i + 1)),
    conf: CONF.fallback,
    tRatio: null,
    groupSize: 0,
    copies: 0,
    guard,
  };
}

function toRoman(units: number[]): string[] {
  return units.map((_, i) => ROMAN[i] ?? String(i + 1));
}

/** Логические юниты → LRC-юниты. null — маппинг невалиден (немонотонен/не покрывает). */
function mapUnitsToLrc(
  units: readonly number[],
  toLrc: readonly number[],
  n: number,
): number[] | null {
  const bounds: number[] = [0];
  let acc = 0;
  for (const u of units) {acc += u; bounds.push(acc);}

  const lrcBounds: number[] = bounds.map((x) => (x >= toLrc.length ? n : toLrc[x]));
  if (lrcBounds[0] !== 0) {return null;}
  for (let i = 1; i < lrcBounds.length; i++) {
    if (lrcBounds[i] <= lrcBounds[i - 1]) {return null;}
  }
  if (lrcBounds[lrcBounds.length - 1] !== n) {return null;}

  const out: number[] = [];
  for (let i = 1; i < lrcBounds.length; i++) {out.push(lrcBounds[i] - lrcBounds[i - 1]);}
  return out;
}

/** Изохронность копий: max/min длительности копий. */
function copyTimeRatio(
  times: readonly (number | null)[] | undefined,
  groupSize: number,
  copies: number,
): number | null {
  if (!times || copies < 2) {return null;}
  const starts: number[] = [];
  for (let c = 0; c <= copies; c++) {
    const t = times[c * groupSize];
    if (t == null) {return null;}
    starts.push(t);
  }
  const spans: number[] = [];
  for (let c = 0; c < copies; c++) {
    const span = starts[c + 1] - starts[c];
    if (span <= 0) {return null;}
    spans.push(span);
  }
  const min = Math.min(...spans);
  const max = Math.max(...spans);
  return max / min;
}

/** GIGO-гварды над финальными юнитами. Возвращает имя гварда или null. */
function checkGuards(units: readonly number[], mode: SquareMode): string | null {
  if (units.length > MAX_UNITS) {return 'roman-cap';}
  if (mode === 'exact-train' || mode === 'near-train' || mode === 'pair-exact-square') {
    if (units.length === 2 && units[1] >= TAIL_GIANT_RATIO * units[0]) {return 'tail-giant';}
    if (units.length === 2 && units[0] === 6 && units[1] === 2) {return 'font-guard';}
  }
  return null;
}

/**
 * Полный сплиттер (BL-050-full).
 *
 * Порядок: unison → exact-train → рондо → near-train → anaphora → fallback.
 * Логические строки (если переданы) — домен rule D; разрыв маппится на
 * границу LRC-группы через logicalToLrc.
 */
export function splitSquareFull(
  lineIndices: readonly number[],
  lines: readonly string[],
  opts: SquareFullOpts = {},
): SquareFullResult {
  const n = lineIndices.length;
  if (n < 6) {return fallbackResult(n, 'n<6');}

  const lrcTexts = lineIndices.map((i) => normalizeText(lines[i] ?? ''));

  // unison-collapse: все строки идентичны → один юнит (не N подблоков).
  if (lrcTexts.length > 0 && lrcTexts[0].length > 0 && lrcTexts.every((t) => t === lrcTexts[0])) {
    return {
      mode: 'unison', units: [n], roman: ['I'], conf: CONF.unison,
      tRatio: null, groupSize: n, copies: 1, guard: null,
    };
  }

  // Домен: логические строки (если есть валидный маппинг) либо LRC.
  const useLogical =
    !!opts.logicalLines && opts.logicalLines.length > 0 &&
    !!opts.logicalToLrc && opts.logicalToLrc.length === opts.logicalLines.length;

  const texts = useLogical ? opts.logicalLines!.map((l) => normalizeText(l)) : lrcTexts;
  const toLrc = useLogical ? opts.logicalToLrc! : null;

  const build = (
    train: Train,
    mode: SquareMode,
    conf: number,
  ): SquareFullResult | null => {
    const units = toLrc ? mapUnitsToLrc(train.split, toLrc, n) : train.split;
    if (!units) {return null;}

    // GGG-collapse: k ≥ 3 повторов группы → единый repeat-юнит.
    if (train.copies >= GGG_K_COLLAPSE) {
      const collapsed = [n];
      return {
        mode, units: collapsed, roman: ['I'], conf,
        tRatio: null, groupSize: train.groupSize, copies: train.copies, guard: 'ggg-collapse',
      };
    }

    const guard = checkGuards(units, mode);
    if (guard && guard !== 'font-guard') {return null;}

    const tRatio = copyTimeRatio(opts.times, train.groupSize, train.copies);
    const bumped = tRatio !== null && tRatio <= T_RATIO_MAX ? conf + T_RATIO_CONF_BUMP : conf;
    return {
      mode, units, roman: toRoman(units), conf: Math.min(1, bumped),
      tRatio, groupSize: train.groupSize, copies: train.copies, guard,
    };
  };

  // 1. Точный поезд. g=2 → closed square + addition (pair-exact-square).
  const exact = exactTrain(texts);
  if (exact) {
    const mode: SquareMode = exact.groupSize === 2 ? 'pair-exact-square' : 'exact-train';
    const conf = mode === 'pair-exact-square' ? CONF.pairExactSquare : CONF.exactTrain;
    const res = build(exact, mode, conf);
    if (res) {return res;}
  }

  // 2. Рондо S20 (g ≥ 4): [G]-вставка-[G]-хвост.
  const rondo = rondoTrain(texts);
  if (rondo) {
    const res = build(rondo, 'rondo', CONF.rondo);
    if (res) {return res;}
  }

  // 3. Near-train (θ): extension для V3/Chorus 1 → [6,4].
  const near = nearTrain(texts, opts.theta ?? NEAR_THETA);
  if (near) {
    const res = build(near, 'near-train', CONF.nearTrain);
    if (res) {return res;}
  }

  // 4. Anaphora-break (echo v2): живой echo, fingerprint-матч.
  if (!useLogical) {
    const echo = detectEchoBreakPoint([...lineIndices], [...lines]);
    if (echo !== null) {
      const units = [echo, n - echo];
      if (units[0] > 0 && units[1] > 0) {
        const guard = checkGuards(units, 'anaphora');
        if (!guard || guard === 'font-guard') {
          return {
            mode: 'anaphora', units, roman: toRoman(units), conf: CONF.anaphora,
            tRatio: null, groupSize: 0, copies: 0, guard,
          };
        }
      }
    }
  }

  return fallbackResult(n, exact || rondo || near ? 'guard-rejected' : null);
}

/** Адаптер: RuleDResult (lite) → SquareFullResult-совместимый вид. */
export function fromRuleD(r: RuleDResult): Pick<SquareFullResult, 'units' | 'groupSize' | 'copies'> {
  return { units: r.split, groupSize: r.groupSize, copies: r.copies };
}

/**
 * Точка wiring: подблоки по полному сплиттеру + сам результат контура.
 * Возвращает и SubBlock[] (для UI), и SquareFullResult (§12.6: mode/conf/roman).
 * Покрытие гарантировано: splitSquareFull всегда возвращает разбиение n.
 */
export function createSubBlocksFull(
  lineIndices: number[],
  lines: string[],
  opts: SquareFullOpts = {},
  maxLines = 6,
): { blocks: SubBlock[]; result: SquareFullResult } {
  const result = splitSquareFull(lineIndices, lines, opts);
  return { blocks: createSubBlocks(lineIndices, maxLines, undefined, result.units), result };
}
