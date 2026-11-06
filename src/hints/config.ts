/** Single place for every tunable of the guided-tour subsystem. */

export const HINTS_STORAGE_KEY = 'belive:hints-v1';

/** Anchor contract: `<button data-bl-hint-target="catalog">`. */
export const HINT_ANCHOR_ATTR = 'data-bl-hint-target';

/**
 * The hint fades on its own. No pressure, no modal, no blocking overlay.
 * 20 s (was 12 s): the splash alone takes ~10.7 s, so a short TTL made the
 * nudge easy to miss right after the page became usable.
 */
export const HINT_DEFAULT_TTL_MS = 20_000;

/** Let the splash → deck handoff settle before the chalk appears. */
export const HINT_IN_DELAY_MS = 400;
export const HINT_OUT_MS = 420;

/** Registry guard: a pool must stay inside 5–7 variants per locale. */
export const HINT_VARIANT_MIN = 5;
export const HINT_VARIANT_MAX = 7;

/** Chalk card geometry. Used only for placement, never for the target. */
export const HINT_BOX_W = 268;
export const HINT_BOX_H = 96;

/* ── `catalog.upload`: when does beLive decide the user has MASTERED it? ────
   These are budgets, NOT timers. A timer would nag a person who already knows
   where ЗАГРУЗКА is; a budget stops after a few honest impressions. */

/** Empty catalog = the next step genuinely does not exist yet → more patience. */
export const HINT_UPLOAD_MAX_SHOWS_EMPTY = 6;
/** «...можно пару раз эту подсказку ещё показать» — Nikita, 05.11.2026. */
export const HINT_UPLOAD_MAX_SHOWS_WITH_TRACKS = 3;
/** Two deliberate visits to ЗАГРУЗКА = the user knows the way. */
export const HINT_UPLOAD_TAB_OPENS_TO_MASTER = 2;
