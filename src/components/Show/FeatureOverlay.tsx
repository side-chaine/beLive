import { useEffect } from 'react';
import { useShowStore } from '../../stores/show.store';
import { useRecordingStore } from '../../stores/recording.store';
import styles from './FeatureOverlay.module.css';

export function FeatureOverlay() {
  const deactivateFeature = useShowStore(s => s.deactivateFeature);
  const scenario = useShowStore(s => s.scenario);
  const activePointIndex = useShowStore(s => s.activePointIndex);
  const activeStepIndex = useShowStore(s => s.activeStepIndex);
  const isRecording = useRecordingStore(s => s.isRecording);
  const duration = useRecordingStore(s => s.duration);

  // ── Escape handler — глобальный, т.к. Show не рендерится при featureActive ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        e.preventDefault();
        deactivateFeature();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [deactivateFeature]);

  const currentStep = scenario.points[activePointIndex]?.steps[activeStepIndex];
  const overlayNote = currentStep?.overlayNote || '';

  const mm = String(Math.floor(duration / 60)).padStart(2, '0');
  const ss = String(duration % 60).padStart(2, '0');

  return (
    <div className={styles.overlay}>
      {overlayNote && (
        <div className={styles.noteCard}>
          <span className={styles.noteText}>{overlayNote}</span>
        </div>
      )}
      <button className={styles.backButton} onClick={deactivateFeature}>
        ← Назад к сценарию
      </button>
      {isRecording && (
        <div className={styles.recIndicator}>
          ● REC {mm}:{ss}
        </div>
      )}
    </div>
  );
}
