import React, { useEffect, useCallback } from 'react';
import { useUIStore } from '../stores/ui.store';
import { useModeStore } from '../stores/mode.store';
import { CatalogLayout } from '../catalog/components/CatalogLayout';
import { useDeckStore } from '../stores/deck.store';

const MODE_COLORS: Record<string, string> = {
  concert: '#3498db',
  karaoke: '#9b59b6',
  rehearsal: '#FF8C00',
  live: '#e74c3c',
};

export function CatalogPanel() {
  const open = useUIStore(s => s.catalogOpen);
  const mode = useModeStore(s => s.mode);
  const color = MODE_COLORS[mode] || '#fff';
  const close = useCallback(() => useUIStore.setState({ catalogOpen: false }), []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') useUIStore.setState({ catalogOpen: false });
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  // Force bottom deck collapsed while catalog is open (so it never covers catalog)
  useEffect(() => {
    if (!open) return;

    const prev = useDeckStore.getState();
    // Collapse immediately
    useDeckStore.setState({ expanded: false });

    // Guard: if something tries to expand while catalog is open — collapse back
    const unsub = useDeckStore.subscribe((st) => {
      if (st.expanded) useDeckStore.setState({ expanded: false });
    });

    return () => {
      unsub();
      // Restore user state after closing catalog
      useDeckStore.setState({
        expanded: prev.expanded,
        activeTabId: prev.activeTabId,
      });
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      onClick={close}
      style={{
        position: 'fixed',
        top: 'var(--react-header-height, 64px)',
        left: 0,
        right: 0,
        bottom: 'var(--bl-deck-height, 76px)',
        zIndex: 999994,
        background: 'rgba(0,0,0,0.4)',
      }}
    >
      <CatalogLayout color={color} onClose={close} />
    </div>
  );
}
