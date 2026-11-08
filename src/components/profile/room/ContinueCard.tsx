/**
 * MR-3 · «Продолжить» — чистая презентация (без сторов и эффектов).
 */

import type { ContinueTarget } from '../../../services/practice-journal/aggregate';

/* MR-4b Q8: rel-time — сколько назад была сессия */
function relTime(at: number): string {
  const min = Math.max(1, Math.round((Date.now() - at) / 60_000));
  if (min < 60) {return `${min} мин назад`;}
  const h = Math.round(min / 60);
  if (h < 24) {return `${h} ч назад`;}
  return `${Math.round(h / 24)} дн назад`;
}

interface Props {
  target: ContinueTarget | null;
  currentTrackId: string | null;
  onContinue: () => void;
}

export function ContinueCard({ target, currentTrackId, onContinue }: Props) {
  if (!target) {return null;}

  const sameTrack = currentTrackId === target.trackId;

  return (
    <section className="bl-continue">
      <div className="bl-continue__title">Продолжить</div>
      <div className="bl-continue__track">{target.trackTitle ?? 'Без трека'}</div>
      <div className="bl-continue__meta">
        {target.blockType && <span className="bl-continue__block">{target.blockType}</span>}
        {target.blockId && <span className="bl-continue__block-id">{target.blockId}</span>}
      </div>
      <div className="bl-continue__meta bl-continue__meta--second">
        <span>{relTime(target.at)}</span>
        <span>блок {target.blockId ?? target.blockType ?? '—'}</span>
        <span>темп {Math.round(target.rate * 100)}%</span>
      </div>
      <button className="bl-continue__btn" disabled={!sameTrack} onClick={onContinue}>
        ▶ ВЕРНУТЬСЯ
      </button>
      {!sameTrack && (
        <div className="bl-continue__hint">Открой этот трек, чтобы продолжить</div>
      )}
    </section>
  );
}
