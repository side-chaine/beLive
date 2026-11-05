import { useHintsStore } from './store';

/**
 * User-owned master switch — ONE line, nothing else (Nikita, 05.11.2026).
 *
 * Deliberately minimal: no caption, no language row, no "restart tour" button,
 * no second heading. The tour still resolves its language automatically from
 * where beLive was opened (locale.ts), and the store still exposes
 * setLocaleOverride / resetTour as wiring for the future guided-tour steps —
 * they are simply NOT surfaced in the settings UI.
 *
 * Drop it into any surface (room, avatar menu, a future Settings page).
 * It is the ONLY place that writes `enabled`.
 */
export function HintToggle() {
  const enabled = useHintsStore((s) => s.enabled);
  const toggleEnabled = useHintsStore((s) => s.toggleEnabled);

  return (
    <div className="bl-hint-toggle">
      <span className="bl-hint-toggle__title">Подсказки!</span>
      <button
        type="button"
        className="bl-hint-toggle__switch"
        role="switch"
        aria-checked={enabled}
        aria-label="Подсказки"
        data-bl-hint-toggle="enabled"
        onClick={toggleEnabled}
      >
        <span className="bl-hint-toggle__knob" />
      </button>
    </div>
  );
}
