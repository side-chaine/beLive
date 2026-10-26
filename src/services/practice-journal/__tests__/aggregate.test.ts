/**
 * MR-2 §5 — агрегации журнала (чистые функции, без IDB).
 * Даты — локальные; now фиксируем строками без 'Z'.
 */

import { describe, expect, it } from 'vitest';
import type { PassRecord, SessionRecord } from '../types';
import type { TextBlock } from '../../../stores/blocks.store';
import {
  lastSession,
  mastery,
  sessionMinutes,
  streak,
  tempoByBlock,
  weekStats,
} from '../aggregate';
import { localDay } from '../date';

const at = (localIso: string): number => new Date(localIso).getTime();
const NOW = at('2026-10-24T18:00:00');

let seq = 0;

function sess(over: Partial<SessionRecord> = {}): SessionRecord {
  seq++;
  const t = over.at ?? NOW;
  return {
    id: `sess-${seq}`,
    kind: 'session',
    at: t,
    day: over.day ?? localDay(new Date(t)),
    ownerId: 'guest',
    startedAt: t,
    endedAt: t + 5 * 60_000,
    lastSeenAt: t + 5 * 60_000,
    pausedMs: 0,
    durationMs: 5 * 60_000,
    status: 'ended',
    trackId: 'track-1',
    trackTitle: 'Song',
    trackArtist: 'Artist',
    scenarioId: null,
    blockId: 'block-1',
    blockType: 'chorus',
    label: null,
    passes: 1,
    rateStart: 0.8,
    rateEnd: 1.0,
    ...over,
  };
}

function pass(over: Partial<PassRecord> = {}): PassRecord {
  seq++;
  const t = over.at ?? NOW;
  return {
    id: `pass-${seq}`,
    kind: 'pass',
    at: t,
    day: over.day ?? localDay(new Date(t)),
    ownerId: 'guest',
    sessionId: 'sess-1',
    blockId: 'block-1',
    blockType: 'chorus',
    passIndex: 1,
    rate: 0.9,
    label: null,
    ...over,
  };
}

const block = (id: string, name: string, type: string): TextBlock => ({
  id,
  name,
  type,
  lineIndices: [],
});

