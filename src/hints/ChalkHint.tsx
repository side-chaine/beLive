import type { HintId, HintLocale, HintVariant } from './types';

interface ChalkHintProps {
  /** Emitted as `data-bl-hint` so CDP witnesses can tell the steps apart. */
  hintId: HintId;
  variant: HintVariant;
  left: number;
  top: number;
  locale: HintLocale;
  /** `true` only for the explicit `×` — Escape / TTL are soft endings. */
  onDismiss: (refused: boolean) => void;
}

/**
 * Presentational only. No store, no anchors, no audio graph — the card can be
 * reused by any future tour step. The underline is a deliberately imperfect
 * double stroke with a tiny displacement filter: chalk, not a CSS border.
 */
export function ChalkHint({ hintId, variant, left, top, locale, onDismiss }: ChalkHintProps) {
  return (
    <div
      className="bl-hint"
      data-bl-hint={hintId}
      style={{ left, top }}
    >
      <button
        className="bl-hint__close"
        type="button"
        onClick={() => onDismiss(true)}
        aria-label={locale === 'ru' ? 'Скрыть подсказку' : 'Dismiss hint'}
      >
        ×
      </button>

      <div className="bl-hint__text" role="status" aria-live="polite">
        <span className="bl-hint__line">{variant.line}</span>
        <svg
          className="bl-hint__underline"
          viewBox="0 0 240 16"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <filter id="bl-hint-chalk" x="-5%" y="-50%" width="110%" height="200%">
              <feTurbulence type="fractalNoise" baseFrequency="0.07" numOctaves="2" seed="11" result="noise" />
              <feDisplacementMap
                in="SourceGraphic"
                in2="noise"
                scale="2.4"
                xChannelSelector="R"
                yChannelSelector="G"
              />
            </filter>
          </defs>
          <g filter="url(#bl-hint-chalk)">
            <path
              className="bl-hint__underline-stroke"
              d="M2 10 C 46 5, 88 13, 140 8 S 208 5, 238 10"
              pathLength={1}
            />
            <path
              className="bl-hint__underline-dust"
              d="M5 12 C 54 8, 104 14, 158 10 S 212 9, 236 12"
              pathLength={1}
            />
          </g>
        </svg>
        <span className="bl-hint__aside">{variant.aside}</span>
      </div>

      <span className="bl-hint__poke" aria-hidden="true">{variant.poke}</span>
    </div>
  );
}
