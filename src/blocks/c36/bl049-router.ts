// bl049-router.ts — §12.6 governance (BL-049 v2, reconciled).
//
// Чистый роутер поверх SquareFullResult. Роутинг ТОЛЬКО по mode + conf-тирам;
// идентичность трека не используется. dual-oracle НЕ заводит третий ИИ —
// согласие двух существующих провайдеров (sendWithProvider) + явный предикат
// валидности (checkGuards + isValidLrcProjection).

import {
  CONF,
  checkGuards,
  isValidLrcProjection,
  type SquareFullResult,
  type SquareMode,
} from './square-full';

/** Решение роутера. */
export type RouteDecision = 'auto' | 'human' | 'ai';

/** Learned-hit состояние, передаётся роутеру из learned-splits store. */
export interface LearnedState {
  isHit: boolean;
  /** Повторное подтверждение (min-observations ≥ 2) → auto; первое → human. */
  confirmed: boolean;
}

/** Исход dual-oracle для anaphora-тира. */
export interface DualOracleOutcome {
  /** Оба провайдера сошлись (точно ИЛИ в одной семье архетипов). */
  agreed: boolean;
  /** Согласованный вектор units проходит гварды + проекцию. */
  valid: boolean;
}

export interface RouteInput {
  result: SquareFullResult;
  learned?: LearnedState;
  /** Передаётся только для anaphora-тира; без него роутер возвращает 'ai'. */
  dualOracle?: DualOracleOutcome;
}

/** §3: effConf = result.conf КАК ЕСТЬ; anaphora форсируется CONF.anaphora без бампа. */
export function computeEffConf(result: SquareFullResult): number {
  if (result.mode === 'anaphora') {return CONF.anaphora;}
  return result.conf;
}

export const ANAPHORA_THRESHOLD = CONF.anaphora; // 0.55
export const RONDO_THRESHOLD = CONF.rondo; // 0.65

/**
 * Согласие dual-oracle (§4): точное совпадение вектора units ИЛИ попадание
 * в одну «семью архетипов» — одна и та же мультимножественная форма
 * (перестановка частей, напр. [3,6] ≡ [6,3]). Без третьего ИИ.
 */
export function unitsAgree(a: readonly number[], b: readonly number[]): boolean {
  if (a.length !== b.length) {return false;}
  if (a.every((x, i) => x === b[i])) {return true;}
  const sa = [...a].sort((x, y) => x - y);
  const sb = [...b].sort((x, y) => x - y);
  return sa.every((x, i) => x === sb[i]);
}

/**
 * Резолвер dual-oracle (§2, строки 6–7): берёт два вектора units от двух
 * провайдеров, проверяет согласие и валидность (гварды + проекция).
 */
export function runDualOracle(
  unitsA: readonly number[],
  unitsB: readonly number[],
  n: number,
  mode: SquareMode,
): DualOracleOutcome {
  const agreed = unitsAgree(unitsA, unitsB);
  if (!agreed) {return { agreed: false, valid: false };}
  const bounds = unitsToBounds(unitsA);
  const valid = isValidLrcProjection(bounds, n) && !checkGuards(unitsA, mode);
  return { agreed: true, valid };
}

function unitsToBounds(units: readonly number[]): number[] {
  const bounds: number[] = [0];
  let acc = 0;
  for (const u of units) {acc += u; bounds.push(acc);}
  return bounds;
}

/**
 * §2 таблица роутинга (сверху вниз, первая match wins):
 *  1. learned-hit + подтверждён               → AUTO
 *  2. learned-hit + первое обучение           → HUMAN
 *  3. mode==='fallback' ‖ effConf < 0.55      → HUMAN
 *  4. 0.55 ≤ effConf < 0.65 (anaphora)        → AI (dual-oracle)
 *  5. effConf ≥ 0.65                          → AUTO
 *  6. dual-oracle: оба сошлись + валидно      → AUTO
 *  7. dual-oracle: разногласие ‖ невалидно    → HUMAN
 */
export function routeDecision(input: RouteInput): RouteDecision {
  const { result, learned, dualOracle } = input;
  const effConf = computeEffConf(result);

  // 1–2: learned-hit обрабатывается ДО тиров conf.
  if (learned?.isHit) {
    return learned.confirmed ? 'auto' : 'human';
  }

  // 3: fallback или ниже anaphora-порога.
  if (result.mode === 'fallback' || effConf < ANAPHORA_THRESHOLD) {
    return 'human';
  }

  // 5: выше rondo-порога — сразу AUTO (без dual-oracle).
  if (effConf >= RONDO_THRESHOLD) {
    return 'auto';
  }

  // 4 + 6–7: anaphora-тир (0.55 ≤ effConf < 0.65) → dual-oracle.
  if (dualOracle) {
    return dualOracle.agreed && dualOracle.valid ? 'auto' : 'human';
  }
  return 'ai';
}
