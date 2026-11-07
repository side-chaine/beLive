import { useState, useLayoutEffect } from 'react';
import type { RefObject, DependencyList } from 'react';

export interface LoopContourShape {
  /** Заливка контура (замкнутый скруглённый силуэт группы блоков). */
  fill: string;
  /** Обводка контура (тот же силуэт). */
  outline: string;
  /** Только верхняя кромка — по ней бежит искра прогресса (нижняя никогда не анимируется). */
  topEdge: string;
}

const PAD = 5;
const RADIUS = 14;

function roundedRectPath(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.min(r, w / 2, h / 2);
  return (
    `M${(x + rr).toFixed(1)} ${y.toFixed(1)} ` +
    `H${(x + w - rr).toFixed(1)} ` +
    `Q${x + w} ${y} ${x + w} ${(y + rr).toFixed(1)} ` +
    `V${(y + h - rr).toFixed(1)} ` +
    `Q${x + w} ${y + h} ${(x + w - rr).toFixed(1)} ${y + h} ` +
    `H${(x + rr).toFixed(1)} ` +
    `Q${x} ${y + h} ${x} ${(y + h - rr).toFixed(1)} ` +
    `V${(y + rr).toFixed(1)} ` +
    `Q${x} ${y} ${(x + rr).toFixed(1)} ${y} Z`
  );
}

// Верхняя кромка — только прямой участок между скруглениями (искра бежит здесь).
function topEdgePath(x: number, y: number, w: number, r: number): string {
  const rr = Math.min(r, w / 2);
  return `M${(x + rr).toFixed(1)} ${y.toFixed(1)} H${(x + w - rr).toFixed(1)}`;
}

/**
 * Геометрия единого контура петли. Группирует смежные `[data-in-loop="true"]`
 * вагоны в «пробеги» и рисует по одному скруглённому силуэту на группу.
 * Петля всегда непрерывна (loop.store добавляет только смежный блок), поэтому
 * группировка по DOM-смежности корректна.
 *
 * Возвращает для каждого силуэта: заливку, обводку и верхнюю кромку (отдельный
 * путь — по нему анимируется искра, не задевая суб-блоки на нижней кромке).
 */
export function useLoopContourGeometry(
  rootRef: RefObject<HTMLElement | null>,
  deps: DependencyList
): LoopContourShape[] {
  const [shapes, setShapes] = useState<LoopContourShape[]>([]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const recompute = () => {
      const rootRect = root.getBoundingClientRect();
      const sx = root.scrollLeft;
      const sy = root.scrollTop;
      const wagons = Array.from(
        root.querySelectorAll<HTMLElement>('[data-in-loop="true"]')
      );
      const next: LoopContourShape[] = [];
      let run: HTMLElement[] = [];

      const flush = () => {
        if (run.length === 0) return;
        let top = Infinity;
        let bottom = -Infinity;
        run.forEach(r => {
          const b = r.getBoundingClientRect();
          top = Math.min(top, b.top);
          bottom = Math.max(bottom, b.bottom);
        });
        const first = run[0].getBoundingClientRect();
        const last = run[run.length - 1].getBoundingClientRect();
        const x = first.left - rootRect.left + sx - PAD;
        const y = top - rootRect.top + sy - PAD;
        const w = last.right - first.left + PAD * 2;
        const h = bottom - top + PAD * 2;
        next.push({
          fill: roundedRectPath(x, y, w, h, RADIUS),
          outline: roundedRectPath(x, y, w, h, RADIUS),
          topEdge: topEdgePath(x, y, w, RADIUS),
        });
        run = [];
      };

      wagons.forEach((w, i) => {
        if (i > 0 && wagons[i - 1].nextElementSibling === w) {
          run.push(w);
        } else {
          flush();
          run = [w];
        }
      });
      flush();
      setShapes(next);
    };

    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(root);
    window.addEventListener('resize', recompute);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', recompute);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return shapes;
}
