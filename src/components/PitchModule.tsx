import { usePitchStore } from '../stores/pitch.store';

/* Inline styles — skeleton only. Frontend L+R will convert to CSS module. */
const S = {
  root: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
    padding: '12px 16px',
    minHeight: '80px',
    fontFamily: 'var(--bl-font-family, system-ui, sans-serif)',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  btn: {
    padding: '6px 18px',
    borderRadius: 'var(--bl-radius-sm, 6px)',
    border: '1px solid var(--bl-border, rgba(255,255,255,0.12))',
    background: 'var(--bl-surface-2, rgba(255,255,255,0.08))',
    color: 'var(--bl-text-primary, #fff)',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 600,
    transition: 'background 0.15s',
  },
  btnActive: {
    background: 'var(--bl-accent, #646cff)',
    border: '1px solid var(--bl-accent, #646cff)',
  },
  note: {
    fontSize: '28px',
    fontWeight: 700,
    color: 'var(--bl-accent, #646cff)',
    minWidth: '56px',
    textAlign: 'center' as const,
    fontVariantNumeric: 'tabular-nums',
  },
  cents: {
    fontSize: '16px',
    fontWeight: 600,
    minWidth: '52px',
    textAlign: 'right' as const,
    fontVariantNumeric: 'tabular-nums',
  },
  conf: {
    fontSize: '12px',
    color: 'var(--bl-text-secondary, rgba(255,255,255,0.5))',
    minWidth: '36px',
  },
  prompt: {
    fontSize: '15px',
    color: 'var(--bl-text-secondary, rgba(255,255,255,0.5))',
    fontStyle: 'italic' as const,
  },
  error: {
    fontSize: '12px',
    color: 'var(--bl-warning, #FB923C)',
  },
  meterWrap: {
    position: 'relative' as const,
    height: '6px',
    borderRadius: '3px',
    background: 'var(--bl-surface-2, rgba(255,255,255,0.08))',
    overflow: 'hidden',
  },
  meterCenter: {
    position: 'absolute' as const,
    left: '50%',
    top: 0,
    bottom: 0,
    width: '2px',
    marginLeft: '-1px',
    background: 'var(--bl-text-secondary, rgba(255,255,255,0.3))',
  },
  meterDot: {
    position: 'absolute' as const,
    top: '-1px',
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    transform: 'translateX(-50%)',
    transition: 'left 0.08s linear',
  },
} as const;

function centsColor(c: number): string {
  const a = Math.abs(c);
  if (a <= 10) return 'var(--bl-success, #4ADE80)';
  if (a <= 25) return 'var(--bl-accent, #646cff)';
  if (a <= 50) return 'var(--bl-warning, #FB923C)';
  return 'var(--bl-text-secondary, rgba(255,255,255,0.3))';
}

export function PitchModule() {
  const status = usePitchStore(s => s.status);
  const note = usePitchStore(s => s.note);
  const cents = usePitchStore(s => s.cents);
  const confidence = usePitchStore(s => s.confidence);
  const isSinging = usePitchStore(s => s.isSinging);
  const error = usePitchStore(s => s.error);
  const startPitch = usePitchStore(s => s.startPitch);
  const stopPitch = usePitchStore(s => s.stopPitch);

  const running = status === 'running';
  const starting = status === 'starting';

  /* cents → meter position: -50..+50 → 0%..100% */
  const pct = running && isSinging
    ? Math.max(0, Math.min(100, (cents + 50) * 100 / 100))
    : 50;

  return (
    <div style={S.root}>
      {/* ── Row 1: Button + Note + Cents + Confidence ── */}
      <div style={S.row}>
        <button
          style={{ ...S.btn, ...(running ? S.btnActive : {}) }}
          onClick={running ? stopPitch : startPitch}
          disabled={starting}
        >
          {starting ? '...' : running ? '■ Stop' : '● Start'}
        </button>

        {running && (
          isSinging ? (
            <>
              <span style={S.note}>♪ {note}</span>
              <span style={{ ...S.cents, color: centsColor(cents) }}>
                {cents > 0 ? '+' : ''}{cents}¢
              </span>
              <span style={S.conf}>
                {Math.round(confidence * 100)}%
              </span>
            </>
          ) : (
            <span style={S.prompt}>♪ Sing…</span>
          )
        )}

        {error && <span style={S.error}>{error}</span>}
      </div>

      {/* ── Row 2: Cents Meter Bar ── */}
      {running && (
        <div style={S.meterWrap}>
          <div style={S.meterCenter} />
          <div
            style={{
              ...S.meterDot,
              left: `${pct}%`,
              background: isSinging
                ? centsColor(cents)
                : 'transparent',
            }}
          />
        </div>
      )}
    </div>
  );
}

export default PitchModule;
