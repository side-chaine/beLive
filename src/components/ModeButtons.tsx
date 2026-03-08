import React, { useCallback } from 'react';
import { useModeStore } from '../stores/mode.store';
import { switchMode } from '../bridges/mode-switch.bridge';

const MODES = [
  { id: 'concert', label: 'Concert', color: '#3498db' },
  { id: 'karaoke', label: 'Karaoke', color: '#9b59b6' },
  { id: 'rehearsal', label: 'Rehearsal', color: '#FF8C00' },
  { id: 'live', label: 'Live', color: '#e74c3c' },
] as const;

export function ModeButtons() {
  const mode = useModeStore((s) => s.mode);

  const handleSwitch = useCallback((newMode: string) => {
    switchMode(newMode as any);
  }, []);

  return (
    <div style={{
      display: 'flex', gap: 4,
    }}>
      {MODES.map((m) => {
        const isActive = mode === m.id;
        return (
          <button
            key={m.id}
            onClick={() => handleSwitch(m.id)}
            style={{
              background: isActive ? `${m.color}22` : 'transparent',
              border: `1px solid ${isActive ? m.color : '#444'}`,
              color: isActive ? m.color : '#888',
              borderRadius: 6,
              padding: '6px 12px',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: isActive ? 700 : 400,
              fontFamily: 'system-ui, sans-serif',
              transition: 'all 0.2s ease',
              whiteSpace: 'nowrap',
            }}
          >
            {m.label}
          </button>
        );
      })}
    </div>
  );
}

