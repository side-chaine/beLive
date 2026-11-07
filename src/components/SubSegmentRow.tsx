import { createSubBlocks } from '../utils/block-utils';
import { MAX_SUB_BLOCK_LINES } from '../slot-matrix/slot-matrix.utils';
import type { TextBlock } from '../stores/blocks.store';
import styles from './WagonTrain.module.css';

interface SubSegmentRowProps {
  block: TextBlock;
  lines: string[];
  isActive: boolean;
  activeSubIdx: number;
  /** Блок целиком в петле — тогда у суб-блоков доступны кнопки +/−. */
  inLoopBlock: boolean;
  loopSubBlockKeys: string[];
  onSubClick: (block: TextBlock, subFirstLineIndex: number) => void;
  onToggleSub: (block: TextBlock, subIndex: number) => void;
}

/**
 * Ряд суб-блоков — отдельный компонент (Центр_2, 07.11).
 * Суб-блоки управляются ОТДЕЛЬНО от петли блока: нейтральный белый цвет
 * (сегментация + плейхед), кнопки +/− тёмные. Они НЕ зеркалят петлю — никакого
 * янтаря, никакой пульсации в унисон с контуром.
 */
export function SubSegmentRow({
  block,
  lines,
  isActive,
  activeSubIdx,
  inLoopBlock,
  loopSubBlockKeys,
  onSubClick,
  onToggleSub,
}: SubSegmentRowProps) {
  const subBlocks = createSubBlocks(block.lineIndices, MAX_SUB_BLOCK_LINES, lines);
  if (subBlocks.length <= 1) return null;

  return (
    <div className={styles.subSegments}>
      {subBlocks.map((sub, si) => {
        const key = `${block.id}:${si}`;
        const active = isActive && si === activeSubIdx;
        const inSubLoop = loopSubBlockKeys.includes(key);
        return (
          <div
            key={sub.id}
            className={styles.subSegmentWrapper}
            style={{ flex: sub.lineIndices.length }}
          >
            <div
              className={styles.subSegment}
              data-sub-active={active || undefined}
              data-in-loop={inSubLoop || undefined}
              onClick={(e) => {
                e.stopPropagation();
                onSubClick(block, sub.lineIndices[0]);
              }}
            />
            {inLoopBlock && (
              <span
                role="button"
                tabIndex={0}
                className={styles.subLoopToggle}
                data-active={inSubLoop || undefined}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleSub(block, si);
                }}
                title="Loop sub-block"
              >
                {inSubLoop ? '−' : '+'}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
