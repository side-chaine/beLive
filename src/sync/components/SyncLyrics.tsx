import React, { useRef, useEffect, useMemo } from 'react';
import { useLyricsStore } from '../../stores/lyrics.store';
import { useMarkersStore } from '../../stores/markers.store';
import { useBlocksStore } from '../../stores/blocks.store';
import { useAudioStore } from '../../stores/audio.store';
import { useWordSyncStore } from '../../stores/wordSync.store';

const BLOCK_COLORS: Record<string, string> = {
  verse: '#4CAF50',
  chorus: '#F44336',
  bridge: '#6f42c1',
  prechorus: '#FF9800',
  'pre-chorus': '#FF9800',
  intro: '#03A9F4',
  outro: '#9E9E9E',
  hook: '#e91e63',
  default: '#888888',
};

function getBlockTypeForLine(
  lineIndex: number,
  blocks: Array<{ lineIndices: number[]; type?: string }>
): string {
  for (const block of blocks) {
    if (block.lineIndices.includes(lineIndex)) {
      return (block.type || 'default').toLowerCase().replace(/[\s\-_]/g, '');
    }
  }
  return 'default';
}

export function SyncLyrics() {
  const lines = useLyricsStore((s) => s.lines);
  const activeLineIndex = useLyricsStore((s) => s.activeLineIndex);
  const markers = useMarkersStore((s) => s.markers);
  const blocks = useBlocksStore((s) => s.blocks);
  const activeRef = useRef<HTMLDivElement>(null);
  const currentTime = useAudioStore((s) => s.currentTime);
  const isPlaying = useAudioStore((s) => s.isPlaying);
  const getWordsForLine = useWordSyncStore((s) => s.getWordsForLine);
  const hasUsableWordSyncForLine = useWordSyncStore((s) => s.hasUsableWordSyncForLine);
  const getActiveWordForLine = useWordSyncStore((s) => s.getActiveWordForLine);
  const wordSyncStatus = useWordSyncStore((s) => s.status);
  const alignmentData = useWordSyncStore((s) => s.alignmentData);

  const markedLines = useMemo(() => {
    const set = new Set<number>();
    for (const m of markers) {
      if (m.lineIndex != null) set.add(m.lineIndex);
    }
    return set;
  }, [markers]);

  // Legacy pattern: scrollIntoView smooth to top
  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
        inline: 'nearest',
      });
    }
  }, [activeLineIndex]);

  if (!lines || lines.length === 0) return null;

  return (
    <div
      className="sync-lyrics"
      style={{
        position: 'fixed',
        top: 'var(--react-header-height, 56px)',
        left: 0,
        right: 0,
        bottom: 'var(--bl-deck-height, 240px)',
        overflowY: 'auto',
        overflowX: 'hidden',
        padding: '20px 32px 200px 32px',
        zIndex: 50,
        pointerEvents: 'none',
        background: 'rgba(0, 0, 0, 0.6)',
        scrollBehavior: 'smooth',
      }}
    >
      <div
        style={{
          position: 'fixed',
          top: 'calc(var(--react-header-height, 56px) + 8px)',
          right: '12px',
          zIndex: 60,
          pointerEvents: 'none',
          fontFamily: 'monospace',
          fontSize: '10px',
          lineHeight: 1.4,
          color: 'rgba(255,255,255,0.85)',
          background: 'rgba(0,0,0,0.55)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '8px',
          padding: '6px 8px',
          whiteSpace: 'pre-wrap',
        }}
      >
        {[
          `play=${isPlaying ? '1' : '0'}`,
          `time=${currentTime.toFixed(2)}`,
          `activeLine=${activeLineIndex}`,
          `markers=${markers.length}`,
          `ws=${wordSyncStatus}`,
          `align=${alignmentData ? alignmentData.lines.length : 0}`,
        ].join('  ')}
      </div>
      {lines.map((line, idx) => {
        const isActive = idx === activeLineIndex;
        const isMarked = markedLines.has(idx);
        const blockType = getBlockTypeForLine(idx, blocks);
        const color = BLOCK_COLORS[blockType] || BLOCK_COLORS.default;
        const isPast = idx < activeLineIndex;
        const hasWordSync = hasUsableWordSyncForLine(idx);
        const words = hasWordSync ? getWordsForLine(idx) : [];
        const activeWord = isActive && hasWordSync
          ? getActiveWordForLine(idx, currentTime)
          : null;

        return (
          <div
            key={idx}
            ref={isActive ? activeRef : null}
            className={`lyric-line${isActive ? ' active' : ''}`}
            data-index={idx}
            data-line-index={idx}
            style={{
              textAlign: 'center',
              fontSize: isActive ? '36px' : '28px',
              fontWeight: isActive ? 700 : 400,
              lineHeight: '1.5',
              padding: '8px 0',
              transition: 'color 0.3s ease, opacity 0.3s ease',
              color: isMarked
                ? color
                : isActive
                ? '#ffffff'
                : 'rgba(255, 255, 255, 0.35)',
              opacity: isPast
                ? 0.25
                : isActive
                ? 1
                : 0.6,
              textShadow: isActive && isMarked
                ? `0 0 12px ${color}`
                : 'none',
            }}
          >
            {isActive ? (
              <span
                style={{
                  display: 'block',
                  fontSize: '10px',
                  lineHeight: 1.2,
                  color: 'rgba(255,255,255,0.45)',
                  marginBottom: '4px',
                }}
              >
                {`idx=${idx} hasWS=${hasWordSync ? 1 : 0} words=${words.length} activeWord=${activeWord?.text ?? 'null'}`}
              </span>
            ) : null}
            {isActive && hasWordSync && words.length > 0 ? (
              words.map((word, wordIdx) => {
                const isActiveWord = activeWord?.id === word.id;
                return (
                  <span
                    key={word.id || `${idx}-${wordIdx}`}
                    data-word-index={word.wordIndex}
                    style={{
                      color: isActiveWord ? '#ffffff' : undefined,
                      textShadow: isActiveWord
                        ? `0 0 14px ${isMarked ? color : '#ffffff'}`
                        : undefined,
                      transition: 'color 0.12s linear, text-shadow 0.12s linear',
                      marginRight: '0.25em',
                    }}
                  >
                    {word.text}
                  </span>
                );
              })
            ) : (
              line
            )}
          </div>
        );
      })}
    </div>
  );
}
