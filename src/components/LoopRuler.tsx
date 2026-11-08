import styles from './WagonTrain.module.css';

interface LoopRulerProps {
  /** сколько строк в вагоне */
  lineCount: number;
  /** смещения (в строках) начал подблоков — на них стоят высокие засечки */
  subBreaks: number[];
}

/**
 * Линейка строк на дне вагона.
 *
 * В покое — серая и тихая: заметна, но не спорит с контентом («как на
 * линейке», канон Никиты 23:3x). Цвет режима засечки получают только на время
 * жеста, через `data-loop-grab` на корне — ноль рендеров, чистый CSS.
 */
export function LoopRuler({ lineCount, subBreaks }: LoopRulerProps) {
  if (lineCount < 2) return null;
  return (
    <span className={styles.loopRuler} aria-hidden="true">
      {Array.from({ length: lineCount - 1 }, (_, i) => (
        <span
          key={`t${i}`}
          className={styles.loopTick}
          style={{ left: `${((i + 1) / lineCount) * 100}%` }}
        />
      ))}
      {subBreaks.map((b, i) => (
        <span
          key={`m${i}`}
          className={styles.loopTickMajor}
          style={{ left: `${(b / lineCount) * 100}%` }}
        />
      ))}
    </span>
  );
}
