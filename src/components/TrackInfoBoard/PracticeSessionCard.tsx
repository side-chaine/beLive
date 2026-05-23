import { usePracticeStore } from '../../stores/practice-session.store';
import styles from './TrackInfoBoard.module.css';

/**
 * PracticeSessionCard — live trainer widget.
 * Shows REAL state from practice store.
 * Buttons call store methods, NOT AI.
 */
export function PracticeSessionCard() {
  const isActive = usePracticeStore(s => s.isActive);
  const practiceStatus = usePracticeStore(s => s.practiceStatus);
  const passesCount = usePracticeStore(s => s.passesCount);
  const currentRate = usePracticeStore(s => s.currentRate);
  const label = usePracticeStore(s => s.label);
  const nextPass = usePracticeStore(s => s.nextPass);
  const repeatPass = usePracticeStore(s => s.repeatPass);
  const pausePractice = usePracticeStore(s => s.pausePractice);
  const resumePractice = usePracticeStore(s => s.resumePractice);
  const endPractice = usePracticeStore(s => s.endPractice);

  if (!isActive) return null;

  const pct = Math.round(currentRate * 100);
  const isBpmRamp = label?.includes('bpm-ramp') || label?.includes('Разгон') || label?.includes('темп');

  // BPM-ramp progress: 80% → 100% = 0% → 100%
  const rampProgress = isBpmRamp
    ? Math.round(((currentRate - 0.8) / 0.2) * 100)
    : 0;

  return (
    <div className={styles.practiceSessionCard}>
      <div className={styles.practiceSessionHeader}>
        <span className={styles.practiceSessionIcon}>🔥</span>
        <span className={styles.practiceSessionTitle}>
          {label || 'Тренировка'}
        </span>
        {isBpmRamp && (
          <span className={styles.practiceSessionTempo}>{pct}%</span>
        )}
      </div>

      <div className={styles.practiceSessionProgress}>
        <div className={styles.practiceSessionProgressBar}>
          <div
            className={styles.practiceSessionProgressFill}
            style={{ width: `${Math.max(0, Math.min(100, rampProgress))}%` }}
          />
        </div>
        <span className={styles.practiceSessionProgressText}>
          {passesCount} {passesCount === 1 ? 'круг' : passesCount < 5 ? 'круга' : 'кругов'}
        </span>
      </div>

      <div className={styles.practiceSessionButtons}>
        {practiceStatus === 'running' && (
          <>
            <button
              className={`${styles.practiceSessionBtn} ${styles.practiceSessionBtnPrimary}`}
              onClick={nextPass}
            >
              Следующий круг (+5%)
            </button>
            <button className={styles.practiceSessionBtn} onClick={repeatPass}>
              Ещё раз
            </button>
            <button className={styles.practiceSessionBtn} onClick={pausePractice}>
              Пауза
            </button>
            <button
              className={`${styles.practiceSessionBtn} ${styles.practiceSessionBtnDanger}`}
              onClick={endPractice}
            >
              Стоп
            </button>
          </>
        )}

        {practiceStatus === 'paused' && (
          <>
            <button
              className={`${styles.practiceSessionBtn} ${styles.practiceSessionBtnPrimary}`}
              onClick={resumePractice}
            >
              Продолжить
            </button>
            <button
              className={`${styles.practiceSessionBtn} ${styles.practiceSessionBtnDanger}`}
              onClick={endPractice}
            >
              Завершить
            </button>
          </>
        )}

        {practiceStatus === 'completed' && (
          <>
            <button
              className={`${styles.practiceSessionBtn} ${styles.practiceSessionBtnPrimary}`}
              onClick={endPractice}
            >
              Снять повтор
            </button>
          </>
        )}
      </div>
    </div>
  );
}
