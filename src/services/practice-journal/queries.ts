/**
 * Practice Journal — тонкое чтение для UI (MR-2, этап 2).
 * Без агрегаций: только выборки. Ошибки IDB пробрасываются наверх — решает вызывающий.
 */

import { getDB, tx, req } from '../idb.service';
import type { JournalRecord } from './types';
import { localDay, shiftDay } from './date';

const STORE = 'practice_log';

/** Все записи владельца (сессии + проходы) через индекс ownerId. */
export async function getAllForOwner(ownerId: string): Promise<JournalRecord[]> {
  const db = await getDB();
  return req<JournalRecord[]>(tx(db, STORE).index('ownerId').getAll(ownerId));
}

/** Записи владельца за последние `days` суток (day >= today−days) через индекс day. */
export async function getRecent(ownerId: string, days: number): Promise<JournalRecord[]> {
  const db = await getDB();
  const from = shiftDay(localDay(), -Math.max(0, days));
  const rows = await req<JournalRecord[]>(
    tx(db, STORE).index('day').getAll(IDBKeyRange.lowerBound(from)),
  );
  return rows.filter((r) => r.ownerId === ownerId);
}
