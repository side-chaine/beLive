import { useEffect, useRef } from 'react';
import { ModeButtons } from './ModeButtons';
import { QuickActions } from './QuickActions';
import { useModeStore } from '../stores/mode.store';
import { useUIStore } from '../stores/ui.store';
import { CurrentTrackBadge } from './CurrentTrackBadge';
import { AiCoachHeaderButton } from '../features/ai-coach';


/** Neutral header accent while no mode has been actively chosen. */
const QUIET_ACCENT = '#8b8b96';


const MODE_COLORS: Record<string, string> = {
  concert: '#3498db',
  karaoke: '#9b59b6',
  rehearsal: '#FF8C00',
  live: '#e74c3c',
};

export function Header() {
  const ref = useRef<HTMLDivElement>(null);
  const mode = useModeStore((s) => s.mode);
  const modeChosen = useUIStore((s) => s.modeChosen);
  // The orange logo + orange header rule used to announce "Rehearsal" before
  // the user had chosen anything. Keep them matte until a real click happens.
  const color = modeChosen ? (MODE_COLORS[mode] || '#fff') : QUIET_ACCENT;

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
      className="bl-header"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        /* 708 / 07.11 · шаг 1: 64→54, +10 отдаём TrackMap (root 44→54).
           Сумма header + wagon = 108 как была => лирика/центр не двигаются. */
        height: 54,
        background: 'rgba(0,0,0,0.95)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 24px',
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
        <AiCoachHeaderButton />
        <QuickActions />
      </div>
    </div>
  );
}

