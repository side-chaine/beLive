import {
  CORNER_POS,
  BILLY_WIDTH,
  BILLY_HEIGHT,
  BILLY_HALF_WIDTH,
  BILLY_VISUAL_FOOT_Y,
  type BillyMode,
  type BillyZone,
} from './billy.constants';

// ═══ Billy Runtime — Module-Level Singleton ═══
// INV-BILLY-NO-RERENDER: Hot-path state, НЕ через Zustand
// Только этот модуль владеет позиционными данными.
// Zustand (billy-runtime.store) владеет ТОЛЬКО mode/facing/zone.

export interface BillyHotState {
  // Position (normalized 0..1)
  posX: number;
  posY: number;
  targetX: number;
  targetY: number;

  // Position (pixel, для DOM write)
  pixelX: number;
  pixelY: number;

  // Movement
  velocity: number;
  isMoving: boolean;

  // Transient timer — ms в текущем режиме (hot-path, не store)
  modeTimer: number;

  _lastTickTime: number;
}

// ── Singleton State ──
let _state: BillyHotState = {
  posX: CORNER_POS.x,
  posY: CORNER_POS.y,
  targetX: CORNER_POS.x,
  targetY: CORNER_POS.y,
  pixelX: 0,   // вычислится при первом tick
  pixelY: 0,
  velocity: 0,
  isMoving: false,
  modeTimer: 0,
  _lastTickTime: performance.now(),
};

// ── Getters (для чтения из hook/bridge) ──
export function getBillyHotState(): Readonly<BillyHotState> {
  return _state;
}

export function getBillyPosition(): { posX: number; posY: number } {
  return { posX: _state.posX, posY: _state.posY };
}

export function getBillyPixel(): { pixelX: number; pixelY: number } {
  return { pixelX: _state.pixelX, pixelY: _state.pixelY };
}

export function getBillyIsMoving(): boolean {
  return _state.isMoving;
}

export function getBillyModeTimer(): number {
  return _state.modeTimer;
}

// ── Setters (только для useBillyLocomotion) ──
export function setBillyHotState(update: Partial<BillyHotState>): void {
  _state = { ..._state, ...update };
}

// ── Reset (before-track-change) ──
export function resetBillyHotState(): void {
  _state = {
    posX: CORNER_POS.x,
    posY: CORNER_POS.y,
    targetX: CORNER_POS.x,
    targetY: CORNER_POS.y,
    pixelX: 0,
    pixelY: 0,
    velocity: 0,
    isMoving: false,
    modeTimer: 0,
    _lastTickTime: performance.now(),
  };
  invalidateLineCache();
}

// ── Coordinate Conversion ──
// INV-BILLY-COORD: hot-path использует только нормализованные + кэш зон
export function computePixelPosition(
  posX: number,
  posY: number,
): { pixelX: number; pixelY: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  return {
    pixelX: posX * vw - BILLY_HALF_WIDTH,
    // BILLY_VISUAL_FOOT_Y (85) вместо BILLY_HEIGHT (91)
    // Убирает 6px зазор между визуальными ногами и поверхностью
    pixelY: posY * vh - BILLY_VISUAL_FOOT_Y,
  };
}

// ── Initial Pixel Position (для useLayoutEffect) ──
export function getInitialPixelPosition(): { pixelX: number; pixelY: number } {
  return computePixelPosition(CORNER_POS.x, CORNER_POS.y);
}

// ── Public alias for bridge (same as resetBillyHotState) ──
export const resetBillyState = resetBillyHotState;

// ── Line Slot Cache (for Eye Tracking) ──
// INV-BILLY-CACHE: querySelector только при смене строки (~1/сек)
// НЕ в hot path — обновляется по событию, читается каждый tick
export interface LineSlot {
  lineIndex: number;
  centerX: number;
  centerY: number;
  width: number;
  isAboveFold: boolean;
}

let _activeLineSlot: LineSlot | null = null;
let _cachedLineIndex: number = -1;

export function getActiveLineSlot(): LineSlot | null {
  return _activeLineSlot;
}

export function updateLineSlotCache(lineIndex: number): void {
  if (lineIndex === _cachedLineIndex && _activeLineSlot) return; // cache hit
  if (lineIndex < 0) {
    _activeLineSlot = null;
    _cachedLineIndex = lineIndex;
    return;
  }
  const el = document.querySelector(`[data-line-index="${lineIndex}"]`);
  if (!el) {
    _activeLineSlot = null;
    _cachedLineIndex = lineIndex;
    return;
  }
  const rect = el.getBoundingClientRect();
  _activeLineSlot = {
    lineIndex,
    centerX: rect.left + rect.width / 2,
    centerY: rect.top + rect.height / 2,
    width: rect.width,
    isAboveFold: rect.top > 0 && rect.bottom < window.innerHeight,
  };
  _cachedLineIndex = lineIndex;
}

export function invalidateLineCache(): void {
  _activeLineSlot = null;
  _cachedLineIndex = -1;
}
