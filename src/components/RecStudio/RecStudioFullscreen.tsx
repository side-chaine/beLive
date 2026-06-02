import { useEffect, useRef } from 'react';
import { useRecStudioStore } from '../../stores/recStudio.store';
import { useRecordingStore } from '../../stores/recording.store';
import { PointList } from './PointList';
import { StepStrip } from './StepStrip';
import { StepWorkspace } from './StepWorkspace';
import { PresentationView } from './PresentationView';

import styles from './RecStudioFullscreen.module.css';

export function RecStudioFullscreen() {
  const panelRef = useRef<HTMLDivElement>(null);
  const scenario = useRecStudioStore(s => s.scenario);
  const activePointIndex = useRecStudioStore(s => s.activePointIndex);
  const activeStepIndex = useRecStudioStore(s => s.activeStepIndex);
  const closeScenario = useRecStudioStore(s => s.closeScenario);
  const activateFeature = useRecStudioStore(s => s.activateFeature);
  const isPresenting = useRecStudioStore(s => s.isPresenting);
  const startPresentation = useRecStudioStore(s => s.startPresentation);

  // ── ResizeObserver → --bl-deck-height ──
  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      document.documentElement.style.setProperty(
        '--bl-deck-height', `${entry.contentRect.height}px`
      );
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── Keyboard navigation ──
  useEffect(() => {
    const isBillyControlActive = () =>
      document.documentElement.getAttribute('data-billy-control') === 'true';
    const isEditingText = () => {
      const el = document.activeElement as HTMLElement;
      if (!el) return false;
      return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable === true;
    };

    const handler = (e: KeyboardEvent) => {
      if (isBillyControlActive()) return;
      if (isEditingText()) return;

      const store = useRecStudioStore.getState();
      const isRecording = useRecordingStore.getState().isRecording;

      switch (e.code) {
        case 'ArrowRight':
          e.preventDefault();
          store.nextStep();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          store.prevStep();
          break;
        case 'ArrowDown':
          e.preventDefault();
          store.nextPoint();
          break;
        case 'ArrowUp':
          e.preventDefault();
          store.prevPoint();
          break;
        case 'Escape':
          e.preventDefault();
          if (store.featureActive) {
            store.deactivateFeature();
          } else if (store.isPresenting && !isRecording) {
            store.stopPresentation();
          } else if (!store.isPresenting && !isRecording) {
            store.closeScenario();
          }
          break;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ── Current step info ──
  const currentPoint = scenario.points[activePointIndex];
  const currentStep = currentPoint?.steps[activeStepIndex];

  return (
    <div ref={panelRef} className={styles.root} data-rec-studio-root="true">
      {isPresenting ? (
        <PresentationView />
      ) : (
        <>
          {/* ── Header bar ── */}
          <div className={styles.header}>
            <div className={styles.headerLeft}>
              <button type="button" className={styles.closeButton} onClick={closeScenario} title="Закрыть">
                ✕
              </button>
              <h2 className={styles.scenarioTitle}>{scenario.title}</h2>
            </div>
            <div className={styles.headerRight}>
              <span className={styles.pointIndicator}>
                Пункт {activePointIndex + 1}/{scenario.points.length}
              </span>
              {currentStep && (
                <span className={styles.stepIndicator}>
                  Шаг {activeStepIndex + 1}/{currentPoint.steps.length}
                  {currentStep.type === 'feature' && ' ◆'}
                </span>
              )}
            </div>
          </div>

          {/* ── Main content area ── */}
          <div className={styles.content}>
            <PointList styles={styles} />
            <StepWorkspace />
          </div>

          {/* ── Step strip ── */}
          {currentPoint && <StepStrip styles={styles} />}

          {/* ── Bottom bar ── */}
          <div className={styles.bottomBar}>
            <div className={styles.bottomBarLeft}>
              {currentStep?.type === 'feature' && currentStep.action ? (
                <button
                  type="button"
                  className={styles.featureButton}
                  onClick={activateFeature}
                >
                  ▶ {currentStep.actionLabel || currentStep.action.type}
                </button>
              ) : (
                <button
                  type="button"
                  className={styles.recordButton}
                  onClick={startPresentation}
                >
                  ▶ Записать
                </button>
              )}
            </div>
            <div className={styles.navHint}>
              ← → шаги &nbsp; ↑ ↓ пункты
            </div>
          </div>
        </>
      )}
    </div>
  );
}
