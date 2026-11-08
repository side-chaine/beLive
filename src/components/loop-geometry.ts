/**
 * Геометрия петли — чистые функции «номер строки ↔ пиксель».
 *
 * Зачем отдельный модуль: вся арифметика петли раньше жила внутри хука и была
 * непроверяема без браузера. Здесь нет ни DOM, ни React — только числа, поэтому
 * её можно гонять тестом (см. loop-geometry.test.ts).
 *
 * 🔴 Главная ловушка, из-за которой скобка «прижималась к соседу» (баг v3):
 * у шва между вагонами ДВА разных края — правый край левого вагона и левый край
 * правого, между ними зазор (gap). Если для правой границы региона брать левый
 * край СЛЕДУЮЩЕГО вагона, скобка уезжает в зазор и наезжает на соседа.
 * Поэтому края региона считаются РАЗНЫМИ функциями: xStart и xEnd.
 */

export type GrabMode = 'step' | 'line';
export type GrabSide = 'start' | 'end';

/** Вагон в координатах контура (от левого верхнего угла скролл-контейнера). */
export interface WagonSpan {
  /** левый край полосы строк (content box) */
  left: number;
  /** ширина полосы строк */
  width: number;
  /** внешние края вагона (border box) — по ним режется регион на границах блоков */
  boxLeft: number;
  boxRight: number;
  top: number;
  bottom: number;
  /** номера строк этого вагона, по возрастанию */
  lineIndices: number[];
}

/** Отступ скобок от вагона. */
export const LOOP_PAD = 5;
/** Малое скругление: «скобки», а не «капсула» (канон Никиты 22:1x). */
export const LOOP_RADIUS = 5;
/** Длина горизонтального усика скобки. */
export const LOOP_CAP = 18;
/**
 * Минимальный просвет между усиками.
 *
 * 🔴 Ловушка: если усики встречаются в середине, узкий регион читается
 * ЗАКРЫТОЙ РАМКОЙ — тем самым «квадратом внутри лупа». Поэтому усик всегда
 * урезается так, чтобы между левым и правым остался просвет.
 */
export const LOOP_GAP = 14;

/** Длина усика для конкретной ширины региона: не длиннее, чем позволяет просвет. */
export function bracketCap(w: number, cap: number = LOOP_CAP): number {
  return Math.max(0, Math.min(cap, (w - LOOP_GAP) / 2));
}

/** Сколько строк вагона лежит строго левее шва `line`. */
function linesBefore(indices: number[], line: number): number {
  let n = 0;
  for (const li of indices) if (li < line) n++;
  return n;
}

/** Индекс вагона, которому принадлежит строка, либо -1 (строка в зазоре). */
export function wagonOfLine(spans: WagonSpan[], line: number): number {
  for (let i = 0; i < spans.length; i++) {
    const li = spans[i].lineIndices;
    if (li.length === 0) continue;
    if (line >= li[0] && line <= li[li.length - 1]) return i;
  }
  return -1;
}

/**
 * Левый край региона, если его первая строка — `line`.
 * Начало блока ⇒ внешний край блока (скобка обнимает блок целиком).
 * Середина блока ⇒ интерполяция по полосе строк.
 */
export function xStart(spans: WagonSpan[], line: number): number {
  if (spans.length === 0) return 0;
  const i = wagonOfLine(spans, line);
  if (i === -1) {
    // строка попала в зазор между вагонами — берём левый край следующего
    for (const sp of spans) {
      if (sp.lineIndices.length > 0 && sp.lineIndices[0] > line) return sp.boxLeft;
    }
    return spans[spans.length - 1].boxRight;
  }
  const sp = spans[i];
  const off = linesBefore(sp.lineIndices, line);
  if (off === 0) return sp.boxLeft;
  return sp.left + (off / sp.lineIndices.length) * sp.width;
}

/**
 * Правый край региона, если последняя строка — `endExclusive - 1`.
 * Конец блока ⇒ внешний край ЭТОГО блока (а не левый край следующего —
 * именно здесь и был баг).
 */
export function xEnd(spans: WagonSpan[], endExclusive: number): number {
  if (spans.length === 0) return 0;
  const last = endExclusive - 1;
  const i = wagonOfLine(spans, last);
  if (i === -1) {
    for (const sp of spans) {
      if (sp.lineIndices.length > 0 && sp.lineIndices[0] > last) return sp.boxLeft;
    }
    return spans[spans.length - 1].boxRight;
  }
  const sp = spans[i];
  const off = linesBefore(sp.lineIndices, endExclusive);
  if (off >= sp.lineIndices.length) return sp.boxRight;
  return sp.left + (off / sp.lineIndices.length) * sp.width;
}

/** Все строчные швы: границы каждой строки. */
export function buildLineSeams(spans: WagonSpan[]): number[] {
  const set = new Set<number>();
  for (const sp of spans) {
    for (const li of sp.lineIndices) {
      set.add(li);
      set.add(li + 1);
    }
  }
  return [...set].sort((a, b) => a - b);
}

