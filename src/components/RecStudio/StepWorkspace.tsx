import { useState, useEffect, useRef } from 'react';
import {
  processAndSaveImage,
  loadStepImageUrl,
  removeStepImage,
  revokeStepUrl,
  revokeAllStepUrls,
} from '../../services/recStudio.image.service';
import { useRecStudioStore } from '../../stores/recStudio.store';
import styles from './StepWorkspace.module.css';
import { getAllFeatures } from './featureRegistry';

export function StepWorkspace() {
  const scenario = useRecStudioStore(s => s.scenario);
  const activePointIndex = useRecStudioStore(s => s.activePointIndex);
  const activeStepIndex = useRecStudioStore(s => s.activeStepIndex);
  const updateStep = useRecStudioStore(s => s.updateStep);

  const currentPoint = scenario.points[activePointIndex];
  const currentStep = currentPoint?.steps[activeStepIndex];

  // ── Image state ──
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Cleanup on unmount
  useEffect(() => {
    return () => { revokeAllStepUrls(); };
  }, []);

  const handleAddImage = async (file: File) => {
    if (!currentStep) return;
    const imageId = Math.random().toString(36).substring(2, 9);
    try {
      const url = await processAndSaveImage(file, imageId);
      const newImageIds = [...(currentStep.imageIds || []), imageId];
      updateStep(currentStep.id, { imageIds: newImageIds });
      setImageUrls(prev => ({ ...prev, [imageId]: url }));
    } catch (e) {
      console.error('[StepWorkspace] Image upload failed:', e);
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
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) handleAddImage(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleAddImage(file);
    e.target.value = '';
  };

  if (!currentStep) {
    return (
      <div className={styles.root}>
        <div className={styles.empty}>Нет шагов</div>
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
              className={styles.featureTextarea}
              value={currentStep.overlayNote || ''}
              onChange={e => updateStep(currentStep.id, { overlayNote: e.target.value })}
              placeholder="Появится поверх beLive при активации"
              rows={3}
            />
          </div>

          <div className={styles.notesSection}>
            <span className={styles.notesLabel}>Заметки</span>
            <textarea
              className={styles.notesInput}
              value={currentStep.notes || ''}
              onChange={e => updateStep(currentStep.id, { notes: e.target.value })}
              placeholder="Не видны в записи"
              rows={3}
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
          className={styles.descriptionInput}
          value={currentStep.description || ''}
          onChange={e => updateStep(currentStep.id, { description: e.target.value })}
          placeholder="Описание"
          rows={4}
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
              {(currentStep.imageIds || []).map(imageId => (
                <div key={imageId} className={styles.imageThumb}>
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
              ))}
            </div>
          )}
          <div
            className={styles.imageDropZone}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <span className={styles.imageDropIcon}>📷</span>
            <span className={styles.imageDropText}>Добавить изображение</span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              hidden
            />
          </div>
        </div>

        <div className={styles.notesSection}>
          <span className={styles.notesLabel}>Заметки</span>
          <textarea
            className={styles.notesInput}
            value={currentStep.notes || ''}
            onChange={e => updateStep(currentStep.id, { notes: e.target.value })}
            placeholder="Не видны в записи"
            rows={3}
          />
        </div>
      </div>
    </div>
  );
}
