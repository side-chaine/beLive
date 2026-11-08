import type { LoopContourShape } from './useLoopContourGeometry';
import type { GrabSide } from './loop-geometry';
import styles from './WagonTrain.module.css';

interface LoopContourProps {
  shapes: LoopContourShape[];
  /** какую половину сейчас тянут — она и загорается цветом режима */
  grabSide: GrabSide | null;
  /** вертикаль-магнит в точке прилипания */
  magnetX: number | null;
}

/**
 * Скобки петли — отдельный слой.
 *
 * Контракт:
 *   • янтарь = петля, но горит ТОЛЬКО обводка скобок — сами вагоны в петле
 *     выглядят как все остальные (канон Никиты 22:1x: «всё горит» = шум);
 *   • левая и правая половины — ОТДЕЛЬНЫЕ пути: иначе нельзя подсветить
 *     только ту половину, за которую взялся (канон 23:3x);
 *   • заливки и искры нет — движение только «дыхание» обводки.
 */
export function LoopContour({ shapes, grabSide, magnetX }: LoopContourProps) {
  if (shapes.length === 0) return null;
  const box = shapes[0];
  return (
    <svg className={styles.loopSvg} aria-hidden="true">
      {shapes.map((s, i) => (
        <g key={`lo${i}`}>
          <path
            className={styles.loopOutline}
            data-side="start"
            data-grabbed={grabSide === 'start' ? 'true' : undefined}
            d={s.left}
          />
          <path
            className={styles.loopOutline}
            data-side="end"
            data-grabbed={grabSide === 'end' ? 'true' : undefined}
            d={s.right}
          />
        </g>
      ))}
      {magnetX != null && (
        <line
          className={styles.loopMagnet}
          x1={magnetX}
          x2={magnetX}
          y1={box.y}
          y2={box.y + box.h}
        />
      )}
    </svg>
  );
}
