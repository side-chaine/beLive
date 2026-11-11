import { useMemo, useRef, useEffect, useCallback, type CSSProperties } from 'react';
import { useBlocksStore } from '../stores/blocks.store';
import { useMarkersStore } from '../stores/markers.store';
import { useLyricsStore } from '../stores/lyrics.store';
import { createSubBlocks, getActiveBlock, getActiveSubBlockIndex } from '../utils/block-utils';
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
import { useLoopGeometry, buildLoopShapes, handlesOf } from './useLoopContourGeometry';
import { subFill } from './loop-geometry';
import { useLoopDrag } from './useLoopDrag';
import { LoopContour } from './LoopContour';
import { LoopHandles } from './LoopHandles';
import { LoopRuler } from './LoopRuler';
import { SubSegmentRow } from './SubSegmentRow';

/** 00:21 · ВРЕМЕННЫЙ отладочный бейдж: печатает на вагоне region / cutL / cutR
 *  и наличие геометрии. Чтобы понять, почему маска не режет родной свет,
 *  Никита фоткает эти значения. Выключается → false. */
const DEBUG_LOOP = false;

export function WagonTrain() {
  const blocks = useBlocksStore(s => s.blocks);
  const markers = useMarkersStore(s => s.markers);
  const activeLineIndex = useLyricsStore(s => s.activeLineIndex);
  const lines = useLyricsStore(s => s.lines);
  const rootRef = useRef<HTMLDivElement>(null);
  const loopBlockIds = useLoopStore(s => s.loopBlockIds);
  const loopSubBlockKeys = useLoopStore(s => s.loopSubBlockKeys);
  const loopStartLine = useLoopStore(s => s.loopStartLine);
  const loopEndLine = useLoopStore(s => s.loopEndLine);
  const isLooping = useLoopStore(s => s.isLooping);
  const takesPanelActive = useDeckStore(s => s.activeTabId === 'takes' && s.expanded);
  const setActiveBlock = useTakesStore(s => s.setActiveBlock);

  // TrackMap control layer (see src/trackmap/) — dim mode, selection, startup blink.
  const dimMode = useTrackMapStore(s => s.dimMode);
  const selection = useTrackMapStore(s => s.selection);
  const fxRun = useTrackMapFx(blocks.length);

  /* 708 / 23:3x · Геометрия петли от НОМЕРОВ СТРОК, а не от DOM-соседства.
     Раньше контур собирался по `data-in-loop` и группировал вагоны в пробеги;
     теперь границы региона заданы строками, поэтому скобку можно поставить
     на любой строке внутри блока, а не только на его краю. */
  const layoutKey = `${blocks.length}|${blocks.map(b => b.lineIndices.length).join(',')}`;

  /** Глобальные номера строк, с которых начинаются подблоки — швы режима «шаг». */
  const subStarts = useMemo(() => {
    const out: number[] = [];
    for (const b of blocks) {
      const subs = createSubBlocks(b.lineIndices, MAX_SUB_BLOCK_LINES, lines);
      for (let i = 1; i < subs.length; i++) {
        const first = subs[i].lineIndices[0];
        if (typeof first === 'number') out.push(first);
      }
    }
    return out;
  }, [blocks, lines]);

  const geo = useLoopGeometry(rootRef, blocks, subStarts, layoutKey);

  const commitLoop = useCallback((startLine: number, endLine: number) => {
    interruptPracticeSession(() => {
      useLoopStore.getState().setBoundaryLines(startLine, endLine);
    });
  }, []);

  const drag = useLoopDrag({
    rootRef,
    geo,
    startLine: loopStartLine,
    endLine: loopEndLine,
    onCommit: commitLoop,
  });

  const shapes = useMemo(
    () => (geo && drag.hasLoop ? buildLoopShapes(geo, drag.k1, drag.k2 - 1) : []),
    [geo, drag.hasLoop, drag.k1, drag.k2]
  );
  const handles = useMemo(() => handlesOf(shapes), [shapes]);

  const magnetX = useMemo(() => {
    if (!drag.grab) return null;
    const h = handles.find(x => x.side === drag.grab!.side);
    return h ? h.x : null;
  }, [handles, drag.grab]);

  /* Границы петли для покраски: null — петли нет, цвет у всех блоков живой. */
  const regionFrom = drag.hasLoop ? drag.k1 : null;
  const regionTo = drag.hasLoop ? drag.k2 - 1 : null;

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

  // Loop edges: only the first/last block in the contiguous loop can be
  // removed — the store itself refuses inner removals (loop.store toggleBlock:
  // `if (!isFirstBlock && !isLastBlock) return;`). Inner blocks keep their
  // in-loop outline but show NO toggle, so a dead minus never glows there.
  const loopIndices = useMemo(() => {
    const idx: number[] = [];
    blocks.forEach((b, i) => { if (loopBlockIds.includes(b.id)) idx.push(i); });
    return idx;
  }, [blocks, loopBlockIds]);
  const leftEdge = loopIndices.length ? Math.min(...loopIndices) : -1;
  const rightEdge = loopIndices.length ? Math.max(...loopIndices) : -1;

  const getLoopToggleState = useCallback(
    (blockId: string, blockIdx: number): 'in-loop' | 'in-loop-inner' | 'adjacent' | 'idle' => {
      if (loopBlockIds.includes(blockId)) {
        return (blockIdx === leftEdge || blockIdx === rightEdge) ? 'in-loop' : 'in-loop-inner';
      }
      if (!isLooping) return 'idle';
      const isAdjacent =
        (blockIdx > 0 && loopBlockIds.includes(blocks[blockIdx - 1].id)) ||
        (blockIdx < blocks.length - 1 && loopBlockIds.includes(blocks[blockIdx + 1].id));
      return isAdjacent ? 'adjacent' : 'idle';
    },
    [loopBlockIds, isLooping, blocks, leftEdge, rightEdge]
  );

  // Sub-block loop edges: same rule as whole-block edges — only the first/last
  // sub-block key in the contiguous loop run is removable; inner ones are dead
  // (store toggleSubBlock also refuses mid-run removal). Plus shows only on the
  // sub-blocks immediately outside the run (extend), never on far ones.
  const orderedSubKeys = useMemo(() => {
    return [...loopSubBlockKeys].sort((a, b) => {
      const [aB, aS] = a.split(':');
      const [bB, bS] = b.split(':');
      const ai = blocks.findIndex(bl => bl.id === aB);
      const bi = blocks.findIndex(bl => bl.id === bB);
      return ai !== bi ? ai - bi : Number(aS) - Number(bS);
    });
  }, [blocks, loopSubBlockKeys]);
  const firstSubKey = orderedSubKeys.length ? orderedSubKeys[0] : null;
  const lastSubKey = orderedSubKeys.length ? orderedSubKeys[orderedSubKeys.length - 1] : null;
  const adjacentSubKeys = useMemo(() => {
    const set = new Set<string>();
    if (!firstSubKey || !lastSubKey) return set;
    const [fb, fs] = firstSubKey.split(':');
    const [lb, ls] = lastSubKey.split(':');
    const fi = Number(fs);
    const li = Number(ls);
    const fBi = blocks.findIndex(b => b.id === fb);
    const lBi = blocks.findIndex(b => b.id === lb);
    if (fi > 0) set.add(`${fb}:${fi - 1}`);
    else if (fBi > 0) {
      const pb = blocks[fBi - 1];
      const subs = createSubBlocks(pb.lineIndices, MAX_SUB_BLOCK_LINES, lines);
      set.add(`${pb.id}:${subs.length - 1}`);
    }
    if (lBi >= 0) {
      const lbBlock = blocks[lBi];
      const subs = createSubBlocks(lbBlock.lineIndices, MAX_SUB_BLOCK_LINES, lines);
      if (li < subs.length - 1) set.add(`${lb}:${li + 1}`);
      else if (lBi < blocks.length - 1) set.add(`${blocks[lBi + 1].id}:0`);
    }
    return set;
  }, [blocks, firstSubKey, lastSubKey, loopSubBlockKeys, lines]);

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
      /* 23:3x · цвет режима жеста живёт на корне: засечки и половина скобки
         берут его через CSS-переменную, без единого лишнего рендера. */
      data-loop-grab={drag.grab?.mode}
      data-loop-on={drag.hasLoop ? 'true' : undefined}
      style={{
        '--tm-fx-k': fxRun.intensity,
        '--tm-fx-duration': fxRun.durationMs > 0 ? `${fxRun.durationMs}ms` : undefined,
      } as CSSProperties}
    >
      {blocks.map((block, i) => {
        const isActive = block.id === activeBlock?.id;
        const activeSubIdx = isActive ? activeSubBlockIndex : -1;

        /* 708 / 22.1x: ОДИН расчёт подблоков на вагон. Раньше SubSegmentRow
           считал их заново и сам решал, рисоваться или нет; вагон при этом не
           знал, есть ли у него тело. Теперь источник truth здесь: hasSubs
           управляет центрированием имени, subBlocks уходит в ряд готовым. */
        const subBlocks = createSubBlocks(block.lineIndices, MAX_SUB_BLOCK_LINES, lines);
        const hasSubs = subBlocks.length > 1;
        const firstLine = block.lineIndices[0];
        const lastLine = block.lineIndices[block.lineIndices.length - 1];

        /* 23:3x · «цвет блока = регион»: внутри петли цвет живой, снаружи
           выключен. Новых цветов не вводим (канон Никиты). */
        let region: 'in' | 'part' | 'out' | undefined;
        if (regionFrom != null && regionTo != null && typeof firstLine === 'number' && typeof lastLine === 'number') {
          if (lastLine < regionFrom || firstLine > regionTo) region = 'out';
          else if (firstLine >= regionFrom && lastLine <= regionTo) region = 'in';
          else region = 'part';
        }

        const subBreaks = hasSubs
          ? subBlocks.slice(1).map(s => s.lineIndices[0] - firstLine)
          : [];

        /* 23:5x · Никита: «подсвечивать только выбранную в лупе часть».
           Считаем долю региона в процентах полосы строк — по ней РЕЖЕТСЯ
           родной слой цвета вагона (mask), а не накладывается второй.
           Полностью выбранному блоку резать нечего: у него цвет живёт весь. */
        const slice =
          region === 'part' && regionFrom != null && regionTo != null
            ? subFill(block.lineIndices, regionFrom, regionTo)
            : null;

        /* Переводим доли полосы строк в проценты ГАБАРИТА вагона — маска
           на ::before считается от него, а не от content-box. */
        let cutL = 0;
        let cutR = 0;
        const span = geo?.spans[i];
        if (slice && span && span.boxRight > span.boxLeft && span.width > 0) {
          const boxW = span.boxRight - span.boxLeft;
          const inset = span.left - span.boxLeft;
          cutL = ((inset + (slice.from / 100) * span.width) / boxW) * 100;
          cutR = 100 - ((inset + (slice.to / 100) * span.width) / boxW) * 100;
        }

        /* 🔴 00:38 · Мягкий край маски только на СТЫКЕ СТРОКИ, а не на границе
           блока. Если петля начинается с первой строки блока (slice.from≈0) —
           левый край это сама граница блока, режем резко (softL=0), иначе блок
           «размывался» бы у своего края. Если петля кончается внутри блока
           (slice.to<100) — правый край это строка, режем мягко (softR=FEATHER),
           чтобы не было «квадрата». Иначе цвет = полноразмерный прямоугольник с
           вертикальной кромкой. */
        const FEATHER = 16;
        const softL = slice && slice.from <= 0.5 ? 0 : FEATHER;
        const softR = slice && slice.to >= 99.5 ? 0 : FEATHER;

        // Loop state per wagon: 'in-loop' | 'adjacent' | 'idle'.
        // adjacent → the «+» badge lights up so the user can extend the loop.
        const loopState = getLoopToggleState(block.id, i);
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
            data-has-subs={hasSubs || undefined}
            data-in-loop={loopBlockIds.includes(block.id) || undefined}
            data-loop-region={region}
            data-loop-state={loopState}
            data-loop-join={loopJoin}
            data-tm-selected={selection.includes(block.id) || undefined}
            onClick={() => handleWagonClick(block)}
            title={block.name}
            style={{
              cursor: 'pointer',
              '--tm-color': getBlockTypeConfig(block.type).color,
              '--tm-fx-delay': `${fxRun.delays[i] ?? 0}ms`,
              /* 23:5x · где обрезать родной цвет блока (см. mask в CSS). */
              '--loop-cut-l': region === 'part' ? `${cutL}%` : undefined,
              '--loop-cut-r': region === 'part' ? `${cutR}%` : undefined,
              '--loop-soft-l': region === 'part' ? `${softL}px` : undefined,
              '--loop-soft-r': region === 'part' ? `${softR}px` : undefined,
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
            {DEBUG_LOOP && (
              <span
                style={{
                  position: 'absolute',
                  left: 2,
                  top: 1,
                  zIndex: 50,
                  fontSize: 8,
                  lineHeight: '9px',
                  fontFamily: 'monospace',
                  color: '#fff',
                  background: 'rgba(0,0,0,0.7)',
                  padding: '1px 2px',
                  borderRadius: 2,
                  pointerEvents: 'none',
                  whiteSpace: 'nowrap',
                }}
              >
                {`${region ?? '-'} L${cutL.toFixed(0)} R${cutR.toFixed(0)} ${geo ? 'G' : 'noG'}`}
              </span>
            )}
            {/* Слой света: заливка + «лампочки под стеклом».
                Одна формула на два состояния — активный блок и презентация. */}
            <span className={styles.lamp} aria-hidden="true" />
            <SubSegmentRow
              block={block}
              subBlocks={subBlocks}
              isActive={isActive}
              activeSubIdx={activeSubIdx}
              inLoopBlock={loopBlockIds.includes(block.id)}
              loopSubBlockKeys={loopSubBlockKeys}
              firstSubKey={firstSubKey}
              lastSubKey={lastSubKey}
              adjacentSubKeys={adjacentSubKeys}
              onSubClick={handleSubBlockClick}
              onToggleSub={handleToggleSub}
            />
            <LoopRuler lineCount={block.lineIndices.length} subBreaks={subBreaks} />
            {loopState !== 'in-loop-inner' && (
            <span
              role="button"
              tabIndex={0}
              className={styles.loopToggle}
              data-active={loopState === 'in-loop' || undefined}
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
            )}
          </button>
        );
      })}
      <LoopContour shapes={shapes} grabSide={drag.grab?.side ?? null} magnetX={magnetX} />
      {shapes.length > 0 && (
        /* ✕ живёт в координатах СКОБКИ, а не блока: при частичном захвате
           правая скобка уезжает внутрь вагона — крестик едет вместе с ней.
           left = правая вертикаль (x+w) минус 16px → «чуть внутрь лупа»,
           top  = уровень верхней полоски (y) + 1px → не вылезает за клип root. */
        <button
          type="button"
          className={styles.loopClear}
          style={{
            left: shapes[0].x + shapes[0].w - 16,
            top: shapes[0].y + 1,
          }}
          onClick={(e) => {
            e.stopPropagation();
            interruptPracticeSession(() => useLoopStore.getState().clearLoop());
          }}
          title="Снять петлю целиком"
          aria-label="Снять петлю целиком"
        >
          <span className={styles.loopClearGlyph} aria-hidden="true" />
        </button>
      )}
      <LoopHandles
        handles={handles}
        grab={drag.grab}
        onBegin={drag.begin}
        onMove={drag.move}
        onEnd={drag.end}
        onHover={drag.hover}
        onLeave={drag.leave}
        onNudge={drag.nudge}
      />
    </div>
  );
}
