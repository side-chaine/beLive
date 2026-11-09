/**
 * Pure policy layer of the guided tour.
 *
 * HintLayer owns the LIFECYCLE (measurement, animation, fade). This file owns
 * the DECISION (may this step be shown, and is it already mastered?). Keeping
 * the two apart means a new tour node never has to touch rendering code, and
 * every rule here is a pure function that can be reasoned about — or tested —
 * without a browser.
 */

import {
  HINT_UPLOAD_MAX_SHOWS_EMPTY,
  HINT_UPLOAD_MAX_SHOWS_WITH_TRACKS,
  HINT_UPLOAD_TAB_OPENS_TO_MASTER,
} from './config';
import type { HintId, HintSpec, HintStats } from './types';

/** Everything observable about the current app state, as a plain snapshot. */
export interface HintContext {
  surface: string;
  catalogOpen: boolean;
  catalogTab: string;
  trackCount: number;
  enabled: boolean;
  completed: HintId[];
  sessionDone: HintId[];
  stats: HintStats;
}

const count = (v: number | undefined): number => v ?? 0;

export interface Mastery {
  mastered: boolean;
  /** Stable reason, handy for CDP witnesses and future telemetry. */
  reason: 'completed' | 'track-saved' | 'knows-the-way' | 'refused' | 'budget' | null;
}

/**
 * «Как понять beLive, что пользователь уже освоил загрузку?»
 *
 * We never guess from elapsed time. Five independent, honest signals, in
 * descending order of strength:
 *
 *  1. `track-saved`        🟢 FACT      — a track really reached IDB through the
 *                                        upload pipeline (3 dispatch sites in
 *                                        upload.service.ts). Undeniable.
 *  2. `upload-tab-open`×2  🟡 INTENT    — the user found ЗАГРУЗКА twice. They
 *                                        know the way even if they never saved.
 *  3. `dismisses` ≥ 1      🔴 REFUSAL   — they closed it with `×`. Stop.
 *  4. `shows` ≥ budget     ⚪ EXPOSURE  — a few impressions is enough. The cap
 *                                        is gentler for a genuinely empty
 *                                        catalog, where the next step does not
 *                                        exist yet.
 *  5. `completed[]`        ✅ EXPLICIT  — written when the fact arrived.
 *
 * `tracksMeta.length` is deliberately NOT treated as mastery: tracks may be
 * built-in, preloaded or imported elsewhere. It only tunes the exposure cap.
 * The master switch `enabled` is handled in isStepEligible and always wins.
 */
export function uploadMastery(c: HintContext): Mastery {
  const id: HintId = 'catalog.upload';
  if (c.completed.includes(id)) {return { mastered: true, reason: 'completed' };}
  if (count(c.stats.facts['track-saved']) > 0) {
    return { mastered: true, reason: 'track-saved' };
  }
  if (count(c.stats.facts['upload-tab-open']) >= HINT_UPLOAD_TAB_OPENS_TO_MASTER) {
    return { mastered: true, reason: 'knows-the-way' };
  }
  if (count(c.stats.dismisses[id]) > 0) {
    return { mastered: true, reason: 'refused' };
  }
  const cap = c.trackCount === 0
    ? HINT_UPLOAD_MAX_SHOWS_EMPTY
    : HINT_UPLOAD_MAX_SHOWS_WITH_TRACKS;
  if (count(c.stats.shows[id]) >= cap) {
    return { mastered: true, reason: 'budget' };
  }
  return { mastered: false, reason: null };
}

/** Pure: may this exact step be on screen right now? */
export function isStepEligible(spec: HintSpec, c: HintContext): boolean {
  if (!c.enabled || c.surface !== 'app') {return false;}
  if (c.sessionDone.includes(spec.id)) {return false;}
  if (!spec.repeatOnLoad && c.completed.includes(spec.id)) {return false;}

  switch (spec.gate) {
    case 'start':
      // Pointing at the Catalog button while the catalog is already open is
      // noise, not help.
      if (c.catalogOpen) {return false;}
      break;
    case 'catalog':
      if (!c.catalogOpen) {return false;}
      // Already standing on ЗАГРУЗКА — the hint has done its job.
      if (c.catalogTab === 'upload') {return false;}
      break;
  }

  if (spec.policy === 'upload-mastery' && uploadMastery(c).mastered) {return false;}
  return true;
}
