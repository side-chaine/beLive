import React from 'react';

interface UseTakeDeleteOptions {
  activeBlockId: string;
  blockTakes: any; // BlockTakes type
  playingTakeId: string | null;
  stopPreview: (options?: { pauseEngine?: boolean }) => void;
  activeCompareSlot: number | null;
  onActiveCompareSlotChange?: (slot: number | null) => void;
  deleteTake: (blockId: string, slot: number) => void;
}

interface UseTakeDeleteReturn {
  handleDeleteSlot: (slot: number) => void;
}

const PLAYING_REFERENCE_ID = '__reference__';

export function useTakeDelete({
  activeBlockId,
  blockTakes,
  playingTakeId,
  stopPreview,
  activeCompareSlot,
  onActiveCompareSlotChange,
  deleteTake,
}: UseTakeDeleteOptions): UseTakeDeleteReturn {
  const handleDeleteSlot = React.useCallback((slot: number) => {
    const take = blockTakes?.takes[slot] ?? null;
    if (!take) return;

    const isDeletingPlayingTake =
      playingTakeId === take.id;

    const isDeletingPlayingReference =
      typeof PLAYING_REFERENCE_ID !== 'undefined' &&
      playingTakeId === PLAYING_REFERENCE_ID &&
      blockTakes?.selectedSlot === slot;

    if (isDeletingPlayingTake || isDeletingPlayingReference) {
      stopPreview({ pauseEngine: true });
    }

    if (activeCompareSlot === slot) {
      onActiveCompareSlotChange?.(null);
    }

    deleteTake(activeBlockId, slot);
  }, [
    blockTakes,
    playingTakeId,
    stopPreview,
    activeCompareSlot,
    onActiveCompareSlotChange,
    deleteTake,
    activeBlockId,
  ]);

  return {
    handleDeleteSlot,
  };
}
