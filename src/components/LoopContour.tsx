import type { LoopContourShape } from './useLoopContourGeometry';
import styles from './WagonTrain.module.css';

/**
 * Контур петли — отдельный компонент (Центр_2, 07.11).
 * Контракт движения:
 *   • янтарь = петля: равномерное «дыхание» обводки + искра прогресса ТОЛЬКО по
 *     верхней кромке (она свободна — .loopToggle сидит по центру правого края);
 *   • нижняя кромка никогда не анимируется (там ряд суб-блоков).
 * Заливка — статичная тёплая «помывка», без анимации.
 */
export function LoopContour({ shapes }: { shapes: LoopContourShape[] }) {
  if (shapes.length === 0) return null;
  return (
    <svg className={styles.loopSvg} aria-hidden="true">
      {shapes.map((s, i) => (
        <path key={`lf${i}`} className={styles.loopFill} d={s.fill} />
      ))}
      {shapes.map((s, i) => (
        <path
          key={`lo${i}`}
          className={styles.loopOutline}
          d={s.outline}
          pathLength={100}
        />
      ))}
      {shapes.map((s, i) => (
        <path
          key={`ls${i}`}
          className={styles.loopSpark}
          d={s.topEdge}
          pathLength={100}
        />
      ))}
    </svg>
  );
}
