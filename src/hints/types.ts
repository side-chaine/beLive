/**
 * Guided-tour contract.
 *
 * A hint is DATA, never a hard-coded coordinate. Every step points at a DOM
 * node carrying `data-bl-hint-target="<target>"`; HintLayer measures that node
 * at runtime and draws the chalk annotation around it. Adding a future step is
 * therefore: add an id, add a spec, put one attribute on the target.
 */

export type HintLocale = 'ru' | 'en';

/** Stable identity. Never rename an existing id — it lives in localStorage. */
export type HintId = 'start.catalog' | 'catalog.upload';

export type HintSide = 'below-left' | 'below-right' | 'above-left' | 'above-right';

/**
 * Where the step lives. This REPLACED the old global `!catalogOpen` gate:
 * `start` steps belong to the start page, `catalog` steps live inside the
 * catalog overlay. HintLayer stays generic — it never knows what "upload" is.
 */
export type HintGate = 'start' | 'catalog';

/** Observable, VISIT-scoped fact that means the user performed the action. */
export type HintCompletion = 'catalog-open' | 'upload-tab-open' | 'track-saved';

/** Stable names of facts we persist across loads. */
export type HintSignal = 'track-saved' | 'upload-tab-open';

/** One interchangeable copy variant. A pool holds 5–7 of these per locale. */
export interface HintVariant {
  /** Main line: short, calm, never an order. */
  line: string;
  /** Hand-scribbled poke: «ТЫК !» / «TAP !». */
  poke: string;
  /** Optional quiet second line. */
  aside?: string;
}

/**
 * Cross-load evidence. Deliberately counters, not booleans: a future step can
 * ask "did this happen twice?" without a storage migration. This is how beLive
 * understands that the user has MASTERED a step instead of guessing by timer.
 */
export interface HintStats {
  /** Delivered impressions per step — drives the exposure budget. */
  shows: Partial<Record<HintId, number>>;
  /** Explicit `×` per step — a refusal must be respected immediately. */
  dismisses: Partial<Record<HintId, number>>;
  /** Observable facts, keyed by signal name. */
  facts: Partial<Record<HintSignal, number>>;
}

export interface HintSpec {
  id: HintId;
  /** Value of `data-bl-hint-target` on the element to point at. */
  target: string;
  side: HintSide;
  gate: HintGate;
  variants: Record<HintLocale, HintVariant[]>;
  /** Auto-fade. A hint NEVER blocks the UI and never waits for a click. */
  ttlMs?: number;
  /**
   * Show this step on EVERY fresh page load, ignoring the persisted
   * `completed[]`. Used by the start-page nudge: Nikita asked for a new random
   * line on each load, not a one-time tutorial. Completing it still ends the
   * hint for the current visit (session-scoped), so there is no nagging.
   * Default `false` = classic learn-once step.
   */
  repeatOnLoad?: boolean;
  /** Optional cross-load policy id, evaluated in eligibility.ts. */
  policy?: 'upload-mastery';
  /** The visit-scoped observation that ends (and, for learn-once, retires) the step. */
  completeOn?: HintCompletion;
}
