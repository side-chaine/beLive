/**
 * TrackMap FX — registry of "blink" effects.
 *
 * A TrackMap effect is a *pure data* description: which CSS animation to run on
 * every wagon and what start-delay each wagon gets. No React, no DOM, no timers
 * here — that keeps effects trivially testable and lets the whole thing scale to
 * dozens of presets without touching the component.
 *
 * Contract for the CSS side (WagonTrain.module.css):
 *   .root[data-tm-fx="<id>"] .wagon  -> animation-name: <id>
 *   .wagon                           -> animation-delay: var(--tm-fx-delay)
 *
 * Every keyframe MUST start and end at the neutral state, because we use
 * `animation-fill-mode: both` — a non-neutral 100% frame would leave the strip
 * permanently modified after the effect finishes.
 */

export type TrackMapFxId =
  | 'cascade'
  | 'cascade-rev'
  | 'tree'
  | 'chase'
  | 'breath'
  | 'spark'
  | 'pair'
  | 'settle'
  | 'ripple'
  | 'lift';

export interface TrackMapFx {
  id: TrackMapFxId;
  /** Human label (ru) — used by the dev console bridge and future preset UI. */
  label: string;
  /** Total effect length, ms. The runner clears data-tm-fx after this. */
  durationMs: number;
  /**
   * Start delay (ms) for wagon `index` out of `total`.
   * `seed` is stable per run — used by non-deterministic effects (spark).
   */
  delay: (index: number, total: number, seed: number) => number;
}

/** Cheap deterministic hash — keeps `spark` reproducible inside a single run. */
function hash(n: number): number {
  let x = (n + 0x9e3779b9) | 0;
  x = Math.imul(x ^ (x >>> 16), 0x21f0aaad);
  x = Math.imul(x ^ (x >>> 15), 0x735a2d97);
  return ((x ^ (x >>> 15)) >>> 0) / 0xffffffff;
}

/** Per-wagon step so the whole cascade fits the effect window, whatever the block count. */
function stepFor(total: number, windowMs: number, maxStep = 120): number {
  if (total <= 1) return 0;
  return Math.min(maxStep, Math.round(windowMs / (total - 1)));
}

const CENTER = (total: number) => (total - 1) / 2;

export const TRACKMAP_FX: TrackMapFx[] = [
  {
    id: 'cascade',
    label: 'Каскад →',
    durationMs: 2400,
    delay: (i, total) => i * stepFor(total, 900),
  },
  {
    id: 'cascade-rev',
    label: 'Каскад ←',
    durationMs: 2400,
    delay: (i, total) => (total - 1 - i) * stepFor(total, 900),
  },
  {
    id: 'tree',
    label: 'Ёлочка',
    durationMs: 2600,
    // края → центр: крайние зажигаются первыми, «ёлочка» сходится к середине
    delay: (i, total) => Math.round(Math.abs(i - CENTER(total)) * stepFor(total, 1000)),
  },
  {
    id: 'chase',
    label: 'Бегущий огонёк',
    durationMs: 2000,
    // узкая волна: короткий шаг, два прохода задаются в keyframes
    delay: (i, total) => i * stepFor(total, 700, 90),
  },
  {
    id: 'breath',
    label: 'Дыхание',
    durationMs: 2200,
    delay: () => 0,
  },
  {
    id: 'spark',
    label: 'Искры',
    durationMs: 2600,
    delay: (i, _total, seed) => Math.round(hash(i * 31 + seed) * 900),
  },
  {
    id: 'pair',
    label: 'Парами',
    durationMs: 2200,
    delay: (i) => Math.floor(i / 2) * 160,
  },
  {
    id: 'settle',
    label: 'Волна с осадкой',
    durationMs: 2800,
    delay: (i, total) => i * stepFor(total, 1000),
  },
  {
    id: 'ripple',
    label: 'Круги от центра',
    durationMs: 2600,
    delay: (i, total) => Math.round(Math.abs(i - CENTER(total)) * stepFor(total, 1000)),
  },
  {
    id: 'lift',
    label: 'Подъём',
    durationMs: 2000,
    delay: (i, total) => i * stepFor(total, 600, 70),
  },
];

export const TRACKMAP_FX_BY_ID: Record<TrackMapFxId, TrackMapFx> = TRACKMAP_FX.reduce(
  (acc, fx) => {
    acc[fx.id] = fx;
    return acc;
  },
  {} as Record<TrackMapFxId, TrackMapFx>,
);

/**
 * Pick a random effect, never the same one twice in a row.
 * `random` is injectable so tests stay deterministic.
 */
export function pickTrackMapFx(
  previous: TrackMapFxId | null,
  random: () => number = Math.random,
): TrackMapFx {
  const pool = TRACKMAP_FX.filter(fx => fx.id !== previous);
  const list = pool.length > 0 ? pool : TRACKMAP_FX;
  return list[Math.floor(random() * list.length)] ?? TRACKMAP_FX[0];
}

/** Delay list for a whole run — index-aligned with the rendered wagons. */
export function computeFxDelays(fx: TrackMapFx, total: number, seed: number): number[] {
  return Array.from({ length: total }, (_, i) => fx.delay(i, total, seed));
}
