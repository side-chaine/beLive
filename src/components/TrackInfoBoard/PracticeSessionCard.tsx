import { useState, useEffect } from 'react';
import { usePracticeStore } from '../../stores/practice-session.store';
import { useAudioStore } from '../../stores/audio.store';
import { useLoopStore } from '../../stores/loop.store';
import styles from './TrackInfoBoard.module.css';

/**
 * PracticeSessionCard — live trainer widget.
 * Shows REAL state from practice store.
 * Buttons call store methods, NOT AI.
 * Includes real-time loop progress bar (10Hz).
 */
export function PracticeSessionCard() {
  const isActive = usePracticeStore(s => s.isActive);
  const practiceStatus = usePracticeStore(s => s.practiceStatus);
  const passesCount = usePracticeStore(s => s.passesCount);
  const currentRate = usePracticeStore(s => s.currentRate);
  const label = usePracticeStore(s => s.label);
  const totalExpectedPasses = usePracticeStore(s => s.totalExpectedPasses);
  const nextPass = usePracticeStore(s => s.nextPass);
  const repeatPass = usePracticeStore(s => s.repeatPass);
  const endPractice = usePracticeStore(s => s.endPractice);
  const completeAndKeep = usePracticeStore(s => s.completeAndKeep);

  // Real-time loop progress (10Hz update)
  const [loopProgress, setLoopProgress] = useState(0);

  useEffect(() => {
    if (!isActive || practiceStatus !== 'running') {
      setLoopProgress(0);
      return;
    }

    const interval = setInterval(() => {
      const loopState = useLoopStore.getState();
      const audioState = useAudioStore.getState();

      if (!loopState.isLooping || loopState.loopStartTime == null || loopState.loopEndTime == null) {
        setLoopProgress(0);
        return;
      }

      const currentTime = audioState.currentTime;
      const duration = loopState.loopEndTime - loopState.loopStartTime;
      if (duration <= 0) {
        setLoopProgress(0);
        return;
      }

      const position = currentTime - loopState.loopStartTime;
      const progress = ((position % duration) + duration) % duration / duration;
      setLoopProgress(progress);
    }, 100); // 10Hz

    return () => clearInterval(interval);
  }, [isActive, practiceStatus]);

  if (!isActive) return null;

  const pct = Math.round(currentRate * 100);
  const isBpmRamp = label?.includes('Разгон') || label?.includes('bpm-ramp');
  const totalDots = totalExpectedPasses || 4;
  const isCompleted = practiceStatus === 'completed';

  // BPM-ramp overall progress (80% → 100%)
  const rampProgress = isBpmRamp
    ? Math.round(((currentRate - 0.8) / 0.2) * 100)
    : 0;

  const isPlaying = useAudioStore.getState().isPlaying;

  return (
    <div className={`${styles.practiceSessionCard} ${isCompleted ? styles.practiceSessionCardCompleted : ''}`}>
      
      {/* HEADER */}
      <div className={styles.practiceSessionHeader}>
        <span className={styles.practiceSessionIcon}>
          {isCompleted ? '🎉' : '🔥'}
        </span>
        <span className={styles.practiceSessionTitle}>
          {label || 'Тренировка'}
        </span>
        {isBpmRamp && (
          <span className={styles.practiceSessionTempo}>{pct}%</span>
        )}
      </div>

      {/* REAL-TIME LOOP PROGRESS — playhead */}
      {practiceStatus === 'running' && (
        <div className={styles.practiceSessionLoopProgress}>
          <div className={styles.practiceSessionLoopBar}>
            <div
              className={`${styles.practiceSessionLoopFill} ${isPlaying ? styles.practiceSessionLoopFillActive : ''}`}
              style={{ width: `${Math.round(loopProgress * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* BPM-RAMP PROGRESS — overall */}
      <div className={styles.practiceSessionProgress}>
        <div className={styles.practiceSessionProgressBar}>
          <div
            className={`${styles.practiceSessionProgressFill} ${
              isCompleted ? styles.practiceSessionProgressFillCompleted : ''
            }`}
            style={{ width: `${Math.max(0, Math.min(100, rampProgress))}%` }}
          />
        </div>
        
        {/* PASS DOTS */}
        {isBpmRamp && totalDots > 0 && (
          <div className={styles.practiceSessionPassDots}>
            {Array.from({ length: totalDots }, (_, i) => (
              <div
                key={i}
                className={`${styles.passDot} ${
                  i < passesCount ? styles.passDotCompleted :
                  i === passesCount && !isCompleted ? styles.passDotCurrent :
                  isCompleted ? styles.passDotCompleted :
                  styles.passDotUpcoming
                }`}
              />
            ))}
          </div>
        )}
        
        <span className={styles.practiceSessionProgressText}>
          {isCompleted
            ? `${passesCount} ${passesCount === 1 ? 'круг' : passesCount < 5 ? 'круга' : 'кругов'} · оригинальный темп 💪`
            : `${passesCount} ${passesCount === 1 ? 'круг' : passesCount < 5 ? 'круга' : 'кругов'}`
          }
        </span>
      </div>

      {/* BUTTONS */}
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
            <button
              className={`${styles.practiceSessionBtn} ${styles.practiceSessionBtnDanger}`}
              onClick={endPractice}
            >
              Стоп
            </button>
          </>
        )}

        {practiceStatus === 'completed' && (
          <>
            <button
              className={`${styles.practiceSessionBtn} ${styles.practiceSessionBtnPrimary}`}
              onClick={completeAndKeep}
            >
              ✅ Оставить результат
            </button>
            <button
              className={`${styles.practiceSessionBtn} ${styles.practiceSessionBtnDanger}`}
              onClick={endPractice}
            >
              ↩ Вернуть как было
            </button>
          </>
        )}
      </div>
    </div>
  );
}
