import { useBlocksStore } from '../../stores/blocks.store';
import { useMarkersStore } from '../../stores/markers.store';
import { useLyricsStore } from '../../stores/lyrics.store';
import { useTrackInfoStore } from '../../stores/trackInfo.store';
import { getBlockTimeRange } from '../../utils/block-time-range';
import { BLOCK_TYPE_CONFIG } from '../../blocks/types';
import styles from './TrackInfoBoard.module.css';

const BLOCK_TYPE_LETTER: Record<string, string> = {
  intro: 'I',
  verse: 'A',
  prechorus: 'P',
  chorus: 'B',
  bridge: 'C',
  interlude: 'L',
  outro: 'O',
  unknown: '?',
};

function getBlockColor(type: string): string {
  const config = BLOCK_TYPE_CONFIG.find(c => c.type === type);
  return config?.color || '#666';
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function StructureDiagram() {
  const blocks = useBlocksStore(s => s.blocks);
  const markers = useMarkersStore(s => s.markers);
  const activeLineIndex = useLyricsStore(s => s.activeLineIndex);

  if (!blocks || blocks.length === 0) {
    return <div className={styles.emptyState}>No blocks — open Block Editor</div>;
  }

  // Determine active block
  let activeBlockId: string | null = null;
  if (activeLineIndex >= 0) {
    for (const block of blocks) {
      if (block.lineIndices.includes(activeLineIndex)) {
        activeBlockId = block.id;
        break;
      }
    }
  }

  // Calculate proportional widths
  const totalDuration = blocks.reduce((sum, block) => {
    const range = getBlockTimeRange(block, markers);
    return sum + (range ? range.endTime - range.startTime : 0);
  }, 0);

  const blockData = blocks.map(block => {
    const range = getBlockTimeRange(block, markers);
    const duration = range ? range.endTime - range.startTime : 0;
    const widthPercent = totalDuration > 0
      ? (duration / totalDuration) * 100
      : (100 / blocks.length);
    return {
      block,
      letter: BLOCK_TYPE_LETTER[block.type] || '?',
      color: getBlockColor(block.type),
      duration,
      widthPercent,
      isActive: block.id === activeBlockId,
    };
  });

  // Empty state: no markers at all
  if (totalDuration === 0) {
    return (
      <div className={styles.structureContainer}>
        <div className={styles.emptyState}>No markers — open Sync Editor to set markers</div>
        <div className={styles.structureFormula}>
          {blockData.map((bd, i) => (
            <span key={i}>
              <span style={{ color: bd.color, fontWeight: 600 }}>{bd.letter}</span>
              {i < blockData.length - 1 && <span className={styles.formulaArrow}> → </span>}
            </span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.structureContainer}>
      {/* TrackMap label — simple, no SVG artifact */}
      <div className={styles.trackMapAnchor}>
        <span className={styles.anchorLabel}>▼ TrackMap</span>
      </div>

      {/* Timeline bar — proportional segments */}
      <div className={styles.timelineBar}>
        {blockData.map((bd, i) => (
          <div
            key={bd.block.id || i}
            className={`${styles.timelineBlock} ${bd.isActive ? styles.timelineActive : ''}`}
            style={{
              width: `${bd.widthPercent}%`,
              background: `${bd.color}15`,
              borderBottomColor: bd.color,
            }}
            onClick={() => {
              // Set clicked block context for AI Expert
              useTrackInfoStore.getState().setClickedBlockType(bd.block.type);
              const range = getBlockTimeRange(bd.block, markers);
              if (range) {
                const ae = (window as any).audioEngine;
                if (ae?.setCurrentTime) ae.setCurrentTime(range.startTime);
              }
            }}
            title={`${bd.block.name} (${bd.block.type}) ${bd.duration > 0 ? formatDuration(bd.duration) : ''}`}
          >
            <span className={styles.timelineLetter} style={{ color: bd.color }}>{bd.letter}</span>
            {bd.duration > 0 && bd.widthPercent > 8 && (
              <span className={styles.timelineTime} style={{ color: `${bd.color}99` }}>{formatDuration(bd.duration)}</span>
            )}
          </div>
        ))}
      </div>

      {/* Formula line */}
      <div className={styles.structureFormula}>
        {blockData.map((bd, i) => (
          <span key={i}>
            <span style={{ color: bd.color, fontWeight: 600 }}>{bd.letter}</span>
            {i < blockData.length - 1 && <span className={styles.formulaArrow}> → </span>}
          </span>
        ))}
      </div>
    </div>
  );
}
