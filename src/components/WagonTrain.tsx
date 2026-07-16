import { useMemo, useRef, useEffect, useCallback } from 'react';
import { useBlocksStore } from '../stores/blocks.store';
import { useMarkersStore } from '../stores/markers.store';
import { useLyricsStore } from '../stores/lyrics.store';
import { getActiveBlock, createSubBlocks, getActiveSubBlockIndex } from '../utils/block-utils';
import { V2Adapter } from '../audio/engine-v3/V2Adapter';
import { useLoopStore } from '../stores/loop.store';
import { useDeckStore } from '../stores/deck.store';
import { useTakesStore } from '../takes/takes.store';
import { MAX_SUB_BLOCK_LINES } from '../slot-matrix/slot-matrix.utils';
import type { TextBlock } from '../stores/blocks.store';
import styles from './WagonTrain.module.css';
import { BLOCK_TYPE_CONFIG } from '../blocks/types';
import { interruptPracticeSession } from '../exercises/exercise.interruption';

export function WagonTrain() {
  const blocks = useBlocksStore(s => s.blocks);
  const markers = useMarkersStore(s => s.markers);
  const activeLineIndex = useLyricsStore(s => s.activeLineIndex);
  const lines = useLyricsStore(s => s.lines);
  const rootRef = useRef<HTMLDivElement>(null);
  const loopBlockIds = useLoopStore(s => s.loopBlockIds);
  const loopSubBlockKeys = useLoopStore(s => s.loopSubBlockKeys);
  const isLooping = useLoopStore(s => s.isLooping);
  const toggleBlock = useLoopStore(s => s.toggleBlock);
  const replaceLoop = useLoopStore(s => s.replaceLoop);
  const takesPanelActive = useDeckStore(s => s.activeTabId === 'takes' && s.expanded);
  const setActiveBlock = useTakesStore(s => s.setActiveBlock);

  // Exercise execution lock for WagonTrain guard - replaced with interruption model
  // REMOVED: exerciseLocked blanket check - now uses interruptPracticeSession()

  const activeBlock = useMemo(
    () => getActiveBlock(activeLineIndex, blocks),
    [activeLineIndex, blocks]
  );

  const activeSubBlockIndex = useMemo(() => {
    if (!activeBlock) return -1;
    return getActiveSubBlockIndex(activeLineIndex, activeBlock, MAX_SUB_BLOCK_LINES, lines);
  }, [activeLineIndex, activeBlock]);

  // Get loop toggle state: 'in-loop' | 'adjacent' | 'idle'
  const getLoopToggleState = useCallback((blockId: string): 'in-loop' | 'adjacent' | 'idle' => {
    if (loopBlockIds.includes(blockId)) return 'in-loop';
    if (!isLooping) return 'idle';
    const blockIdx = blocks.findIndex(b => b.id === blockId);
    const isAdjacent = loopBlockIds.some(id => {
      const idx = blocks.findIndex(b => b.id === id);
      return Math.abs(idx - blockIdx) === 1;
    });
    return isAdjacent ? 'adjacent' : 'idle';
  }, [loopBlockIds, isLooping, blocks]);

  // Publish height as CSS var (RehearsalLyrics reads it)
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      document.documentElement.style.setProperty(
        '--wagon-train-height', `${entry.contentRect.height}px`
      );
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      document.documentElement.style.removeProperty('--wagon-train-height');
    };
  }, []);

  // Auto-scroll to active wagon
  useEffect(() => {
    const el = rootRef.current;
    if (!el || !activeBlock) return;
    const active = el.querySelector('[data-active="true"]') as HTMLElement;
    if (active) {
      const left = active.offsetLeft - el.offsetWidth / 2 + active.offsetWidth / 2;
      el.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
    }
  }, [activeBlock?.id]);

  if (blocks.length === 0) return null;

  const handleWagonClick = (block: TextBlock) => {
    // Interrupt practice first if active, then continue requested action
    interruptPracticeSession(() => {
      const firstLine = Math.min(...block.lineIndices);
      const marker = markers.find(m => m.lineIndex === firstLine);
      if (!marker) return;

      const loopStore = useLoopStore.getState();
      if (loopStore.isLooping) {
        loopStore.rebindToBlock(block);
      }

      try { V2Adapter.getInstance().delegateSync('seekTo', marker.time) } catch {}

      // If Takes panel is active (open and selected), select this block for recording
      if (takesPanelActive) {
        setActiveBlock(block.id);
      }
    });
  };

  const handleSubBlockClick = (block: TextBlock, subFirstLineIndex: number) => {
    interruptPracticeSession(() => {
      const marker = markers.find(m => m.lineIndex === subFirstLineIndex);
      if (!marker) return;

      const loopStore = useLoopStore.getState();
      if (loopStore.isLooping) {
        loopStore.rebindToBlock(block);
      }

      try { V2Adapter.getInstance().delegateSync('seekTo', marker.time) } catch {}
    });
  };

  return (
    <div ref={rootRef} className={styles.root} data-reactive="true">
      {blocks.map((block, i) => {
        const subBlocks = createSubBlocks(block.lineIndices, MAX_SUB_BLOCK_LINES, lines);
        const isMulti = subBlocks.length > 1;
        const isActive = block.id === activeBlock?.id;
        const activeSubIdx = isActive ? activeSubBlockIndex : -1;

        return (
          <button
            key={block.id}
            className={styles.wagon}
            data-block-type={block.type}
            data-active={isActive || undefined}
            data-in-loop={loopBlockIds.includes(block.id) || undefined}
            data-has-sub-blocks={isMulti || undefined}
            onClick={() => handleWagonClick(block)}
            title={block.name}
            style={{
              opacity: 1,
              cursor: 'pointer',
            }}
          >
            <span className={styles.title}>
              {(() => {
                if (block.name && !block.name.match(/^Block \d+$/)) return block.name;
                if (block.type) {
                  const config = BLOCK_TYPE_CONFIG.find(c => c.type === block.type);
                  if (config) return config.label;
                }
                return block.name || 'Block';
              })()}
            </span>
            {isMulti && (
              <div className={styles.subSegments}>
                {subBlocks.map((sub, si) => (
                  <div
                    key={sub.id}
                    className={styles.subSegmentWrapper}
                    style={{ flex: sub.lineIndices.length }}
                  >
                    <div
                      className={styles.subSegment}
                      data-sub-active={isActive && si === activeSubIdx || undefined}
                      data-in-loop={loopSubBlockKeys.includes(`${block.id}:${si}`) || undefined}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSubBlockClick(block, sub.lineIndices[0]);
                      }}
                    />
                    {isLooping && loopBlockIds.includes(block.id) && (
                      <span
                        role="button"
                        tabIndex={0}
                        className={styles.subLoopToggle}
                        data-active={loopSubBlockKeys.includes(`${block.id}:${si}`) || undefined}
                        onClick={(e) => {
                          e.stopPropagation();
                          interruptPracticeSession(() => {
                            const loopStore = useLoopStore.getState();
                            loopStore.toggleSubBlock(block, si, lines);
                          });
                        }}
                        title="Loop sub-block"
                      >
                        {loopSubBlockKeys.includes(`${block.id}:${si}`) ? '−' : '+'}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
            <span
              role="button"
              tabIndex={0}
              className={styles.loopToggle}
              data-active={loopBlockIds.includes(block.id) || undefined}
              data-loop-state={getLoopToggleState(block.id)}
              onClick={(e) => {
                e.stopPropagation();
                interruptPracticeSession(() => {
                  const state = getLoopToggleState(block.id);
                  const loopStore = useLoopStore.getState();
                  if (state === 'idle' && loopStore.isLooping) {
                    loopStore.replaceLoop(block);
                  } else {
                    loopStore.toggleBlock(block);
                  }
                });
              }}
              title={(() => {
                const state = getLoopToggleState(block.id);
                if (state === 'in-loop') return 'Remove from loop';
                if (state === 'adjacent') return 'Add to loop';
                return 'Start loop';
              })()}
              style={{
                opacity: 1,
                cursor: 'pointer',
              }}
            >
              {(() => {
                const state = getLoopToggleState(block.id);
                if (state === 'in-loop') return '−';
                if (state === 'adjacent') return '+';
                return '∞';
              })()}
            </span>
          </button>
        );
      })}
    </div>
  );
}
