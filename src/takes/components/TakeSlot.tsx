import React from 'react';
import type { TakeMeta } from '../takes.types';
import { TakeControls } from './TakeControls';

interface TakeSlotProps {
  slot: number
  take: TakeMeta | null
  isEmpty: boolean
  isReady: boolean
  isBest: boolean
  isThisRec: boolean
  isPlaying: boolean
  isCurrentVisible: boolean
  compareMode: 'off' | 'ab'
  activeCompareSlot: number | null
  exercisePlaybackLocked: boolean
  isRecording: boolean
  countdown: number | null
  onRecord: (slot: number) => void
  onPlay: (takeId: string) => void
  onSelectCompare: (slot: number | null) => void
  onRetake?: () => void
  onStar?: () => void
  onDelete?: () => void
}

/**
 * TakeSlot — карточка одного take'а (слот).
 * Отображает пустой слот (приглашение к записи) или заполненный слот
 * с метаданными и кнопками управления.
 */
export const TakeSlot: React.FC<TakeSlotProps> = ({
  slot, take, isEmpty, isReady, isBest, isThisRec, isPlaying,
  isCurrentVisible, compareMode, activeCompareSlot, exercisePlaybackLocked,
  isRecording, countdown, onRecord, onPlay, onSelectCompare,
  onRetake, onStar, onDelete,
}) => {
  const handleClick = () => {
    if (exercisePlaybackLocked) return;
    if (isThisRec) return;
    if (isEmpty && !isRecording && countdown === null) {
      onSelectCompare(slot);
      onRecord(slot);
      return;
    }
    if (isReady) {
      onSelectCompare(slot);
      onPlay(take!.id);
    }
  };

  return (
    <div
      onClick={handleClick}
      onMouseEnter={(e) => {
        if (!isEmpty && !isThisRec && !exercisePlaybackLocked) {
          e.currentTarget.style.transform = 'scale(1.015) translateY(-6px)';
          e.currentTarget.style.boxShadow = '0 12px 32px rgba(0,0,0,0.55)';
          e.currentTarget.style.borderColor = isEmpty
            ? 'rgba(255,255,255,0.45)'
            : isBest
              ? 'rgba(0,200,83,0.85)'
              : 'rgba(255,140,0,0.85)';
        } else if (isEmpty && !exercisePlaybackLocked) {
          e.currentTarget.style.transform = 'translateY(-4px)';
          e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.48)';
          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.40)';
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'scale(1)';
        e.currentTarget.style.boxShadow = isPlaying
          ? `inset 0 0 0 2px ${isBest ? 'rgba(0,200,83,0.7)' : 'rgba(255,140,0,0.7)'}`
          : 'none';
        e.currentTarget.style.borderColor = isEmpty
          ? 'rgba(255,255,255,0.22)'
          : isBest
            ? 'rgba(0,200,83,0.55)'
            : isThisRec
              ? 'rgba(255,70,70,0.6)'
              : 'rgba(255,140,0,0.55)';
      }}
      style={{
        position: 'relative',
        width: 340,
        height: 64,
        borderRadius: 14,
        overflow: 'visible',
        cursor: (isReady || isEmpty) ? 'pointer' : 'default',
        border: `1px ${isEmpty ? 'dashed' : 'solid'} ${
          isEmpty ? 'rgba(255,255,255,0.22)'
            : isCurrentVisible ? 'rgba(100,200,255,0.8)'
            : isBest ? 'rgba(0,200,83,0.55)'
            : isThisRec ? 'rgba(255,70,70,0.6)'
            : 'rgba(255,140,0,0.55)'
        }`,
        background:
          isEmpty ? '#16171f'
          : isCurrentVisible ? 'rgba(100,200,255,0.06)'
          : isBest ? 'rgba(0,200,83,0.08)'
          : isThisRec ? 'rgba(255,70,70,0.08)'
          : 'rgba(255,140,0,0.08)',
        boxShadow: isPlaying
          ? `inset 0 0 0 2px ${isBest
              ? 'rgba(0,200,83,0.7)'
              : 'rgba(255,140,0,0.7)'}`
          : 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: isEmpty ? 'center' : 'flex-start',
        justifyContent: isEmpty ? 'center' : 'flex-end',
        padding: '8px 12px',
        transition: 'transform 0.15s ease-out, box-shadow 0.15s ease-out, border-color 0.15s ease-out',
        transform: 'scale(1)',
      }}
    >
      {isEmpty ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '8px 8px' }}>
          <span style={{
            fontSize: 15, color: 'rgba(255,255,255,0.65)', fontWeight: 800,
            letterSpacing: '0.03em',
          }}>
            Take {slot + 1}
          </span>
          <span style={{
            fontSize: 10, color: 'rgba(255,70,70,0.80)', fontWeight: 800,
            textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>
            ● Record
          </span>
        </div>
      ) : take ? (
        <FilledSlot
          take={take}
          slot={slot}
          isBest={isBest}
          isThisRec={isThisRec}
          isReady={isReady}
          isPlaying={isPlaying}
          compareMode={compareMode}
          activeCompareSlot={activeCompareSlot}
          exercisePlaybackLocked={exercisePlaybackLocked}
          onRetake={onRetake}
          onStar={onStar}
          onDelete={onDelete}
        />
      ) : null}
    </div>
  );
};

