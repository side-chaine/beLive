import type { GhostTrack } from '../../stores/ghost.store';

const PHASE_LABEL: Record<string, string> = {
  download: '☁ Скачивание',
  extract: '📦 Распаковка',
  import: '🔄 Импорт',
  done: '✅ Готово',
};

const PHASE_COLOR: Record<string, string> = {
  download: '#FF8C00',
  extract: '#3498db',
  import: '#9b59b6',
  done: '#4CAF50',
};

interface Props { ghost: GhostTrack; }

export function GhostTrackCard({ ghost }: Props) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', padding: '6px 10px', borderRadius: 6,
      marginBottom: 2, gap: 10,
      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
      opacity: 0.9, animation: 'bl-ghost-fade 1.5s ease-in-out infinite',
    }}>
      {/* Cover placeholder */}
      <div style={{
        width: 32, height: 32, borderRadius: 6, flexShrink: 0,
        background: ghost.coverUrl
          ? `url(${ghost.coverUrl}) center/cover`
          : 'rgba(255,255,255,0.06)',
      }} />
      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          height: 10, width: '60%', borderRadius: 4,
          background: 'rgba(255,255,255,0.08)', marginBottom: 4,
          animation: 'bl-ghost-shimmer 1.5s ease-in-out infinite',
        }} />
        <div style={{
          height: 8, width: '40%', borderRadius: 4,
          background: 'rgba(255,255,255,0.05)',
          animation: 'bl-ghost-shimmer 1.5s ease-in-out 0.2s infinite',
        }} />
      </div>
      {/* Phase + progress */}
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: 9, fontWeight: 600, color: PHASE_COLOR[ghost.phase], letterSpacing: '0.03em', marginBottom: 2 }}>
          {PHASE_LABEL[ghost.phase]}
        </div>
        <div style={{
          width: 80, height: 4, borderRadius: 2,
          background: 'rgba(255,255,255,0.08)', overflow: 'hidden',
        }}>
          <div style={{
            height: '100%', borderRadius: 2,
            width: `${Math.max(ghost.progress, 5)}%`,
            background: PHASE_COLOR[ghost.phase],
            transition: 'width 0.4s ease',
          }} />
        </div>
      </div>
    </div>
  );
}
