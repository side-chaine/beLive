import { useAiCoachStore } from './ai-coach.store';

const ACCENT = '#fe5c55';

/** Точка входа AI Coach в шапке. */
export function AiCoachHeaderButton() {
  const open = useAiCoachStore((s) => s.open);
  const togglePanel = useAiCoachStore((s) => s.togglePanel);

  return (
    <button
      type="button"
      onClick={togglePanel}
      aria-pressed={open}
      aria-label={open ? 'Закрыть AI Coach' : 'Открыть AI Coach'}
      title="AI Coach"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        background: open ? `${ACCENT}22` : 'transparent',
        border: `1px solid ${open ? ACCENT : '#444'}`,
        color: open ? ACCENT : '#aaa',
        borderRadius: 6,
        padding: '6px 10px',
        cursor: 'pointer',
        fontSize: 12,
        fontFamily: 'system-ui, sans-serif',
        whiteSpace: 'nowrap',
        transition: 'all 0.2s ease',
      }}
      onMouseEnter={(e) => {
        if (open) {return;}
        e.currentTarget.style.borderColor = ACCENT;
        e.currentTarget.style.color = '#fff';
      }}
      onMouseLeave={(e) => {
        if (open) {return;}
        e.currentTarget.style.borderColor = '#444';
        e.currentTarget.style.color = '#aaa';
      }}
    >
      <span aria-hidden="true">✦</span>
      AI Coach
    </button>
  );
}
