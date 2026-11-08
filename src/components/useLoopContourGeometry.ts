import { useState, useLayoutEffect, useMemo } from 'react';
import type { RefObject } from 'react';
import type { TextBlock } from '../stores/blocks.store';
import {
  buildLoopGeo,
  regionBounds,
  leftBracket,
  rightBracket,
  LOOP_PAD,
  LOOP_RADIUS,
  LOOP_CAP,
  type LoopGeo,
  type GrabSide,
  type WagonSpan,
} from './loop-geometry';

/**
 * Скобки петли: один силуэт = левая и правая половины.
 * Верхняя и нижняя кромки намеренно разорваны — поэтому группа читается как
 * «( ---- )», а не как коробка вокруг блоков.
 */
export interface LoopContourShape {
  left: string;
  right: string;
  /** габарит скобок в координатах контура — по нему ставятся ручки */
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Ручка захвата: стоит ровно на вертикали скобки. */
export interface LoopHandle {
  side: GrabSide;
  x: number;
  y: number;
  h: number;
}

/**
 * Измеряет вагоны и собирает геометрию.
 *
 * 🔴 Почему `layoutKey`, а не `deps`-массив: старый вариант принимал
 * `DependencyList` и создавался инлайном на каждый рендер ⇒ эффект перезапускался
 * ВСЕГДА, включая каждое обновление activeLineIndex во время проигрывания.
 * На каждом таком рендере шёл querySelectorAll + getComputedStyle по всем
 * вагонам. Теперь замер кэширован и повторяется только при смене раскладки.
 */
export function useLoopGeometry(
  rootRef: RefObject<HTMLElement | null>,
  blocks: TextBlock[],
  subStarts: number[],
  layoutKey: string
): LoopGeo | null {
  const [spans, setSpans] = useState<WagonSpan[]>([]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const measure = () => {
      const els = Array.from(root.querySelectorAll<HTMLElement>('button[data-block-type]'));
      if (els.length === 0 || els.length !== blocks.length) {
        setSpans([]);
        return;
      }
      const rootRect = root.getBoundingClientRect();
      // начало координат контура: скролл-контейнер сдвигает содержимое,
      // поэтому scrollLeft/scrollTop вычитаем — иначе скобки «уедут» при скролле.
      const ox = rootRect.left - root.scrollLeft;
      const oy = rootRect.top - root.scrollTop;

      const next: WagonSpan[] = els.map((el, i) => {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        const bl = parseFloat(cs.borderLeftWidth) || 0;
        const br = parseFloat(cs.borderRightWidth) || 0;
        const pl = parseFloat(cs.paddingLeft) || 0;
        const pr = parseFloat(cs.paddingRight) || 0;
        return {
          boxLeft: r.left - ox,
          boxRight: r.right - ox,
          left: r.left - ox + bl + pl,
          width: Math.max(0, r.width - bl - br - pl - pr),
          top: r.top - oy,
          bottom: r.bottom - oy,
          lineIndices: blocks[i]?.lineIndices ?? [],
        };
      });
      setSpans(next);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [layoutKey]);

  return useMemo(
    () => (spans.length === 0 ? null : buildLoopGeo(spans, subStarts)),
    [spans, subStarts]
  );
}

/**
 * Силуэт по номерам строк. Границы региона — включительные (`endLine` — последняя
 * строка петли), поэтому снаружи передаётся `endLine + 1` как эксклюзивный шов.
 */
export function buildLoopShapes(
  geo: LoopGeo,
  startLine: number,
  endLine: number
): LoopContourShape[] {
  if (endLine < startLine) return [];
  const sx = geo.xStart(startLine);
  const ex = geo.xEnd(endLine + 1);
  const { top, bottom } = regionBounds(geo.spans, startLine, endLine);
  if (!isFinite(top) || !isFinite(bottom) || bottom <= top) return [];

  const x = sx - LOOP_PAD;
  const y = top - LOOP_PAD;
  const w = Math.max(ex - sx, 2) + LOOP_PAD * 2;
  const h = bottom - top + LOOP_PAD * 2;

  return [
    {
      left: leftBracket(x, y, w, h, LOOP_RADIUS, LOOP_CAP),
      right: rightBracket(x, y, w, h, LOOP_RADIUS, LOOP_CAP),
      x,
      y,
      w,
      h,
    },
  ];
}

/** Ручки стоят на вертикалях скобок. */
export function handlesOf(shapes: LoopContourShape[]): LoopHandle[] {
  const out: LoopHandle[] = [];
  for (const s of shapes) {
    out.push({ side: 'start', x: s.x, y: s.y, h: s.h });
    out.push({ side: 'end', x: s.x + s.w, y: s.y, h: s.h });
  }
  return out;
}
