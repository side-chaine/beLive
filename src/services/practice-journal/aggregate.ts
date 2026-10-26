/**
 * Practice Journal — агрегации (MR-2, этап 2).
 * ТОЛЬКО чистые функции: без React, без IDB, без сторов (TextBlock — тип).
 * Учитываемая сессия («прогон») = passes > 0. Иначе ни минут, ни runs, ни streak.
 */

import type { SessionRecord, PassRecord } from './types';
import type { TextBlock } from '../../stores/blocks.store';
import { localDay, shiftDay } from './date';

export interface WeekStats {
  minutes: number;
  runs: number;
  streak: number;
  /** spark[0] = 6 дней назад … spark[6] = сегодня (ровно 7 чисел) */
  spark: number[];
}

export interface TempoRow {
  blockId: string;
  blockType: string;
  label: string;
  rates: number[];
  rate: number;
  passes: number;
  mastered: boolean;
  almost: boolean;
}

export interface MasterySummary {
  done: number;
  total: number;
  almost: number;
}

export interface ContinueTarget {
  trackId: string | null;
  trackTitle: string | null;
  scenarioId: string | null;
  blockId: string | null;
  blockType: string | null;
  rate: number;
  at: number;
}

const WINDOW_DAYS = 7;
const MIN_MS = 60_000;

/** Минуты сессии (активное время, округление до минуты). */
export function sessionMinutes(s: SessionRecord): number {
  return Math.round(s.durationMs / MIN_MS);
}

/** «Прогон»: сессия, в которой был хотя бы один проход. */
const isCounted = (s: SessionRecord): boolean => s.passes > 0;

/** Непрерывная серия дней назад от today. Сегодня пусто → старт со вчера. */
export function streak(days: string[], today: string): number {
  const set = new Set(days);
  let cursor = set.has(today) ? today : shiftDay(today, -1);
  let n = 0;
  while (set.has(cursor)) {
    n++;
    cursor = shiftDay(cursor, -1);
  }
  return n;
}

/** Окно: today−6 … today. Минуты/runs/spark — только по учитываемым сессиям. */
export function weekStats(sessions: SessionRecord[], now: number = Date.now()): WeekStats {
  const today = localDay(new Date(now));
  const oldest = shiftDay(today, -(WINDOW_DAYS - 1));

  const index = new Map<string, number>();
  for (let i = 0; i < WINDOW_DAYS; i++) index.set(shiftDay(oldest, i), i);

  const spark = new Array<number>(WINDOW_DAYS).fill(0);
  const counted = sessions.filter(isCounted);
  const countedDays: string[] = [];
  let minutes = 0;
  let runs = 0;

  for (const s of counted) {
    countedDays.push(s.day); // streak считается по всей истории, не по окну
    const i = index.get(s.day);
    if (i === undefined) continue;
    const m = sessionMinutes(s);
    minutes += m;
    runs++;
    spark[i] += m;
  }

  return { minutes, runs, streak: streak(countedDays, today), spark };
}

/** Темп по блокам в порядке blocks.store; passes с blockId=null пропускаем. */
export function tempoByBlock(passes: PassRecord[], blocks: TextBlock[]): TempoRow[] {
  return blocks.map((block) => {
    const rates = passes
      .filter((p) => p.blockId === block.id)
      .sort((a, b) => a.at - b.at)
      .map((p) => p.rate);
    const rate = rates.length > 0 ? rates[rates.length - 1] : 0;
    return {
      blockId: block.id,
      blockType: block.type,
      label: block.name,
      rates,
      rate,
      passes: rates.length,
      mastered: rate >= 1.0,
      almost: rate >= 0.95 && rate < 1.0,
    };
  });
}

/** Момент сессии: closed → endedAt, иначе at. */
/** Момент сессии: closed → endedAt, иначе at. */
const atOf = (s: SessionRecord): number => s.endedAt ?? s.at;

/** Освоение: done rate>=1.0, almost 0.95<=rate<1.0 (в done не входит), total = блоки. */
export function mastery(rows: TempoRow[]): MasterySummary {
  let done = 0;
  let almost = 0;
  for (const row of rows) {
    if (row.rate >= 1.0) done++;
    else if (row.rate >= 0.95 && row.rate < 1.0) almost++;
  }
  return { done, total: rows.length, almost };
}

/** Последняя сессия для «продолжить»: ended/kept + прогоны. */
export function lastSession(sessions: SessionRecord[]): ContinueTarget | null {
  let best: SessionRecord | null = null;
  for (const s of sessions) {
    if (s.status !== 'ended' && s.status !== 'kept') continue;
    if (!isCounted(s)) continue;
    if (!best || atOf(s) > atOf(best)) best = s;
  }
  if (!best) return null;
  return {
    trackId: best.trackId,
    trackTitle: best.trackTitle,
    scenarioId: best.scenarioId,
    blockId: best.blockId,
    blockType: best.blockType,
    rate: best.rateEnd,
    at: atOf(best),
  };
}

