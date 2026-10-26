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
  appendPass,
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

  // practice:pass-complete (store:401)
  const onPassComplete = (): void => {
    const s = usePracticeStore.getState();
    void (async () => {
      await appendPass({ rate: s.currentRate, passIndex: s.passesCount, label: s.passLabel });
      await patchSession({ passes: s.passesCount, rateEnd: s.currentRate });
    })();
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
  const onCancelled = (): void => {
    clearPauseTimer();
    stopHeartbeat();
    void closeSession('cancelled');
  };

  // practice:paused (store:424) — пауза >30 мин → interrupted
  const onPaused = (): void => {
    markPaused();
    clearPauseTimer();
    pauseTimer = setTimeout(() => {
      pauseTimer = null;
      stopHeartbeat();
      void closeSession('interrupted');
    }, PAUSE_TIMEOUT_MS);
  };

  // practice:resumed (store:428)
  const onResumed = (): void => {
    clearPauseTimer();
    markResumed();
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
