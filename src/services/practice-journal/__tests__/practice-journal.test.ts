/**
 * MR-1 §6 — обязательные кейсы журнала прогонов.
 * IDB: fake-indexeddb (test-only, в бандл не идёт).
 */

import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { JournalRecord, PassRecord, SessionRecord } from '../types';

type JournalModule = typeof import('../idb');
type IdbServiceModule = typeof import('../../idb.service');

let journal: JournalModule;
let idbService: IdbServiceModule;

const BASE_INPUT = {
  scenarioId: 'bpm-ramp' as string | null,
  blockId: 'block-1' as string | null,
  blockType: 'chorus' as string | null,
  label: 'Разогнать припев' as string | null,
  rateStart: 0.8,
  trackId: 'track-1' as string | null,
  trackTitle: 'Test Song' as string | null,
  trackArtist: 'Test Artist' as string | null,
};

async function readAll(): Promise<JournalRecord[]> {
  const db = await idbService.getDB();
  return idbService.req<JournalRecord[]>(idbService.tx(db, 'practice_log').getAll());
}

async function putRaw(records: JournalRecord[]): Promise<void> {
  const db = await idbService.getDB();
  const t = db.transaction(['practice_log'], 'readwrite');
  const store = t.objectStore('practice_log');
  for (const r of records) store.put(r);
  await new Promise<void>((resolve, reject) => {
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

const sessionsOf = (rows: JournalRecord[]): SessionRecord[] =>
  rows.filter((r): r is SessionRecord => r.kind === 'session');
const passesOf = (rows: JournalRecord[]): PassRecord[] =>
  rows.filter((r): r is PassRecord => r.kind === 'pass');

beforeEach(async () => {
  vi.resetModules();
  localStorage.clear();
  globalThis.indexedDB = new IDBFactory();
  idbService = await import('../../idb.service');
  journal = await import('../idb');
});

afterEach(() => {
  vi.useRealTimers();
});

describe('practice journal MR-1', () => {
  it('1. 3 прогона 0.8/0.9/1.0 → 1 session (passes=3) + 3 pass', async () => {
    await journal.appendSession(BASE_INPUT);

    const rates = [0.8, 0.9, 1.0];
    for (let i = 0; i < rates.length; i++) {
      await journal.appendPass({ rate: rates[i], passIndex: i + 1, label: null });
      await journal.patchSession({ passes: i + 1, rateEnd: rates[i] });
    }
    await journal.closeSession('ended');

    const rows = await readAll();
    const sessions = sessionsOf(rows);
    const passes = passesOf(rows);

    expect(sessions).toHaveLength(1);
    expect(passes).toHaveLength(3);
    expect(sessions[0].passes).toBe(3);
    expect(sessions[0].rateStart).toBe(0.8);
    expect(sessions[0].rateEnd).toBe(1.0);
    expect(sessions[0].status).toBe('ended');
    expect(sessions[0].blockId).toBe('block-1');
    expect(sessions[0].blockType).toBe('chorus');
    expect(sessions[0].trackId).toBe('track-1');
    expect(sessions[0].ownerId).toBe('guest');
    expect(sessions[0].day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const ordered = [...passes].sort((a, b) => a.passIndex - b.passIndex);
    expect(ordered.map((p) => p.rate)).toEqual([0.8, 0.9, 1.0]);
    expect(ordered.map((p) => p.passIndex)).toEqual([1, 2, 3]);
    expect(passes.every((p) => p.sessionId === sessions[0].id)).toBe(true);
  });

  it('2. reload-эмуляция: open + старый lastSeenAt → interrupted, duration=lastSeenAt−startedAt', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const t0 = new Date('2026-10-24T10:00:00').getTime();
    vi.setSystemTime(t0);

    await journal.appendSession(BASE_INPUT);

    // heartbeat через 5 минут, затем «перезагрузка» через 3 часа
    vi.setSystemTime(t0 + 5 * 60_000);
    await journal.heartbeat();

    const now = t0 + 3 * 60 * 60_000;
    vi.setSystemTime(now);
    const closed = await journal.closeStale(now);
    expect(closed).toBe(1);

    const [session] = sessionsOf(await readAll());
    expect(session.status).toBe('interrupted');
    expect(session.durationMs).toBe(5 * 60_000);
    expect(session.endedAt).toBe(t0 + 5 * 60_000);
  });

  it('3. пауза 10 мин → durationMs без этих 10 минут', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const t0 = new Date('2026-10-24T12:00:00').getTime();
    vi.setSystemTime(t0);

    await journal.appendSession(BASE_INPUT);

    vi.setSystemTime(t0 + 5 * 60_000);
    journal.markPaused();

    vi.setSystemTime(t0 + 15 * 60_000); // пауза 10 минут
    journal.markResumed();

    vi.setSystemTime(t0 + 30 * 60_000); // всего 30 минут
    await journal.closeSession('ended');

    const [session] = sessionsOf(await readAll());
    expect(session.pausedMs).toBe(10 * 60_000);
    expect(session.durationMs).toBe(20 * 60_000);
    expect(session.startedAt).toBe(t0);
    expect(session.endedAt).toBe(t0 + 30 * 60_000);
  });

  it('4. повторный close → без дубля и без перезаписи passes', async () => {
    await journal.appendSession(BASE_INPUT);
    await journal.appendPass({ rate: 0.9, passIndex: 1, label: '90%' });
    await journal.patchSession({ passes: 1, rateEnd: 0.9 });

    await journal.closeSession('ended');
    await journal.closeSession('ended');
    await journal.closeSession('cancelled');

    const rows = await readAll();
    const sessions = sessionsOf(rows);
    expect(sessions).toHaveLength(1);
    expect(passesOf(rows)).toHaveLength(1);
    expect(sessions[0].passes).toBe(1);
    expect(sessions[0].rateEnd).toBe(0.9);
    expect(sessions[0].status).toBe('ended');
  });

  it('5. migrateGuest: полный record сохраняется, повторный вызов не дублирует', async () => {
    await journal.appendSession(BASE_INPUT);
    await journal.appendPass({ rate: 0.9, passIndex: 1, label: '90%' });
    await journal.patchSession({ passes: 1, rateEnd: 0.9 });
    await journal.closeSession('ended');

    const before = await readAll();
    expect(before).toHaveLength(2);
    expect(before.every((r) => r.ownerId === 'guest')).toBe(true);
    const dayBefore = sessionsOf(before)[0].day;

    const migrated = await journal.migrateGuest('acc-1');
    expect(migrated).toBe(2);

    const after = await readAll();
    expect(after).toHaveLength(2);
    expect(after.every((r) => r.ownerId === 'acc-1' && r.migrated === true)).toBe(true);

    const session = sessionsOf(after)[0];
    expect(session.kind).toBe('session');
    expect(session.day).toBe(dayBefore);
    expect(session.passes).toBe(1);
    expect(session.rateEnd).toBe(0.9);
    expect(session.status).toBe('ended');
    expect(passesOf(after)[0].rate).toBe(0.9);

    // guard: повторный вызов не мигрирует и не дублирует
    const again = await journal.migrateGuest('acc-1');
    expect(again).toBe(0);
    expect(await readAll()).toHaveLength(2);
  });

  it('6. prune: старые удалены, day===today живы даже при >10k', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const now = new Date('2026-10-24T18:00:00').getTime();
    vi.setSystemTime(now);

    const today = journal.localDay(new Date(now));
    const oldDay = journal.localDay(new Date(now - 500 * 86_400_000));
    const recentOldDay = journal.localDay(new Date(now - 10 * 86_400_000));

    // 1 текущая сессия (записана писателем)
    await journal.appendSession(BASE_INPUT);
    await journal.closeSession('ended');

    // + 1 запись старше 365 дней (напрямую)
    await putRaw([
      {
        id: 'old-1',
        kind: 'pass',
        at: now - 500 * 86_400_000,
        day: oldDay,
        ownerId: 'guest',
        sessionId: 'x',
        blockId: null,
        blockType: null,
        passIndex: 1,
        rate: 0.8,
        label: null,
      },
    ]);

    await journal.prune(now);
    let rows = await readAll();
    expect(rows.some((r) => r.day === oldDay)).toBe(false);
    expect(rows.some((r) => r.day === today)).toBe(true);

    // >10k: 10 000 старых (в пределах года) + 5 сегодняшних
    const bulk: JournalRecord[] = [];
    for (let i = 0; i < 10_000; i++) {
      bulk.push({
        id: `bulk-${i}`,
        kind: 'pass',
        at: now - 10 * 86_400_000 - i,
        day: recentOldDay,
        ownerId: 'guest',
        sessionId: 'x',
        blockId: null,
        blockType: null,
        passIndex: 1,
        rate: 0.8,
        label: null,
      });
    }
    for (let i = 0; i < 5; i++) {
      bulk.push({
        id: `today-${i}`,
        kind: 'pass',
        at: now + i,
        day: today,
        ownerId: 'guest',
        sessionId: 'x',
        blockId: null,
        blockType: null,
        passIndex: 1,
        rate: 0.8,
        label: null,
      });
    }
    await putRaw(bulk);

    const beforeCount = (await readAll()).length;
    expect(beforeCount).toBe(10_006); // 1 today-сессия + 10 000 старых + 5 today
    await journal.prune(now);

    rows = await readAll();
    expect(rows.length).toBe(10_000);
    expect(rows.filter((r) => r.day === today)).toHaveLength(6); // 5 + текущая сессия
    expect(rows.some((r) => r.day === oldDay)).toBe(false);
  });
});
