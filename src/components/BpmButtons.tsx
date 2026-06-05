/* ============================================================
 * BpmButtons.tsx
 * ------------------------------------------------------------
 * BPM capsule: unified control module
 * [-5] | [BPM / value] | [+5]
 *
 * Center = display (BPM label + value).
 * Sides = ghost controls with B/M engraving.
 * Stateless: receives rate + callback, no store coupling.
 * ============================================================ */

import styles from './BpmButtons.module.css';

interface BpmButtonsProps {
  /** Current playback rate (1.0 = original tempo) */
  playbackRate: number;
  /** Disables all sections (e.g. during practice session) */
  disabled?: boolean;
  /** Called with clamped, step-rounded new rate */
  onChange: (rate: number) => void;
}

const STEP = 0.05;
const MIN = 0.25;
const MAX = 4.0;

function clampRate(rate: number): number {
  return Math.max(MIN, Math.min(MAX, rate));
}

function roundToStep(rate: number): number {
  return Math.round(rate * 100) / 100;
}

export function BpmButtons({
  playbackRate,
  disabled = false,
  onChange,
}: BpmButtonsProps) {
  const isModified = playbackRate !== 1;

  const handleDown = () => onChange(roundToStep(clampRate(playbackRate - STEP)));
  const handleReset = () => onChange(1);
  const handleUp = () => onChange(roundToStep(clampRate(playbackRate + STEP)));

  return (
    <div
      className={styles.capsule}
      role="group"
      aria-label="Playback tempo"
      data-modified={String(isModified)}
      data-disabled={String(disabled)}
    >
      <button
        type="button"
        className={`${styles.section} ${styles.side}`}
        data-letter="B"
        onClick={handleDown}
        disabled={disabled}
        aria-label="Slow down 5 percent"
      >
        <span className={styles.digit}>−5</span>
      </button>

      <button
        type="button"
        className={`${styles.section} ${styles.center}`}
        data-letter="P"
        onClick={handleReset}
        disabled={disabled}
        aria-label={
          isModified
            ? `Reset tempo to 100 percent, currently ${Math.round(playbackRate * 100)} percent`
            : 'Original tempo 100 percent'
        }
      >
        <span className={`${styles.digit} ${styles.centerDigit}`}>{Math.round(playbackRate * 100)}%</span>
      </button>

      <button
        type="button"
        className={`${styles.section} ${styles.side}`}
        data-letter="M"
        onClick={handleUp}
        disabled={disabled}
        aria-label="Speed up 5 percent"
      >
        <span className={styles.digit}>+5</span>
      </button>
    </div>
  );
}
