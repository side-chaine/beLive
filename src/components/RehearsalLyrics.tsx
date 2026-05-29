import React from 'react';
import { useEffect, useLayoutEffect, useRef, useMemo, useCallback, useState } from 'react';
import { useLyricsStore } from '../stores/lyrics.store';
import { useBlocksStore, type TextBlock } from '../stores/blocks.store';
import { useLoopStore } from '../stores/loop.store';
import { useTextStyleStore } from '../stores/textStyle.store';
import { useWordSyncStore } from '../stores/wordSync.store';
import { useMarkersStore } from '../stores/markers.store';
import { useTrackStore } from '../stores/track.store';
import { usePlateStore } from '../stores/plate.store';
import { useAudioStore } from '../stores/audio.store';
import { TRANSITION_PRESETS, DEFAULT_PRESET } from '../data/transition-presets';
import { useEffectiveTier } from '../performance/performance.hooks';
import {
  getActiveBlock,
  getNextBlock,
  getBlockFontSize,
  createSubBlocks,
} from '../utils/block-utils';
import { useSlotMatrix } from '../slot-matrix/use-slot-matrix';
import { measureNextBlock, type NextBlockMeasurement } from '../slot-matrix/measure-next-block';
import { MAX_SUB_BLOCK_LINES } from '../slot-matrix/slot-matrix.utils';

import styles from './RehearsalLyrics.module.css';
import { WordHighlightLine } from '../triggers/WordHighlightLine';

