import { TRANSITIONS } from '../types/textStyle.types';
import s from './LineFxSelectorModal.module.css';

type TransitionSet = 'A' | 'B';

interface LineFxSelectorModalProps {
  open: boolean;
  transitionSet: TransitionSet;
  transitionId: string;
  onClose: () => void;
  onSetTransitionSet: (set: TransitionSet) => void;
  onSelectTransition: (id: string) => void;
}

export function LineFxSelectorModal({
  open,
  transitionSet,
  transitionId,
  onClose,
  onSetTransitionSet,
  onSelectTransition,
}: LineFxSelectorModalProps) {
  if (!open) return null;

  const sourceFilter = transitionSet === 'A' ? 'claude' : 'gemini';
  const visibleTrans = Object.entries(TRANSITIONS).filter(([, t]) => t.source === sourceFilter);
  const currentName = TRANSITIONS[transitionId]?.name ?? 'Effect';

  function handleSelect(id: string) {
    onSelectTransition(id);
    onClose();
  }

  return (
    <div className={s.overlay} onClick={onClose}>
      <div className={s.modal} onClick={e => e.stopPropagation()}>
        <div className={s.header}>
          <div>
            <div className={s.title}>Line FX</div>
            <div className={s.sub}>Select effect for active line transitions</div>
          </div>
          <button type="button" className={s.closeBtn} onClick={onClose}>
            ✕
          </button>
        </div>

        <div className={s.currentBar}>
          <span className={s.currentLabel}>Current</span>
          <span className={s.currentValue}>{currentName}</span>
        </div>

        <div className={s.bankRow}>
          <span className={s.bankLabel}>Bank</span>
          <div className={s.bankGroup}>
            <button
              type="button"
              className={`${s.bankBtn} ${transitionSet === 'A' ? s.bankBtnActive : ''}`}
              onClick={() => onSetTransitionSet('A')}
            >
              A
            </button>
            <button
              type="button"
              className={`${s.bankBtn} ${transitionSet === 'B' ? s.bankBtnActive : ''}`}
              onClick={() => onSetTransitionSet('B')}
            >
              B
            </button>
            <button type="button" className={s.bankGhost} disabled>
              C
            </button>
            <button type="button" className={s.bankGhost} disabled>
              D
            </button>
          </div>
        </div>

        <div className={s.grid}>
          {visibleTrans.map(([id, t]) => (
            <button
              type="button"
              key={id}
              className={`${s.fxBtn} ${transitionId === id ? s.fxBtnActive : ''}`}
              onClick={() => handleSelect(id)}
            >
              {t.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
