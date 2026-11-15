// learned-splits.ts — §5 BL-049 (runtime-артефакт, НЕ коммитится).
//
// Хранилище обученных разбиений поверх SquareFullResult. БЕЗ raw text:
// только структурный patternKey + метаданные + sourceHash. keep-last-N + dedup
// по patternKey с инкрементом счётчика наблюдений. learningDisabled (forced off
// в тестах). TTL + kill-switch. После подстановки learned-units ОБЯЗАТЕЛЬНО
// checkGuards + isValidLrcProjection → нарушение ⇒ обычный train. Первое
// обучение = HUMAN, повторное подтверждение = AUTO (min-observations).

import {
  checkGuards,
  isValidLrcProjection,
  type SquareFullResult,
  type SquareMode,
} from './square-full';
import type { LearnedState } from './bl049-router';

export interface LearnedSplitEntry {
  patternKey: string;
  units: number[];
  mode: SquareMode;
  conf: number;
  tRatio: number | null;
  guard: string | null;
  sourceHash: string;
  observations: number;
  firstSeen: number;
  lastSeen: number;
}

const KEEP_LAST_N = 200;
const TTL_MS = 1000 * 60 * 60 * 24; // 24h
const MIN_OBSERVATIONS = 2; // повторное подтверждение → auto

function unitsToBounds(units: readonly number[]): number[] {
  const bounds: number[] = [0];
  let acc = 0;
  for (const u of units) {acc += u; bounds.push(acc);}
  return bounds;
}

/** Потолок юнитов для валидации проекции (римские не выше IV). */
const MAX_UNITS = 4;

export class LearnedSplitStore {
  private readonly store = new Map<string, LearnedSplitEntry>();
  private disabled = false;

  setDisabled(disabled: boolean): void {
    this.disabled = disabled;
  }

  isDisabled(): boolean {
    return this.disabled;
  }

  /** Kill-switch: полностью очистить рантайм-стор. */
  clear(): void {
    this.store.clear();
  }

  /**
   * patternKey из структурных признаков (БЕЗ raw text):
   * режим + groupSize + copies + форма units.
   */
  static patternKey(
    result: Pick<SquareFullResult, 'mode' | 'groupSize' | 'copies' | 'units'>,
  ): string {
    return `${result.mode}#${result.groupSize}#${result.copies}#${result.units.join(',')}`;
  }

  /** sourceHash — дешёвый djb2 по структуре (НЕ по тексту). */
  static sourceHash(
    result: Pick<SquareFullResult, 'units' | 'conf' | 'tRatio'>,
  ): string {
    const raw = `${result.units.join(',')}|${result.conf}|${result.tRatio}`;
    let h = 5381;
    for (let i = 0; i < raw.length; i++) {
      h = ((h << 5) + h + raw.charCodeAt(i)) | 0;
    }
    return `h${(h >>> 0).toString(36)}`;
  }

  /**
   * Вернуть запись если hit + гварды OK + валидная проекция; иначе null
   * (⇒ обычный train). Нарушение checkGuards/проекции = отказ от learned.
   */
  resolve(patternKey: string, n: number): LearnedSplitEntry | null {
    if (this.disabled) {return null;}
    const entry = this.store.get(patternKey);
    if (!entry) {return null;}
    if (Date.now() - entry.lastSeen > TTL_MS) {
      this.store.delete(patternKey);
      return null;
    }
    if (entry.units.length > MAX_UNITS) {return null;}
    if (!isValidLrcProjection(unitsToBounds(entry.units), n)) {return null;}
    if (checkGuards(entry.units, entry.mode)) {return null;}
    return entry;
  }

  /** LearnedState для роутера: hit + confirmed (min-observations). */
  static toLearnedState(entry: LearnedSplitEntry): LearnedState {
    return { isHit: true, confirmed: entry.observations >= MIN_OBSERVATIONS };
  }

  /**
   * Записать (или инкрементить observations при dedup по patternKey).
   * Возвращает актуальную запись. Валидация проекции — в resolve (подстановка).
   */
  record(result: SquareFullResult): LearnedSplitEntry {
    const key = LearnedSplitStore.patternKey(result);
    const now = Date.now();
    const existing = this.store.get(key);
    if (existing) {
      existing.observations++;
      existing.lastSeen = now;
      existing.units = [...result.units];
      existing.mode = result.mode;
      existing.conf = result.conf;
      existing.tRatio = result.tRatio;
      existing.guard = result.guard;
      existing.sourceHash = LearnedSplitStore.sourceHash(result);
      return existing;
    }
    const entry: LearnedSplitEntry = {
      patternKey: key,
      units: [...result.units],
      mode: result.mode,
      conf: result.conf,
      tRatio: result.tRatio,
      guard: result.guard,
      sourceHash: LearnedSplitStore.sourceHash(result),
      observations: 1,
      firstSeen: now,
      lastSeen: now,
    };
    this.store.set(key, entry);
    this.evict();
    return entry;
  }

  /** Human-override: снять запертый learned (освобождает роутинг). */
  invalidate(patternKey: string): void {
    this.store.delete(patternKey);
  }

  private evict(): void {
    if (this.store.size <= KEEP_LAST_N) {return;}
    const sorted = [...this.store.entries()].sort(
      (a, b) => a[1].lastSeen - b[1].lastSeen,
    );
    const toRemove = sorted.slice(0, this.store.size - KEEP_LAST_N);
    for (const [k] of toRemove) {this.store.delete(k);}
  }
}
