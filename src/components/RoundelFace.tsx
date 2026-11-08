import type { AnimationEvent } from 'react';
import { useRoundelPulse } from '../hooks/useRoundelPulse';
import styles from './PlayPauseRoundel.module.css';

interface RoundelFaceProps {
  playing: boolean;
  /** Splash copy: identical pixels, but inert (no store, no audio imports). */
  decorative?: boolean;
  onClick?: () => void;
}

/**
 * Pure presentational play/pause roundel. Deliberately has NO dependency on the
 * audio graph: the startup splash renders this before any track exists, so it
 * must not pull engine-v3 / stores into the first-paint module graph.
 *
 * The interactive deck version is `DeckPlayPause` (same component + state).
 * Only the interactive copy subscribes to the roundel pulse — the splash twin
 * stays static so the splash → deck hand-off remains pixel-identical.
 */
export function RoundelFace({ playing, decorative = false, onClick }: RoundelFaceProps) {
  const { pulseKey, pulseActive, fire, endPulse } = useRoundelPulse('play', !decorative);

  return (
    <button
      type="button"
      className={`${styles.root} ${decorative ? styles.decorative : ''}`}
      data-bl-playpause={decorative ? undefined : ''}
      data-playing={playing ? 'true' : 'false'}
      onClick={decorative ? undefined : () => { fire(); onClick?.(); }}
      tabIndex={decorative ? -1 : 0}
      aria-hidden={decorative ? true : undefined}
      aria-label={playing ? 'Pause' : 'Play'}
      aria-pressed={decorative ? undefined : playing}
      title={decorative ? undefined : 'Play / Pause (Space)'}
    >
      <span className={styles.face}>
        <span className={styles.border} />
        <span className={styles.inner} />
        <span className={styles.icon}>
          {playing ? (
            <span className={styles.pause}>
              <span className={styles.pauseBar} />
              <span className={styles.pauseBar} />
            </span>
          ) : (
            <span className={styles.play} />
          )}
        </span>
        {pulseActive && (
          <span
            key={pulseKey}
            className={styles.pulse}
            data-bl-pulse={pulseKey}
            aria-hidden="true"
            onAnimationEnd={(e: AnimationEvent<HTMLSpanElement>) => {
              // ignore the nested sweep's own animationend
              if (e.target === e.currentTarget) {endPulse();}
            }}
          >
            <span className={styles.pulseLit} />
            <span className={styles.pulseSweep} />
          </span>
        )}
      </span>
    </button>
  );
}
