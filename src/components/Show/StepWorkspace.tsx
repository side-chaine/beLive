import { useState, useEffect, useRef } from 'react';
import {
  processAndSaveImage,
  loadStepImageUrl,
  removeStepImage,
  revokeStepUrl,
  revokeAllStepUrls,
} from '../../services/show.image.service';
import {
  processAndSaveHtml,
  loadStepHtmlUrl,
  revokeAllHtmlUrls,
} from '../../services/show.html.service';
import { useShowStore } from '../../stores/show.store';
import styles from './StepWorkspace.module.css';
import { useAutoResize } from '../../hooks/useAutoResize';
import { getAllFeatures } from './featureRegistry';
import type { ShowSubSlide, SubSlideBullet, SlideColor } from '../../types/show.types';
import { SLIDE_COLORS } from '../../types/show.types';

// ── Inline ColorPicker ──

function ColorPicker({ value, onChange }: {
  value?: SlideColor;
  onChange: (color?: SlideColor) => void;
}) {
  return (
    <div className={styles.colorPicker}>
      {SLIDE_COLORS.map(color => (
        <button
          key={color}
          type="button"
          className={`${styles.colorSwatch} ${value === color ? styles.colorSwatchActive : ''}`}
          style={{ backgroundColor: color }}
          onClick={() => onChange(value === color ? undefined : color)}
          title={color}
        />
      ))}
    </div>
  );
}

// ── Auto-resize for dynamic textareas ──

function autoResize(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
}

