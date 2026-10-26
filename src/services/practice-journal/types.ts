/**
 * Practice Journal — типы записей журнала прогонов (MR-1, этап 1).
 * day = ЛОКАЛЬНАЯ дата YYYY-MM-DD (не toISOString — UTC-сдвиг).
 * ownerId = currentUser?.id ?? 'guest'.
 */

export type JournalKind = 'session' | 'pass';

export interface JournalBase {
  id: string;
  kind: JournalKind;
  at: number;
  day: string;
  ownerId: string;
  migrated?: boolean;
}

export interface SessionRecord extends JournalBase {
  kind: 'session';
  startedAt: number;
  endedAt: number | null;
  lastSeenAt: number;
  pausedMs: number;
  durationMs: number;
  status: 'open' | 'ended' | 'kept' | 'cancelled' | 'interrupted';
  trackId: string | null;
  trackTitle: string | null;
  trackArtist: string | null;
  scenarioId: string | null;
  blockId: string | null;
  blockType: string | null;
  label: string | null;
  passes: number;
  rateStart: number;
  rateEnd: number;
  reachedFull?: boolean;
}

export interface PassRecord extends JournalBase {
  kind: 'pass';
  sessionId: string;
  blockId: string | null;
  blockType: string | null;
  passIndex: number;
  rate: number;
  label: string | null;
}

export type JournalRecord = SessionRecord | PassRecord;
