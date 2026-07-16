import { useCallback } from 'react';
import { useWordSyncStore } from '../../stores/wordSync.store';

/**
 * useWordHighlight — хук для word highlighting логики.
 * Инкапсулирует проверки hasUsableWordSyncForLine и выбор активного слова.
 * Используется в RehearsalLyrics для определения data-reactive-words атрибутов.
 */
export function useWordHighlight() {
  const hasUsableWordSyncForLine = useCallback((lineIndex: number): boolean => {
    return useWordSyncStore.getState().hasUsableWordSyncForLine(lineIndex);
  }, []);

  const getActiveWordForLine = useCallback((lineIndex: number, currentTime: number) => {
    return useWordSyncStore.getState().getActiveWordForLine(lineIndex, currentTime);
  }, []);

  const getFillWordForLine = useCallback((lineIndex: number, currentTime: number) => {
    return useWordSyncStore.getState().getFillWordForLine(lineIndex, currentTime);
  }, []);

  return {
    hasUsableWordSyncForLine,
    getActiveWordForLine,
    getFillWordForLine,
  };
}
