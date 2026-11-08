import type { PointerEvent as ReactPointerEvent, KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { GrabMode, GrabSide } from './loop-geometry';
import type { LoopHandle } from './useLoopContourGeometry';
import styles from './WagonTrain.module.css';

interface LoopHandlesProps {
  handles: LoopHandle[];
  grab: { side: GrabSide; mode: GrabMode } | null;
  onBegin: (side: GrabSide, mode: GrabMode, e: ReactPointerEvent<HTMLButtonElement>) => void;
  onMove: (e: ReactPointerEvent<HTMLButtonElement>) => void;
  onEnd: (e: ReactPointerEvent<HTMLButtonElement>) => void;
  onHover: (side: GrabSide, mode: GrabMode) => void;
  onLeave: () => void;
  onNudge: (
    side: GrabSide,
    mode: GrabMode,
    dir: -1 | 1,
    e: ReactKeyboardEvent<HTMLButtonElement>
  ) => void;
}

/**
 * Ручки захвата скобки — две зоны на каждой вертикали (паттерн DAW, 50/50):
 *   верхняя половина → шаг (блоки и подблоки),
 *   нижняя половина  → строки.
 * Shift/Alt перебивают режим на время жеста.
 *
 * Ручки живут в координатах скролл-контейнера, поэтому скроллятся вместе с
 * вагонами: left/top считает геометрия, здесь только раскладка зон.
 */
export function LoopHandles({
  handles,
  grab,
  onBegin,
  onMove,
  onEnd,
  onHover,
  onLeave,
  onNudge,
}: LoopHandlesProps) {
  if (handles.length === 0) return null;

  const zone = (h: LoopHandle, mode: GrabMode, pos: 'top' | 'bottom') => {
    const active = grab?.side === h.side && grab.mode === mode;
    const label = h.side === 'start' ? 'Начало петли' : 'Конец петли';
    const hint = mode === 'step' ? 'шаг: блоки и подблоки' : 'по строкам';
    return (
      <button
        type="button"
        className={`${styles.loopZone} ${pos === 'top' ? styles.loopZoneTop : styles.loopZoneBottom}`}
        aria-label={`${label} — ${hint}`}
        title={hint}
        data-active={active ? 'true' : undefined}
        onPointerDown={e => onBegin(h.side, mode, e)}
        onPointerMove={onMove}
        onPointerUp={onEnd}
        onPointerCancel={onEnd}
        onPointerEnter={() => onHover(h.side, mode)}
        onPointerLeave={onLeave}
        onFocus={() => onHover(h.side, mode)}
        onBlur={onLeave}
        onKeyDown={e => {
          if (e.key === 'ArrowLeft') onNudge(h.side, mode, -1, e);
          else if (e.key === 'ArrowRight') onNudge(h.side, mode, 1, e);
        }}
      >
        <span
          className={mode === 'step' ? styles.loopGripStep : styles.loopGripLine}
          aria-hidden="true"
        />
      </button>
    );
  };

  return (
    <>
      {handles.map((h, i) => (
        <div
          key={`${h.side}-${i}`}
          className={styles.loopHandle}
          style={{ left: h.x, top: h.y, height: h.h }}
        >
          {zone(h, 'step', 'top')}
          {zone(h, 'line', 'bottom')}
        </div>
      ))}
    </>
  );
}
