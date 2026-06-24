// @TC-PROF-1: ProfileStats — Phase 1, conditional earned data cells
// Principle: no mock data. Cells visible only when counter > 0.
// ELO 1500 and Треков are always visible (universal defaults).

import { useTrackStore } from '../stores/track.store';
import { useMetricsStore } from '../stores/metrics.store';

const styles: Record<string, React.CSSProperties> = {
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    width: '100%',
    marginTop: 12,
    borderRadius: 12,
    overflow: 'hidden',
    border: '0.5px solid rgba(255,255,255,0.06)',
  },
  cell: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-start',
    padding: '11px 10px',
    gap: 0,
    borderRight: '0.5px solid rgba(255,255,255,0.06)',
    borderBottom: '0.5px solid rgba(255,255,255,0.06)',
  },
  value: {
    fontSize: 20,
    fontWeight: 500,
    color: '#fff',
    lineHeight: 1.2,
  },
  label: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.35)',
    lineHeight: 1.2,
    marginTop: 3,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '100%',
  },
};

export function ProfileStats() {
  const tracksCount = useTrackStore(s => s.tracksMeta.length);
  const rehearsals = useMetricsStore(s => s.rehearsals);
  const exercisesCompleted = useMetricsStore(s => s.exercisesCompleted);
  const topGenre = useMetricsStore(s => s.topGenre);

  // ELO 1500 — единственное исключение манифеста
  // TODO: read from D1 users.elo when ranked system exists (Phase 3)
  const elo = 1500;

  // Build cells: always-visible + conditional earned
  const cells: { value: string | number; label: string }[] = [
    { value: elo, label: 'ELO' },
    { value: tracksCount, label: 'Треков' },
  ];

  if (rehearsals > 0) cells.push({ value: rehearsals, label: 'Репетиций' });
  if (exercisesCompleted > 0) cells.push({ value: exercisesCompleted, label: 'Упражнений' });
  if (topGenre) cells.push({ value: topGenre, label: 'Жанр' });

  // Ensure even grid: pad to even count with hidden cells
  while (cells.length % 2 !== 0) {
    cells.push({ value: '', label: '' });
  }

  return (
    <div style={styles.grid}>
      {cells.map((c, i) => (
        <div
          key={c.label || i}
          style={{
            ...styles.cell,
            borderRight: i % 2 === 0 ? '0.5px solid rgba(255,255,255,0.06)' : 'none',
            borderBottom: 'none',
            visibility: c.value === '' ? 'hidden' : 'visible',
          }}
        >
          {c.value !== '' && (
            <>
              <span style={styles.value}>{c.value}</span>
              <span style={styles.label}>{c.label}</span>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