export function RehearsalLyrics() {
  const lines = useLyricsStore(s => s.lines);
  const activeLineIndex = useLyricsStore(s => s.activeLineIndex);
  const blocks = useBlocksStore(s => s.blocks);
  const activeRef = useRef<HTMLDivElement>(null);
  const prevBlockRef = useRef<TextBlock | null>(null);
  const activeBlockRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const isLooping = useLoopStore(s => s.isLooping);
  const loopBlockIds = useLoopStore(s => s.loopBlockIds);
  const loopStartLine = useLoopStore(s => s.loopStartLine);
  const loopEndLine = useLoopStore(s => s.loopEndLine);
  const setBoundaryLines = useLoopStore(s => s.setBoundaryLines);

  // Word FX controls from StylesDeck
  const wordFocusLevel = useTextStyleStore(s => s.wordFocusLevel);
  const wordFxMode = useTextStyleStore(s => s.wordFxMode);
  const lineActiveLevel = useTextStyleStore(s => s.lineActiveLevel);
  const lineNextLevel = useTextStyleStore(s => s.lineNextLevel);
  const lineOthersLevel = useTextStyleStore(s => s.lineOthersLevel);
  const lineOthersSource = useTextStyleStore(s => s.lineOthersSource);

  const useAutoBg = usePlateStore(s => s.useAutoBg);
  const currentTrack = useTrackStore(s => s.currentTrack);
  const coverArtUrl = currentTrack?.coverArtUrl || null;
  const customBgUrl = useTrackStore(s => s.currentTrack?.customBgUrl) || null;
  const tier = useEffectiveTier();

  // Transition preset from plate store
  const transitionPresetId = usePlateStore(s => s.transitionPreset);

  const activePreset = useMemo(() => 
    TRANSITION_PRESETS[transitionPresetId] ?? DEFAULT_PRESET,
    [transitionPresetId]
  );

  // Performance guard: lite tier → only smooth preset
  const effectivePreset = useMemo(() => {
    if (tier === 'lite') return DEFAULT_PRESET;
    return activePreset;
  }, [activePreset, tier]);

  const isPlaying = useAudioStore(s => s.isPlaying);

  // Custom background visible even when useAutoBg=false (user's explicit choice)
  const showCoverBg = useAutoBg || !!customBgUrl;
  // Custom bg renders on body (Layer 1) — not in plate (Layer 3)
  // Plate img shows cover art only when no custom bg
  const effectiveBgUrl = customBgUrl ? null : coverArtUrl;




  // W12: Plate settings from store
  const plateWidth = usePlateStore(s => s.width);
  const platePosition = usePlateStore(s => s.position);
  const glowIntensity = usePlateStore(s => s.glowIntensity);
  const vignetteIntensity = usePlateStore(s => s.vignetteIntensity);

  // Computed plate styles
  const plateStyle: React.CSSProperties = {
    width: `${plateWidth}%`,
    '--plate-glow-size': `${Math.round(glowIntensity * 0.3)}px`,
    '--plate-bg': vignetteIntensity > 0
      ? `radial-gradient(ellipse calc(100% - ${vignetteIntensity * 0.4}%) calc(100% - ${vignetteIntensity * 0.4}%) at center, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.35) 60%, transparent 100%)`
      : 'rgba(0, 0, 0, 0.5)',
  } as React.CSSProperties;

  // Transition preset CSS variables — на .root, НЕ на .activeBlock!
  // Причина: .previewOverlay — sibling .activeBlock, не потомок.
  // CSS custom properties наследуются ТОЛЬКО вниз по DOM-дереву.
  const presetStyle: React.CSSProperties = {
    '--bl-ps-appear-duration': `${effectivePreset.appear.duration}s`,
    '--bl-ps-appear-easing': effectivePreset.appear.easing,
    '--bl-ps-appear-slide': `${effectivePreset.appear.slideFrom}px`,
    '--bl-ps-appear-start-opacity': String(effectivePreset.appear.startOpacity),
    '--bl-ps-appear-end-opacity': String(effectivePreset.appear.endOpacity),
    '--bl-ps-travel-duration': `${effectivePreset.travel.duration}s`,
    '--bl-ps-travel-easing': effectivePreset.travel.easing,
    '--bl-ps-spotlight-intensity': String(effectivePreset.travel.spotlight.intensity),
    '--bl-ps-spotlight-glow-size': `${effectivePreset.travel.spotlight.glowSize}px`,
    '--bl-ps-spotlight-glow-opacity': String(effectivePreset.travel.spotlight.glowOpacity),
    '--bl-ps-spotlight-others-opacity': String(effectivePreset.travel.spotlight.othersOpacity),
    // Dissolve/enter CSS variables
    '--bl-ps-dissolve-duration': `${effectivePreset.dissolve.duration}s`,
    '--bl-ps-dissolve-end-opacity': String(effectivePreset.dissolve.endOpacity),
    '--bl-ps-dissolve-scale': String(effectivePreset.dissolve.scale),
    '--bl-ps-enter-duration': `${effectivePreset.enter.duration}s`,
    '--bl-ps-enter-start-opacity': String(effectivePreset.enter.startOpacity),
    '--bl-ps-enter-slide-y': `${effectivePreset.enter.slideY}px`,
  } as React.CSSProperties;

  const rootAlignItems = platePosition === 'left' ? 'flex-start'
    : platePosition === 'right' ? 'flex-end'
    : 'center';

  // Block Cue: sync horizontal position with plate center
  const [cueLeft, setCueLeft] = useState('50%');
  const [cueTop, setCueTop] = useState<string>('');
  const [coverCenterX, setCoverCenterX] = useState('50%');

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

  // ── SLOT MATRIX VERIFICATION ──
  const { 
    matrix: slotMatrix, 
    nextBlock: slotNextBlock, 
    gridTemplateRows,
    visibleLineIndices,
    isLastLineInSubBlock,
    activeSubBlockIndex,
    activeSlotGroup,
  } = useSlotMatrix();
  const USE_SLOT_GRID = true; // true = grid, false = flex (мгновенный откат)
    /** Canvas mode: ПС = overlay с travel animation.
     *  false = ПС как grid row (текущий), true = overlay + travel */
    const USE_SLOT_CANVAS = true;
  
    /** ПС overlay: top позиция в viewport координатах.
     *  null = overlay не существует (ПС = grid row).
     *  number = overlay активен, top в viewport px. */
    const [psOverlayTop, setPsOverlayTop] = useState<number | null>(null);
    const [isTraveling, setIsTraveling] = useState(false);
    const [isDissolving, setIsDissolving] = useState(false);
    const [isEntering, setIsEntering] = useState(false);
    const [isEnterMounted, setIsEnterMounted] = useState(false);
    const overlayRef = useRef<HTMLDivElement>(null);

  // Block Cue: sync horizontal position with plate center
  useEffect(() => {
    const el = activeBlockRef.current;
    if (!el) return;

    const updateCue = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0) return; // Guard: skip transition state
      const centerX = rect.left + rect.width / 2;
      setCueLeft(`${centerX}px`);
      setCoverCenterX(`${centerX}px`);
    };

    // Delay first calculation to ensure DOM is settled
    const rafId = requestAnimationFrame(updateCue);

    // Observe size changes (position changes from plateWidth/platePosition)
    const ro = new ResizeObserver(updateCue);
    ro.observe(el);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, [plateWidth, platePosition, displayBlock]);

  // Compute Block Cue vertical position — under last line of active block
  useEffect(() => {
    const root = rootRef.current;
    const block = activeBlockRef.current;
    if (!root || !block) return;

    const updateCueTop = () => {
      const rootRect = root.getBoundingClientRect();
      const lineElements = block.querySelectorAll('[data-line-index]:not([data-is-preview="true"])');
      if (!lineElements.length) return;
      const lastLine = lineElements[lineElements.length - 1];
      const lastRect = lastLine.getBoundingClientRect();
      const top = lastRect.bottom - rootRect.top + 4;
      setCueTop(`${top}px`);
    };

    updateCueTop();

    const ro = new ResizeObserver(updateCueTop);
    ro.observe(block);
    return () => ro.disconnect();
  }, [displayBlock, activeSubBlockIndex]);

  const nextBlock = useMemo(
    () => getNextBlock(displayBlock, blocks),
    [displayBlock, blocks]
  );

  /** Кэш измерения следующего блока.
   *  Обновляется при shouldGrowPreview/nextBlock смене.
   *  Используется в travel rAF — zero DOM access в горячем пути. */
  const nextBlockMeasureRef = useRef<NextBlockMeasurement | null>(null);

  // nextNextBlock = блок после следующего (для ПС строки в shadow)
  const nextNextBlock = useMemo(
    () => getNextBlock(nextBlock, blocks),
    [nextBlock, blocks]
  );

  // ── BC: reactive markers for travel trigger ──
  const markers = useMarkersStore(s => s.markers);

  const activePositionInBlock = useMemo(
    () => displayBlock ? displayBlock.lineIndices.indexOf(activeLineIndex) : -1,
    [displayBlock, activeLineIndex]
  );

  const isLastLineInBlock = useMemo(
    () => displayBlock !== null
      && activePositionInBlock >= 0
      && activePositionInBlock === displayBlock.lineIndices.length - 1,
    [displayBlock, activePositionInBlock]
  );

  const isActiveLineBeyondBlock = useMemo(
    () => displayBlock !== null
      && activeLineIndex >= 0
      && !displayBlock.lineIndices.includes(activeLineIndex)
      && nextBlock !== null,
    [displayBlock, activeLineIndex, nextBlock]
  );

  const shouldGrowBlockCue = useMemo(
    () => !!nextBlock
      && (isLastLineInSubBlock || isLastLineInBlock || isActiveLineBeyondBlock),
    [nextBlock, isLastLineInSubBlock, isLastLineInBlock, isActiveLineBeyondBlock]
  );

  const nextBlockFirstMarkerTime = useMemo(() => {
    if (!nextBlock || nextBlock.lineIndices.length === 0) return Infinity;
    const firstLineIdx = nextBlock.lineIndices[0];
    const marker = markers.find(m => m.lineIndex === firstLineIdx);
    return marker?.time ?? Infinity;
  }, [nextBlock, markers]);

  // ── Next SubBlock First Marker Time (Level 1 trigger) ──
  const nextSubBlockFirstMarkerTime = useMemo(() => {
    const activeSubBlock = slotMatrix?.activeSubBlock;
    if (!activeSubBlock || activeSubBlock.isLast) return Infinity;

    const nextSubBlockIndex = activeSubBlock.subBlockIndex + 1;
    const nextSubBlock = slotMatrix?.subBlocks?.[nextSubBlockIndex];
    if (!nextSubBlock || nextSubBlock.lineIndices.length === 0) return Infinity;

    const firstLineIdx = nextSubBlock.lineIndices[0];
    const marker = markers.find(m => m.lineIndex === firstLineIdx);
    return marker?.time ?? Infinity;
  }, [slotMatrix, markers]);

  const bcFontSize = useMemo(() => {
    if (!nextBlock || nextBlock.lineIndices.length === 0) return undefined;
    const effectiveLines = Math.min(MAX_SUB_BLOCK_LINES, nextBlock.lineIndices.length);
    return getBlockFontSize(effectiveLines);
  }, [nextBlock]);

  // Slot Matrix: shouldGrowPreview + psFontSize
  // ПС подавляется если следующий target за пределами лупа
  const nextTargetIsInLoop = useMemo(() => {
    if (!isLooping || loopStartLine === null || loopEndLine === null) return true;
    const isLastSub = activeSlotGroup?.subBlock?.isLast ?? true;
    let nextTargetLine: number | null = null;
    if (!isLastSub && slotMatrix?.subBlocks) {
      const nextSubIdx = (slotMatrix.activeSubBlock?.subBlockIndex ?? -1) + 1;
      const nextSub = slotMatrix.subBlocks[nextSubIdx];
      if (nextSub && nextSub.lineIndices.length > 0) {
        nextTargetLine = nextSub.lineIndices[0];
      }
    } else if (nextBlock && nextBlock.lineIndices.length > 0) {
      nextTargetLine = nextBlock.lineIndices[0];
    }
    if (nextTargetLine === null) return true;
    return nextTargetLine >= loopStartLine && nextTargetLine <= loopEndLine;
  }, [isLooping, loopStartLine, loopEndLine, activeSlotGroup, slotMatrix, nextBlock]);

  const shouldGrowPreview = slotMatrix 
    ? (isLastLineInSubBlock || isLastLineInBlock || isActiveLineBeyondBlock) && nextTargetIsInLoop
    : false;

  // ── ПС Overlay: idle позиция (viewport coords) ──
  // Когда shouldGrowPreview=true → overlay появляется
  // под последней строкой (viewport coords).
  // Когда false → overlay исчезает (ПС = grid row).
  useEffect(() => {
    if (!USE_SLOT_CANVAS) return;

    if (!shouldGrowPreview) {
      setPsOverlayTop(null);
      return;
    }

    const block = activeBlockRef.current;
    if (!block) return;

    const lineElements = block.querySelectorAll('[data-line-index]:not([data-is-preview="true"])');
    if (!lineElements.length) return;
    const lastLine = lineElements[lineElements.length - 1];
    const lastLineRect = lastLine.getBoundingClientRect();

    if (lastLineRect.bottom < 0) return; // guard: stale

    // Idle позиция = viewport coords: под последней строкой + idleGap
    setPsOverlayTop(lastLineRect.bottom + effectivePreset.timing.idleGap);
  }, [USE_SLOT_CANVAS, shouldGrowPreview, displayBlock?.id, activeSubBlockIndex]);

  // ── Shadow Measurement: целевой подблок ──
  // ВСЕГДА измеряем КОНКРЕТНЫЙ подблок который будет виден после переключения:
  // - SubBlock→SubBlock: следующий подблок текущего блока
  // - Block→Block: первый подблок следующего блока
  // Это устраняет оба бага:
  //   L1 неточность (4→1 строки = промах 98px)
  //   L2 неточность (shadow измеряет весь блок, не подблок)
  useEffect(() => {
    if (!USE_SLOT_CANVAS || !shouldGrowPreview) {
      nextBlockMeasureRef.current = null;
      return;
    }

    // Определить целевой подблок
    const currentSubBlock = slotMatrix?.activeSubBlock;
    const isLastSub = currentSubBlock?.isLast ?? true;

    let targetLineIndices: number[];
    let targetBlockId: string;
    let targetBlockType: string;
    let psNextBlock: TextBlock | null | undefined;

    if (!isLastSub && currentSubBlock && displayBlock) {
      // SubBlock→SubBlock: следующий подблок ТЕКУЩЕГО блока
      const nextSubBlockIndex = currentSubBlock.subBlockIndex + 1;
      const nextSubBlock = slotMatrix?.subBlocks?.[nextSubBlockIndex];
      if (!nextSubBlock) {
        nextBlockMeasureRef.current = null;
        return;
      }
      targetLineIndices = nextSubBlock.lineIndices;
      targetBlockId = displayBlock.id;
      targetBlockType = displayBlock.type;
      // ПС для subblock перехода = первый подблок nextBlock
      psNextBlock = nextBlock;
    } else if (nextBlock) {
      // Block→Block: первый подблок СЛЕДУЮЩЕГО блока
      const nextBlockSubBlocks = createSubBlocks(nextBlock.lineIndices, 6, lines);
      const firstSubBlock = nextBlockSubBlocks[0];
      if (!firstSubBlock) {
        nextBlockMeasureRef.current = null;
        return;
      }
      targetLineIndices = firstSubBlock.lineIndices;
      targetBlockId = nextBlock.id;
      targetBlockType = nextBlock.type;
      // ПС = первый подблок блока после nextBlock
      psNextBlock = nextNextBlock;
    } else {
      nextBlockMeasureRef.current = null;
      return;
    }

    // Ширина = из текущего slotContainer
    const slotContainerEl = activeBlockRef.current
      ?.querySelector('[data-slot-container="true"]');
    const containerWidth = slotContainerEl
      ? slotContainerEl.getBoundingClientRect().width
      : (() => {
          const rootWidth = rootRef.current?.getBoundingClientRect().width ?? window.innerWidth;
          return Math.min(rootWidth * 0.8, 900) - 80;
        })();

    if (containerWidth <= 0) return;

    // Создать виртуальный TextBlock с lineIndices целевого подблока
    const virtualBlock: TextBlock = {
      id: targetBlockId,
      type: targetBlockType,
      lineIndices: targetLineIndices,
      label: '',
    };

    const measurement = measureNextBlock({
      nextBlock: virtualBlock,
      nextNextBlock: psNextBlock ?? null,
      lines,
      containerWidth,
      gapPx: 16,
      interBlockGapPx: 24,
    });

    if (measurement.containerHeight > 0) {
      nextBlockMeasureRef.current = measurement;
    }
  }, [USE_SLOT_CANVAS, shouldGrowPreview, displayBlock?.id, activeSubBlockIndex, nextBlock?.id, nextNextBlock?.id, lines]);

  // ── ПС Overlay: travel (viewport coords) ──
  // Единый L2 путь: shadow measurement всегда измеряет целевой подблок.
  // Определяем тип перехода только для trigger time:
  //   SubBlock→SubBlock: triggerTime = nextSubBlockFirstMarkerTime - offset
  //   Block→Block: triggerTime = nextBlockFirstMarkerTime - 1.0
  useEffect(() => {
    const isLastSub = activeSlotGroup?.subBlock?.isLast ?? true;

    // Определить trigger time
    let triggerTime: number;
    if (!isLastSub && nextSubBlockFirstMarkerTime && nextSubBlockFirstMarkerTime !== Infinity) {
      // SubBlock transition: динамический offset
      const interval = nextBlockFirstMarkerTime
        ? nextBlockFirstMarkerTime - nextSubBlockFirstMarkerTime
        : Infinity;
      const travelDuration = effectivePreset.travel.duration;
      triggerTime = nextSubBlockFirstMarkerTime - Math.min(travelDuration, interval * effectivePreset.timing.subBlockOffsetRatio);
    } else if (nextBlockFirstMarkerTime && nextBlockFirstMarkerTime !== Infinity) {
      // Block transition: фиксированный offset из пресета
      triggerTime = nextBlockFirstMarkerTime - effectivePreset.timing.triggerOffset;
    } else {
      return;
    }

    // Guard: suppress travel when loop is active and next target is outside loop
    if (!shouldGrowPreview) {
      return;
    }

    const ae = (window as any).audioEngine;
    let rafId: number;
    let triggered = false;

    const tick = () => {
      // LIVE guard: read current loop state (closure may be stale)
      const liveLoop = useLoopStore.getState();
      if (liveLoop.isLooping) {
        cancelAnimationFrame(rafId);
        return;
      }

      if (!shouldGrowPreview) {
        cancelAnimationFrame(rafId);
        return;
      }

      const ct = ae?.getCurrentTime?.() ?? 0;

      if (ct >= triggerTime && ct <= triggerTime + effectivePreset.timing.triggerWindow) {
        if (!triggered) {
          triggered = true;
          setIsTraveling(true);
          setIsDissolving(true);

          const block = activeBlockRef.current;
          const measurement = nextBlockMeasureRef.current;
          const blockRect = block?.getBoundingClientRect();

          // Staleness guard: measurement должен соответствовать текущему контексту
          const expectedId = isLastSub ? nextBlock?.id : displayBlock?.id;
          const measurementValid = measurement
            && measurement.containerHeight > 0
            && measurement.nextBlockId === expectedId;

          console.log('[PS Travel] Trigger fired', {
            nextBlockId: nextBlock?.id,
            isLastSub,
            expectedMeasureId: expectedId,
            measuredId: measurement?.nextBlockId,
            hasMeasurement: !!measurement,
            measurementValid,
            containerHeight: measurement?.containerHeight,
            triggerTime,
            ct,
          });

          if (measurementValid && blockRect && blockRect.height > 0) {
            // ═══ ТОЧНЫЙ TRAVEL TARGET ═══
            const getPaddings = (): { top: number; bottom: number } => {
              const block = activeBlockRef.current;
              if (!block) return { top: 24, bottom: 24 };
              const style = getComputedStyle(block);
              return {
                top: parseFloat(style.paddingTop) || 24,
                bottom: parseFloat(style.paddingBottom) || 24,
              };
            };
            const { top: PADDING_TOP, bottom: PADDING_BOTTOM } = getPaddings();
            const available = blockRect.height - PADDING_TOP - PADDING_BOTTOM;
            const centeringOffset = (available - measurement.containerHeight) / 2;
            const targetTop = blockRect.top + PADDING_TOP + centeringOffset + measurement.firstLineOffset;

            const minTop = blockRect.top + PADDING_TOP;
            const getLineHeight = (): number => {
              const block = activeBlockRef.current;
              if (!block) return 52;
              const fontSize = parseFloat(getComputedStyle(block).fontSize) || 41.6;
              return fontSize * 1.25;
            };
            const lineHeight = getLineHeight();
            const maxTop = blockRect.bottom - PADDING_BOTTOM - lineHeight;
            const clampedTarget = Math.max(minTop, Math.min(maxTop, targetTop));

            setPsOverlayTop(clampedTarget);

            console.log('[PS Travel] Unified L2', {
              transitionType: isLastSub ? 'block→block' : 'subblock→subblock',
              containerHeight: measurement.containerHeight,
              contentHeight: measurement.contentHeight,
              firstLineOffset: measurement.firstLineOffset,
              targetTop: clampedTarget,
              blockRect: { top: blockRect.top, height: blockRect.height },
            });
          } else {
            // Fallback
            const lineH = 52;
            const root = rootRef.current;
            const rootRect = root?.getBoundingClientRect();
            setPsOverlayTop(
              rootRect
                ? rootRect.top + rootRect.height / 2 - lineH / 2
                : window.innerHeight / 2 - lineH / 2
            );
            console.log('[PS Travel] Fallback — no valid measurement');
          }
        }
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [USE_SLOT_CANVAS, shouldGrowPreview, nextSubBlockFirstMarkerTime, nextBlockFirstMarkerTime, effectivePreset]);

  // Appear: add data-mounted="true" via double rAF (transition-based appear)
  // Data attribute вместо class — обходит CSS Modules name mangling
  useEffect(() => {
    if (psOverlayTop !== null && overlayRef.current) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (overlayRef.current) {
            overlayRef.current.dataset.mounted = 'true';
          }
        });
      });
    } else if (overlayRef.current) {
      delete overlayRef.current.dataset.mounted;
    }
  }, [psOverlayTop]);

  // Enter: add data-enter-mounted="true" via double rAF
  useEffect(() => {
    if (isEntering && activeBlockRef.current) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsEnterMounted(true);
        });
      });
    }
  }, [isEntering]);

  // Enter: cleanup after duration + buffer
  useEffect(() => {
    if (!isEntering) return;
    const ms = effectivePreset.enter.duration * 1000 + 100;
    const timer = setTimeout(() => {
      setIsEntering(false);
      setIsEnterMounted(false);
    }, ms);
    return () => clearTimeout(timer);
  }, [isEntering, effectivePreset.enter.duration]);

  // Reset isTraveling/isDissolving when playback stops
  // Without this: dim-others CSS rule stays active → lines remain dim
  useEffect(() => {
    if (!isPlaying) {
      setIsTraveling(false);
      setIsDissolving(false);
    }
  }, [isPlaying]);

  // Сброс overlay при смене блока
  // useLayoutEffect = BEFORE paint → ZERO glitch
  // (useEffect = after paint → 1 frame stale overlay visible)
  useLayoutEffect(() => {
    setPsOverlayTop(null);
    setIsTraveling(false);
    // Enter only if dissolve was active (travel-triggered block switch)
    // Normal block switches (first load, seek) → no enter animation
    if (isDissolving) {
      setIsEntering(true);
      setIsEnterMounted(false);
    }
    setIsDissolving(false);
  }, [displayBlock?.id, activeSubBlockIndex]);

  const psFontSize = slotMatrix && slotNextBlock
    ? getBlockFontSize(Math.min(slotNextBlock.lineIndices.length, MAX_SUB_BLOCK_LINES))
    : undefined;

  // ── BC Travel Up: rAF-driven movement ──
  const bcRef = useRef<HTMLDivElement>(null);

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
    if (!isLooping || loopStartLine === null || loopEndLine === null) return null;
    return { min: loopStartLine, max: loopEndLine };
  }, [isLooping, loopStartLine, loopEndLine]);

  // Line-scoped CSS variables for inactive lines (Others level)
  const getInactiveLineStyle = useCallback((level: typeof lineOthersLevel): React.CSSProperties => {
    switch (level) {
      case 'dim':
        return {
          '--bl-line-word-opacity': '0.35',
          '--bl-line-word-color': 'rgba(255, 255, 255, 0.4)',
        } as React.CSSProperties;
      case 'low':
        return {
          '--bl-line-word-opacity': '0.8',
          '--bl-line-word-color': 'rgba(255, 255, 255, 0.75)',
        } as React.CSSProperties;
      case 'medium':
      default:
        return {
          '--bl-line-word-opacity': '0.6',
          '--bl-line-word-color': 'var(--bl-text-muted, rgba(255, 255, 255, 0.6))',
        } as React.CSSProperties;
    }
  }, []);

  // CSS variables for Block Cue (structural first-line-of-next-block cue)
  const getBlockCueStyle = useCallback((level: typeof lineNextLevel): React.CSSProperties => {
    switch (level) {
      case 'off':
        return {
          '--bl-preview-opacity': '0.35',
          '--bl-preview-color': 'rgba(0, 210, 160, 0.38)',
          '--bl-preview-weight': '400',
        } as React.CSSProperties;
      case 'hint':
        return {
          '--bl-preview-opacity': '0.55',
          '--bl-preview-color': 'rgba(0, 210, 160, 0.65)',
          '--bl-preview-weight': '400',
        } as React.CSSProperties;
      case 'guide':
      default:
        return {
          '--bl-preview-opacity': '0.85',
          '--bl-preview-color': 'rgba(0, 210, 160, 0.90)',
          '--bl-preview-weight': '500',
        } as React.CSSProperties;
    }
  }, []);

  if (lines.length === 0) return null;

  if (displayBlock) {
    const fontSize = getBlockFontSize(visibleLineIndices.length);
    
    const nextLineIndexInBlock = activePositionInBlock >= 0 
      && activePositionInBlock < displayBlock.lineIndices.length - 1
        ? displayBlock.lineIndices[activePositionInBlock + 1]
        : -1;

    return (
      <div
        ref={rootRef}
        className={styles.root}
        data-reactive="true"
        data-line-active-level={lineActiveLevel}
        data-line-next-level={lineNextLevel}
        data-line-others-level={lineOthersLevel}
        data-line-others-source={lineOthersSource}
        style={{
          alignItems: rootAlignItems,
          '--plate-cue-x': cueLeft,
          '--plate-cover-width': `${Math.min(plateWidth, 70)}%`,
          '--plate-cover-center': coverCenterX,
          ...presetStyle,
        } as React.CSSProperties}
      >
        {showCoverBg && (
          <div className={styles.coverBackground}>
            {effectiveBgUrl && (
              <img
                key={effectiveBgUrl}
                src={effectiveBgUrl}
                className={styles.coverArtImage}
                alt=""
              />
            )}
          </div>
        )}
        <div ref={activeBlockRef} className={`${styles.activeBlock}${USE_SLOT_GRID && slotMatrix ? ` ${styles.slotMatrixActive}` : ''}`} 
          data-slot-group-id={activeSlotGroup?.id}
          data-slot-group-type={activeSlotGroup?.blockType}
          data-slot-group-color={activeSlotGroup?.blockColor}
          data-spotlight-active={effectivePreset.travel.spotlight.enabled ? 'true' : undefined}
          data-spotlight-dim-others={effectivePreset.travel.spotlight.dimOthers ? 'true' : undefined}
          data-traveling={isTraveling ? 'true' : undefined}
          data-dissolving={isDissolving ? 'true' : undefined}
          data-entering={isEntering ? 'true' : undefined}
          data-enter-mounted={isEnterMounted ? 'true' : undefined}
          style={
          (USE_SLOT_GRID && slotMatrix)
            ? plateStyle
            : { ...plateStyle, fontSize }
        }>
          {(USE_SLOT_GRID && slotMatrix) ? (
            <div 
              className={styles.slotContainer}
              data-slot-container="true"
              style={{ fontSize, gridTemplateRows } as React.CSSProperties}
            >
              {slotMatrix.slots.filter(s => !s.isEmpty).map((slot) => {
                const isActive = !slot.isPreview && slot.lineIndex === activeLineIndex;
                const isNext = !slot.isPreview && slot.lineIndex === nextLineIndexInBlock;
                const isOutOfLoop = isLooping && loopLineRange
                  ? (slot.lineIndex < loopLineRange.min || slot.lineIndex > loopLineRange.max)
                  : false;
                
                const nextLineOpacity = isNext
                  ? lineNextLevel === 'guide' ? 0.85
                  : lineNextLevel === 'hint' ? 0.65
                  : undefined
                  : undefined;
                
                const inactiveLineStyle = (!isActive && !isNext && !slot.isPreview)
                  ? getInactiveLineStyle(lineOthersLevel) 
                  : undefined;
                const nextLineOpacityStyle = (isNext && nextLineOpacity !== undefined) 
                  ? { opacity: nextLineOpacity } 
                  : {};

                // Canvas mode: grid ПС всегда скрыт — overlay управляет отображением
                // transition: none = мгновенное скрытие (без fade out 0.3s)
                const previewHiddenStyle = (USE_SLOT_CANVAS && slot.isPreview)
                  ? { opacity: 0, transition: 'none' }
                  : {};

                return (
                  <div
                    key={slot.id}
                    className={`${styles.line}${isOutOfLoop ? ` ${styles.lineOutOfLoop}` : ''}`}
                    data-line-index={slot.lineIndex}
                    data-slot-id={slot.id}
                    data-active={isActive ? 'true' : undefined}
                    data-is-preview={slot.isPreview ? 'true' : undefined}
                    data-grow-cue={slot.isPreview && shouldGrowPreview 
                        && psOverlayTop === null ? 'true' : undefined}
                    data-block-type={slot.isPreview ? slot.previewBlockType : displayBlock.type}
                    data-word-fx-mode={isActive ? wordFxMode : undefined}
                    data-reactive-words={
                      isActive && !slot.isPreview 
                        && useWordSyncStore.getState().hasUsableWordSyncForLine(slot.lineIndex) 
                        ? 'true' : undefined
                    }
                    data-line-next={isNext ? 'true' : undefined}
                    data-line-next-level={isNext ? lineNextLevel : undefined}
                    style={{
                      color: slot.isPreview ? slot.previewBlockColor : undefined,
                      fontSize: slot.isPreview ? psFontSize : undefined,
                      ...inactiveLineStyle,
                      ...nextLineOpacityStyle,
                      ...previewHiddenStyle,
                    }}
                  >
                    {wordFocusLevel === 'off' || slot.isPreview ? (
                      <span className={styles.plainLineText}>{slot.text}</span>
                    ) : (
                      <WordHighlightLine
                        lineIndex={slot.lineIndex}
                        text={slot.text}
                        fx={wordFxMode}
                        focus={wordFocusLevel}
                        blockType={slot.isPreview ? slot.previewBlockType ?? 'unknown' : displayBlock.type}
                      />
                    )}
                  </div>
                );
              })}

              {/* Grid path: Loop boundary rendering with slot.y positioning */}
              {isLooping && slotMatrix && (() => {
                const firstLoopSlot = slotMatrix.slots.find(s => !s.isPreview && !s.isEmpty && s.lineIndex === loopStartLine);
                const lastLoopSlot = slotMatrix.slots.find(s => !s.isPreview && !s.isEmpty && s.lineIndex === loopEndLine);
                const startInVisibleSub = firstLoopSlot && visibleLineIndices.includes(firstLoopSlot.lineIndex);
                const endInVisibleSub = lastLoopSlot && visibleLineIndices.includes(lastLoopSlot.lineIndex);

                return (
                  <>
                    {firstLoopSlot && startInVisibleSub && (
                      <div
                        className={styles.loopBoundary}
                        style={{ top: firstLoopSlot.y - 2 }}
                        onPointerDown={(e) => handleBoundaryDrag('start', e)}
                      />
                    )}
                    {lastLoopSlot && endInVisibleSub && (
                      <div
                        className={styles.loopBoundary}
                        style={{ top: lastLoopSlot.y + lastLoopSlot.height - 2 }}
                        onPointerDown={(e) => handleBoundaryDrag('end', e)}
                      />
                    )}
                  </>
                );
              })()}

              {/* Grid path: Loop boundary arrows for invisible boundaries */}
              {isLooping && slotMatrix && (() => {
                const firstLoopSlot = slotMatrix.slots.find(s => !s.isPreview && !s.isEmpty && s.lineIndex === loopStartLine);
                const lastLoopSlot = slotMatrix.slots.find(s => !s.isPreview && !s.isEmpty && s.lineIndex === loopEndLine);
                const startInVisibleSub = firstLoopSlot && visibleLineIndices.includes(firstLoopSlot.lineIndex);
                const endInVisibleSub = lastLoopSlot && visibleLineIndices.includes(lastLoopSlot.lineIndex);

                return (
                  <>
                    {firstLoopSlot && !startInVisibleSub && (
                      <div className={styles.loopBoundaryArrow} data-direction="up">↕</div>
                    )}
                    {lastLoopSlot && !endInVisibleSub && (
                      <div className={styles.loopBoundaryArrow} data-direction="down">↕</div>
                    )}
                  </>
                );
              })()}
            </div>
          ) : (
            visibleLineIndices.map((li) => {
            const showStartBefore = isLooping && loopStartLine === li;
            const showEndAfter = isLooping && loopEndLine === li;
            const isOutOfLoop = isLooping && loopStartLine !== null && loopEndLine !== null && (li < loopStartLine || li > loopEndLine);
            const isNextLine = li === nextLineIndexInBlock;
            const nextLineOpacity = isNextLine
              ? lineNextLevel === 'guide' ? 0.85
              : lineNextLevel === 'hint' ? 0.65
              : undefined
              : undefined;
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
                  data-word-fx-mode={li === activeLineIndex ? wordFxMode : undefined}
                  data-reactive-words={li === activeLineIndex && useWordSyncStore.getState().hasUsableWordSyncForLine(li) ? 'true' : undefined}
                  data-line-next={li === nextLineIndexInBlock ? 'true' : undefined}
                  data-line-next-level={li === nextLineIndexInBlock ? lineNextLevel : undefined}
                  style={{
                    ...(li !== nextLineIndexInBlock ? getInactiveLineStyle(lineOthersLevel) : {}),
                    ...(nextLineOpacity !== undefined ? { opacity: nextLineOpacity } : {}),
                  }}
                >
                  {wordFocusLevel === 'off' ? (
                    <span className={styles.plainLineText}>{lines[li] ?? ''}</span>
                  ) : (
                    <WordHighlightLine
                      lineIndex={li}
                      text={lines[li] ?? ''}
                      fx={wordFxMode}
                      focus={wordFocusLevel}
                      blockType={displayBlock.type}
                    />
                  )}
                </div>
                {showEndAfter && (
                  <div
                    className={styles.loopBoundary}
                    onPointerDown={(e) => handleBoundaryDrag('end', e)}
                  />
                )}
              </React.Fragment>
            );
          })
  )}
        </div>

        {/* ПС Travel Overlay — position:fixed (viewport coords) */}
        {USE_SLOT_CANVAS && psOverlayTop !== null && activeSlotGroup?.previewSlot && (() => {
          const previewSlot = activeSlotGroup.previewSlot;

          // Staleness guard: overlay должен показывать актуальный ПС
          // Уровень 1 (подблок): previewSlot.blockId === displayBlock.id
          // Уровень 2 (блок):    previewSlot.blockId === nextBlock.id
          const currentActiveSubBlock = slotMatrix?.activeSubBlock;
          const isSubBlockLevel = currentActiveSubBlock && !currentActiveSubBlock.isLast;

          if (isSubBlockLevel) {
            if (previewSlot.blockId !== displayBlock?.id) return null;
          } else {
            if (!nextBlock || previewSlot.blockId !== nextBlock.id) return null;
          }

          const block = activeBlockRef.current;
          const blockRect = block?.getBoundingClientRect();

          return (
            <div
              ref={overlayRef}
              className={styles.previewOverlay}
              data-travel-target={psOverlayTop}
              data-travel-block-id={nextBlockMeasureRef.current?.nextBlockId ?? undefined}
              data-travel-container-h={nextBlockMeasureRef.current?.containerHeight ?? undefined}
              data-travel-content-h={nextBlockMeasureRef.current?.contentHeight ?? undefined}
              style={{
                top: `${psOverlayTop}px`,
                left: blockRect ? `${blockRect.left}px` : '10%',
                width: blockRect ? `${blockRect.width}px` : '80%',
                fontSize: psFontSize ?? '2.6rem',
                color: previewSlot.previewBlockColor,
              }}
            >
              <span className={styles.plainLineText}>{previewSlot.text}</span>
            </div>
          );
        })()}

        {/* Block Cue: structural first-line-of-next-block cue.
            This is a separate semantic object from the public Line `Next Line` control.
            It remains always-on as a structural guide with fixed styling (not controlled by lineNextLevel).
            Grows when active line is last in current block ("get ready" signal). */}
        {!USE_SLOT_CANVAS && nextBlock && nextBlock.lineIndices.length > 0 && (
          <div
            ref={bcRef}
            className={styles.blockCue}
            data-block-type={nextBlock.type}
            data-grow-cue={shouldGrowBlockCue ? 'true' : undefined}
            style={{
              '--plate-cue-top': cueTop,
              '--bl-bc-font-size': bcFontSize ?? '0.85rem',
            } as React.CSSProperties}
          >
            <div className={styles.blockCueLine}>
              {lines[nextBlock.lineIndices[0]] ?? ''}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={styles.root}
      data-reactive="true"
      data-line-active-level={lineActiveLevel}
      data-line-next-level={lineNextLevel}
      data-line-others-level={lineOthersLevel}
        data-line-others-source={lineOthersSource}
    >
      <div className={styles.scrollContainer}>
        {lines.map((text, i) => (
          <div
            key={i}
            ref={i === activeLineIndex ? activeRef : undefined}
            className={styles.line}
            data-active={i === activeLineIndex}
            data-word-fx-mode={i === activeLineIndex ? wordFxMode : undefined}
            data-reactive-words={i === activeLineIndex && useWordSyncStore.getState().hasUsableWordSyncForLine(i) ? 'true' : undefined}
            style={getInactiveLineStyle(lineOthersLevel)}
          >
            {wordFocusLevel === 'off' ? (
              <span className={styles.plainLineText}>{text}</span>
            ) : (
              <WordHighlightLine
                lineIndex={i}
                text={text}
                fx={wordFxMode}
                focus={wordFocusLevel}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
