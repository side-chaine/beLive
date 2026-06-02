import { useState, useRef, useEffect } from 'react';
import { useRecStudioStore } from '../../stores/recStudio.store';
import type { RecPoint } from '../../types/rec-studio.types';

interface PointListProps {
  styles: Record<string, string>;
}

export function PointList({ styles: s }: PointListProps) {
  const scenario = useRecStudioStore(s => s.scenario);
  const activePointIndex = useRecStudioStore(s => s.activePointIndex);
  const updatePoint = useRecStudioStore(s => s.updatePoint);
  const removePoint = useRecStudioStore(s => s.removePoint);
  const addPoint = useRecStudioStore(s => s.addPoint);
  const movePoint = useRecStudioStore(s => s.movePoint);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  const startEdit = (point: RecPoint) => {
    setEditingId(point.id);
    setEditValue(point.title);
  };

  const commitEdit = () => {
    if (editingId && editValue.trim()) {
      updatePoint(editingId, { title: editValue.trim() });
    }
    setEditingId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); commitEdit(); }
    if (e.key === 'Escape') setEditingId(null);
  };

  return (
    <div className={s.plRoot}>
      <div className={s.plHeader}>
        <span className={s.plHeaderTitle}>Пункты</span>
        <span className={s.plHeaderCount}>{scenario.points.length}</span>
      </div>

      <div className={s.plList}>
        {scenario.points.map((point, i) => (
          <div
            key={point.id}
            className={`${s.plItem} ${i === activePointIndex ? s.plItemActive : ''}`}
            onClick={() => {
              useRecStudioStore.setState({ activePointIndex: i, activeStepIndex: 0 });
            }}
          >
            <span className={s.plIndex}>{i + 1}</span>

            {editingId === point.id ? (
              <input
                ref={inputRef}
                className={s.plTitleInput}
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                onBlur={commitEdit}
                onKeyDown={handleKeyDown}
                onClick={e => e.stopPropagation()}
              />
            ) : (
              <span
                className={s.plTitle}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  startEdit(point);
                }}
              >
                {point.title}
              </span>
            )}

            <div className={s.plActions}>
              {i > 0 && (
                <button
                  type="button"
                  className={s.plActionBtn}
                  onClick={(e) => { e.stopPropagation(); movePoint(i, i - 1); }}
                  title="↑"
                >
                  ↑
                </button>
              )}
              {i < scenario.points.length - 1 && (
                <button
                  type="button"
                  className={s.plActionBtn}
                  onClick={(e) => { e.stopPropagation(); movePoint(i, i + 1); }}
                  title="↓"
                >
                  ↓
                </button>
              )}
              {scenario.points.length > 1 && (
                <button
                  type="button"
                  className={`${s.plActionBtn} ${s.plDeleteBtn}`}
                  onClick={(e) => { e.stopPropagation(); removePoint(point.id); }}
                  title="Удалить"
                >
                  ×
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        className={s.plAddButton}
        onClick={() => addPoint()}
      >
        + Пункт
      </button>
    </div>
  );
}
