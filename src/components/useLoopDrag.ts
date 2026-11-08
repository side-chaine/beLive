import { useCallback, useRef, useState } from 'react';
import type { RefObject, PointerEvent as ReactPointerEvent, KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { LoopGeo, GrabMode, GrabSide } from './loop-geometry';

interface UseLoopDragArgs {
  rootRef: RefObject<HTMLElement | null>;
  geo: LoopGeo | null;
  /** первая строка петли (null — петли нет) */
  startLine: number | null;
  /** последняя строка петли включительно */
  endLine: number | null;
  onCommit: (startLine: number, endLine: number) => void;
}

export interface LoopDragApi {
  /** первая строка петли (с учётом предпросмотра) */
  k1: number;
  /** эксклюзивный шов: последняя строка = k2 - 1 */
  k2: number;
  hasLoop: boolean;
  grab: { side: GrabSide; mode: GrabMode } | null;
  begin: (side: GrabSide, mode: GrabMode, e: ReactPointerEvent<HTMLButtonElement>) => void;
  move: (e: ReactPointerEvent<HTMLButtonElement>) => void;
  end: (e: ReactPointerEvent<HTMLButtonElement>) => void;
  hover: (side: GrabSide, mode: GrabMode) => void;
  leave: () => void;
  nudge: (side: GrabSide, mode: GrabMode, dir: -1 | 1, e: ReactKeyboardEvent<HTMLButtonElement>) => void;
}

function nearestIndex(list: number[], value: number): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < list.length; i++) {
    const d = Math.abs(list[i] - value);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/**
 * Драг скобки: две зоны хвата, два режима, запись в стор ТОЛЬКО на pointerup.
 *
 * Во время жеста живёт предпросмотр (`preview`) — стор не трогаем, иначе
 * на каждый пиксель движения уходил бы setBoundaryLines и пересчёт
 * loopSubBlockKeys по всему треку.
 *
 * Захват держим на самой кнопке через setPointerCapture: ручка во время драга
 * едет вместе со скобкой, и без capture события терялись бы на полпути.
 */
export function useLoopDrag({ rootRef, geo, startLine, endLine, onCommit }: UseLoopDragArgs): LoopDragApi {
  const [preview, setPreview] = useState<{ k1: number; k2: number } | null>(null);
  const [grab, setGrab] = useState<{ side: GrabSide; mode: GrabMode } | null>(null);

  const previewRef = useRef<{ k1: number; k2: number } | null>(null);
  const dragRef = useRef<{ side: GrabSide; mode: GrabMode; ox: number } | null>(null);

  const hasLoop = startLine != null && endLine != null;
  const baseK1 = startLine ?? 0;
  const baseK2 = endLine != null ? endLine + 1 : 0;

  const k1 = preview?.k1 ?? baseK1;
  const k2 = preview?.k2 ?? baseK2;

  const begin = useCallback(
    (side: GrabSide, mode: GrabMode, e: ReactPointerEvent<HTMLButtonElement>) => {
      const root = rootRef.current;
      if (!geo || !root) return;
      e.preventDefault();
      e.stopPropagation();
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* Safari до 13 не умеет — драг всё равно отработает через onPointerMove */
      }
      const rr = root.getBoundingClientRect();
      dragRef.current = { side, mode, ox: rr.left - root.scrollLeft };
      const start = { k1, k2 };
      previewRef.current = start;
      setPreview(start);
      setGrab({ side, mode });
    },
    [geo, rootRef, k1, k2]
  );

  const move = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>) => {
      const d = dragRef.current;
      if (!d || !geo) return;
      const mode: GrabMode = e.shiftKey ? 'line' : e.altKey ? 'step' : d.mode;
      if (mode !== d.mode) {
        d.mode = mode;
        setGrab({ side: d.side, mode });
      }
      const k = geo.snap(e.clientX - d.ox, d.side, mode);
      const p = previewRef.current ?? { k1, k2 };
      const next =
        d.side === 'start'
          ? { k1: Math.min(k, p.k2 - 1), k2: p.k2 }
          : { k1: p.k1, k2: Math.max(k, p.k1 + 1) };
      previewRef.current = next;
      setPreview(next);
    },
    [geo, k1, k2]
  );

  const end = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>) => {
      const d = dragRef.current;
      const p = previewRef.current;
      dragRef.current = null;
      previewRef.current = null;
      setGrab(null);
      setPreview(null);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* уже отпущен */
      }
      if (!d || !p) return;
      onCommit(p.k1, p.k2 - 1);
    },
    [onCommit]
  );

  const hover = useCallback((side: GrabSide, mode: GrabMode) => {
    if (dragRef.current) return;
    setGrab({ side, mode });
  }, []);

  const leave = useCallback(() => {
    if (dragRef.current) return;
    setGrab(null);
  }, []);

  const nudge = useCallback(
    (side: GrabSide, mode: GrabMode, dir: -1 | 1, e: ReactKeyboardEvent<HTMLButtonElement>) => {
      if (!geo) return;
      const eff: GrabMode = e.shiftKey ? 'line' : e.altKey ? 'step' : mode;
      const list = eff === 'step' ? geo.stepSeams : geo.lineSeams;
      if (list.length === 0) return;
      e.preventDefault();
      e.stopPropagation();
      const cur = side === 'start' ? k1 : k2;
      const at = nearestIndex(list, cur);
      const next = list[Math.max(0, Math.min(list.length - 1, at + dir))];
      const p =
        side === 'start'
          ? { k1: Math.min(next, k2 - 1), k2 }
          : { k1, k2: Math.max(next, k1 + 1) };
      onCommit(p.k1, p.k2 - 1);
    },
    [geo, k1, k2, onCommit]
  );

  return { k1, k2, hasLoop, grab, begin, move, end, hover, leave, nudge };
}
