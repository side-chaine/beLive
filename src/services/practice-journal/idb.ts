/**
 * Practice Journal — ЕДИНСТВЕННЫЙ писатель журнала прогонов (MR-1, этап 1).
 * Best-effort: любая ошибка IDB → no-op. Журнал не должен ломать практику.
 * Читают журнал только агрегации/UI (этап 2+).
 *
 * MR-4a Q1: ВСЕ мутации идут через одну очередь `enqueueWrite` — closeSession
 * физически не может встать перед незавершённым патчем (патч не теряется).
 */

import { getDB, tx, req } from '../idb.service';
import { useUserProfileStore } from '../../stores/user-profile.store';
import type { JournalRecord, PassRecord, SessionRecord } from './types';
import { localDay } from './date';

// Совместимость: тесты этапа 1 читают journal.localDay.
export { localDay };

const STORE = 'practice_log';
const GUEST = 'guest';

const RETENTION_DAYS = 365;
const DAY_MS = 86_400_000;
const MAX_RECORDS = 10_000;
const STALE_MS = 2 * 60 * 60 * 1000;

// ── Сериализатор записи (MR-4a Q1) ─────────────────────

let _tail: Promise<unknown> = Promise.resolve();

/**
 * Поставить мутацию журнала в сериализованную очередь.
 * Провал одной операции не отменяет следующую (op и на reject-ветке).
 */
export function enqueueWrite<T>(op: () => Promise<T>): Promise<T> {
  const run = _tail.then(op, op);
  _tail = run.then(() => {}, () => {});
  return run;
}

/** Module-state кэш активной сессии (условие 009-4). */
interface ActiveSession {
  sessionId: string;
  startedAt: number;
  passes: number;
  rateStart: number;
  rateEnd: number;
  pausedMs: number;
  pausedStartedAt: number | null;
  trackId: string | null;
  trackTitle: string | null;
  trackArtist: string | null;
  scenarioId: string | null;
  blockId: string | null;
  blockType: string | null;
  label: string | null;
}

let active: ActiveSession | null = null;

// ── Helpers ────────────────────────────────────────────

function newId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c?.randomUUID) {return c.randomUUID();}
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function ownerId(): string {
  return useUserProfileStore.getState().currentUser?.id ?? GUEST;
}

function durationOf(startedAt: number, endedAt: number, pausedMs: number): number {
  return Math.max(0, endedAt - startedAt - pausedMs);
}

/** Завершить readwrite-транзакцию (batch-записи без await между запросами). */
function awaitTx(t: IDBTransaction): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

function passRecord(
  input: { rate: number; passIndex: number; label: string | null },
  cache: ActiveSession,
  now: number,
): PassRecord {
  return {
    id: newId(),
    kind: 'pass',
    at: now,
    day: localDay(),
    ownerId: ownerId(),
    sessionId: cache.sessionId,
    blockId: cache.blockId,
    blockType: cache.blockType,
    passIndex: input.passIndex,
    rate: input.rate,
    label: input.label,
  };
}

// ── Writer: session ────────────────────────────────────

export interface AppendSessionInput {
  scenarioId: string | null;
  blockId: string | null;
  blockType: string | null;
  label: string | null;
  rateStart: number;
  trackId: string | null;
  trackTitle: string | null;
  trackArtist: string | null;
}

async function _appendSession(input: AppendSessionInput): Promise<void> {
  try {
    const now = Date.now();
    const id = newId();
    const record: SessionRecord = {
      id,
      kind: 'session',
      at: now,
      day: localDay(),
      ownerId: ownerId(),
      startedAt: now,
      endedAt: null,
      lastSeenAt: now,
      pausedMs: 0,
      durationMs: 0,
      status: 'open',
      trackId: input.trackId,
      trackTitle: input.trackTitle,
      trackArtist: input.trackArtist,
      scenarioId: input.scenarioId,
      blockId: input.blockId,
      blockType: input.blockType,
      label: input.label,
      passes: 0,
      rateStart: input.rateStart,
      rateEnd: input.rateStart,
    };

    // Кэш — ДО записи и до любых сбросов стора.
    active = {
      sessionId: id,
      startedAt: now,
      passes: 0,
      rateStart: input.rateStart,
      rateEnd: input.rateStart,
      pausedMs: 0,
      pausedStartedAt: null,
      trackId: input.trackId,
      trackTitle: input.trackTitle,
      trackArtist: input.trackArtist,
      scenarioId: input.scenarioId,
      blockId: input.blockId,
      blockType: input.blockType,
      label: input.label,
    };

    const db = await getDB();
    await req(tx(db, STORE, 'readwrite').put(record));
  } catch {
    // best-effort: журнал молчит
  }
}

