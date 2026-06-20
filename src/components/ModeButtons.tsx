import { useCallback } from 'react';
import { useModeStore } from '../stores/mode.store';
import { useUIStore } from '../stores/ui.store';
import { switchMode } from '../bridges/mode-switch.bridge';
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

  const handleSwitch = useCallback((newMode: string) => {
    switchMode(newMode as any);
    setAppMode('studio');
  }, [setAppMode]);

  return (
    <div style={{
      display: 'flex', gap: 24, alignItems: 'center',
    }}>
      {MODES.slice(0, 2).map((m) => renderModeBtn(m))}

      <div style={{ margin: '0 8px' }}>
        <BeLiveButton />
      </div>

      {MODES.slice(2).map((m) => renderModeBtn(m))}
    </div>
  );

  function renderModeBtn(m: typeof MODES[number]) {
    const isActive = mode === m.id && appMode !== 'feed';
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

