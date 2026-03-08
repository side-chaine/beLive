import React, { useCallback } from 'react';
import { useModeStore } from '../stores/mode.store';
import { usePianoStore } from '../stores/piano.store';
import { useMonitorStore } from '../stores/monitor.store';
import { requestOpenSync } from '../sync/bridge/sync.bridge';


const MODE_COLORS: Record<string, string> = {
  concert: '#3498db',
  karaoke: '#9b59b6',
  rehearsal: '#FF8C00',
  live: '#e74c3c',
};

export function ControlPanel() {
  const mode = useModeStore((s) => s.mode);
  const color = MODE_COLORS[mode] || '#fff';

  const onMonitor = useCallback(() => useMonitorStore.getState().toggleOpen(), []);
  const togglePiano = usePianoStore(s => s.togglePiano);
  const onSync    = useCallback(() => { requestOpenSync(); }, []);

  const handleBlockEditor = useCallback(() => {
    const w = window as any;
    if (!w.lyricsDisplay?.lyrics?.length) {
      console.warn('[ControlPanel] No lyrics loaded — cannot open Block Editor');
      return;
    }
    w.waveformEditor?._openNewBlockEditor?.();
  }, []);

  if (mode === 'live') return null;

  const btnStyle = (active = false): React.CSSProperties => ({
    padding: '6px 14px',
    background: 'var(--bl-surface-raised, rgba(40, 40, 40, 0.8))',
    border: `1px solid ${color}33`,
    borderRadius: 'var(--bl-radius-md, 8px)',
    color: '#fff',
    fontSize: '12px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  });

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        flexWrap: 'wrap',
      }}
    >
      <button onClick={onMonitor} style={btnStyle()} title="Monitor settings">
        Monitor
      </button>
      <button onClick={togglePiano} style={btnStyle()} title="Pitch / Piano">
        Pitch
      </button>
      <button
        onClick={handleBlockEditor}
        style={btnStyle()}
        title="Block Editor"
      >
        Blocks
      </button>
      <button onClick={onSync} style={btnStyle()} title="Sync Editor">
        Sync
      </button>
    </div>
  );
}

