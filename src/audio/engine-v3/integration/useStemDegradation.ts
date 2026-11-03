import { useCallback, useEffect, useState } from 'react'

export interface DegradedStem {
  stemId: string
  error: string
}

export interface StemDegradationState {
  /** Список стемов, чья загрузка в WASM упала (после retry). Пусто = всё ок. */
  degradedStems: DegradedStem[]
  /** Флаг «трек загрузился не полностью» (событие belive:track-load-failed, 0/N). */
  trackLoadFailed: boolean
  /** Ручной сброс (крестик). Не блокирует воспроизведение — в отличие от AudioCrashModal. */
  clear: () => void
}

const STEM_EVENT = 'belive:stem-degraded'
const TRACK_FAIL_EVENT = 'belive:track-load-failed'
const TRACK_CHANGE_EVENT = 'before-track-change'

/**
 * C1–C3 (PR-2, собрано 707 вручную): видимая деградация вместо «STEM SILENT».
 * Консьюмер-сторона событий, которые шлёт ядро PR-2 (HybridPipelineService /
 * V3DataInterceptor): показываем НЕМОДАЛЬНЫЙ баннер, а не AudioCrashModal, и
 * сбрасываем его на смену трека (before-track-change).
 *
 * Чистая логика (addDegradedStem / mergeTrackLoadFailed) вынесена отдельно и
 * покрыта юнит-тестами — это обходит limitation vitest/jsdom, где window НЕ
 * является реальным EventTarget и кастомные события не доходят до слушателей.
 */

/** Добавить стем в список деградации; дедуп по stemId (повтор не дублируется). */
export function addDegradedStem(
  prev: DegradedStem[],
  stemId: string,
  error: string,
): DegradedStem[] {
  return prev.some((s) => s.stemId === stemId)
    ? prev
    : [...prev, { stemId, error }]
}

/** C2: трек загрузился не полностью — флаг + (опц.) список упавших стемов. */
export function mergeTrackLoadFailed(
  prev: DegradedStem[],
  failedStemIds: string[] = [],
): { trackLoadFailed: boolean; degradedStems: DegradedStem[] } {
  const next = [...prev]
  for (const id of failedStemIds) {
    if (!next.some((s) => s.stemId === id)) next.push({ stemId: id, error: 'decode failed' })
  }
  return { trackLoadFailed: true, degradedStems: next }
}

export function useStemDegradation(): StemDegradationState {
  const [degradedStems, setDegradedStems] = useState<DegradedStem[]>([])
  const [trackLoadFailed, setTrackLoadFailed] = useState(false)

  const clear = useCallback(() => {
    setDegradedStems([])
    setTrackLoadFailed(false)
  }, [])

  useEffect(() => {
    const onStemDegraded = (e: Event) => {
      const detail = (e as CustomEvent).detail as { stemId?: string; error?: string } | undefined
      const stemId = detail?.stemId
      if (!stemId) return
      setDegradedStems((prev) => addDegradedStem(prev, stemId, detail?.error ?? 'unknown'))
    }

    const onTrackFailed = (e: Event) => {
      // C2: НЕ блокируем трек целиком — просто подсвечиваем баннером.
      const detail = (e as CustomEvent).detail as { failedStemIds?: string[] } | undefined
      setTrackLoadFailed(true)
      const failed = detail?.failedStemIds ?? []
      if (failed.length) {
        setDegradedStems((prev) => mergeTrackLoadFailed(prev, failed).degradedStems)
      }
    }

    // C1: сброс баннера при смене трека.
    const onTrackChange = () => clear()

    window.addEventListener(STEM_EVENT, onStemDegraded)
    window.addEventListener(TRACK_FAIL_EVENT, onTrackFailed)
    document.addEventListener(TRACK_CHANGE_EVENT, onTrackChange)
    return () => {
      window.removeEventListener(STEM_EVENT, onStemDegraded)
      window.removeEventListener(TRACK_FAIL_EVENT, onTrackFailed)
      document.removeEventListener(TRACK_CHANGE_EVENT, onTrackChange)
    }
  }, [clear])

  return { degradedStems, trackLoadFailed, clear }
}