describe('practice journal aggregates (MR-2)', () => {
  it('1. пустой вход → нули, mastery {0,0,0}, lastSession null', () => {
    expect(weekStats([], NOW)).toEqual({
      minutes: 0,
      runs: 0,
      streak: 0,
      spark: [0, 0, 0, 0, 0, 0, 0],
    });
    expect(mastery([])).toEqual({ done: 0, total: 0, almost: 0 });
    expect(lastSession([])).toBeNull();
  });

  it('2. один день, две сессии → runs=2, streak=1 (день считается один раз)', () => {
    const sessions = [
      sess({ at: at('2026-10-24T10:00:00'), durationMs: 10 * 60_000 }),
      sess({ at: at('2026-10-24T16:00:00'), durationMs: 5 * 60_000 }),
    ];
    const stats = weekStats(sessions, NOW);
    expect(stats.runs).toBe(2);
    expect(stats.minutes).toBe(15);
    expect(stats.streak).toBe(1);
    expect(stats.spark[6]).toBe(15);
  });

  it('3. streak через границу месяца (2026-02-28 → 2026-03-01)', () => {
    expect(streak(['2026-02-27', '2026-02-28', '2026-03-01'], '2026-03-01')).toBe(3);
  });

  it('4. streak через границу года (2025-12-31 → 2026-01-01)', () => {
    expect(streak(['2025-12-30', '2025-12-31', '2026-01-01'], '2026-01-01')).toBe(3);
  });

  it('5. сегодня пусто, вчера есть → streak продолжается', () => {
    expect(streak(['2026-10-22', '2026-10-23'], '2026-10-24')).toBe(2);
    const stats = weekStats([sess({ at: at('2026-10-23T12:00:00') })], NOW);
    expect(stats.streak).toBe(1);
  });

  it('6. разрыв в 2 дня → streak останавливается', () => {
    expect(streak(['2026-10-24', '2026-10-22'], '2026-10-24')).toBe(1);
    expect(streak(['2026-10-22'], '2026-10-24')).toBe(0);
  });

  it('7. сессия с passes=0 не попадает в минуты/runs', () => {
    const sessions = [
      sess({ at: at('2026-10-24T09:00:00'), passes: 0, durationMs: 10 * 60_000 }),
      sess({ at: at('2026-10-24T11:00:00'), passes: 3, durationMs: 4 * 60_000 }),
    ];
    const stats = weekStats(sessions, NOW);
    expect(stats.runs).toBe(1);
    expect(stats.minutes).toBe(4);
    expect(stats.spark[6]).toBe(4);
  });

  it('8. mastery: 1.0→done, 0.99→almost, 0.94→ничего', () => {
    const blocks = [block('b1', 'Куплет', 'verse'), block('b2', 'Припев', 'chorus'), block('b3', 'Бридж', 'bridge')];
    const passes = [
      pass({ blockId: 'b1', rate: 1.0, at: at('2026-10-24T10:00:00') }),
      pass({ blockId: 'b2', rate: 0.99, at: at('2026-10-24T10:01:00') }),
      pass({ blockId: 'b3', rate: 0.94, at: at('2026-10-24T10:02:00') }),
    ];
    const rows = tempoByBlock(passes, blocks);
    expect(mastery(rows)).toEqual({ done: 1, total: 3, almost: 1 });
    expect(rows.map((r) => r.mastered)).toEqual([true, false, false]);
    expect(rows.map((r) => r.almost)).toEqual([false, true, false]);
  });

  it('9. tempoByBlock: порядок блоков из store, rates по at, blockId=null пропущен', () => {
    const blocks = [block('b2', 'Припев', 'chorus'), block('b1', 'Куплет', 'verse')];
    const passes = [
      pass({ blockId: 'b1', rate: 1.0, at: at('2026-10-24T10:05:00') }),
      pass({ blockId: 'b1', rate: 0.8, at: at('2026-10-24T10:01:00') }),
      pass({ blockId: 'b2', rate: 0.95, at: at('2026-10-24T10:02:00') }),
      pass({ blockId: null, rate: 0.7, at: at('2026-10-24T10:03:00') }),
    ];
    const rows = tempoByBlock(passes, blocks);
    expect(rows.map((r) => r.blockId)).toEqual(['b2', 'b1']);
    expect(rows[0].label).toBe('Припев');
    expect(rows[0].blockType).toBe('chorus');
    expect(rows[1].rates).toEqual([0.8, 1.0]);
    expect(rows[1].rate).toBe(1.0);
    expect(rows[1].passes).toBe(2);
    expect(rows[0].passes).toBe(1);
    expect(rows[0].almost).toBe(true);
  });

  it('10. lastSession: последняя ended/kept с прогонами, cancelled игнорируется', () => {
    const sessions = [
      sess({ at: at('2026-10-22T10:00:00'), endedAt: at('2026-10-22T10:30:00'), trackId: 'old' }),
      sess({ at: at('2026-10-23T10:00:00'), endedAt: at('2026-10-23T10:20:00'), status: 'kept', trackId: 'kept' }),
      sess({ at: at('2026-10-24T10:00:00'), endedAt: at('2026-10-24T10:40:00'), status: 'cancelled', trackId: 'cancelled' }),
      sess({ at: at('2026-10-24T11:00:00'), endedAt: at('2026-10-24T11:10:00'), passes: 0, trackId: 'empty' }),
    ];
    expect(lastSession(sessions)).toEqual({
      trackId: 'kept',
      trackTitle: 'Song',
      scenarioId: null,
      blockId: 'block-1',
      blockType: 'chorus',
      rate: 1.0,
      at: at('2026-10-23T10:20:00'),
    });
  });

  it('11. spark: ровно 7, oldest→newest, минуты попадают в свой день', () => {
    const sessions = [
      sess({ at: at('2026-10-18T10:00:00'), durationMs: 3 * 60_000 }),
      sess({ at: at('2026-10-21T10:00:00'), durationMs: 7 * 60_000 }),
      sess({ at: at('2026-10-24T10:00:00'), durationMs: 10 * 60_000 }),
    ];
    const stats = weekStats(sessions, NOW);
    expect(stats.spark).toEqual([3, 0, 0, 7, 0, 0, 10]);
    expect(stats.minutes).toBe(20);
    expect(stats.runs).toBe(3);
  });

  it('12. sessionMinutes округляет (90_000 мс → 2 мин)', () => {
    expect(sessionMinutes(sess({ durationMs: 90_000 }))).toBe(2);
    expect(sessionMinutes(sess({ durationMs: 60_000 }))).toBe(1);
    expect(sessionMinutes(sess({ durationMs: 0 }))).toBe(0);
  });
});
