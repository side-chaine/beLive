import { useTextStyleStore } from '../stores/textStyle.store';
import { FONT_CATEGORIES, TRANSITIONS } from '../types/textStyle.types';
import s from './StylesDeck.module.css';

export function StylesDeck() {
  const fontFamily = useTextStyleStore(st => st.fontFamily);
  const fontScale = useTextStyleStore(st => st.fontScale);
  const transitionId = useTextStyleStore(st => st.transitionId);
  const transitionSet = useTextStyleStore(st => st.transitionSet);
  const setFont = useTextStyleStore(st => st.setFontFamily);
  const setTransition = useTextStyleStore(st => st.setTransitionId);
  const setTransSet = useTextStyleStore(st => st.setTransitionSet);

  const increase = useTextStyleStore(st => st.increaseFontScale);
  const decrease = useTextStyleStore(st => st.decreaseFontScale);
  const reset = useTextStyleStore(st => st.resetFontScale);

  const sourceFilter = transitionSet === 'A' ? 'claude' : 'gemini';
  const visibleTrans = Object.entries(TRANSITIONS).filter(
    ([, t]) => t.source === sourceFilter
  );

  return (
    <div className={s.root}>
      {/* Row 1: Font + Scale */}
      <div className={s.row}>
        <label className={s.label}>Font</label>
        <select
          className={s.fontSelect}
          value={fontFamily}
          onChange={e => setFont(e.target.value)}
        >
          {FONT_CATEGORIES.map(cat => (
            <optgroup key={cat.name} label={cat.name}>
              {cat.list.map(f => (
                <option key={f.id} value={f.family}>
                  {f.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <div className={s.scaleGroup}>
          <button className={s.scaleBtn} onClick={() => decrease()}>
            A−
          </button>
          <span className={s.scaleVal}>{Math.round(fontScale * 100)}%</span>
          <button className={s.scaleBtn} onClick={() => increase()}>
            A+
          </button>
          <button className={s.scaleBtn} onClick={() => reset()} title="Reset">
            ↺
          </button>
        </div>
      </div>

      {/* Row 2: Set A/B */}
      <div className={s.row}>
        <label className={s.label}>FX</label>
        <button
          className={`${s.setBtn} ${transitionSet === 'A' ? s.setActive : ''}`}
          onClick={() => setTransSet('A')}
        >
          A
        </button>
        <button
          className={`${s.setBtn} ${transitionSet === 'B' ? s.setActive : ''}`}
          onClick={() => setTransSet('B')}
        >
          B
        </button>

      </div>

      {/* Row 3: Transitions grid */}
      <div className={s.transGrid}>
        {visibleTrans.map(([id, t]) => (
          <button
            key={id}
            className={`${s.transBtn} ${transitionId === id ? s.transSel : ''}`}
            onClick={() => setTransition(id)}
          >
            {t.name}
          </button>
        ))}
      </div>
    </div>
  );
}
