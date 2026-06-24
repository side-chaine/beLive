// @TC-PROF-0: ProfileStats — Phase 0, only earned data
// Principle: no mock data except ELO 1500 (universal starting rating)
// Cells appear only when real data exists

import { useTrackStore } from '../stores/track.store';

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

  // ELO 1500 — единственное исключение манифеста (стартовый рейтинг)
  // TODO: read from D1 users.elo when ranked system exists (Phase 3)
  const elo = 1500;

  // Phase 1+: добавятся:
  // - Репетиции (из rehearsal-actions subscriber → profileStats.store)
  // - Квесты (из exercise.store + persist)
  // - Жанр (из track-meta.service агрегации → profileStats.genre store)

  return (
    <div style={styles.grid}>
      {/* Cell 1: ELO — always visible (allowed default) */}
      <div style={styles.cell}>
        <span style={{ fontSize: 20, fontWeight: 500, color: '#fff', lineHeight: 1.2 }}>{elo}</span>
        <span style={styles.label}>ELO</span>
      </div>

      {/* Cell 2: Треков — always visible (0 is valid data) */}
      <div style={{ ...styles.cell, borderRight: 'none' }}>
        <span style={{ fontSize: 20, fontWeight: 500, color: '#fff', lineHeight: 1.2 }}>{tracksCount}</span>
        <span style={styles.label}>Треков</span>
      </div>

      {/* PHASE 1+: Репетиции, Квесты, Жанр появятся здесь когда будут реальные данные */}
    </div>
  );
}
