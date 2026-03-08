import React, { useEffect, useRef } from 'react';
import { ModeButtons } from './ModeButtons';
import { QuickActions } from './QuickActions';
import { useModeStore } from '../stores/mode.store';
import { CurrentTrackBadge } from './CurrentTrackBadge';
import { ThemeSelector } from './ThemeSelector';

const MODE_COLORS: Record<string, string> = {
  concert: '#3498db',
  karaoke: '#9b59b6',
  rehearsal: '#FF8C00',
  live: '#e74c3c',
};

export function Header() {
  const ref = useRef<HTMLDivElement>(null);
  const mode = useModeStore((s) => s.mode);
  const color = MODE_COLORS[mode] || '#fff';

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const apply = () => {
      document.documentElement.style.setProperty('--react-header-height', `${el.offsetHeight}px`);
    };

    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);

    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: 48,
        background: 'rgba(0,0,0,0.95)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        zIndex: 999996,
        borderBottom: `1px solid ${color}30`,
        backdropFilter: 'blur(10px)',
      }}
    >
      {/* LEFT: logo + current track */}
      <div
        style={{
          flex: '0 1 420px',
          minWidth: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <div style={{ color, fontWeight: 700 }}>beLive</div>
        <CurrentTrackBadge />
      </div>

      {/* CENTER: ModeButtons */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
        <ModeButtons />
      </div>

      {/* RIGHT: QuickActions */}
      <div style={{ flex: '0 1 420px', minWidth: 0, display: 'flex', justifyContent: 'flex-end', gap: 8, alignItems: 'center' }}>
        <ThemeSelector />
        <QuickActions />
      </div>
    </div>
  );
}

