import s from '../MonitorMixPanel.module.css';

export function DualAutoMixRow({
  label,
  active,
  onToggle,
  value,
  onValue,
  bvActive,
  onBvToggle,
  bvValue,
  onBvValue
}: {
  label: string;
  active: boolean;
  onToggle: () => void;
  value: number;
  onValue: (v: number) => void;
  bvActive: boolean;
  onBvToggle: () => void;
  bvValue: number;
  onBvValue: (v: number) => void;
}) {
  return (
    <div className={s.dualAutoMixRow}>
      <div className={s.dualLeft}>
        <button
          className={`${s.dotToggle} ${active ? s.dotToggleActive : ''}`}
          onClick={onToggle}
          type="button"
        />
        <span className={s.toggleLabel}>{label}</span>
        <input type="range" className={`${s.slider} ${!active ? s.sliderInactive : ''}`}
          min={0} max={100} value={Math.round(value * 100)}
          onChange={e => onValue(+e.target.value / 100)} />
        <span className={s.val}>{Math.round(value * 100)}%</span>
      </div>
      <div className={s.dualDivider} />
      <div className={s.dualRight}>
        <button
          className={`${s.dotToggle} ${bvActive ? s.dotToggleActive : ''}`}
          onClick={onBvToggle}
          type="button"
        />
        <span className={s.bvLabel}>{label}</span>
        <input type="range" className={`${s.bvSlider} ${bvActive ? s.bvSliderActive : ''}`}
          min={0} max={100} value={Math.round(bvValue * 100)}
          onChange={e => onBvValue(+e.target.value / 100)} />
        <span className={s.val}>{Math.round(bvValue * 100)}%</span>
      </div>
    </div>
  );
}
