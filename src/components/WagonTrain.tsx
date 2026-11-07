import { useMemo, useRef, useEffect, useCallback, type CSSProperties } from 'react';
import { useBlocksStore } from '../stores/blocks.store';
import { useMarkersStore } from '../stores/markers.store';
import { useLyricsStore } from '../stores/lyrics.store';
import { getActiveBlock, getActiveSubBlockIndex } from '../utils/block-utils';
import { getTransport } from '../audio/engine-v3';
import { useLoopStore } from '../stores/loop.store';
import { useDeckStore } from '../stores/deck.store';
import { useTakesStore } from '../takes/takes.store';
import { MAX_SUB_BLOCK_LINES } from '../slot-matrix/slot-matrix.utils';
import type { TextBlock } from '../stores/blocks.store';
import styles from './WagonTrain.module.css';
import { BLOCK_TYPE_CONFIG, getBlockTypeConfig } from '../blocks/types';
import { interruptPracticeSession } from '../exercises/exercise.interruption';
import { useTrackMapStore } from '../trackmap/trackmap.store';
import { useTrackMapFx } from '../trackmap/use-trackmap-fx';
import { useLoopContourGeometry } from './useLoopContourGeometry';
import { LoopContour } from './LoopContour';
import { SubSegmentRow } from './SubSegmentRow';

