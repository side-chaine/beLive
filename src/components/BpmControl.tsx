import { useAudioStore } from '../stores/audio.store';
import styles from './BpmControl.module.css';

export function BpmControl() {
  const playbackRate = useAudioStore(s => s.playbackRate);
  const ae = (window as any).audioEngine;

  const setRate = (rate: number) => {
    const clamped = Math.max(0.5, Math.min(2.0, rate));
    const rounded = Math.round(clamped * 100) / 100;
    ae?.setPlaybackRate?.(rounded);
    useAudioStore.setState({ playbackRate: rounded });
  };

  const pct = Math.round(playbackRate * 100);

  return (
    <div className={styles.root}>
      <button
        className={styles.btn}
        onClick={() => setRate(playbackRate - 0.05)}
        title="Slower (−5%)"
      >
        −5
      </button>
      <button
        className={`${styles.btn} ${styles.value}`}
        data-modified={String(playbackRate !== 1)}
        onClick={() => setRate(1)}
        title="Reset to 100%"
      >
        {pct}%
      </button>
      <button
        className={styles.btn}
        onClick={() => setRate(playbackRate + 0.05)}
        title="Faster (+5%)"
      >
        +5
      </button>
    </div>
  );
}
