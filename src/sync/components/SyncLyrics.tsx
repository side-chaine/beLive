import React, { useRef, useEffect, useMemo } from 'react';
import { useLyricsStore } from '../../stores/lyrics.store';
import { useMarkersStore } from '../../stores/markers.store';
import { useBlocksStore } from '../../stores/blocks.store';

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
      {lines.map((line, idx) => {
        const isActive = idx === activeLineIndex;
        const isMarked = markedLines.has(idx);
        const blockType = getBlockTypeForLine(idx, blocks);
        const color = BLOCK_COLORS[blockType] || BLOCK_COLORS.default;
        const isPast = idx < activeLineIndex;

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
            {line}
          </div>
        );
      })}
    </div>
  );
}
