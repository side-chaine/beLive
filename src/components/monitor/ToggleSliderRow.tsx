import s from '../MonitorMixPanel.module.css';

export function ToggleSliderRow({ label, active, onToggle, value, onValue, hideToggle }: {
  label: string;
  active: boolean;
  onToggle: () => void;
  value: number;
  onValue: (v: number) => void;
  hideToggle?: boolean;
}) {
  return (
    <div className={s.toggleRow}>
      {!hideToggle && (
        <button
          className={`${s.dotToggle} ${active ? s.dotToggleActive : ''}`}
          onClick={onToggle}
          type="button"
        />
      )}
      <span className={s.toggleLabel}>{label}</span>
      <input type="range" className={`${s.slider} ${!active ? s.sliderInactive : ''}`}
        min={0} max={100} value={Math.round(value * 100)}
        onChange={e => onValue(+e.target.value / 100)} />
      <span className={s.val}>{Math.round(value * 100)}%</span>
    </div>
  );
}
