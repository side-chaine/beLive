import React from 'react';

/**
 * TakesList — отображает список take'ов для выбора и сравнения.
 * Используется как overlay внутри TakesPanel для навигации по take'ам.
 */

export interface TakesListProps {
  compareMode: 'off' | 'ab'
  activeCompareSlot: number | null
  onActiveCompareSlotChange: (slot: number | null) => void
}

export const TakesList: React.FC<TakesListProps> = () => {
  // TakesList is a container for take comparison.
  // The actual take slots are rendered by TakesControlStrip.
  // This component serves as the compare overlay coordinator.
  return null;
};