export function appendSession(input: AppendSessionInput): Promise<void> {
  return enqueueWrite(() => _appendSession(input));
}

async function _appendPass(input: {
  rate: number;
  passIndex: number;
  label: string | null;
}): Promise<void> {
  try {
    if (!active) {return;}
    const now = Date.now();
    const record = passRecord(input, active, now);

    active.passes = input.passIndex;
    active.rateEnd = input.rate;

    const db = await getDB();
    await req(tx(db, STORE, 'readwrite').put(record));
  } catch {
    // best-effort
  }
}

export function appendPass(input: {
  rate: number;
  passIndex: number;
  label: string | null;
}): Promise<void> {
  return enqueueWrite(() => _appendPass(input));
}

/**
 * MR-4a Q1: pass + патч сессии в ОДНОЙ readwrite-транзакции.
 * real fix гонки: патч и запись прогона либо оба на диске, либо ни одного.
 */
async function _appendPassAndPatch(
  pass: { rate: number; passIndex: number; label: string | null },
  patch: Partial<Omit<SessionRecord, 'id' | 'kind'>>,
): Promise<void> {
  try {
    if (!active) {return;}
    const cache = active;
    const now = Date.now();
    const record = passRecord(pass, cache, now);

    const db = await getDB();
    const t = db.transaction([STORE], 'readwrite');
    const store = t.objectStore(STORE);
    store.put(record);

    const get = store.get(cache.sessionId);
    get.onsuccess = () => {
      const current = get.result as SessionRecord | undefined;
      if (!current) {return;}
      store.put({ ...current, ...patch } as SessionRecord);
    };

    await awaitTx(t);

    cache.passes = pass.passIndex;
    cache.rateEnd = pass.rate;
    if (patch.passes != null) {cache.passes = patch.passes;}
    if (patch.rateEnd != null) {cache.rateEnd = patch.rateEnd;}
  } catch {
    // best-effort
  }
}

export function appendPassAndPatch(
  pass: { rate: number; passIndex: number; label: string | null },
  patch: Partial<Omit<SessionRecord, 'id' | 'kind'>>,
): Promise<void> {
  return enqueueWrite(() => _appendPassAndPatch(pass, patch));
}

async function _patchSession(
  patch: Partial<Omit<SessionRecord, 'id' | 'kind'>>,
): Promise<void> {
  try {
    if (!active) {return;}
    const sessionId = active.sessionId;
    const db = await getDB();
    const current = await req<SessionRecord | undefined>(tx(db, STORE).get(sessionId));
    if (!current) {return;}
    await req(tx(db, STORE, 'readwrite').put({ ...current, ...patch } as SessionRecord));
    if (patch.passes != null) {active.passes = patch.passes;}
    if (patch.rateEnd != null) {active.rateEnd = patch.rateEnd;}
  } catch {
    // best-effort
  }
}

export function patchSession(
  patch: Partial<Omit<SessionRecord, 'id' | 'kind'>>,
): Promise<void> {
  return enqueueWrite(() => _patchSession(patch));
}

/** Тоже в очереди (Q1: мутации — только через неё); внутри — нерекурсивный патч. */
export function heartbeat(): Promise<void> {
  return enqueueWrite(async () => {
    if (!active) {return;}
    await _patchSession({ lastSeenAt: Date.now() });
  });
}

/** Пауза: отметка в кэше (pausedMs копится, в запись уходит на close). */
export function markPaused(now: number = Date.now()): void {
  if (!active || active.pausedStartedAt != null) {return;}
  active.pausedStartedAt = now;
}

export function markResumed(now: number = Date.now()): void {
  if (!active || active.pausedStartedAt == null) {return;}
  active.pausedMs += Math.max(0, now - active.pausedStartedAt);
  active.pausedStartedAt = null;
}

/**
 * Закрытие сессии. Читает ТОЛЬКО кэш; passes/rateEnd не перезаписывает;
 * идемпотентно (status !== 'open' → skip).
 */
async function _closeSession(
  status: Exclude<SessionRecord['status'], 'open'>,
): Promise<void> {
  try {
    if (!active) {return;}
    const cache = active;
    const db = await getDB();
    const current = await req<SessionRecord | undefined>(tx(db, STORE).get(cache.sessionId));
    if (!current || current.status !== 'open') {
      active = null;
      return;
    }

    const endedAt = Date.now();
    const pausedMs =
      cache.pausedMs +
      (cache.pausedStartedAt != null ? Math.max(0, endedAt - cache.pausedStartedAt) : 0);

    const next: SessionRecord = {
      ...current, // passes / rateEnd — из записи, НЕ трогаем
      status,
      endedAt,
      lastSeenAt: endedAt,
      pausedMs,
      durationMs: durationOf(current.startedAt, endedAt, pausedMs),
    };

    await req(tx(db, STORE, 'readwrite').put(next));
    active = null;
  } catch {
    // best-effort
  }
}

