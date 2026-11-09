/**
 * Graphics — качество графики внутри комнаты (перенос из меню аватара).
 *
 * Источник правды — performance.store (tier / autoDetect / detectedTier).
 * Ничего своего не хранит: только читает и пишет существующий стор.
 *
 * a11y: список тиров = radiogroup, тумблер Auto = switch.
 */

import { usePerformanceStore } from '../../../../performance/performance.store';
import type { PerformanceTier } from '../../../../performance/performance.types';

const TIERS: PerformanceTier[] = ['lite', 'balanced', 'max', 'ultra'];

const TIER_LABEL: Record<PerformanceTier, string> = {
  lite: 'Lite',
  balanced: 'Balanced',
  max: 'Max',
  ultra: 'Ultra',
};

/** Короткая подпись «что это значит» — без маркетинга. */
const TIER_HINT: Record<PerformanceTier, string> = {
  lite: 'минимум эффектов, слабые устройства',
  balanced: 'баланс качества и нагрузки',
  max: 'полный визуал',
  ultra: 'всё включено, сильное железо',
};

export function GraphicsSection() {
  const tier = usePerformanceStore(s => s.tier);
  const autoDetect = usePerformanceStore(s => s.autoDetect);
  const detectedTier = usePerformanceStore(s => s.detectedTier);
  const setTier = usePerformanceStore(s => s.setTier);
  const setAutoDetect = usePerformanceStore(s => s.setAutoDetect);

  // Что реально работает сейчас: при Auto — автоопределённый, иначе выбранный руками.
  const effective = autoDetect ? detectedTier : tier;

  return (
    <section className="bl-settings__panel" aria-labelledby="bl-graphics-title">
      <div className="bl-settings__panel-head">
        <h3 className="bl-settings__panel-title" id="bl-graphics-title">
          Графика
        </h3>
        <span className="bl-settings__badge">
          {autoDetect ? `Авто · ${TIER_LABEL[effective]}` : TIER_LABEL[effective]}
        </span>
      </div>

      <div
        className="bl-graphics__tiers"
        role="radiogroup"
        aria-label="Качество графики"
      >
        {TIERS.map(t => {
          const isActive = effective === t;
          const isManual = !autoDetect && tier === t;
          return (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={isActive}
              className={
                'bl-graphics__tier' +
                (isActive ? ' is-active' : '') +
                (isManual ? ' is-manual' : '')
              }
              onClick={() => setTier(t)}
              title={TIER_HINT[t]}
            >
              <span className="bl-graphics__tier-name">{TIER_LABEL[t]}</span>
              {isManual && <span className="bl-graphics__check" aria-hidden="true">✓</span>}
            </button>
          );
        })}
      </div>

      <div className="bl-settings__row">
        <span className="bl-settings__row-label">
          Автоопределение
          <span className="bl-settings__row-hint">
            {autoDetect
              ? `система выбрала ${TIER_LABEL[detectedTier]}`
              : 'выбрано вручную'}
          </span>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={autoDetect}
          aria-label="Автоопределение качества графики"
          className={'bl-settings__switch' + (autoDetect ? ' is-on' : '')}
          onClick={() => setAutoDetect(!autoDetect)}
        >
          <span className="bl-settings__knob" />
        </button>
      </div>
    </section>
  );
}
