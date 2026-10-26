/**
 * MR-4a — приёмка must-fix ревью Центр_1:
 *  Q1 сериализатор записи + одна tx (pass+патч),
 *  Q4 guard миграции гостя внутри tx,
 *  Q5 VersionError-retry в idb.service.
 *  (Q2 — detail событий, Q8 — CSS-клапан: без юнит-гейта.)
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

const sessionsOf = (rows: JournalRecord[]): SessionRecord[] =>
  rows.filter((r): r is SessionRecord => r.kind === 'session');
const passesOf = (rows: JournalRecord[]): PassRecord[] =>
  rows.filter((r): r is PassRecord => r.kind === 'pass');

/** Дождаться дренажа очереди журнала. */
async function flushQueue(): Promise<void> {
  await journal.enqueueWrite(async () => {});
}

/** Считать транзакции, открытые за время fn (проверка «одна tx»). */
async function countTx<T>(fn: () => Promise<T>): Promise<{ result: T; count: number }> {
  const db = await idbService.getDB();
  let count = 0;
  const orig = db.transaction.bind(db);
  (db as unknown as Record<string, unknown>).transaction = (...args: unknown[]) => {
    count++;
    return (orig as (...a: unknown[]) => IDBTransaction)(...args);
  };
  try {
    const result = await fn();
    return { result, count };
  } finally {
    delete (db as unknown as Record<string, unknown>).transaction;
  }
}

beforeEach(async () => {
  vi.resetModules();
  localStorage.clear();
  globalThis.indexedDB = new IDBFactory();
  idbService = await import('../../idb.service');
  journal = await import('../idb');
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('MR-4a Q1 — сериализатор записи', () => {
  it('гонка: pass без await + мгновенный close ⇒ патч на месте, session closed', async () => {
    await journal.appendSession(BASE_INPUT);

    // Ровно как onPassComplete → быстрый «завершить» в том же тике.
    void journal.appendPassAndPatch(
      { rate: 0.9, passIndex: 1, label: '90%' },
      { passes: 1, rateEnd: 0.9 },
    );
    void journal.closeSession('ended');

    await flushQueue();

    const rows = await readAll();
    const [session] = sessionsOf(rows);
    expect(session.status).toBe('ended');
    expect(session.passes).toBe(1); // патч НЕ потерян
    expect(session.rateEnd).toBe(0.9);
    expect(passesOf(rows)).toHaveLength(1);
  });

  it('инвариант одной tx: appendPassAndPatch пишет pass+патч атомарно', async () => {
    await journal.appendSession(BASE_INPUT);

    const { count } = await countTx(() =>
      journal.appendPassAndPatch(
        { rate: 0.85, passIndex: 1, label: null },
        { passes: 1, rateEnd: 0.85 },
      ),
    );
    expect(count).toBe(1); // ОДНА readwrite-транзакция

    const rows = await readAll();
    expect(sessionsOf(rows)[0].passes).toBe(1);
    expect(sessionsOf(rows)[0].rateEnd).toBe(0.85);
    expect(passesOf(rows)).toHaveLength(1);
    expect(passesOf(rows)[0].rate).toBe(0.85);
  });
});

describe('MR-4a Q4 — guard миграции внутри tx', () => {
  it('count-гвард и миграция в ОДНОЙ tx; повторный вызов → 0', async () => {
    await journal.appendSession(BASE_INPUT);
    await journal.appendPassAndPatch(
      { rate: 0.9, passIndex: 1, label: null },
      { passes: 1, rateEnd: 0.9 },
    );
    await journal.closeSession('ended'); // 2 записи guest

    const first = await countTx(() => journal.migrateGuest('acc-1'));
    expect(first.result).toBe(2);
    expect(first.count).toBe(1); // нет внешнего count-запроса отдельной tx

    const after = await readAll();
    expect(after.every((r) => r.ownerId === 'acc-1' && r.migrated === true)).toBe(true);

    const again = await countTx(() => journal.migrateGuest('acc-1'));
    expect(again.result).toBe(0);
    expect(again.count).toBe(1);
    expect(await readAll()).toHaveLength(2);
  });
});

describe('MR-4a Q5 — VersionError-retry', () => {
  it('сервис всегда open без пина: диск-версия любая, VersionError недостижим (MR-IDB-UNBLOCK)', async () => {
    vi.resetModules();

    const DISK_VERSION = 11;
    const opens: Array<number | undefined> = [];

    interface FakeReq {
      result: unknown;
      error: DOMException | null;
      onsuccess: (() => void) | null;
      onerror: (() => void) | null;
      onupgradeneeded: unknown;
      transaction: unknown;
    }

    const okReq = (result: unknown): FakeReq => {
      const req: FakeReq = {
        result, error: null, onsuccess: null, onerror: null, onupgradeneeded: null, transaction: null,
      };
      queueMicrotask(() => req.onsuccess?.());
      return req;
    };

    const versionErrorReq = (): FakeReq => {
      // Контракт MR-IDB-UNBLOCK: пиновый open больше не существует.
      // Если бы пин вернулся — это баг: кладём отказ, тест упадёт.
      const req: FakeReq = {
        result: null,
        error: Object.assign(new Error('The requested version is less than the existing version'), {
          name: 'VersionError',
        }) as DOMException,
        onsuccess: null, onerror: null, onupgradeneeded: null, transaction: null,
      };
      queueMicrotask(() => req.onerror?.());
      return req;
    };

    const fakeDb = {
      version: DISK_VERSION,
      close: vi.fn(),
      onversionchange: null as null | (() => void),
      objectStoreNames: { contains: () => true },
    };

    vi.stubGlobal('indexedDB', {
      open: (_name: string, version?: number): FakeReq => {
        opens.push(version);
        // любое пиновое open => VersionError (ловим регресс возврата пина);
        // без версии => фактическая версия диска
        return version === undefined ? okReq(fakeDb) : versionErrorReq();
      },
    });

    const retryService: IdbServiceModule = await import('../../idb.service');
    const db = await retryService.getDB();

    expect(opens).toEqual([undefined]); // БЕЗ пина, один звонок — блокировка невозможна
    expect((db as unknown as { version: number }).version).toBe(DISK_VERSION);
  });
});
