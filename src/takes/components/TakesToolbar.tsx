import React from 'react';
import type { ViewMode } from '../takes.types';
import { getCanonicalBlockColor } from '../../structure/block-colors';

interface TakesToolbarProps {
  activeBlock: { id: string; name?: string; type: string } | null
  activeBlockId: string | null
  timeRange: { startTime: number; endTime: number } | null
  viewMode: ViewMode
  setViewMode: (mode: ViewMode) => void
  previewMode: 'solo' | 'context'
  setPreviewMode: (mode: 'solo' | 'context') => void
  compareMode: 'off' | 'ab'
  setCompareMode: (mode: 'off' | 'ab') => void
  exercisePlaybackLocked: boolean
  recipesOpen: boolean
  setRecipesOpen: (fn: (v: boolean) => boolean) => void
  activeExercise: unknown
  onInterrupt: (fn: () => void) => void
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * TakesToolbar — верхняя панель инструментов в Takes режиме.
 * Содержит блок info, scenario, compare, solo, I/V/M кнопки.
 */
export const TakesToolbar: React.FC<TakesToolbarProps> = ({
  activeBlock, activeBlockId, timeRange,
  viewMode, setViewMode,
  previewMode, setPreviewMode,
  compareMode, setCompareMode,
  exercisePlaybackLocked,
  recipesOpen, setRecipesOpen,
  activeExercise,
  onInterrupt,
}) => {
  if (!activeBlock || !timeRange) return null;

  return (
    <div
      data-no-seek
      style={{
        position: 'absolute',
        top: activeExercise ? 34 : 8,
        left: 8,
        right: 8,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        zIndex: 8,
        pointerEvents: 'auto',
      }}
    >
      {/* Block info chip */}
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '3px 8px',
          borderRadius: 999,
          background: 'rgba(0,0,0,0.48)',
          border: '1px solid rgba(255,255,255,0.07)',
          fontSize: 10,
          fontWeight: 700,
          color: 'rgba(255,255,255,0.72)',
          letterSpacing: '0.03em',
          pointerEvents: 'none',
        }}
      >
        <span style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: getCanonicalBlockColor(activeBlock.type),
          boxShadow: `0 0 10px ${getCanonicalBlockColor(activeBlock.type)}55`,
        }} />
        <span>{activeBlock.name || activeBlockId}</span>
        <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>
          {formatTime(timeRange.startTime)}—{formatTime(timeRange.endTime)}
        </span>
      </div>

      {/* Controls section */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {/* Scenario button */}
        <div style={{ position: 'relative' }}>
          <button
            data-no-seek
            onClick={(e) => {
              e.stopPropagation();
              onInterrupt(() => {
                if (exercisePlaybackLocked) return;
                setRecipesOpen((v) => !v);
              });
            }}
            disabled={exercisePlaybackLocked}
            style={{
              padding: '5px 14px',
              borderRadius: 6,
              border: `1px solid rgba(255,255,255,${recipesOpen ? '0.25' : '0.15'})`,
              background: recipesOpen ? 'rgba(255,255,255,0.10)' : 'transparent',
              color: exercisePlaybackLocked
                ? 'rgba(255,255,255,0.15)'
                : recipesOpen
                  ? 'rgba(255,255,255,0.95)'
                  : 'rgba(255,255,255,0.60)',
              fontSize: 11,
              fontWeight: 700,
              cursor: exercisePlaybackLocked ? 'not-allowed' : 'pointer',
              opacity: exercisePlaybackLocked ? 0.5 : 1,
            }}
            title={exercisePlaybackLocked ? 'Unavailable during exercise execution' : 'Scenario'}
          >
            Scenario
          </button>
        </div>

        <Divider />

        {/* Compare toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{
            fontSize: 9,
            color: 'rgba(255,255,255,0.3)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}>
            Compare
          </span>
          <button
            data-no-seek
            onClick={(e) => {
              e.stopPropagation();
              onInterrupt(() => {
                if (exercisePlaybackLocked) return;
                setCompareMode(compareMode === 'ab' ? 'off' : 'ab');
              });
            }}
            style={{
              padding: '3px 8px',
              borderRadius: 6,
              border: `1px solid ${compareMode === 'ab' ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.07)'}`,
              background: compareMode === 'ab' ? 'rgba(255,255,255,0.07)' : 'transparent',
              color: exercisePlaybackLocked
                ? 'rgba(255,255,255,0.15)'
                : compareMode === 'ab'
                  ? 'rgba(255,255,255,0.82)'
                  : 'rgba(255,255,255,0.36)',
              fontSize: 10,
              fontWeight: 700,
              cursor: exercisePlaybackLocked ? 'not-allowed' : 'pointer',
              opacity: exercisePlaybackLocked ? 0.5 : 1,
            }}
          >
            {compareMode === 'ab' ? 'On' : 'Off'}
          </button>
        </div>

        <Divider />

        {/* Solo toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button
            data-no-seek
            onClick={(e) => {
              e.stopPropagation();
              onInterrupt(() => {
                if (exercisePlaybackLocked) return;
                setPreviewMode(previewMode === 'solo' ? 'context' : 'solo');
              });
            }}
            style={{
              padding: '3px 10px',
              borderRadius: 6,
              border: `1px solid ${previewMode === 'solo' ? 'rgba(255,140,0,0.5)' : 'rgba(255,255,255,0.07)'}`,
              background: previewMode === 'solo' ? 'rgba(255,140,0,0.15)' : 'transparent',
              color: exercisePlaybackLocked
                ? 'rgba(255,255,255,0.15)'
                : previewMode === 'solo'
                  ? 'rgba(255,140,0,0.95)'
                  : 'rgba(255,255,255,0.45)',
              fontSize: 10,
              fontWeight: 700,
              cursor: exercisePlaybackLocked ? 'not-allowed' : 'pointer',
              opacity: exercisePlaybackLocked ? 0.5 : 1,
            }}
          >
            Solo
          </button>
        </div>

        <Divider />

        {/* I/V/M mode buttons */}
        <div style={{ display: 'flex', gap: 3 }}>
          {(['inst', 'voc', 'mix'] as const).map(m => (
            <button
              key={m}
              data-no-seek
              onClick={(e) => {
                e.stopPropagation();
                setViewMode(m);
              }}
              style={{
                width: 24,
                height: 24,
                borderRadius: 6,
                border: `1px solid ${viewMode === m ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)'}`,
                background: viewMode === m ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.48)',
                color: viewMode === m
                  ? (m === 'inst' ? '#d25555' : m === 'voc' ? '#4f8bff' : '#ccc')
                  : 'rgba(255,255,255,0.42)',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {m === 'inst' ? 'I' : m === 'voc' ? 'V' : 'M'}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

function Divider() {
  return (
    <div style={{
      width: 1,
      height: 24,
      background: 'rgba(255,255,255,0.07)',
    }} />
  );
}
