import { useState, useEffect, useMemo } from 'react';
import type { SlotCanvas } from './slot-matrix.types';
import { computeSlotCanvas } from './compute-slot-canvas';
import { useSlotMatrix } from './use-slot-matrix';
import { usePlateStore } from '../stores/plate.store';
import { useLyricsStore } from '../stores/lyrics.store';
import { useTextStyleStore } from '../stores/textStyle.store';

/** CSS var имена для viewport margins */
const HEADER_HEIGHT_VAR = '--react-header-height';
const WAGON_TRAIN_HEIGHT_VAR = '--wagon-train-height';
const DECK_HEIGHT_VAR = '--bl-deck-height';

/** Читает CSS var значение в px из :root */
function readCssVarPx(varName: string, fallback: number): number {
  const val = getComputedStyle(document.documentElement)
    .getPropertyValue(varName)?.trim();
  if (!val) return fallback;
  const px = parseFloat(val);
  return isNaN(px) ? fallback : px;
}

/** Вычисляет доступную высоту viewport (header → dock) */
function computeAvailableHeight(): number {
  const headerH = readCssVarPx(HEADER_HEIGHT_VAR, 64);
  const wagonH = readCssVarPx(WAGON_TRAIN_HEIGHT_VAR, 0);
  const dockH = readCssVarPx(DECK_HEIGHT_VAR, 76);
  return window.innerHeight - headerH - wagonH - dockH;
}

export function useSlotCanvas(): {
  canvas: SlotCanvas | null;
  viewportWidth: number;
  viewportHeight: number;
  isReady: boolean;
} {
  const {
    matrix, 
    activeSlotGroup, 
    nextBlock,
    isLastLineInSubBlock,
  } = useSlotMatrix();

  const lines = useLyricsStore(s => s.lines);
  const fontScale = useTextStyleStore(s => s.fontScale);
  const plateWidth = usePlateStore(s => s.width);

  // ═══ Viewport measurement ═══
  const [viewportSize, setViewportSize] = useState({
    width: window.innerWidth,
    height: computeAvailableHeight(),
  });

  useEffect(() => {
    const update = () => {
      setViewportSize({
        width: window.innerWidth,
        height: computeAvailableHeight(),
      });
    };

    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // ═══ shouldGrowPreview ═══
  const shouldGrowPreview = useMemo(() => {
    if (!matrix || !activeSlotGroup) return false;
    return isLastLineInSubBlock;
  }, [matrix, activeSlotGroup, isLastLineInSubBlock]);

  // ═══ SlotCanvas computation ═══
  const canvas = useMemo(() => {
    if (!matrix || !activeSlotGroup) return null;

    return computeSlotCanvas({
      matrix,
      activeSlotGroup,
      nextBlock: nextBlock ?? undefined,
      lines,
      fontScale,
      viewportWidth: viewportSize.width,
      viewportHeight: viewportSize.height,
      plateWidth,
      zoom: 1.0,
      shouldGrowPreview,
      gapPx: matrix.gapPx,
    });
  }, [
    matrix, activeSlotGroup, nextBlock, lines, fontScale,
    viewportSize, plateWidth, shouldGrowPreview,
  ]);

  return {
    canvas,
    viewportWidth: viewportSize.width,
    viewportHeight: viewportSize.height,
    isReady: canvas !== null,
  };
}
