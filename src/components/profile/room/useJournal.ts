/**
 * MR-3 · загрузка журнала для комнаты (owner-scoped) + обновление по событиям практики.
 * Ошибки IDB → пустые данные (комната не падает).
 */

import { useCallback, useEffect, useState } from 'react';
import { getAllForOwner } from '../../../services/practice-journal/queries';
import { lastSession, weekStats } from '../../../services/practice-journal/aggregate';
import type { ContinueTarget, WeekStats } from '../../../services/practice-journal/aggregate';
import type { PassRecord, SessionRecord } from '../../../services/practice-journal/types';

export interface JournalData {
  sessions: SessionRecord[];
  passes: PassRecord[];
  week: WeekStats;
  last: ContinueTarget | null;
  loading: boolean;
  refresh: () => void;
}

const EMPTY_WEEK: WeekStats = { minutes: 0, runs: 0, streak: 0, spark: [0, 0, 0, 0, 0, 0, 0] };

/** События, после которых журнал уже дописан — обновляемся в микротаске. */
const EVENTS = ['practice:ended', 'practice:completed-kept'];

export function useJournal(ownerId: string): JournalData {
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [passes, setPasses] = useState<PassRecord[]>([]);
  const [week, setWeek] = useState<WeekStats>(EMPTY_WEEK);
  const [last, setLast] = useState<ContinueTarget | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const rows = await getAllForOwner(ownerId);
      const nextSessions = rows.filter((r): r is SessionRecord => r.kind === 'session');
      const nextPasses = rows.filter((r): r is PassRecord => r.kind === 'pass');
      setSessions(nextSessions);
      setPasses(nextPasses);
      setWeek(weekStats(nextSessions));
      setLast(lastSession(nextSessions));
    } catch {
      setSessions([]);
      setPasses([]);
      setWeek(EMPTY_WEEK);
      setLast(null);
    } finally {
      setLoading(false);
    }
  }, [ownerId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const handler = () => {
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        void load();
      }, 0);
    };
    for (const event of EVENTS) document.addEventListener(event, handler);
    return () => {
      for (const event of EVENTS) document.removeEventListener(event, handler);
      if (timer !== null) clearTimeout(timer);
    };
  }, [load]);

  const refresh = useCallback(() => {
    void load();
  }, [load]);

  return { sessions, passes, week, last, loading, refresh };
}
