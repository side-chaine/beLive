// ============================================================
// src/services/playback-orchestrator.service.ts
// Reference-counting lifecycle for PlaybackVisualScheduler.
//
// Scheduler работает пока есть активные клиенты (acquire > release).
// Прямой вызов scheduler.start()/stop() — deprecated, используй acquire/release.
// ============================================================

import { getPlaybackVisualScheduler } from '../playback'

export type SchedulerClientId =
  | 'trigger'
  | 'stem-reactive'
  | 'audio-reactive'
  | 'billy'

const held = new Set<SchedulerClientId>()

function getScheduler() {
  return getPlaybackVisualScheduler()
}

/**
 * Запросить работу scheduler'а.
 * Idempotent: повторный acquire того же клиента не меняет состояние.
 * Если это первый клиент — scheduler запускается.
 */
export function acquire(client: SchedulerClientId): void {
  if (held.has(client)) {
    if (import.meta.env.DEV) console.log(`[PVO] acquire(${client}) — déjà détenu, ignoré`)
    return
  }
  const wasEmpty = held.size === 0
  held.add(client)
  if (wasEmpty) {
    getScheduler().start()
  }
  if (import.meta.env.DEV) console.log(`[PVO] acquire(${client}) — déteneurs=${held.size}`)
}

/**
 * Отказаться от scheduler'а.
 * Если после release не осталось клиентов — scheduler останавливается.
 */
export function release(client: SchedulerClientId): void {
  if (!held.has(client)) {
    if (import.meta.env.DEV) console.warn(`[PVO] release(${client}) — pas détenu, ignoré`)
    return
  }
  held.delete(client)
  if (held.size === 0) {
    getScheduler().stop()
  }
  if (import.meta.env.DEV) console.log(`[PVO] release(${client}) — déteneurs=${held.size}`)
}

/** Для диагностики: список активных клиентов */
export function getActiveAcquirers(): readonly SchedulerClientId[] {
  return [...held]
}

/** Количество активных клиентов */
export function getAcquireCount(): number {
  return held.size
}

/** Полный сброс (для HMR / тестов) */
export function disposePlaybackOrchestrator(): void {
  if (held.size > 0) {
    getScheduler().stop()
    held.clear()
  }
}
