import React from 'react';

interface TakeControlsProps {
  isBest: boolean
  isPlaying: boolean
  exercisePlaybackLocked: boolean
  onRetake?: () => void
  onStar?: () => void
  onDelete?: () => void
}

/**
 * TakeControls — hover action buttons for a take slot.
 * Renders retake (⟳), star (★/☆), and delete (✕) buttons.
 */
export const TakeControls: React.FC<TakeControlsProps> = ({
  isBest, exercisePlaybackLocked, onRetake, onStar, onDelete,
}) => {
  return (
    <div
      onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
      onMouseLeave={(e) => { e.currentTarget.style.opacity = '0'; }}
      style={{
        position: 'absolute',
        top: 5, right: 5,
        display: 'flex', gap: 4,
        zIndex: 3,
        opacity: exercisePlaybackLocked ? 0.3 : 0,
        transition: 'opacity 0.15s',
        pointerEvents: exercisePlaybackLocked ? 'none' : 'auto',
      }}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onRetake?.(); }}
        style={{
          width: 22, height: 22, borderRadius: 6,
          border: '1px solid rgba(255,255,255,0.10)',
          background: 'rgba(0,0,0,0.65)',
          color: 'rgba(255,70,70,0.82)',
          fontSize: 10, cursor: exercisePlaybackLocked ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: exercisePlaybackLocked ? 0.5 : 1,
        }}
        disabled={exercisePlaybackLocked}
        title={exercisePlaybackLocked ? 'Unavailable during exercise execution' : 'Retake'}
      >⟳</button>
      <button
        onClick={(e) => { e.stopPropagation(); onStar?.(); }}
        style={{
          width: 22, height: 22, borderRadius: 6,
          border: '1px solid rgba(255,255,255,0.10)',
          background: 'rgba(0,0,0,0.65)',
          color: isBest ? '#f7c948' : 'rgba(255,255,255,0.65)',
          fontSize: 12, cursor: exercisePlaybackLocked ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: exercisePlaybackLocked ? 0.5 : 1,
        }}
        disabled={exercisePlaybackLocked}
        title={exercisePlaybackLocked ? 'Unavailable during exercise execution' : 'Set reference'}
      >{isBest ? '★' : '☆'}</button>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete?.(); }}
        style={{
          width: 22, height: 22, borderRadius: 6,
          border: '1px solid rgba(255,255,255,0.10)',
          background: 'rgba(0,0,0,0.65)',
          color: 'rgba(255,255,255,0.65)',
          fontSize: 12, cursor: exercisePlaybackLocked ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: exercisePlaybackLocked ? 0.5 : 1,
        }}
        disabled={exercisePlaybackLocked}
        title={exercisePlaybackLocked ? 'Unavailable during exercise execution' : 'Delete take'}
      >✕</button>
    </div>
  );
};
