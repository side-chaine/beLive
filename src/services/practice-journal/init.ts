/**
 * Practice Journal — хуки на document-события практики (MR-1, этап 1).
 * Подписка на document, НЕ на EventBus (LEGACY_EVENT_MAP неполон).
 * Все записи best-effort: ошибка журнала не ломает практику.
 */

import { usePracticeStore } from '../../stores/practice-session.store';
import { useBlocksStore } from '../../stores/blocks.store';
import { useTrackStore } from '../../stores/track.store';
import {
  appendSession,
  appendPassAndPatch,
  patchSession,
  closeSession,
  heartbeat,
  markPaused,
  markResumed,
  prune,
  closeStale,
} from './idb';

const HEARTBEAT_MS = 30_000;
const PAUSE_TIMEOUT_MS = 30 * 60_000;

/** MR-4a Q2: detail из CustomEvent стора; getState() — fallback. */
function detailOf(e: Event): Record<string, unknown> {
  const d = (e as CustomEvent<unknown>).detail;
  return d && typeof d === 'object' ? (d as Record<string, unknown>) : {};
}

function numOf(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

export function init(): () => void {
  if (typeof document === 'undefined') return () => {};

  let heartbeatId: ReturnType<typeof setInterval> | null = null;
  let pauseTimer: ReturnType<typeof setTimeout> | null = null;

  const startHeartbeat = (): void => {
    if (heartbeatId !== null) return;
    heartbeatId = setInterval(() => {
      void heartbeat();
    }, HEARTBEAT_MS);
  };

  const stopHeartbeat = (): void => {
    if (heartbeatId === null) return;
    clearInterval(heartbeatId);
    heartbeatId = null;
  };

  const clearPauseTimer = (): void => {
    if (pauseTimer === null) return;
    clearTimeout(pauseTimer);
    pauseTimer = null;
  };

  // practice:started (store:245)
  const onStarted = (): void => {
    const s = usePracticeStore.getState();
    const track = useTrackStore.getState().currentTrack;
    const block = s.targetBlockId
      ? useBlocksStore.getState().blocks.find((b) => b.id === s.targetBlockId) ?? null
      : null;

    void appendSession({
      scenarioId: s.scenarioId,
      blockId: s.targetBlockId ?? null,
      blockType: block?.type ?? null,
      label: s.label,
      rateStart: s.currentRate,
      trackId: track?.id ?? null,
      trackTitle: track?.title ?? null,
      trackArtist: track?.artist ?? null,
    });

    clearPauseTimer();
    startHeartbeat();
  };

  // practice:pass-complete (store:401) — Q1: pass+патч ОДНОЙ транзакцией
  const onPassComplete = (e: Event): void => {
    const s = usePracticeStore.getState();
    const d = detailOf(e);
    const rate = numOf(d.currentRate) ?? s.currentRate;
    const passIndex = numOf(d.passesCount) ?? s.passesCount;
    const label =
      d.passLabel === null || typeof d.passLabel === 'string'
        ? (d.passLabel as string | null)
        : s.passLabel;
    void appendPassAndPatch({ rate, passIndex, label }, { passes: passIndex, rateEnd: rate });
  };

  // practice:completed (store:412) — НЕ закрываем, isActive ещё true
  const onCompleted = (): void => {
    void patchSession({ reachedFull: true });
  };

  // practice:completed-kept (store:281)
  const onCompletedKept = (): void => {
    clearPauseTimer();
    stopHeartbeat();
    void closeSession('kept');
  };

  // practice:ended (store:267)
  const onEnded = (): void => {
    clearPauseTimer();
    stopHeartbeat();
    void closeSession('ended');
  };

  // practice:cancelled (store:298) — close читает кэш; нет кэша → no-op
  // (в списках refresh-событий useJournal:24 — с MR-4a тоже)
  const onCancelled = (): void => {
    clearPauseTimer();
    stopHeartbeat();
    void closeSession('cancelled');
  };

  // practice:paused (store:424) — пауза >30 мин → interrupted
  const onPaused = (e: Event): void => {
    markPaused(numOf(detailOf(e).at) ?? Date.now());
    clearPauseTimer();
    pauseTimer = setTimeout(() => {
      pauseTimer = null;
      stopHeartbeat();
      void closeSession('interrupted');
    }, PAUSE_TIMEOUT_MS);
  };

  // practice:resumed (store:428)
  const onResumed = (e: Event): void => {
    clearPauseTimer();
    markResumed(numOf(detailOf(e).at) ?? Date.now());
  };

  const handlers: Array<[string, EventListener]> = [
    ['practice:started', onStarted],
    ['practice:pass-complete', onPassComplete],
    ['practice:completed', onCompleted],
    ['practice:completed-kept', onCompletedKept],
    ['practice:ended', onEnded],
    ['practice:cancelled', onCancelled],
    ['practice:paused', onPaused],
    ['practice:resumed', onResumed],
  ];

  for (const [type, handler] of handlers) document.addEventListener(type, handler);

  // Boot: ретеншен + закрытие «живых» open старше 2ч
  void prune();
  void closeStale();

  return () => {
    for (const [type, handler] of handlers) document.removeEventListener(type, handler);
    clearPauseTimer();
    stopHeartbeat();
  };
}
