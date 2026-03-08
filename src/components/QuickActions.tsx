import React, { useCallback, useState } from 'react';
import { useModeStore } from '../stores/mode.store';
import { useUIStore } from '../stores/ui.store';

const MODE_COLORS: Record<string, string> = {
  concert: '#3498db',
  karaoke: '#9b59b6',
  rehearsal: '#FF8C00',
  live: '#e74c3c',
};

export function QuickActions() {
  const mode = useModeStore((s) => s.mode);
  const color = MODE_COLORS[mode] || '#fff';
  const setCatalogOpen = useUIStore((s) => s.setCatalogOpen);

  const openCatalog = useCallback(() => {
    setCatalogOpen(true);
  }, [setCatalogOpen]);

  const [avatarHint, setAvatarHint] = useState(false);
  const openAvatar = useCallback(() => {
    setAvatarHint(true);
    setTimeout(() => setAvatarHint(false), 2000);
  }, []);

  const btnStyle = (active = false): React.CSSProperties => ({
    background: active ? `${color}22` : 'transparent',
    border: `1px solid ${active ? color : '#444'}`,
    color: active ? color : '#aaa',
    borderRadius: 6,
    padding: '6px 10px',
    cursor: 'pointer',
    fontSize: 12,
    fontFamily: 'system-ui, sans-serif',
    transition: 'all 0.2s ease',
    whiteSpace: 'nowrap',
  });

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <button onClick={openCatalog} style={btnStyle()}>Catalog</button>
      <button onClick={openAvatar} style={btnStyle()} title="Avatar Studio">
        {avatarHint ? '🔜' : '👤'}
      </button>
    </div>
  );
}
