import { useEffect, useRef, useState, useCallback } from 'react';
import { useRecStudioStore } from '../../stores/recStudio.store';
import { useRecordingStore } from '../../stores/recording.store';
import { loadStepImageUrl } from '../../services/recStudio.image.service';
import styles from './PresenterDock.module.css';

export function PresenterDock() {
  const scenario = useRecStudioStore(s => s.scenario);
  const activePointIndex = useRecStudioStore(s => s.activePointIndex);
  const activeStepIndex = useRecStudioStore(s => s.activeStepIndex);
  const showSlide = useRecStudioStore(s => s.showSlide);
  const toggleSlide = useRecStudioStore(s => s.toggleSlide);
  const nextStep = useRecStudioStore(s => s.nextStep);
  const prevStep = useRecStudioStore(s => s.prevStep);
  const activateFeature = useRecStudioStore(s => s.activateFeature);
  const stopPresentation = useRecStudioStore(s => s.stopPresentation);
  const dockPosition = useRecStudioStore(s => s.dockPosition);
  const setDockPosition = useRecStudioStore(s => s.setDockPosition);

  const isRecording = useRecordingStore(s => s.isRecording);
  const duration = useRecordingStore(s => s.duration);
  const startRecording = useRecordingStore(s => s.startRecording);
  const stopRecording = useRecordingStore(s => s.stopRecording);

  const dockRef = useRef<HTMLDivElement>(null);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});

  const currentPoint = scenario.points[activePointIndex];
  const currentStep = currentPoint?.steps[activeStepIndex];

  // ── Load images for current step ──
  useEffect(() => {
    const step = scenario.points[activePointIndex]?.steps[activeStepIndex];
    if (!step?.imageIds?.length) {
      setImageUrls({});
      return;
    }
    let cancelled = false;
    const urls: Record<string, string> = {};
    Promise.all(
      step.imageIds.map(async (imageId) => {
        const url = await loadStepImageUrl(imageId);
        if (url) urls[imageId] = url;
      })
    ).then(() => {
      if (!cancelled) setImageUrls(urls);
    });
    return () => { cancelled = true; };
  }, [activePointIndex, activeStepIndex]);

  // ── Drag logic ──
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const dock = dockRef.current;
    if (!dock) return;
    const rect = dock.getBoundingClientRect();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: rect.left,
      origY: rect.top,
    };

    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = ev.clientX - dragRef.current.startX;
      const dy = ev.clientY - dragRef.current.startY;
      let newX = dragRef.current.origX + dx;
      let newY = dragRef.current.origY + dy;
      // Clamp to viewport
      newX = Math.max(0, Math.min(window.innerWidth - 100, newX));
      newY = Math.max(0, Math.min(window.innerHeight - 60, newY));
      // Apply position directly for smoothness
      if (dockRef.current) {
        dockRef.current.style.left = `${newX}px`;
        dockRef.current.style.top = `${newY}px`;
        dockRef.current.style.right = 'auto';
        dockRef.current.style.bottom = 'auto';
      }
    };

    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      // Save final position
      if (dockRef.current) {
        const rect = dockRef.current.getBoundingClientRect();
        setDockPosition({ x: rect.left, y: rect.top });
      }
      dragRef.current = null;
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [setDockPosition]);

  // ── Apply saved position on mount ──
  useEffect(() => {
    if (dockPosition.x >= 0 && dockPosition.y >= 0 && dockRef.current) {
      dockRef.current.style.left = `${dockPosition.x}px`;
      dockRef.current.style.top = `${dockPosition.y}px`;
      dockRef.current.style.right = 'auto';
      dockRef.current.style.bottom = 'auto';
    }
  }, []);

  // ── Keyboard routing ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;

      const store = useRecStudioStore.getState();

      if (e.code === 'Space') {
        e.preventDefault();
        store.toggleSlide();
        return;
      }

      if (e.code === 'Escape') {
        e.preventDefault();
        if (store.showSlide) {
          store.toggleSlide();
        } else {
          if (useRecordingStore.getState().isRecording) {
            useRecordingStore.getState().stopRecording();
          }
          store.stopPresentation();
        }
        return;
      }

      // Стрелки — ТОЛЬКО когда слайд открыт
      if (store.showSlide) {
        switch (e.code) {
          case 'ArrowRight':
          case 'ArrowDown':
            e.preventDefault();
            store.nextStep();
            break;
          case 'ArrowLeft':
          case 'ArrowUp':
            e.preventDefault();
            store.prevStep();
            break;
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleStop = () => {
    if (isRecording) stopRecording();
    stopPresentation();
  };

  const mm = String(Math.floor(duration / 60)).padStart(2, '0');
  const ss = String(duration % 60).padStart(2, '0');

  // (удалено — thumbnail убран из compact dock)

  if (!currentStep) return null;

  return (
    <>
      {/* ── Compact Dock (single row) ── */}
      <div ref={dockRef} className={styles.dock}>
        <span className={styles.dragGrip} onMouseDown={handleDragStart}>⠿</span>

        <span className={styles.stepType}>
          {currentStep.type === 'feature' ? '◆' : '•'}
        </span>
        <span className={styles.stepTitle}>
          {currentStep.title || 'Без заголовка'}
        </span>

        <button type="button" className={styles.navBtn} onClick={prevStep} title="Предыдущий шаг">←</button>
        <span className={styles.position}>
          {activeStepIndex + 1}/{currentPoint?.steps.length || 0}
        </span>
        <button type="button" className={styles.navBtn} onClick={nextStep} title="Следующий шаг">→</button>

        {currentStep.type === 'feature' && currentStep.action && (
          <button type="button" className={styles.activateBtn} onClick={activateFeature} title="Активировать функцию">
            ▶
          </button>
        )}

        {isRecording ? (
          <div className={styles.recGroup}>
            <span className={styles.recDot} />
            <span className={styles.recTimer}>{mm}:{ss}</span>
            <button type="button" className={styles.stopBtn} onClick={handleStop} title="Остановить">■</button>
          </div>
        ) : (
          <button type="button" className={styles.recBtn} onClick={startRecording} title="Начать запись">
            ● Запись
          </button>
        )}

        <button
          type="button"
          className={styles.slideBtn}
          onClick={toggleSlide}
          data-active={showSlide ? 'true' : 'false'}
          title={showSlide ? 'Вернуться к beLive' : 'Показать слайд'}
        >
          {showSlide ? '🎮' : '📋'}
        </button>
      </div>

      {/* ── Slide Overlay (fullscreen, unchanged) ── */}
      {showSlide && (
        <div className={styles.slideOverlay}>
          <div className={styles.slideContent}>
            {currentStep.type === 'feature' && (
              <div className={styles.slideTypeBadge}>◆ Функция</div>
            )}
            <h1 className={styles.slideTitle}>{currentStep.title || 'Без заголовка'}</h1>
            {currentStep.subtitle && (
              <h2 className={styles.slideSubtitle}>{currentStep.subtitle}</h2>
            )}
            {currentStep.description && (
              <p className={styles.slideDescription}>{currentStep.description}</p>
            )}
            {currentStep.bullets && currentStep.bullets.filter(b => b.trim()).length > 0 && (
              <ul className={styles.slideBullets}>
                {currentStep.bullets.filter(b => b.trim()).map((b, i) => (
                  <li key={i} className={styles.slideBullet}>{b}</li>
                ))}
              </ul>
            )}
            {currentStep.imageIds && currentStep.imageIds.length > 0 && (
              <div className={styles.slideImages}>
                {currentStep.imageIds.map(imageId => (
                  imageUrls[imageId] && (
                    <img key={imageId} src={imageUrls[imageId]} alt="" className={styles.slideImage} />
                  )
                ))}
              </div>
            )}
          </div>
          {currentStep.notes && (
            <div className={styles.slideNotes}>📝 {currentStep.notes}</div>
          )}
          <div className={styles.slideControls}>
            <button type="button" className={styles.slideBackBtn} onClick={toggleSlide}>
              🎮 beLive
            </button>
            <span className={styles.slidePosition}>
              {activePointIndex + 1}/{scenario.points.length} · {activeStepIndex + 1}/{currentPoint?.steps.length || 0}
            </span>
            <span className={styles.slideHint}>Space — свернуть · ← → — навигация</span>
          </div>
        </div>
      )}
    </>
  );
}