export function StepWorkspace() {
  const scenario = useShowStore(s => s.scenario);
  const activePointIndex = useShowStore(s => s.activePointIndex);
  const activeStepIndex = useShowStore(s => s.activeStepIndex);
  const updateStep = useShowStore(s => s.updateStep);

  const currentPoint = scenario.points[activePointIndex];
  const currentStep = currentPoint?.steps[activeStepIndex];

  // ── Image state ──
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [htmlUrl, setHtmlUrl] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const htmlInputRef = useRef<HTMLInputElement>(null);
  // ── Sub-slide image upload refs ──
  const subSlideImageInputRef = useRef<HTMLInputElement>(null);
  const newSubSlideImageInputRef = useRef<HTMLInputElement>(null);
  const targetSubSlideIndexRef = useRef(-1);
  const [isBatchDragOver, setIsBatchDragOver] = useState(false);

  // ── Auto-resize refs ──
  const descResizeRef = useAutoResize([currentStep?.description]);
  const notesResizeRef = useAutoResize([currentStep?.notes]);
  const overlayResizeRef = useAutoResize([currentStep?.overlayNote]);

  // Load images when step changes (legacy + sub-slides)
  useEffect(() => {
    const step = scenario.points[activePointIndex]?.steps[activeStepIndex];
    if (!step) {
      setImageUrls({});
      return;
    }

    // Collect all imageIds from both legacy and sub-slides
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

  // Load HTML when step changes
  useEffect(() => {
    const step = scenario.points[activePointIndex]?.steps[activeStepIndex];
    if (!step?.htmlId) {
      setHtmlUrl(null);
      return;
    }
    let cancelled = false;
    loadStepHtmlUrl(step.htmlId).then(url => {
      if (!cancelled) setHtmlUrl(url);
    });
    return () => { cancelled = true; };
  }, [activePointIndex, activeStepIndex]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      revokeAllStepUrls();   // изображения
      revokeAllHtmlUrls();   // HTML (усиление 32.1 — координация cleanup)
    };
  }, []);

  const handleAddImages = async (files: File[]) => {
    if (!currentStep) return;
    const newImageIds: string[] = [];
    const newUrls: Record<string, string> = {};

    for (const file of files) {
      const imageId = Math.random().toString(36).substring(2, 9);
      try {
        const url = await processAndSaveImage(file, imageId);
        newImageIds.push(imageId);
        newUrls[imageId] = url;
      } catch (e) {
        console.error('[StepWorkspace] Image upload failed:', e);
      }
    }

    if (newImageIds.length > 0) {
      const allImageIds = [...(currentStep.imageIds || []), ...newImageIds];
      updateStep(currentStep.id, { imageIds: allImageIds });
      setImageUrls(prev => ({ ...prev, ...newUrls }));
    }
  };

  const handleRemoveImage = async (imageId: string) => {
    if (!currentStep) return;
    const url = imageUrls[imageId];
    const newImageIds = (currentStep.imageIds || []).filter(id => id !== imageId);
    updateStep(currentStep.id, { imageIds: newImageIds });
    setImageUrls(prev => {
      const next = { ...prev };
      delete next[imageId];
      return next;
    });
    if (url) revokeStepUrl(url);
    try { await removeStepImage(imageId); } catch (_) {}
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const imageFiles = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    if (imageFiles.length > 0) {
      handleAddImages(imageFiles);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleAddImages(Array.from(files));
    }
    e.target.value = '';
  };

  const handleHtmlFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentStep) return;
    const htmlId = Math.random().toString(36).substring(2, 9);
    try {
      const url = await processAndSaveHtml(file, htmlId);
      updateStep(currentStep.id, { htmlId });
      setHtmlUrl(url);
    } catch (err) {
      console.error('[StepWorkspace] HTML upload failed:', err);
    }
    e.target.value = '';
  };

  const handleHtmlDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files[0];
    if (!file || !currentStep) return;
    if (file.name.endsWith('.html') || file.name.endsWith('.htm')) {
      const htmlId = Math.random().toString(36).substring(2, 9);
      processAndSaveHtml(file, htmlId).then(url => {
        updateStep(currentStep.id, { htmlId });
        setHtmlUrl(url);
      });
    }
  };

  // ── Sub-slide helpers ──

  const updateSubSlide = (index: number, data: Partial<ShowSubSlide>) => {
    if (!currentStep) return;
    const newSubSlides = [...(currentStep.subSlides || [])];
    if (!newSubSlides[index]) return;
    newSubSlides[index] = { ...newSubSlides[index], ...data };
    updateStep(currentStep.id, { subSlides: newSubSlides });
  };

  const updateSubSlideBullet = (ssIndex: number, bIndex: number, data: Partial<SubSlideBullet>) => {
    if (!currentStep) return;
    const newSubSlides = [...(currentStep.subSlides || [])];
    const ss = newSubSlides[ssIndex];
    if (!ss) return;
    const newBullets = [...(ss.bullets || [])];
    newBullets[bIndex] = { ...newBullets[bIndex], ...data };
    newSubSlides[ssIndex] = { ...ss, bullets: newBullets };
    updateStep(currentStep.id, { subSlides: newSubSlides });
  };

  // ── Sub-slide image handlers ──

  const handleSubSlideImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const ssIdx = targetSubSlideIndexRef.current;
    if (!file || !currentStep || ssIdx < 0) return;
    const imageId = Math.random().toString(36).substring(2, 9);
    try {
      const url = await processAndSaveImage(file, imageId);
      updateSubSlide(ssIdx, { imageId });
      setImageUrls(prev => ({ ...prev, [imageId]: url }));
    } catch (err) {
      console.error('[StepWorkspace] Sub-slide image upload failed:', err);
    }
    e.target.value = '';
    targetSubSlideIndexRef.current = -1;
  };

  const handleNewSubSlideImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !currentStep) return;
    const newSubSlides: ShowSubSlide[] = [];
    const newUrls: Record<string, string> = {};

    for (let i = 0; i < files.length; i++) {
      const imageId = Math.random().toString(36).substring(2, 9);
      try {
        const url = await processAndSaveImage(files[i], imageId);
        newSubSlides.push({ imageId });
        newUrls[imageId] = url;
      } catch (err) {
        console.error('[StepWorkspace] New sub-slide image upload failed:', err);
      }
    }

    if (newSubSlides.length > 0) {
      updateStep(currentStep.id, {
        subSlides: [...(currentStep.subSlides || []), ...newSubSlides],
      });
      setImageUrls(prev => ({ ...prev, ...newUrls }));
    }
    e.target.value = '';
  };

  const handleRemoveSubSlideImage = async (ssIndex: number) => {
    if (!currentStep) return;
    const ss = currentStep.subSlides?.[ssIndex];
    if (!ss?.imageId) return;
    const url = imageUrls[ss.imageId];
    updateSubSlide(ssIndex, { imageId: undefined });
    setImageUrls(prev => {
      const next = { ...prev };
      delete next[ss.imageId!];
      return next;
    });
    if (url) revokeStepUrl(url);
    try { await removeStepImage(ss.imageId); } catch (_) {}
  };

  const handleSubSlideImageDrop = (e: React.DragEvent, ssIdx: number) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files[0];
    if (!file || !file.type.startsWith('image/') || !currentStep) return;
    const imageId = Math.random().toString(36).substring(2, 9);
    processAndSaveImage(file, imageId).then(url => {
      updateSubSlide(ssIdx, { imageId });
      setImageUrls(prev => ({ ...prev, [imageId]: url }));
    });
  };

  const handleBatchImageDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsBatchDragOver(false);
    if (!currentStep) return;
    const imageFiles = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    if (imageFiles.length === 0) return;

    const newSubSlides: ShowSubSlide[] = [];
    const newUrls: Record<string, string> = {};

    (async () => {
      for (const file of imageFiles) {
        const imageId = Math.random().toString(36).substring(2, 9);
        try {
          const url = await processAndSaveImage(file, imageId);
          newSubSlides.push({ imageId });
          newUrls[imageId] = url;
        } catch (err) {
          console.error('[StepWorkspace] Batch drop upload failed:', err);
        }
      }
      if (newSubSlides.length > 0) {
        updateStep(currentStep.id, {
          subSlides: [...(currentStep.subSlides || []), ...newSubSlides],
        });
        setImageUrls(prev => ({ ...prev, ...newUrls }));
      }
    })();
  };

  const handleBatchDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsBatchDragOver(true);
  };

  const handleBatchDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsBatchDragOver(false);
  };

  // ── Sub-slide CRUD ──

  const handleAddTextSubSlide = () => {
    if (!currentStep) return;
    updateStep(currentStep.id, {
      subSlides: [...(currentStep.subSlides || []), {}],
    });
  };

  const handleRemoveSubSlide = (ssIndex: number) => {
    if (!currentStep) return;
    const ss = currentStep.subSlides?.[ssIndex];
    if (ss?.imageId) {
      const url = imageUrls[ss.imageId];
      if (url) revokeStepUrl(url);
      removeStepImage(ss.imageId).catch(() => {});
    }
    const newSubSlides = (currentStep.subSlides || []).filter((_, i) => i !== ssIndex);
    updateStep(currentStep.id, { subSlides: newSubSlides });
  };

  const handleMoveSubSlide = (ssIndex: number, direction: 'up' | 'down') => {
    if (!currentStep) return;
    const subSlides = [...(currentStep.subSlides || [])];
    const targetIndex = direction === 'up' ? ssIndex - 1 : ssIndex + 1;
    if (targetIndex < 0 || targetIndex >= subSlides.length) return;
    [subSlides[ssIndex], subSlides[targetIndex]] = [subSlides[targetIndex], subSlides[ssIndex]];
    updateStep(currentStep.id, { subSlides });
  };

  // ── Sub-slide bullet CRUD ──

  const handleAddSubSlideBullet = (ssIndex: number) => {
    if (!currentStep) return;
    const ss = currentStep.subSlides?.[ssIndex];
    if (!ss) return;
    const newBullets = [...(ss.bullets || []), { text: '' }];
    updateSubSlide(ssIndex, { bullets: newBullets });
  };

  const handleRemoveSubSlideBullet = (ssIndex: number, bIndex: number) => {
    if (!currentStep) return;
    const ss = currentStep.subSlides?.[ssIndex];
    if (!ss) return;
    const newBullets = (ss.bullets || []).filter((_, i) => i !== bIndex);
    updateSubSlide(ssIndex, { bullets: newBullets });
  };

  if (!currentStep) {
    return (
      <div className={styles.root}>
        <div className={styles.empty}>Нет шагов</div>
      </div>
    );
  }

  if (currentStep.type === 'html') {
    return (
      <div className={styles.root}>
        <div className={styles.contentInner}>
          <div className={styles.typeBadge}>◇ HTML</div>

          <input
            className={styles.titleInput}
            value={currentStep.title || ''}
            onChange={e => updateStep(currentStep.id, { title: e.target.value })}
            placeholder="Заголовок шага"
          />

          {htmlUrl ? (
            <div className={styles.htmlPreviewWrapper}>
              <iframe
                src={htmlUrl}
                sandbox=""
                className={styles.htmlPreview}
                title="HTML preview"
              />
              <button
                type="button"
                className={styles.htmlReplace}
                onClick={() => htmlInputRef.current?.click()}
              >
                Заменить .html
              </button>
            </div>
          ) : (
            <div
              className={styles.htmlDropZone}
              onDragOver={handleDragOver}
              onDrop={handleHtmlDrop}
              onClick={() => htmlInputRef.current?.click()}
            >
              <span className={styles.htmlDropIcon}>🌐</span>
              <span className={styles.htmlDropText}>Загрузить .html файл</span>
            </div>
          )}

          <input
            ref={htmlInputRef}
            type="file"
            accept=".html,.htm"
            onChange={handleHtmlFileSelect}
            hidden
          />

          <div className={styles.notesSection}>
            <span className={styles.notesLabel}>Заметки</span>
            <textarea
              ref={notesResizeRef}
              className={styles.notesInput}
              value={currentStep.notes || ''}
              onChange={e => updateStep(currentStep.id, { notes: e.target.value })}
              placeholder="Не видны в записи"
              rows={1}
            />
          </div>
        </div>
      </div>
    );
  }

  if (currentStep.type === 'feature') {
    const features = getAllFeatures();

    return (
      <div className={styles.root}>
        <div className={styles.contentInner}>
          <div className={styles.typeBadge}>◆ Функция</div>

          <input
            className={styles.titleInput}
            value={currentStep.title || ''}
            onChange={e => updateStep(currentStep.id, { title: e.target.value })}
            placeholder="Заголовок шага"
          />

          <div className={styles.featureSection}>
            <label className={styles.fieldLabel}>Действие</label>
            <select
              className={styles.actionSelect}
              value={currentStep.action?.type || ''}
              onChange={e => {
                const actionType = e.target.value;
                updateStep(currentStep.id, {
                  action: actionType ? { type: actionType } : undefined,
                });
              }}
            >
              <option value="">— Выберите функцию —</option>
              {features.map(f => (
                <option key={f.id} value={f.id}>{f.label}</option>
              ))}
            </select>
          </div>

          <div className={styles.featureSection}>
            <label className={styles.fieldLabel}>Метка кнопки</label>
            <input
              className={styles.featureInput}
              value={currentStep.actionLabel || ''}
              onChange={e => updateStep(currentStep.id, { actionLabel: e.target.value })}
              placeholder="Например: Показать микшер"
            />
          </div>

          <div className={styles.featureSection}>
            <label className={styles.fieldLabel}>Заметка на экране</label>
            <textarea
              ref={overlayResizeRef}
              className={styles.featureTextarea}
              value={currentStep.overlayNote || ''}
              onChange={e => updateStep(currentStep.id, { overlayNote: e.target.value })}
              placeholder="Появится поверх beLive при активации"
              rows={1}
            />
          </div>

          <div className={styles.notesSection}>
            <span className={styles.notesLabel}>Заметки</span>
            <textarea
              ref={notesResizeRef}
              className={styles.notesInput}
              value={currentStep.notes || ''}
              onChange={e => updateStep(currentStep.id, { notes: e.target.value })}
              placeholder="Не видны в записи"
              rows={1}
            />
          </div>
        </div>
      </div>
    );
  }

  // ── Content step ──
  const hasSubSlides = currentStep.subSlides !== undefined;

  return (
    <div className={styles.root}>
      <div className={styles.contentInner}>
        <div className={styles.typeBadge}>Контент</div>

        <input
          className={styles.titleInput}
          value={currentStep.title || ''}
          onChange={e => updateStep(currentStep.id, { title: e.target.value })}
          placeholder="Заголовок шага"
        />

        <input
          className={styles.subtitleInput}
          value={currentStep.subtitle || ''}
          onChange={e => updateStep(currentStep.id, { subtitle: e.target.value })}
          placeholder="Подзаголовок"
        />

        {hasSubSlides ? (
          /* ── New model: sub-slide cards ── */
          <div className={styles.subSlidesSection}>
            {(currentStep.subSlides || []).map((subSlide, ssIdx) => (
              <div key={ssIdx} className={styles.subSlideCard}>
                {/* Header */}
                <div className={styles.subSlideHeader}>
                  <span className={styles.subSlideIndex}>
                    Суб-слайд {ssIdx + 1}
                  </span>
                  <div className={styles.subSlideActions}>
                    {ssIdx > 0 && (
                      <button
                        type="button"
                        className={styles.subSlideAction}
                        onClick={() => handleMoveSubSlide(ssIdx, 'up')}
                        title="↑ Вверх"
                      >
                        ↑
                      </button>
                    )}
                    {ssIdx < (currentStep.subSlides?.length ?? 0) - 1 && (
                      <button
                        type="button"
                        className={styles.subSlideAction}
                        onClick={() => handleMoveSubSlide(ssIdx, 'down')}
                        title="↓ Вниз"
                      >
                        ↓
                      </button>
                    )}
                    {(currentStep.subSlides?.length ?? 0) > 1 && (
                      <button
                        type="button"
                        className={`${styles.subSlideAction} ${styles.subSlideActionDelete}`}
                        onClick={() => handleRemoveSubSlide(ssIdx)}
                        title="Удалить"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>

                {/* Image */}
                <div className={styles.subSlideImageArea}>
                  {subSlide.imageId && imageUrls[subSlide.imageId] ? (
                    <div className={styles.subSlideImageThumb}>
                      <img
                        src={imageUrls[subSlide.imageId]}
                        alt=""
                        className={styles.subSlideImageImg}
                      />
                      <button
                        type="button"
                        className={styles.subSlideImageRemove}
                        onClick={() => handleRemoveSubSlideImage(ssIdx)}
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <div
                      className={styles.subSlideImageDropZone}
                      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                      onDrop={(e) => handleSubSlideImageDrop(e, ssIdx)}
                      onClick={() => {
                        targetSubSlideIndexRef.current = ssIdx;
                        subSlideImageInputRef.current?.click();
                      }}
                    >
                      <span className={styles.subSlideImageDropIcon}>📷</span>
                      <span className={styles.subSlideImageDropText}>Добавить фото</span>
                    </div>
                  )}
                </div>

                {/* Title */}
                <div className={styles.subSlideField}>
                  <div className={styles.subSlideFieldRow}>
                    <span className={styles.subSlideFieldLabel}>Заголовок</span>
                    <input
                      className={styles.subSlideFieldInput}
                      value={subSlide.title || ''}
                      onChange={e => updateSubSlide(ssIdx, { title: e.target.value || undefined })}
                      placeholder={ssIdx === 0 ? currentStep?.title || 'Заголовок' : 'Наследует предыдущий'}
                    />
                    <ColorPicker
                      value={subSlide.titleColor}
                      onChange={color => updateSubSlide(ssIdx, { titleColor: color })}
                    />
                  </div>
                </div>

                {/* Description */}
                <div className={styles.subSlideField}>
                  <div className={styles.subSlideFieldRow}>
                    <span className={styles.subSlideFieldLabel}>Описание</span>
                    <textarea
                      ref={autoResize}
                      className={styles.subSlideFieldTextarea}
                      value={subSlide.description || ''}
                      onChange={e => updateSubSlide(ssIdx, { description: e.target.value || undefined })}
                      onInput={(e) => autoResize(e.currentTarget)}
                      placeholder="Описание суб-слайда"
                      rows={1}
                    />
                    <ColorPicker
                      value={subSlide.descriptionColor}
                      onChange={color => updateSubSlide(ssIdx, { descriptionColor: color })}
                    />
                  </div>
                </div>

                {/* Bullets */}
                <div className={styles.subSlideBulletsSection}>
                  {(subSlide.bullets || []).map((bullet, bIdx) => (
                    <div key={bIdx} className={styles.subSlideBulletRow}>
                      <span className={styles.subSlideBulletDot}>•</span>
                      <input
                        className={styles.subSlideBulletInput}
                        value={bullet.text}
                        onChange={e => updateSubSlideBullet(ssIdx, bIdx, { text: e.target.value })}
                        placeholder="Тезис"
                      />
                      <ColorPicker
                        value={bullet.color}
                        onChange={color => updateSubSlideBullet(ssIdx, bIdx, { color })}
                      />
                      <button
                        type="button"
                        className={styles.subSlideBulletRemove}
                        onClick={() => handleRemoveSubSlideBullet(ssIdx, bIdx)}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className={styles.subSlideBulletAdd}
                    onClick={() => handleAddSubSlideBullet(ssIdx)}
                  >
                    + Пункт
                  </button>
                </div>
              </div>
            ))}

            {/* Add sub-slide buttons */}
            <div
              className={`${styles.addSubSlideArea} ${isBatchDragOver ? styles.addSubSlideAreaDragOver : ''}`}
              onDragOver={handleBatchDragOver}
              onDragLeave={handleBatchDragLeave}
              onDrop={handleBatchImageDrop}
            >
              <button
                type="button"
                className={styles.addSubSlideBtn}
                onClick={() => newSubSlideImageInputRef.current?.click()}
              >
                <span className={styles.addSubSlideIcon}>📷</span>
                Добавить изображение
              </button>
              <button
                type="button"
                className={styles.addSubSlideBtn}
                onClick={handleAddTextSubSlide}
              >
                <span className={styles.addSubSlideIcon}>📝</span>
                Текстовый суб-слайд
              </button>
            </div>

            {/* Hidden file inputs */}
            <input
              ref={subSlideImageInputRef}
              type="file"
              accept="image/*"
              onChange={handleSubSlideImageSelect}
              hidden
            />
            <input
              ref={newSubSlideImageInputRef}
              type="file"
              accept="image/*"
              onChange={handleNewSubSlideImageSelect}
              hidden
              multiple
            />
          </div>
        ) : (
          /* ── Legacy model (defensive fallback) ── */
          <>
            <textarea
              ref={descResizeRef}
              className={styles.descriptionInput}
              value={currentStep.description || ''}
              onChange={e => updateStep(currentStep.id, { description: e.target.value })}
              placeholder="Описание"
              rows={1}
            />

            <div className={styles.bulletsSection}>
              {(currentStep.bullets || []).map((bullet, i) => (
                <div key={i} className={styles.bulletRow}>
                  <span className={styles.bulletDot}>•</span>
                  <input
                    className={styles.bulletInput}
                    value={bullet}
                    onChange={e => {
                      const newBullets = [...(currentStep.bullets || [])];
                      newBullets[i] = e.target.value;
                      updateStep(currentStep.id, { bullets: newBullets });
                    }}
                    placeholder="Тезис"
                  />
                  <button
                    type="button"
                    className={styles.bulletRemove}
                    onClick={() => {
                      const newBullets = (currentStep.bullets || []).filter((_, idx) => idx !== i);
                      updateStep(currentStep.id, { bullets: newBullets });
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                className={styles.bulletAdd}
                onClick={() => {
                  const newBullets = [...(currentStep.bullets || []), ''];
                  updateStep(currentStep.id, { bullets: newBullets });
                }}
              >
                + Тезис
              </button>
            </div>

            <div className={styles.imageSection}>
              {(currentStep.imageIds || []).length > 0 && (
                <div className={styles.imageGrid}>
                  {(currentStep.imageIds || []).map((imageId, idx) => (
                    <div key={imageId} className={styles.imageThumbWithCaption}>
                      <div className={styles.imageThumb}>
                        {imageUrls[imageId] && (
                          <img src={imageUrls[imageId]} alt="" className={styles.imageImg} />
                        )}
                        <button
                          type="button"
                          className={styles.imageRemove}
                          onClick={() => handleRemoveImage(imageId)}
                        >
                          ×
                        </button>
                      </div>
                      <input
                        className={styles.imageCaptionInput}
                        value={currentStep.imageCaptions?.[idx] || ''}
                        onChange={e => {
                          const newCaptions = [...(currentStep.imageCaptions || [])];
                          while (newCaptions.length < (currentStep.imageIds || []).length) newCaptions.push('');
                          newCaptions[idx] = e.target.value;
                          updateStep(currentStep.id, { imageCaptions: newCaptions });
                        }}
                        placeholder="Подпись"
                      />
                    </div>
                  ))}
                </div>
              )}
              <div
                className={styles.imageDropZone}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => imageInputRef.current?.click()}
              >
                <span className={styles.imageDropIcon}>+</span>
                <span className={styles.imageDropText}>Добавить изображение</span>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  hidden
                  multiple
                />
              </div>
            </div>
          </>
        )}

        <div className={styles.notesSection}>
          <span className={styles.notesLabel}>Заметки</span>
          <textarea
            ref={notesResizeRef}
            className={styles.notesInput}
            value={currentStep.notes || ''}
            onChange={e => updateStep(currentStep.id, { notes: e.target.value })}
            placeholder="Не видны в записи"
            rows={1}
          />
        </div>
      </div>
    </div>
  );
}
