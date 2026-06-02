import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useRecStudioStore } from '../../stores/recStudio.store';
import type { RecStep, StepType } from '../../types/rec-studio.types';

interface StepStripProps {
  styles: Record<string, string>;
}

export function StepStrip({ styles: s }: StepStripProps) {
  const scenario = useRecStudioStore(s => s.scenario);
  const activePointIndex = useRecStudioStore(s => s.activePointIndex);
  const activeStepIndex = useRecStudioStore(s => s.activeStepIndex);
  const updateStep = useRecStudioStore(s => s.updateStep);
  const removeStep = useRecStudioStore(s => s.removeStep);
  const addStep = useRecStudioStore(s => s.addStep);
  const moveStep = useRecStudioStore(s => s.moveStep);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [showTypePicker, setShowTypePicker] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  // Preserve scroll position across re-renders
  const scrollLeftRef = useRef(0);
  const addAreaRef = useRef<HTMLDivElement>(null);
  const [pickerPos, setPickerPos] = useState<{ left: number; top: number } | null>(null);

  const currentPoint = scenario.points[activePointIndex];
  if (!currentPoint) return null;

  const steps = currentPoint.steps;

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  // Effect 1: Scroll listener — mount only
  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const onScroll = () => { scrollLeftRef.current = strip.scrollLeft; };
    strip.addEventListener('scroll', onScroll, { passive: true });
    return () => strip.removeEventListener('scroll', onScroll);
  }, []);

  // Effect 2: Restore scroll — EVERY render
  useEffect(() => {
    if (stripRef.current) {
      stripRef.current.scrollLeft = scrollLeftRef.current;
    }
  });

  // Сбросить picker при смене пункта
  useEffect(() => {
    closePicker();
  }, [activePointIndex]);

  const startEdit = (step: RecStep) => {
    setEditingId(step.id);
    setEditValue(step.title || '');
  };

  const commitEdit = () => {
    if (editingId && editValue.trim()) {
      updateStep(editingId, { title: editValue.trim() });
    }
    setEditingId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); commitEdit(); }
    if (e.key === 'Escape') setEditingId(null);
  };

  const handleAddStep = (type: StepType) => {
    // Save scroll before state change
    if (stripRef.current) {
      scrollLeftRef.current = stripRef.current.scrollLeft;
    }
    addStep(currentPoint.id, type);
    setShowTypePicker(false);
    // Гарантированное восстановление scroll ПОСЛЕ React re-render
    requestAnimationFrame(() => {
      if (stripRef.current) {
        stripRef.current.scrollLeft = scrollLeftRef.current;
      }
    });
  };

  const openPicker = () => {
    if (addAreaRef.current) {
      const rect = addAreaRef.current.getBoundingClientRect();
      setPickerPos({
        left: rect.left,
        top: rect.top - 4,  // низ пикера = чуть выше кнопки
      });
    }
    setShowTypePicker(true);
  };

  const closePicker = () => {
    setShowTypePicker(false);
    setPickerPos(null);
  };

  return (
    <div className={s.ssRoot}>
      <div ref={stripRef} className={s.ssStrip}>
        {steps.map((step, i) => (
          <div
            key={step.id}
            className={`${s.ssChip} ${i === activeStepIndex ? s.ssChipActive : ''}`}
            onClick={() => {
              useRecStudioStore.setState({ activeStepIndex: i });
            }}
          >
            <span className={s.ssChipType}>
              {step.type === 'feature' ? '◆' : '•'}
            </span>

            {editingId === step.id ? (
              <input
                ref={inputRef}
                className={s.ssChipInput}
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                onBlur={commitEdit}
                onKeyDown={handleKeyDown}
                onClick={e => e.stopPropagation()}
              />
            ) : (
              <span
                className={s.ssChipTitle}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  startEdit(step);
                }}
              >
                {step.title || `${i + 1}`}
              </span>
            )}

            <div className={s.ssChipActions}>
              {i > 0 && (
                <button
                  type="button"
                  className={s.ssChipAction}
                  onClick={(e) => { e.stopPropagation(); moveStep(currentPoint.id, i, i - 1); }}
                >
                  ←
                </button>
              )}
              {i < steps.length - 1 && (
                <button
                  type="button"
                  className={s.ssChipAction}
                  onClick={(e) => { e.stopPropagation(); moveStep(currentPoint.id, i, i + 1); }}
                >
                  →
                </button>
              )}
              {steps.length > 1 && (
                <button
                  type="button"
                  className={`${s.ssChipAction} ${s.ssChipDelete}`}
                  onClick={(e) => { e.stopPropagation(); removeStep(step.id); }}
                >
                  ×
                </button>
              )}
            </div>
          </div>
        ))}

        <div ref={addAreaRef} className={s.ssAddArea}>
          {showTypePicker ? null : (
            <button
              type="button"
              className={s.ssAddButton}
              onClick={openPicker}
            >
              + Шаг
            </button>
          )}
          {showTypePicker && pickerPos && createPortal(
            <div
              className={s.ssTypePicker}
              style={{
                position: 'fixed',
                left: pickerPos.left,
                top: pickerPos.top,
                transform: 'translateY(-100%)',
                zIndex: 999998,
              }}
            >
              <button
                type="button"
                className={s.ssTypeOption}
                onClick={() => handleAddStep('content')}
              >
                • Контент
              </button>
              <button
                type="button"
                className={s.ssTypeOption}
                onClick={() => handleAddStep('feature')}
              >
                ◆ Функция
              </button>
              <button
                type="button"
                className={s.ssTypeCancel}
                onClick={closePicker}
              >
                Отмена
              </button>
            </div>,
            document.querySelector('[data-rec-studio-root]') ?? document.body
          )}
        </div>
      </div>
    </div>
  );
}
