import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useShowStore } from '../../stores/show.store';
import type { ShowStep, StepType } from '../../types/show.types';

interface StepStripProps {
  styles: Record<string, string>;
}

export function StepStrip({ styles: s }: StepStripProps) {
  const scenario = useShowStore(s => s.scenario);
  const activePointIndex = useShowStore(s => s.activePointIndex);
  const activeStepIndex = useShowStore(s => s.activeStepIndex);
  const updateStep = useShowStore(s => s.updateStep);
  const removeStep = useShowStore(s => s.removeStep);
  const addStep = useShowStore(s => s.addStep);
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

  const startEdit = (step: ShowStep) => {
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
    addStep(currentPoint.id, type);
    // Auto-activate new step (it's added at the end)
    useShowStore.setState({ activeStepIndex: currentPoint.steps.length });
    setShowTypePicker(false);
    // Scroll strip to end — new step should be visible
    requestAnimationFrame(() => {
      if (stripRef.current) {
        stripRef.current.scrollLeft = stripRef.current.scrollWidth;
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
              useShowStore.setState({ activeStepIndex: i });
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
                className={s.ssTypeOption}
                onClick={() => handleAddStep('html')}
              >
                ◇ HTML
              </button>
              <button
                type="button"
                className={s.ssTypeCancel}
                onClick={closePicker}
              >
                Отмена
              </button>
            </div>,
            document.querySelector('[data-show-root]') ?? document.body
          )}
        </div>
      </div>
    </div>
  );
}