export function WagonTrain() {
  const blocks = useBlocksStore(s => s.blocks);
  const markers = useMarkersStore(s => s.markers);
  const activeLineIndex = useLyricsStore(s => s.activeLineIndex);
  const lines = useLyricsStore(s => s.lines);
  const rootRef = useRef<HTMLDivElement>(null);
  const loopBlockIds = useLoopStore(s => s.loopBlockIds);
  const loopSubBlockKeys = useLoopStore(s => s.loopSubBlockKeys);
  const isLooping = useLoopStore(s => s.isLooping);
  const takesPanelActive = useDeckStore(s => s.activeTabId === 'takes' && s.expanded);
  const setActiveBlock = useTakesStore(s => s.setActiveBlock);

  // TrackMap control layer (see src/trackmap/) — dim mode, selection, startup blink.
  const dimMode = useTrackMapStore(s => s.dimMode);
  const selection = useTrackMapStore(s => s.selection);
  const fxRun = useTrackMapFx(blocks.length);

  // Единый контур петли — отдельный хук (Центр_2, 07.11): геометрия loop-вагонов
  // → массив силуэтов (заливка + обводка + верхняя кромка для искры прогресса).
  const loopShapes = useLoopContourGeometry(rootRef, [loopBlockIds.join(','), blocks.length]);

  // Exercise execution lock for WagonTrain guard - replaced with interruption model
  // REMOVED: exerciseLocked blanket check - now uses interruptPracticeSession()

  const activeBlock = useMemo(
    () => {
      // №17-K: пин блока записи — подсветка чипа держится на блоке записи
      const pinned = useTakesStore.getState().pinnedBlockId;
      if (pinned) {
        const held = blocks.find(b => b.id === pinned);
        if (held) return held;
      }
      return getActiveBlock(activeLineIndex, blocks);
    },
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

  // Publish height as CSS var (RehearsalLyrics reads it).
  // 706: WagonTrain may mount with blocks.length === 0 and render null, so the ref
  // is not ready and a []-effect would never run again. Re-publish when blocks
  // appear, and use offsetHeight (contentRect excludes the root padding).
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    const apply = () => {
      document.documentElement.style.setProperty(
        '--wagon-train-height', `${el.offsetHeight}px`
      );
    };

    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);

    return () => ro.disconnect();
  }, [blocks.length]);

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

  // Контур петли теперь считается в хуке useLoopContourGeometry (см. импорт выше).

  if (blocks.length === 0) return null;

  const handleWagonClick = (block: TextBlock) => {
    // №17-TRACE (449): ручной клик по чипу блока
    if (import.meta.env.DEV) console.log(`[CHIP-CLICK] ${block.id}`);
    // Interrupt practice first if active, then continue requested action
    interruptPracticeSession(() => {
      const firstLine = Math.min(...block.lineIndices);
      const marker = markers.find(m => m.lineIndex === firstLine);
      if (!marker) return;

      const loopStore = useLoopStore.getState();
      if (loopStore.isLooping) {
        loopStore.rebindToBlock(block);
      }

      const transport = getTransport();
      if (transport && transport.state !== 'idle' && ((window as any).__v3Active || transport.orchestrator.all().length > 0)) {
        void transport.seek(marker.time);
        // publishSeek идёт через _onSeek (V3StatePublisher) — не дублируем (#TASK-013.4)
      } else {
        try { getTransport()?.seek(marker.time) } catch {}
      }

      // If Takes panel is active (open and selected), select this block for recording
      if (takesPanelActive) {
        setActiveBlock(block.id, { fromUser: true });
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

      const transport = getTransport();
      if (transport && transport.state !== 'idle' && ((window as any).__v3Active || transport.orchestrator.all().length > 0)) {
        void transport.seek(marker.time);
        // publishSeek идёт через _onSeek (V3StatePublisher) — не дублируем (#TASK-013.4)
      } else {
        try { getTransport()?.seek(marker.time) } catch {}
      }

      // TASK-011 / №17-H: клик по субблоку тоже выбирает блок панели тейков
      // (паритет с handleWagonClick; находка юзера 22.08)
      if (takesPanelActive) {
        setActiveBlock(block.id, { fromUser: true });
      }
    });
  };

  const handleToggleSub = (block: TextBlock, subIndex: number) => {
    interruptPracticeSession(() => {
      const loopStore = useLoopStore.getState();
      loopStore.toggleSubBlock(block, subIndex, lines);
    });
  };

  return (
    <div
      ref={rootRef}
      className={styles.root}
      data-reactive="true"
      data-tm-fx={fxRun.fxId ?? undefined}
      data-tm-dim={dimMode === 'off' ? undefined : dimMode}
      data-tm-has-active={activeBlock ? 'true' : undefined}
      style={{
        '--tm-fx-k': fxRun.intensity,
        '--tm-fx-duration': fxRun.durationMs > 0 ? `${fxRun.durationMs}ms` : undefined,
      } as CSSProperties}
    >
      {blocks.map((block, i) => {
        const isActive = block.id === activeBlock?.id;
        const activeSubIdx = isActive ? activeSubBlockIndex : -1;

        // Loop state per wagon: 'in-loop' | 'adjacent' | 'idle'.
        // adjacent → the «+» badge lights up so the user can extend the loop.
        const loopState = getLoopToggleState(block.id);
        const loopJoin = (() => {
          if (loopState !== 'adjacent') return undefined;
          const hasLeft = loopBlockIds.some(id => blocks.findIndex(b => b.id === id) === i - 1);
          const hasRight = loopBlockIds.some(id => blocks.findIndex(b => b.id === id) === i + 1);
          if (hasLeft && hasRight) return 'both';
          if (hasLeft) return 'left';
          if (hasRight) return 'right';
          return undefined;
        })();

        return (
          <button
            key={block.id}
            className={styles.wagon}
            data-block-type={block.type}
            data-active={isActive || undefined}
            data-in-loop={loopBlockIds.includes(block.id) || undefined}
            data-loop-state={loopState}
            data-loop-join={loopJoin}
            data-tm-selected={selection.includes(block.id) || undefined}
            onClick={() => handleWagonClick(block)}
            title={block.name}
            style={{
              cursor: 'pointer',
              '--tm-color': getBlockTypeConfig(block.type).color,
              '--tm-fx-delay': `${fxRun.delays[i] ?? 0}ms`,
            } as CSSProperties}
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
            {/* Слой света: заливка + «лампочки под стеклом».
                Одна формула на два состояния — активный блок и презентация. */}
            <span className={styles.lamp} aria-hidden="true" />
            <SubSegmentRow
              block={block}
              lines={lines}
              isActive={isActive}
              activeSubIdx={activeSubIdx}
              inLoopBlock={loopBlockIds.includes(block.id)}
              loopSubBlockKeys={loopSubBlockKeys}
              onSubClick={handleSubBlockClick}
              onToggleSub={handleToggleSub}
            />
            <span
              role="button"
              tabIndex={0}
              className={styles.loopToggle}
              data-active={loopBlockIds.includes(block.id) || undefined}
              data-loop-state={loopState}
              onClick={(e) => {
                e.stopPropagation();
                interruptPracticeSession(() => {
                  const loopStore = useLoopStore.getState();
                  if (loopState === 'idle' && loopStore.isLooping) {
                    loopStore.replaceLoop(block);
                  } else {
                    loopStore.toggleBlock(block);
                  }
                });
              }}
              title={(() => {
                if (loopState === 'in-loop') return 'Remove from loop';
                if (loopState === 'adjacent') return 'Add to loop';
                return 'Start loop';
              })()}
              style={{
                cursor: 'pointer',
              }}
            >
              {/* Глиф рисуем, а не печатаем: шрифтовой «+» на 22px выглядит
                  рвано и не масштабируется. idle — ∞ текстом, остальное — CSS. */}
              {loopState === 'idle' ? (
                <span className={styles.loopInfinity} aria-hidden="true">∞</span>
              ) : (
                <span className={styles.loopGlyph} aria-hidden="true" />
              )}
            </span>
          </button>
        );
      })}
      <LoopContour shapes={loopShapes} />
    </div>
  );
}
