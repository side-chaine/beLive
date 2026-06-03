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

  // ── Auto-resize refs ──
  const descResizeRef = useAutoResize([currentStep?.description]);
  const notesResizeRef = useAutoResize([currentStep?.notes]);
  const overlayResizeRef = useAutoResize([currentStep?.overlayNote]);

  // Load images when step changes
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

        <textarea
          ref={descResizeRef}
          className={styles.descriptionInput}
          value={currentStep.description || ''}
          onChange={e => updateStep(currentStep.id, { description: e.target.value })}
          placeholder="Описание"
          rows={1}
        />

        {/* Bullets */}
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
        {/* Images */}
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
