import { HINT_VARIANT_MAX, HINT_VARIANT_MIN } from './config';
import type { HintId, HintSpec } from './types';
import { START_CATALOG_VARIANTS, UPLOAD_TAB_VARIANTS } from './variants';

/**
 * The tour itself. Order matters: HintLayer always shows the FIRST eligible
 * step. `repeatOnLoad` steps ignore `completed[]` and greet the user on every
 * fresh load; learn-once steps retire through eligibility.ts. Future nodes go
 * here — no component changes required, only one `data-bl-hint-target` on the
 * target element.
 */
export const HINT_REGISTRY: Record<HintId, HintSpec> = {
  'start.catalog': {
    id: 'start.catalog',
    target: 'catalog',
    side: 'below-left',
    gate: 'start',
    variants: START_CATALOG_VARIANTS,
    // «При каждой новой загрузке мы пишем что-то» — Nikita, 05.11.2026.
    // A click on Catalog ends the hint for THIS visit only, never forever.
    repeatOnLoad: true,
    completeOn: 'catalog-open',
  },
  'catalog.upload': {
    id: 'catalog.upload',
    // The ЗАГРУЗКА tab inside the catalog overlay (CatalogLayout.tsx).
    target: 'upload',
    side: 'below-left',
    gate: 'catalog',
    variants: UPLOAD_TAB_VARIANTS,
    // Classic learn-once step, but the retirement is driven by EVIDENCE, not
    // by a single click — see eligibility.ts → uploadMastery().
    policy: 'upload-mastery',
    completeOn: 'track-saved',
  },
};

export const HINT_ORDER: HintId[] = ['start.catalog', 'catalog.upload'];

/** Pure guard so a future step can never ship with an empty or stale pool. */
export function checkHintPools(): string[] {
  const problems: string[] = [];
  for (const id of HINT_ORDER) {
    const spec = HINT_REGISTRY[id];
    if (!spec) {
      problems.push(`${id}: missing spec`);
      continue;
    }
    for (const locale of ['ru', 'en'] as const) {
      const pool = spec.variants[locale];
      if (!Array.isArray(pool) || pool.length < HINT_VARIANT_MIN || pool.length > HINT_VARIANT_MAX) {
        problems.push(`${id}/${locale}: ${pool?.length ?? 0} variants, expected ${HINT_VARIANT_MIN}–${HINT_VARIANT_MAX}`);
      }
      if (pool?.some((v) => !v.line || !v.poke)) {
        problems.push(`${id}/${locale}: empty line or poke`);
      }
    }
    if (!HINT_ORDER.includes(spec.id)) {problems.push(`${id}: id is not in HINT_ORDER`);}
  }
  return problems;
}
