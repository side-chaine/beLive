import { useBlocksStore } from '../../stores/blocks.store';
import { useMarkersStore } from '../../stores/markers.store';
import { useLyricsStore } from '../../stores/lyrics.store';
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

  return (
    <div className={styles.structureRow}>
      {blocks.map((block, i) => {
        const letter = BLOCK_TYPE_LETTER[block.type] || '?';
        const color = getBlockColor(block.type);
        const range = getBlockTimeRange(block, markers);
        const duration = range ? range.endTime - range.startTime : null;
        const isActive = block.id === activeBlockId;

        return (
          <span key={block.id || i} style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
              <span
                className={`${styles.structureBlock} ${isActive ? styles.active : ''}`}
                style={{
                  background: `${color}33`,
                  border: `1px solid ${color}66`,
                  color: color,
                }}
                title={`${block.name} (${block.type})`}
              >
                {letter}
              </span>
              {i < blocks.length - 1 && (
                <span className={styles.structureArrow}>→</span>
              )}
            </span>
            {duration !== null && (
              <span className={styles.blockDuration}>{formatDuration(duration)}</span>
            )}
          </span>
        );
      })}
    </div>
  );
}