/** Границы блоков и подблоков — по ним ходит верхняя (шаговая) зона. */
export function buildStepSeams(spans: WagonSpan[], subStarts: number[]): number[] {
  const set = new Set<number>();
  for (const sp of spans) {
    if (sp.lineIndices.length === 0) continue;
    set.add(sp.lineIndices[0]);
    set.add(sp.lineIndices[sp.lineIndices.length - 1] + 1);
  }
  for (const k of subStarts) set.add(k);
  return [...set].sort((a, b) => a - b);
}

export interface LoopGeo {
  spans: WagonSpan[];
  lineSeams: number[];
  stepSeams: number[];
  xStart(k: number): number;
  xEnd(k: number): number;
  /** Ближайший шов к курсору. `side` решает, по какому краю мерить. */
  snap(localX: number, side: GrabSide, mode: GrabMode): number;
}

export function buildLoopGeo(spans: WagonSpan[], subStarts: number[]): LoopGeo {
  const lineSeams = buildLineSeams(spans);
  const stepSeams = buildStepSeams(spans, subStarts);
  return {
    spans,
    lineSeams,
    stepSeams,
    xStart: (k: number) => xStart(spans, k),
    xEnd: (k: number) => xEnd(spans, k),
    snap(localX: number, side: GrabSide, mode: GrabMode): number {
      const list = mode === 'step' ? stepSeams : lineSeams;
      if (list.length === 0) return 0;
      let best = list[0];
      let bestD = Infinity;
      for (const k of list) {
        const x = side === 'start' ? xStart(spans, k) : xEnd(spans, k);
        const d = Math.abs(x - localX);
        if (d < bestD) {
          bestD = d;
          best = k;
        }
      }
      return best;
    },
  };
}

/** Вертикальные границы региона: от верха первого вагона до низа последнего. */
export function regionBounds(
  spans: WagonSpan[],
  startLine: number,
  endLine: number
): { top: number; bottom: number } {
  let top = Infinity;
  let bottom = -Infinity;
  for (const sp of spans) {
    const li = sp.lineIndices;
    if (li.length === 0) continue;
    const from = li[0];
    const to = li[li.length - 1];
    if (to < startLine || from > endLine) continue;
    top = Math.min(top, sp.top);
    bottom = Math.max(bottom, sp.bottom);
  }
  if (!isFinite(top) || !isFinite(bottom)) return { top: 0, bottom: 0 };
  return { top, bottom };
}

/** Левая скобка: верхний усик → скругление → вертикаль → скругление → нижний усик. */
export function leftBracket(
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  cap: number
): string {
  const rr = Math.min(r, w / 2, h / 2);
  const c = bracketCap(w, cap);
  return (
    `M${(x + c).toFixed(1)} ${y.toFixed(1)} ` +
    `H${(x + rr).toFixed(1)} ` +
    `Q${x.toFixed(1)} ${y.toFixed(1)} ${x.toFixed(1)} ${(y + rr).toFixed(1)} ` +
    `V${(y + h - rr).toFixed(1)} ` +
    `Q${x.toFixed(1)} ${(y + h).toFixed(1)} ${(x + rr).toFixed(1)} ${(y + h).toFixed(1)} ` +
    `H${(x + c).toFixed(1)}`
  );
}

/** Правая скобка — зеркально. Середина верхней и нижней кромки пустая: это и есть «скобки». */
export function rightBracket(
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  cap: number
): string {
  const rr = Math.min(r, w / 2, h / 2);
  const c = bracketCap(w, cap);
  return (
    `M${(x + w - c).toFixed(1)} ${y.toFixed(1)} ` +
    `H${(x + w - rr).toFixed(1)} ` +
    `Q${(x + w).toFixed(1)} ${y.toFixed(1)} ${(x + w).toFixed(1)} ${(y + rr).toFixed(1)} ` +
    `V${(y + h - rr).toFixed(1)} ` +
    `Q${(x + w).toFixed(1)} ${(y + h).toFixed(1)} ${(x + w - rr).toFixed(1)} ${(y + h).toFixed(1)} ` +
    `H${(x + w - c).toFixed(1)}`
  );
}

/**
 * Доля подблока, попавшая в регион [startLine, endLine] (включительно).
 * Возвращает {from, to} в процентах ширины подблока — ровно то, что просил
 * Никита: «заливать ровно те строки, что попали в регион».
 */
export function subFill(
  lineIndices: number[],
  startLine: number,
  endLine: number
): { from: number; to: number } {
  const n = lineIndices.length;
  if (n === 0) return { from: 0, to: 0 };
  let lo = n;
  let hi = 0;
  for (let i = 0; i < n; i++) {
    const li = lineIndices[i];
    if (li >= startLine && li <= endLine) {
      if (i < lo) lo = i;
      if (i > hi) hi = i;
    }
  }
  if (lo > hi) return { from: 0, to: 0 };
  return { from: (lo / n) * 100, to: ((hi + 1) / n) * 100 };
}
