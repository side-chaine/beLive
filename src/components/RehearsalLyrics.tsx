import React from 'react';
import { useEffect, useRef, useMemo, useCallback } from 'react';
import { useLyricsStore } from '../stores/lyrics.store';
import { useBlocksStore, type TextBlock } from '../stores/blocks.store';
import { useLoopStore } from '../stores/loop.store';
import {
  getActiveBlock,
  getNextBlock,
  getBlockFontSize,
} from '../utils/block-utils';
import styles from './RehearsalLyrics.module.css';

export function RehearsalLyrics() {
  const lines = useLyricsStore(s => s.lines);
  const activeLineIndex = useLyricsStore(s => s.activeLineIndex);
  const blocks = useBlocksStore(s => s.blocks);
  const activeRef = useRef<HTMLDivElement>(null);
  const prevBlockRef = useRef<TextBlock | null>(null);
  const isLooping = useLoopStore(s => s.isLooping);
  const loopBlockIds = useLoopStore(s => s.loopBlockIds);
  const loopStartLine = useLoopStore(s => s.loopStartLine);
  const loopEndLine = useLoopStore(s => s.loopEndLine);
  const setBoundaryLines = useLoopStore(s => s.setBoundaryLines);

  const hasBlocks = blocks.length > 0;

  const activeBlock = useMemo(
    () => getActiveBlock(activeLineIndex, blocks),
    [activeLineIndex, blocks]
  );

  const displayBlock = useMemo(() => {
    const candidate = activeBlock ?? (hasBlocks ? blocks[0] : null);
    if (!candidate) {
      prevBlockRef.current = null;
      return null;
    }
    const prev = prevBlockRef.current;
    if (prev && prev.id !== candidate.id) {
      if (prev.lineIndices.includes(activeLineIndex)) {
        return prev;
      }
    }
    prevBlockRef.current = candidate;
    return candidate;
  }, [activeBlock, hasBlocks, blocks, activeLineIndex]);

  const nextBlock = useMemo(
    () => getNextBlock(displayBlock, blocks),
    [displayBlock, blocks]
  );

  useEffect(() => {
    if (!displayBlock && activeRef.current) {
      activeRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeLineIndex, displayBlock]);

  const handleBoundaryDrag = useCallback((type: 'start' | 'end', e: React.PointerEvent) => {
    if (!displayBlock || loopStartLine === null || loopEndLine === null) return;
    e.preventDefault();
    const container = e.currentTarget.parentElement;
    if (!container) return;
    const lines = container.querySelectorAll('[data-line-index]');
    const lineEls = Array.from(lines) as HTMLElement[];

    const onMove = (ev: PointerEvent) => {
      let closest = -1;
      let minDist = Infinity;
      lineEls.forEach(el => {
        const rect = el.getBoundingClientRect();
        const center = rect.top + rect.height / 2;
        const dist = Math.abs(ev.clientY - center);
        if (dist < minDist) {
          minDist = dist;
          closest = Number(el.dataset.lineIndex);
        }
      });
      if (closest < 0) return;
      if (type === 'start') {
        const newStart = Math.min(closest, loopEndLine!);
        if (newStart !== loopStartLine) setBoundaryLines(newStart, loopEndLine!);
      } else {
        const newEnd = Math.max(closest, loopStartLine!);
        if (newEnd !== loopEndLine) setBoundaryLines(loopStartLine!, newEnd);
      }
    };

    const onUp = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  }, [displayBlock, loopStartLine, loopEndLine, setBoundaryLines]);

  const loopLineRange = useMemo(() => {
    if (!isLooping || loopBlockIds.length === 0) return null;
    const loopBlocks = blocks.filter(b => loopBlockIds.includes(b.id));
    if (loopBlocks.length === 0) return null;
    const allIndices = loopBlocks.flatMap(b => b.lineIndices);
    return { min: Math.min(...allIndices), max: Math.max(...allIndices) };
  }, [isLooping, loopBlockIds, blocks]);

  if (lines.length === 0) return null;

  if (displayBlock) {
    const fontSize = getBlockFontSize(displayBlock.lineIndices.length);
    return (
      <div className={styles.root} data-reactive="true">
        <div className={styles.activeBlock} style={{ fontSize }}>
          {displayBlock.lineIndices.map((li, idx) => {
            const showStartBefore = isLooping && loopStartLine === li;
            const showEndAfter = isLooping && loopEndLine === li;
            const isOutOfLoop = isLooping && loopStartLine !== null && loopEndLine !== null && (li < loopStartLine || li > loopEndLine);
            return (
              <React.Fragment key={li}>
                {showStartBefore && (
                  <div
                    className={styles.loopBoundary}
                    onPointerDown={(e) => handleBoundaryDrag('start', e)}
                  />
                )}
                <div
                  data-line-index={li}
                  className={`${styles.line}${isOutOfLoop ? ` ${styles.lineOutOfLoop}` : ''}`}
                  data-active={li === activeLineIndex}
                  data-block-type={displayBlock.type}
                >
                  {lines[li] ?? ''}
                </div>
                {showEndAfter && (
                  <div
                    className={styles.loopBoundary}
                    onPointerDown={(e) => handleBoundaryDrag('end', e)}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {nextBlock && (
          <div className={styles.nextPreview}>
            <div className={styles.previewLine}>
              {lines[nextBlock.lineIndices[0]] ?? ''}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={styles.root} data-reactive="true">
      <div className={styles.scrollContainer}>
        {lines.map((text, i) => (
          <div
            key={i}
            ref={i === activeLineIndex ? activeRef : undefined}
            className={styles.line}
            data-active={i === activeLineIndex}
          >
            {text}
          </div>
        ))}
      </div>
    </div>
  );
}