export function closeSession(
  status: Exclude<SessionRecord['status'], 'open'>,
): Promise<void> {
  return enqueueWrite(() => _closeSession(status));
}

// ── Ретеншен ───────────────────────────────────────────

async function _prune(now: number): Promise<void> {
  try {
    const db = await getDB();
    const all = await req<JournalRecord[]>(tx(db, STORE).getAll());
    const today = localDay(new Date(now));
    const cutoff = localDay(new Date(now - RETENTION_DAYS * DAY_MS));

    // 1) старее 365 дней (day===today не попадает: today >= cutoff)
    let keep = all.filter((r) => r.day >= cutoff || r.day === today);

    // 2) перебор 10k — удаляем старейшие, но НИКОГДА не сегодняшние
    if (keep.length > MAX_RECORDS) {
      const drop = new Set<string>();
      let overflow = keep.length - MAX_RECORDS;
      for (const r of [...keep].sort((a, b) => a.at - b.at)) {
        if (overflow <= 0) {break;}
        if (r.day === today) {continue;}
        drop.add(r.id);
        overflow--;
      }
      keep = keep.filter((r) => !drop.has(r.id));
    }

    const keepIds = new Set(keep.map((r) => r.id));
    const toDelete = all.filter((r) => !keepIds.has(r.id)).map((r) => r.id);
    if (toDelete.length === 0) {return;}

    const t = db.transaction([STORE], 'readwrite');
    const store = t.objectStore(STORE);
    for (const id of toDelete) {store.delete(id);}
    await awaitTx(t);
  } catch {
    // best-effort
  }
}

export function prune(now: number = Date.now()): Promise<void> {
  return enqueueWrite(() => _prune(now));
}

// ── Миграция гостя ─────────────────────────────────────

/** MR-4a Q4: guard («у аккаунта уже есть записи?») — ВНУТРИ миграционной tx. */
async function _migrateGuest(accountId: string): Promise<number> {
  try {
    if (!accountId || accountId === GUEST) {return 0;}
    const db = await getDB();

    // ОДНА readwrite-транзакция: count-гвард и read-modify-write в ней же.
    const t = db.transaction([STORE], 'readwrite');
    const index = t.objectStore(STORE).index('ownerId');

    return await new Promise<number>((resolve, reject) => {
      let migrated = 0;
      let blocked = false;

      const guard = index.count(accountId);
      guard.onerror = () => reject(guard.error);
      guard.onsuccess = () => {
        if ((guard.result as number) > 0) {
          blocked = true; // записей нет — транзакция завершится пустой
          return;
        }
        const request = index.openCursor(IDBKeyRange.only(GUEST));
        request.onsuccess = () => {
          const cursor = request.result;
          if (cursor) {
            // read-modify-write: полный объект, НЕ частичный
            const r = cursor.value as JournalRecord;
            r.ownerId = accountId;
            r.migrated = true;
            cursor.update(r);
            migrated++;
            cursor.continue();
          }
        };
        request.onerror = () => reject(request.error);
      };

      t.oncomplete = () => resolve(blocked ? 0 : migrated);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  } catch {
    return 0;
  }
}

export function migrateGuest(accountId: string): Promise<number> {
  return enqueueWrite(() => _migrateGuest(accountId));
}

// ── Boot: закрытие зависших open ───────────────────────

async function _closeStale(now: number): Promise<number> {
  try {
    const db = await getDB();
    const sessions = await req<SessionRecord[]>(tx(db, STORE).index('kind').getAll('session'));
    const stale = sessions.filter((s) => s.status === 'open' && now - s.lastSeenAt > STALE_MS);
    if (stale.length === 0) {return 0;}

    const t = db.transaction([STORE], 'readwrite');
    const store = t.objectStore(STORE);
    for (const s of stale) {
      store.put({
        ...s,
        status: 'interrupted',
        endedAt: s.lastSeenAt,
        durationMs: durationOf(s.startedAt, s.lastSeenAt, s.pausedMs),
      } as SessionRecord);
    }
    await awaitTx(t);

    const activeId = active?.sessionId ?? null;
    if (activeId && stale.some((s) => s.id === activeId)) {active = null;}
    return stale.length;
  } catch {
    return 0;
  }
}

export function closeStale(now: number = Date.now()): Promise<number> {
  return enqueueWrite(() => _closeStale(now));
}
