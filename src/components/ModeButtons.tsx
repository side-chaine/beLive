import { useCallback } from 'react';
import { useModeStore } from '../stores/mode.store';
import { useUIStore } from '../stores/ui.store';
import { switchMode } from '../services/mode-switch.service';
import { BeLiveButton } from './BeLiveButton';

const MODES = [
  { id: 'concert', label: 'Concert', color: '#3498db' },
  { id: 'karaoke', label: 'Karaoke', color: '#9b59b6' },
  { id: 'rehearsal', label: 'Rehearsal', color: '#FF8C00' },
  { id: 'live', label: 'Live', color: '#e74c3c' },
] as const;

export function ModeButtons() {
  const mode = useModeStore((s) => s.mode);
  const appMode = useUIStore(s => s.appMode);
  const setAppMode = useUIStore(s => s.setAppMode);
  const modeChosen = useUIStore(s => s.modeChosen);
  const markModeChosen = useUIStore(s => s.markModeChosen);

  const handleSwitch = useCallback((newMode: string) => {
    switchMode(newMode as any);
    setAppMode('studio');
    // Only an explicit click turns the bright accent on. The store default is
    // `rehearsal`, but on a fresh load nobody has chosen it yet — showing a
    // saturated orange "active" tab reads as a loud, unasked-for CTA.
    markModeChosen();
  }, [setAppMode, markModeChosen]);

  return (
    // Symmetric 3-column grid: the middle column is the bL roundel and BOTH
    // side columns are equal `1fr`. That puts bL EXACTLY on the viewport centre
    // — the same axis used by the deck fader trio and the splash faders.
    // The old plain flex row had 2 buttons left / 2 right of different widths
    // (Concert+Karaoke vs Rehearsal+Live), which pushed bL 7.3px off centre.
    // `auto` for the middle column also keeps bL centred when it expands to
    // the "beLive" pill in feed mode.
    <div style={{
      display: 'grid',
      // `minmax(0, 1fr)` NOT `1fr`: plain 1fr has a min-content floor, so on
      // narrow windows the wider left pair forced the two columns apart and
      // pushed bL 7.3px off centre again. Zero floor = strictly equal columns
      // at every width; overflowing buttons simply extend outwards.
      gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)',
      alignItems: 'center',
      gap: 24,
    }}>
      <div style={{ display: 'flex', gap: 24, alignItems: 'center', justifyContent: 'flex-end' }}>
        {MODES.slice(0, 2).map((m) => renderModeBtn(m))}
      </div>

      <BeLiveButton />

      <div style={{ display: 'flex', gap: 24, alignItems: 'center', justifyContent: 'flex-start' }}>
        {MODES.slice(2).map((m) => renderModeBtn(m))}
      </div>
    </div>
  );

  function renderModeBtn(m: typeof MODES[number]) {
    // Quiet start: until the user picks a mode ALL four tabs share the muted
    // resting style. Functional mode is still `rehearsal` — only its visual
    // claim to be "selected" is withheld.
    const isActive = modeChosen && mode === m.id && appMode !== 'feed';
    return (
      <button
        key={m.id}
        onClick={() => handleSwitch(m.id)}
        style={{
          background: isActive ? `${m.color}22` : 'transparent',
          border: `1px solid ${isActive ? m.color : '#444'}`,
          color: isActive ? m.color : '#888',
          borderRadius: 18,
          padding: '7px 18px',
          cursor: 'pointer',
          fontSize: 13,
          fontWeight: isActive ? 700 : 400,
          fontFamily: "'Space Grotesk', system-ui, sans-serif",
          transition: 'all 0.2s ease',
          whiteSpace: 'nowrap',
        }}
      >
        {m.label}
      </button>
    );
  }
}

