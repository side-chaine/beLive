import { useMemo, useRef, useEffect } from 'react';
import { useBlocksStore } from '../stores/blocks.store';
import { useMarkersStore } from '../stores/markers.store';
import { useLyricsStore } from '../stores/lyrics.store';
import { getActiveBlock } from '../utils/block-utils';
import { useLoopStore } from '../stores/loop.store';
import type { TextBlock } from '../stores/blocks.store';
import styles from './WagonTrain.module.css';

export function WagonTrain() {
  const blocks = useBlocksStore(s => s.blocks);
  const markers = useMarkersStore(s => s.markers);
  const activeLineIndex = useLyricsStore(s => s.activeLineIndex);
  const lines = useLyricsStore(s => s.lines);
  const rootRef = useRef<HTMLDivElement>(null);
  const loopBlockIds = useLoopStore(s => s.loopBlockIds);
  const toggleBlock = useLoopStore(s => s.toggleBlock);

  const activeBlock = useMemo(
    () => getActiveBlock(activeLineIndex, blocks),
    [activeLineIndex, blocks]
  );

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
    const firstLine = Math.min(...block.lineIndices);
    const marker = markers.find(m => m.lineIndex === firstLine);
    if (marker) {
      (window as any).audioEngine?.setCurrentTime?.(marker.time);
    }
  };

  return (
    <div ref={rootRef} className={styles.root} data-reactive="true">
      {blocks.map((block, i) => (
        <button
          key={block.id}
          className={styles.wagon}
          data-block-type={block.type}
          data-active={block.id === activeBlock?.id}
          data-in-loop={loopBlockIds.includes(block.id)}
          onClick={() => handleWagonClick(block)}
          title={block.name}
        >
          <span className={styles.index}>{i + 1}</span>
          <span className={styles.title}>
            {block.name.startsWith('Block ') && lines[block.lineIndices[0]]
              ? lines[block.lineIndices[0]].substring(0, 30)
              : block.name}
          </span>
          <span
            role="button"
            tabIndex={0}
            className={styles.loopToggle}
            data-active={loopBlockIds.includes(block.id)}
            onClick={(e) => {
              e.stopPropagation();
              toggleBlock(block);
            }}
            title="Loop"
          >
            {loopBlockIds.includes(block.id) ? '−' : '+'}
          </span>
        </button>
      ))}
    </div>
  );
}
