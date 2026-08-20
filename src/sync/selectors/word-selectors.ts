import { useWordSyncStore } from '../../stores/wordSync.store';

/**
 * word-selectors — чистые селекторы для word sync store.
 * Вынесены из RehearsalLyrics для повторного использования.
 */

/** Проверить, доступен ли word sync для указанной строки. */
export function hasUsableWordSync(lineIndex: number): boolean {
  return useWordSyncStore.getState().hasUsableWordSyncForLine(lineIndex);
}

/** Получить активное слово для строки (с опережением). */
export function getActiveWord(lineIndex: number, currentTime: number) {
  return useWordSyncStore.getState().getActiveWordForLine(lineIndex, currentTime);
}

/** Получить fill-слово для строки (точное совпадение). */
export function getFillWord(lineIndex: number, currentTime: number) {
  return useWordSyncStore.getState().getFillWordForLine(lineIndex, currentTime);
}

/** Получить слова для строки. */
export function getWordsForLine(lineIndex: number) {
  return useWordSyncStore.getState().getWordsForLine(lineIndex);
}