interface FilledSlotProps {
  take: TakeMeta
  slot: number
  isBest: boolean
  isThisRec: boolean
  isReady: boolean
  isPlaying: boolean
  compareMode: 'off' | 'ab'
  activeCompareSlot: number | null
  exercisePlaybackLocked: boolean
  onRetake?: () => void
  onStar?: () => void
  onDelete?: () => void
}

function FilledSlot({
  take, slot, isBest, isThisRec, isReady, isPlaying, compareMode,
  activeCompareSlot, exercisePlaybackLocked, onRetake, onStar, onDelete,
}: FilledSlotProps) {
  return (
    <>
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0,
        padding: '8px 14px',
        fontSize: 12, fontWeight: 800,
        color: 'rgba(255,255,255,0.88)',
        pointerEvents: 'none',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: 13, fontWeight: 900, whiteSpace: 'nowrap' }}>
          {isThisRec ? '● ' : ''}
          Take {slot + 1}
        </span>
        {compareMode === 'ab' && isBest && (
          <span style={{
            fontSize: 10, fontWeight: 800, color: 'rgba(247,201,72,0.98)',
            background: 'rgba(247,201,72,0.18)', padding: '3px 6px', borderRadius: 4,
            letterSpacing: '0.03em',
          }}>Ref</span>
        )}
        {compareMode === 'ab' && activeCompareSlot === slot && !isBest && (
          <span style={{
            fontSize: 10, fontWeight: 800, color: 'rgba(0,200,83,0.98)',
            background: 'rgba(0,200,83,0.18)', padding: '3px 6px', borderRadius: 4,
            letterSpacing: '0.03em',
          }}>Target</span>
        )}
        {compareMode === 'ab' && activeCompareSlot === slot && isBest && (
          <span style={{
            fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.98)',
            background: 'rgba(255,255,255,0.25)', padding: '3px 6px', borderRadius: 4,
            letterSpacing: '0.03em',
          }}>Ref+Target</span>
        )}
        {take?.tempoRate && take.tempoRate !== 1.0 && (
          <span style={{
            fontSize: 10, fontWeight: 800, color: 'rgba(100,200,255,0.98)',
            background: 'rgba(100,200,255,0.18)', padding: '3px 6px', borderRadius: 4,
            letterSpacing: '0.03em',
          }}>
            {Math.round(take.tempoRate * 100)}%
          </span>
        )}
      </div>
      {isReady && !isThisRec && (
        <TakeControls
          isBest={isBest}
          isPlaying={isPlaying}
          exercisePlaybackLocked={exercisePlaybackLocked}
          onRetake={onRetake}
          onStar={onStar}
          onDelete={onDelete}
        />
      )}
    </>
  );
}
