import React from 'react';
import { QuestEntrySurface } from './QuestEntrySurface';

/**
 * RecipeCardPopover — Thin wrapper/transition shell around QuestEntrySurface.
 *
 * This component maintains backward compatibility with existing code that imports
 * RecipeCardPopover. It delegates to the new QuestEntrySurface foundation.
 *
 * Future: This can be removed once all call sites migrate to QuestEntrySurface directly.
 */
export const RecipeCardPopover: React.FC<{
  blockId: string;
  onClose: () => void;
}> = ({ blockId, onClose }) => {
  return <QuestEntrySurface blockId={blockId} onClose={onClose} visibility="stable" />;
};
