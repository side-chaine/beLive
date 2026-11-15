// line-link.ts — §6 BL-049 (потребитель isValidLrcProjection).
//
// LineLink проверяет проекцию logical→LRC тем же предикатом, что и движок
// (square-full.isValidLrcProjection) — один предикат, без дублирования.
// При невалидности линк помечается INVALID и bounds НЕ эмитятся (консистентно
// с двигателем: mapUnitsToLrc в этом случае возвращает null).

import { isValidLrcProjection } from '../../blocks/c36/square-full';

export type LinkStatus = 'valid' | 'invalid';

export interface LineLinkResult {
  status: LinkStatus;
  /** bounds (логические границы → LRC-индексы) или null при INVALID. */
  bounds: number[] | null;
}

/**
 * Спроецировать logicalToLrc на LRC-границы.
 * logicalToLrc[i] = LRC-индекс i-й логической строки; валидно когда
 * [0, ..., n] — строго возрастает и покрывает все n LRC-строк.
 */
export function projectLineLink(
  logicalToLrc: readonly number[],
  n: number,
): LineLinkResult {
  if (!isValidLrcProjection(logicalToLrc, n)) {
    return { status: 'invalid', bounds: null };
  }
  return { status: 'valid', bounds: [...logicalToLrc] };
}

/** Состояние одного линка (mutable для пометки INVALID в рантайме). */
export class LineLink {
  status: LinkStatus = 'valid';
  bounds: number[] | null = null;

  constructor(logicalToLrc: readonly number[], n: number) {
    const res = projectLineLink(logicalToLrc, n);
    this.status = res.status;
    this.bounds = res.bounds;
  }
}
