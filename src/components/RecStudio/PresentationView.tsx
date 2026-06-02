import { useEffect, useState } from 'react';
import { useRecStudioStore } from '../../stores/recStudio.store';
import { useRecordingStore } from '../../stores/recording.store';
import { useMouseIdle } from '../../hooks/useMouseIdle';
import styles from './PresentationView.module.css';

export function PresentationView() {
  const scenario = useRecStudioStore(s => s.scenario);
  const activePointIndex = useRecStudioStore(s => s.activePointIndex);
  const activeStepIndex = useRecStudioStore(s => s.activeStepIndex);
  const nextStep = useRecStudioStore(s => s.nextStep);
  const prevStep = useRecStudioStore(s => s.prevStep);
  const stopPresentation = useRecStudioStore(s => s.stopPresentation);

  const isRecording = useRecordingStore(s => s.isRecording);
  const duration = useRecordingStore(s => s.duration);
  const startRecording = useRecordingStore(s => s.startRecording);
  const stopRecording = useRecordingStore(s => s.stopRecording);

  const mouseIdle = useMouseIdle(2500);
  const [transitioning, setTransitioning] = useState(false);

  const currentPoint = scenario.points[activePointIndex];
  const currentStep = currentPoint?.steps[activeStepIndex];

  // Next step info for preview
  const nextStepInfo = (() => {
    if (!currentPoint) return null;
    if (activeStepIndex < currentPoint.steps.length - 1) {
      return { point: currentPoint, step: currentPoint.steps[activeStepIndex + 1] };
    }
    if (activePointIndex < scenario.points.length - 1) {
      const nextPoint = scenario.points[activePointIndex + 1];
      return { point: nextPoint, step: nextPoint.steps[0] };
    }
    return null;
  })();

  // Crossfade navigation
  useEffect(() => {
    const isEditingText = () => {
      const el = document.activeElement as HTMLElement;
      if (!el) return false;
      return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable === true;
    };

    const handler = (e: KeyboardEvent) => {
      if (isEditingText()) return;

      const navigate = (direction: 'next' | 'prev') => {
        setTransitioning(true);
        setTimeout(() => {
          direction === 'next' ? nextStep() : prevStep();
          setTransitioning(false);
        }, 150);
      };

      switch (e.code) {
        case 'ArrowRight':
        case 'ArrowDown':
          e.preventDefault();
          navigate('next');
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
          e.preventDefault();
          navigate('prev');
          break;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [nextStep, prevStep]);

  const handleStop = () => {
    if (isRecording) stopRecording();
    stopPresentation();
  };

  const handleStartRecording = async () => {
    await startRecording();
  };

  const mm = String(Math.floor(duration / 60)).padStart(2, '0');
  const ss = String(duration % 60).padStart(2, '0');

  if (!currentStep) {
    return (
      <div className={styles.root}>
        <div className={styles.empty}>Нет шагов для показа</div>
        <div className={styles.controlBar}>
          <button type="button" className={styles.stopButton} onClick={handleStop}>
            ■ Закрыть
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.root} data-mouse-idle={mouseIdle ? 'true' : 'false'}>
      {/* ── Slide content ── */}
      <div className={styles.slideContent} data-transitioning={transitioning ? 'true' : 'false'}>
        <div className={styles.slideInner}>
          {currentStep.type === 'feature' && (
            <div className={styles.slideTypeBadge}>◆ Функция</div>
          )}

          <h1 className={styles.slideTitle}>
            {currentStep.title || 'Без заголовка'}
          </h1>

          {currentStep.subtitle && (
            <h2 className={styles.slideSubtitle}>{currentStep.subtitle}</h2>
          )}

          {currentStep.description && (
            <p className={styles.slideDescription}>{currentStep.description}</p>
          )}

          {currentStep.bullets && currentStep.bullets.length > 0 && (
            <ul className={styles.slideBullets}>
              {currentStep.bullets.filter(b => b.trim()).map((bullet, i) => (
                <li key={i} className={styles.slideBullet}>{bullet}</li>
              ))}
            </ul>
          )}

          {currentStep.type === 'feature' && (
            <div className={styles.slideFeatureHint}>
              {currentStep.actionLabel || currentStep.action?.type || 'Функция'}
            </div>
          )}
        </div>

        {/* Next step preview */}
        {nextStepInfo && (
          <div className={styles.nextPreview}>
            <span className={styles.nextLabel}>Далее:</span>
            <span className={styles.nextTitle}>
              {nextStepInfo.step.title || 'Без заголовка'}
            </span>
            <span className={styles.nextType}>
              {nextStepInfo.step.type === 'feature' ? '◆' : '•'}
            </span>
          </div>
        )}
      </div>

      {/* ── Notes overlay (semi-transparent) ── */}
      {currentStep.notes && (
        <div className={styles.notesOverlay}>
          <span className={styles.notesIcon}>📝</span>
          <span className={styles.notesText}>{currentStep.notes}</span>
        </div>
      )}

      {/* ── Control bar ── */}
      <div className={styles.controlBar}>
        <div className={styles.controlLeft}>
          {isRecording ? (
            <div className={styles.recIndicator}>
              <span className={styles.recDot} /> REC {mm}:{ss}
            </div>
          ) : (
            <button type="button" className={styles.recButton} onClick={handleStartRecording}>
              ● Запись
            </button>
          )}
        </div>

        <div className={styles.controlCenter}>
          <span className={styles.positionText}>
            Пункт {activePointIndex + 1}/{scenario.points.length}
            &nbsp;·&nbsp;
            Шаг {activeStepIndex + 1}/{currentPoint?.steps.length || 0}
          </span>
        </div>

        <div className={styles.controlRight}>
          <button type="button" className={styles.stopButton} onClick={handleStop}>
            ■ Стоп
          </button>
        </div>
      </div>
    </div>
  );
}
