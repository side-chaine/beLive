/**
 * MR-3 · «Продолжить» — чистая презентация (без сторов и эффектов).
 */

import type { ContinueTarget } from '../../../services/practice-journal/aggregate';

interface Props {
  target: ContinueTarget | null;
  currentTrackId: string | null;
  onContinue: () => void;
}

export function ContinueCard({ target, currentTrackId, onContinue }: Props) {
  if (!target) return null;

  const sameTrack = currentTrackId === target.trackId;

  return (
    <section className="bl-continue">
      <div className="bl-continue__title">Продолжить</div>
      <div className="bl-continue__track">{target.trackTitle ?? 'Без трека'}</div>
      <div className="bl-continue__meta">
        {target.blockType && <span className="bl-continue__block">{target.blockType}</span>}
        {target.blockId && <span className="bl-continue__block-id">{target.blockId}</span>}
        <span className="bl-continue__rate">темп {Math.round(target.rate * 100)}%</span>
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
