/**
 * MR-3 · «Эта неделя» — чистая презентация (без сторов и эффектов).
 */

import type { WeekStats } from '../../../services/practice-journal/aggregate';

interface Props {
  stats: WeekStats;
  onStart?: () => void;
}

const SPARK_MAX = 48;
const TICKS = 7;

export function WeekStrip({ stats, onStart }: Props) {
  const empty = stats.runs === 0;
  const max = Math.max(...stats.spark, 1);
  const value = (n: number) => (n === 0 ? '—' : String(n));

  return (
    <section className="bl-weekstrip">
      <div className="bl-weekstrip__title">Эта неделя</div>

      <div className="bl-weekstrip__numbers">
        <div className="bl-weekstrip__num">
          <span className="bl-weekstrip__value">{value(stats.minutes)}</span>
          <span className="bl-weekstrip__label">мин</span>
        </div>
        <div className="bl-weekstrip__num">
          <span className="bl-weekstrip__value">{value(stats.runs)}</span>
          <span className="bl-weekstrip__label">прогонов</span>
        </div>
        <div className="bl-weekstrip__num">
          <span className="bl-weekstrip__value">{value(stats.streak)}</span>
          <span className="bl-weekstrip__label">дней</span>
        </div>
      </div>

      <div className="bl-weekstrip__spark" aria-hidden="true">
        {empty
          ? Array.from({ length: TICKS }, (_, i) => (
              <span key={i} className="bl-weekstrip__tick" />
            ))
          : stats.spark.map((v, i) => (
              <span
                key={i}
                className="bl-weekstrip__bar"
                style={{ height: `${v === 0 ? 4 : Math.max(4, Math.round((v / max) * SPARK_MAX))}px` }}
              />
            ))}
      </div>

      {empty && (
        <div className="bl-weekstrip__empty">
          Проведи первую репетицию — здесь появится неделя
        </div>
      )}

      {onStart && (
        <button className="bl-weekstrip__cta" onClick={onStart}>
          Начать репетицию →
        </button>
      )}
    </section>
  );
}
