import { useEffect, useRef, useState, useCallback } from 'react';
import { useShowStore } from '../../stores/show.store';
import { useRecordingStore } from '../../stores/recording.store';
import { loadStepImageUrl } from '../../services/show.image.service';
import { loadStepHtmlUrl, revokeAllHtmlUrls } from '../../services/show.html.service';
import styles from './PresenterDock.module.css';
import type { ShowSubSlide, SlideColor } from '../../types/show.types';

// ── Title inheritance helper ──

function getInheritedTitle(
  step: { title?: string; subSlides?: ShowSubSlide[] },
  subSlideIndex: number
): { text: string; color?: SlideColor } | null {
  const subSlides = step.subSlides;
  if (!subSlides?.length) {
    return step.title ? { text: step.title } : null;
  }

  // Walk backward from current sub-slide for non-empty title
  for (let i = subSlideIndex; i >= 0; i--) {
    if (subSlides[i].title) {
      return { text: subSlides[i].title!, color: subSlides[i].titleColor };
    }
  }

  // Fallback to step title
  return step.title ? { text: step.title } : null;
}

export function PresenterDock() {
  const scenario = useShowStore(s => s.scenario);
  const activePointIndex = useShowStore(s => s.activePointIndex);
  const activeStepIndex = useShowStore(s => s.activeStepIndex);
  const showSlide = useShowStore(s => s.showSlide);
  const toggleSlide = useShowStore(s => s.toggleSlide);
  const activateFeature = useShowStore(s => s.activateFeature);
  const stopPresentation = useShowStore(s => s.stopPresentation);
  const dockPosition = useShowStore(s => s.dockPosition);
  const setDockPosition = useShowStore(s => s.setDockPosition);
  const activeSubSlideIndex = useShowStore(s => s.activeSubSlideIndex);
  const activeBulletIndex = useShowStore(s => s.activeBulletIndex);

  const isRecording = useRecordingStore(s => s.isRecording);
  const duration = useRecordingStore(s => s.duration);
  const startRecording = useRecordingStore(s => s.startRecording);
  const stopRecording = useRecordingStore(s => s.stopRecording);

  const dockRef = useRef<HTMLDivElement>(null);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const activeImageIndexRef = useRef(0);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [htmlSlideUrl, setHtmlSlideUrl] = useState<string | null>(null);
  const [htmlSlideLoaded, setHtmlSlideLoaded] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const notifTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showNotif = (text: string, duration = 3000) => {
    if (notifTimerRef.current) clearTimeout(notifTimerRef.current);
    setNotification(text);
    notifTimerRef.current = setTimeout(() => setNotification(null), duration);
  };

  const currentPoint = scenario.points[activePointIndex];
  const currentStep = currentPoint?.steps[activeStepIndex];

  // ── Load images for current step (legacy + sub-slides) ──
  useEffect(() => {
    const step = scenario.points[activePointIndex]?.steps[activeStepIndex];
    if (!step) {
      setImageUrls({});
      return;
    }

    const allImageIds: string[] = [];

    // Legacy imageIds
    if (step.imageIds?.length) {
      allImageIds.push(...step.imageIds);
    }

    // Sub-slide imageIds
    if (step.subSlides?.length) {
      step.subSlides.forEach(ss => {
        if (ss.imageId) allImageIds.push(ss.imageId);
      });
    }

    if (allImageIds.length === 0) {
      setImageUrls({});
      return;
    }

    let cancelled = false;
    const urls: Record<string, string> = {};
    Promise.all(
      allImageIds.map(async (imageId) => {
        const url = await loadStepImageUrl(imageId);
        if (url) urls[imageId] = url;
      })
    ).then(() => {
      if (!cancelled) setImageUrls(urls);
    });
    return () => { cancelled = true; };
  }, [activePointIndex, activeStepIndex]);

  // ── Reset on navigation change ──
  useEffect(() => {
    setActiveImageIndex(0);
    activeImageIndexRef.current = 0;
    setLightboxUrl(null);
  }, [activePointIndex, activeStepIndex, activeSubSlideIndex]);

  // ── Load HTML slide on step change ──
  useEffect(() => {
    const step = scenario.points[activePointIndex]?.steps[activeStepIndex];
    if (!step?.htmlId) {
      setHtmlSlideUrl(null);
      setHtmlSlideLoaded(false);
      return;
    }
    let cancelled = false;
    setHtmlSlideLoaded(false);
    loadStepHtmlUrl(step.htmlId).then(url => {
      if (!cancelled) setHtmlSlideUrl(url);
    });
    return () => { cancelled = true; };
  }, [activePointIndex, activeStepIndex]);

  // ── Lightbox Escape handler (capture phase, приоритет над глобальным) ──
  useEffect(() => {
    if (!lightboxUrl) return;
    const handler = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setLightboxUrl(null);
      }
    };
    window.addEventListener('keydown', handler, { capture: true });
    return () => window.removeEventListener('keydown', handler, { capture: true });
  }, [lightboxUrl]);

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
      // Apply position via transform (GPU-accelerated, no reflow)
      if (dockRef.current) {
        dockRef.current.style.left = '0';
        dockRef.current.style.top = '0';
        dockRef.current.style.right = 'auto';
        dockRef.current.style.bottom = 'auto';
        dockRef.current.style.transform = `translate(${newX}px, ${newY}px)`;
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
      dockRef.current.style.left = '0';
      dockRef.current.style.top = '0';
      dockRef.current.style.right = 'auto';
      dockRef.current.style.bottom = 'auto';
      dockRef.current.style.transform = `translate(${dockPosition.x}px, ${dockPosition.y}px)`;
    }
  }, []);

  // ── Keyboard routing ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;

      const store = useShowStore.getState();

      if (e.code === 'Space') {
        if (store.showSlide) {
          e.preventDefault();
          e.stopImmediatePropagation();
          store.toggleSlide();
          return;
        }
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

      // ── Arrow navigation: ↑↓ = steps, ←→ = photo carousel ──
      if (store.showSlide) {
        // Read CURRENT step from store (not stale closure)
        // Read CURRENT step from store (not stale closure)
        const { activePointIndex: pi, activeStepIndex: si, scenario: sc } = store;
        const curStep = sc.points[pi]?.steps[si];
        const hasSubSlides = curStep?.type === 'content' && curStep.subSlides?.length;

        switch (e.code) {
          case 'ArrowDown':
            e.preventDefault();
            (document.activeElement as HTMLElement)?.blur?.();
            store.nextStep();
            break;
          case 'ArrowUp':
            e.preventDefault();
            (document.activeElement as HTMLElement)?.blur?.();
            store.prevStep();
            break;
          case 'ArrowRight':
            e.preventDefault();
            (document.activeElement as HTMLElement)?.blur?.();
            if (hasSubSlides) {
              store.nextScreen();
            } else {
              // Legacy carousel navigation
              const hasMultipleImages = (curStep?.imageIds?.length ?? 0) > 1;
              if (hasMultipleImages) {
                const maxIdx = curStep.imageIds!.length - 1;
                const newIdx = Math.min(activeImageIndexRef.current + 1, maxIdx);
                activeImageIndexRef.current = newIdx;
                setActiveImageIndex(newIdx);
              } else {
                store.nextStep();
              }
            }
            break;
          case 'ArrowLeft':
            e.preventDefault();
            (document.activeElement as HTMLElement)?.blur?.();
            if (hasSubSlides) {
              store.prevScreen();
            } else {
              // Legacy carousel navigation
              const hasMultipleImages = (curStep?.imageIds?.length ?? 0) > 1;
              if (hasMultipleImages && activeImageIndexRef.current > 0) {
                const newIdx = activeImageIndexRef.current - 1;
                activeImageIndexRef.current = newIdx;
                setActiveImageIndex(newIdx);
              } else {
                store.prevStep();
              }
            }
            break;
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ── Cleanup HTML URLs on unmount ──
  useEffect(() => {
    return () => { revokeAllHtmlUrls(); };
  }, []);

  const handleStop = () => {
    if (isRecording) stopRecording();
    stopPresentation();
  };

  const handleStartRecording = async () => {
    showNotif('Начинаем запись...');
    await startRecording();
    const recState = useRecordingStore.getState();
    if (recState.isRecording) {
      showNotif('🔴 Запись идёт', 3000);
    } else if (recState.error) {
      showNotif('❌ ' + recState.error, 4000);
    }
  };

  // ── Recording save notification ──
  const prevRecordingRef = useRef(isRecording);
  useEffect(() => {
    if (prevRecordingRef.current && !isRecording) {
      showNotif('✅ Запись сохранена', 3000);
    }
    prevRecordingRef.current = isRecording;
  }, [isRecording]);

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

        <button type="button" className={styles.navBtn} onClick={() => { useShowStore.getState().prevStep(); (document.activeElement as HTMLElement)?.blur?.(); }} title="Предыдущий шаг (↑)">↑</button>
        <span className={styles.position}>
          {activeStepIndex + 1}/{currentPoint?.steps.length || 0}
          {currentStep?.subSlides?.length ? ` · ${activeSubSlideIndex + 1}/${currentStep.subSlides.length}` : ''}
        </span>
        <button type="button" className={styles.navBtn} onClick={() => { useShowStore.getState().nextStep(); (document.activeElement as HTMLElement)?.blur?.(); }} title="Следующий шаг (↓)">↓</button>

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
          <button type="button" className={styles.recBtn} onClick={handleStartRecording} title="Начать запись">
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
        <button
          type="button"
          className={styles.dockClose}
          onClick={handleStop}
          title="Закрыть презентацию"
        >
          ✕
        </button>
      </div>

      {/* ── Notification toast ── */}
      {notification && (
        <div className={styles.notification}>{notification}</div>
      )}

      {/* ── Slide Overlay (fullscreen, unchanged) ── */}
      {showSlide && (
        <div className={styles.slideOverlay}>
          <button
            type="button"
            className={styles.slideClose}
            onClick={toggleSlide}
            title="Закрыть слайд"
          >
            ✕
          </button>
          <div
            className={styles.slideContent}
            key={`slide-${activePointIndex}-${activeStepIndex}-${currentStep.subSlides?.length ? activeSubSlideIndex : 0}`}
            data-step-type={currentStep.type}
          >
            {currentStep.type === 'feature' && (
              <div className={styles.slideTypeBadge}>◆ Функция</div>
            )}

            {/* ── Content step with sub-slides ── */}
            {currentStep.type === 'content' && currentStep.subSlides?.length ? (
              (() => {
                const safeSSIndex = Math.max(0, Math.min(activeSubSlideIndex, currentStep.subSlides.length - 1));
                const subSlide = currentStep.subSlides[safeSSIndex];

                if (!subSlide) {
                  return <div className={styles.subSlideEmpty}>◌ Пустой слайд</div>;
                }

                const inheritedTitle = getInheritedTitle(currentStep, safeSSIndex);
                const imageUrl = subSlide.imageId ? imageUrls[subSlide.imageId] : null;
                const bullets = subSlide.bullets?.filter(b => b.text.trim()) || [];
                const hasContent = inheritedTitle || subSlide.description || bullets.length || imageUrl;

                return (
                  <>
                    {inheritedTitle && (
                      <h1 className={styles.slideTitle} style={inheritedTitle.color ? { color: inheritedTitle.color } : undefined}>
                        {inheritedTitle.text}
                      </h1>
                    )}
                    {currentStep.subtitle && (
                      <h2 className={styles.slideSubtitle}>{currentStep.subtitle}</h2>
                    )}
                    {imageUrl && (
                      <div className={styles.subSlideImageContainer}>
                        <img
                          key={imageUrl}
                          src={imageUrl}
                          alt=""
                          className={styles.subSlideImage}
                          onClick={() => setLightboxUrl(imageUrl)}
                        />
                      </div>
                    )}
                    {subSlide.description && (
                      <p
                        className={styles.slideDescription}
                        style={subSlide.descriptionColor ? { color: subSlide.descriptionColor } : undefined}
                      >
                        {subSlide.description}
                      </p>
                    )}
                    {bullets.length > 0 && (
                      <ul className={styles.slideBullets}>
                        {bullets.map((bullet, i) => {
                          let state: 'past' | 'current' | 'future';
                          if (activeBulletIndex === -1) {
                            state = 'future';
                          } else if (i < activeBulletIndex) {
                            state = 'past';
                          } else if (i === activeBulletIndex) {
                            state = 'current';
                          } else {
                            state = 'future';
                          }
                          return (
                            <li
                              key={i}
                              className={`${styles.slideBullet} ${
                                state === 'past' ? styles.slideBulletPast :
                                state === 'current' ? styles.slideBulletCurrent :
                                styles.slideBulletFuture
                              }`}
                              style={state === 'current' && bullet.color ? { color: bullet.color } : undefined}
                            >
                              {bullet.text}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                    {!hasContent && (
                      <div className={styles.subSlideEmpty}>
                        ◌ Пустой слайд
                      </div>
                    )}
                  </>
                );
              })()
            ) : (
              /* ── Legacy / Feature / HTML rendering ── */
              <>
                {currentStep.type !== 'html' && currentStep.title && (
                  <h1 className={styles.slideTitle}>{currentStep.title}</h1>
                )}
                {currentStep.type !== 'html' && currentStep.subtitle && (
                  <h2 className={styles.slideSubtitle}>{currentStep.subtitle}</h2>
                )}
                {currentStep.type !== 'html' && currentStep.description && (
                  <p className={styles.slideDescription}>{currentStep.description}</p>
                )}
                {currentStep.type !== 'html' && currentStep.bullets && currentStep.bullets.filter(b => b.trim()).length > 0 && (
                  <ul className={styles.slideBullets}>
                    {currentStep.bullets.filter(b => b.trim()).map((b, i) => (
                      <li key={i} className={styles.slideBullet}>{b}</li>
                    ))}
                  </ul>
                )}
                  {/* LEGACY: carousel path for content steps without subSlides (defensive) */}
                  {/* After migration, all content steps have subSlides. This path is a safety net. */}
                {currentStep.type !== 'html' && currentStep.imageIds && currentStep.imageIds.length > 0 && (() => {
                  const visibleIds = currentStep.imageIds.filter(id => imageUrls[id]);
                  if (visibleIds.length === 0) return null;
                  const safeIndex = Math.min(activeImageIndex, visibleIds.length - 1);
                  const url = imageUrls[visibleIds[safeIndex]];
                  const caption = currentStep.imageCaptions?.[currentStep.imageIds.indexOf(visibleIds[safeIndex])];
                  return (
                    <div className={styles.imageCarousel}>
                      <div className={styles.carouselMain}>
                        <button
                          type="button"
                          className={styles.carouselNav}
                          onClick={() => { const i = Math.max(0, safeIndex - 1); setActiveImageIndex(i); activeImageIndexRef.current = i; }}
                          style={{ opacity: safeIndex > 0 ? 1 : 0.2, pointerEvents: safeIndex > 0 ? 'auto' : 'none' }}
                        >
                          ‹
                        </button>
                        <div className={styles.carouselImageContainer}>
                          {url && (
                            <img
                              key={url}
                              src={url}
                              alt=""
                              className={styles.carouselImage}
                              onClick={() => setLightboxUrl(url)}
                            />
                          )}
                          {caption && (
                            <div className={styles.carouselCaption}>{caption}</div>
                          )}
                        </div>
                        <button
                          type="button"
                          className={styles.carouselNav}
                          onClick={() => { const i = Math.min(visibleIds.length - 1, safeIndex + 1); setActiveImageIndex(i); activeImageIndexRef.current = i; }}
                          style={{ opacity: safeIndex < visibleIds.length - 1 ? 1 : 0.2, pointerEvents: safeIndex < visibleIds.length - 1 ? 'auto' : 'none' }}
                        >
                          ›
                        </button>
                      </div>
                      {visibleIds.length > 1 && (
                        <div className={styles.carouselCounter}>
                          {safeIndex + 1} / {visibleIds.length}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </>
            )}

            {/* ── HTML slide (unchanged) ── */}
            {currentStep.type === 'html' && currentStep.htmlId && htmlSlideUrl && (
              <div className={styles.htmlSlideWrapper}>
                {!htmlSlideLoaded && (
                  <div className={styles.htmlSlideLoader}>
                    <span className={styles.htmlSlideLoaderText}>Загрузка...</span>
                  </div>
                )}
                <iframe
                  src={htmlSlideUrl}
                  sandbox="allow-scripts"
                  className={styles.htmlSlide}
                  style={{ opacity: htmlSlideLoaded ? 1 : 0 }}
                  title={currentStep.title || 'HTML Slide'}
                  onLoad={() => setHtmlSlideLoaded(true)}
                />
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
            <div className={styles.slideNavGroup}>
              <button
                type="button"
                className={styles.slideNavBtn}
                onClick={() => {
                  const store = useShowStore.getState();
                  if (currentStep?.subSlides?.length) {
                    store.prevScreen();
                  } else {
                    store.prevStep();
                  }
                }}
                title="← Предыдущий экран"
              >
                ‹
              </button>
              <span className={styles.slidePosition}>
                {activePointIndex + 1}/{scenario.points.length} · {activeStepIndex + 1}/{currentPoint?.steps.length || 0}
                {currentStep?.subSlides?.length ? ` · ${activeSubSlideIndex + 1}/${currentStep.subSlides.length}` : ''}
              </span>
              <button
                type="button"
                className={styles.slideNavBtn}
                onClick={() => {
                  const store = useShowStore.getState();
                  if (currentStep?.subSlides?.length) {
                    store.nextScreen();
                  } else {
                    store.nextStep();
                  }
                }}
                title="Следующий экран →"
              >
                ›
              </button>
            </div>
            <span className={styles.slideHint}>
              Space — свернуть
              {currentStep?.subSlides?.length ? ' · ← → — экраны' : ' · ← → — навигация'}
            </span>
          </div>
        </div>
      )}

      {/* ── Lightbox (fullscreen image zoom) ── */}
      {lightboxUrl && (
        <div className={styles.lightbox} onClick={() => setLightboxUrl(null)}>
          <img src={lightboxUrl} alt="" className={styles.lightboxImage} onClick={e => e.stopPropagation()} />
          <button
            type="button"
            className={styles.lightboxClose}
            onClick={() => setLightboxUrl(null)}
          >
            ✕
          </button>
        </div>
      )}
    </>
  );
}
