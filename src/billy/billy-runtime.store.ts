import { create } from 'zustand';
import {
  type BillyMode,
  type BillyZone,
  CORNER_POS,
  ZONE_Z_INDEX,
  POS_MIN,
  POS_MAX,
  POSITION_DEADZONE,
} from './billy.constants';
import { useTrackInfoStore } from '../stores/trackInfo.store';

// ── Zone Boundaries (absolute px, updated on resize/track-change) ──
// INV-BILLY-COORD: hot-path использует только кэш, не getBoundingClientRect
export interface ZoneBounds {
  ground: { top: number; bottom: number };
  corner: { x: number; y: number };
  // W4: plaque, rope — добавятся в TC-BILLY-06
}

// ── Billy Runtime State ──
export interface BillyRuntimeState {
  // Position (normalized 0..1, INV-BILLY-ANCHOR: y = footY)
  posX: number;
  posY: number;
  targetX: number;
  targetY: number;

  // Mode & Zone
  mode: BillyMode;
  prevMode: BillyMode | null;     // для возврата после retreat
  zone: BillyZone;
  facing: 'left' | 'right';
  isMoving: boolean;
  modeTimer: number;              // ms в текущем режиме

  // Zone Cache (px, обновляется на resize/track-change)
  zones: ZoneBounds;

  // Velocity (для BPM-dependent speed)
  velocity: number;

  // Internal
  _lastTickTime: number;
}

// ── Actions ──
export interface BillyRuntimeActions {
  // Position
  setPosition: (x: number, y: number) => void;
  setTargetPosition: (x: number, y: number) => void;
  snapToTarget: () => void;        // deadzone snap

  // Mode
  setMode: (mode: BillyMode) => void;
  tickModeTimer: (dt: number) => void;

  // Zone
  setZone: (zone: BillyZone) => void;
  updateZoneCache: (zones: Partial<ZoneBounds>) => void;

  // Movement
  setFacing: (facing: 'left' | 'right') => void;
  setIsMoving: (moving: boolean) => void;
  setVelocity: (v: number) => void;

  // Lifecycle
  reset: () => void;               // before-track-change
  retreatToCorner: () => void;      // overlay open
  returnFromRetreat: () => void;    // overlay close

  // Computed (не в state, но доступны как функции)
  isOverlayOpen: () => boolean;
  effectiveZIndex: () => number;
}

// ── Initial State ──
const initialState: BillyRuntimeState = {
  posX: CORNER_POS.x,
  posY: CORNER_POS.y,
  targetX: CORNER_POS.x,
  targetY: CORNER_POS.y,
  mode: 'sleep',
  prevMode: null,
  zone: 'corner',
  facing: 'right',
  isMoving: false,
  modeTimer: 0,
  zones: {
    ground: { top: 0, bottom: 0 },  // обновится на resize
    corner: { x: CORNER_POS.x, y: CORNER_POS.y },
  },
  velocity: 0,
  _lastTickTime: performance.now(),
};

// ── Store ──
export const useBillyRuntimeStore = create<BillyRuntimeState & BillyRuntimeActions>()(
  (set, get) => ({
  ...initialState,

  // ── Position ──
  setPosition: (x, y) => set({
    posX: Math.max(POS_MIN, Math.min(POS_MAX, x)),
    posY: Math.max(POS_MIN, Math.min(POS_MAX, y)),
  }),

  setTargetPosition: (x, y) => set({
    targetX: Math.max(POS_MIN, Math.min(POS_MAX, x)),
    targetY: Math.max(POS_MIN, Math.min(POS_MAX, y)),
  }),

  snapToTarget: () => {
    const { targetX, targetY } = get();
    set({ posX: targetX, posY: targetY });
  },

  // ── Mode ──
  setMode: (mode) => set(state => ({
    mode,
    prevMode: state.mode,
    modeTimer: 0,
  })),

  tickModeTimer: (dt) => set(state => ({
    modeTimer: state.modeTimer + dt,
  })),

  // ── Zone ──
  setZone: (zone) => set({ zone }),

  updateZoneCache: (zones) => set(state => ({
    zones: { ...state.zones, ...zones },
  })),

  // ── Movement ──
  setFacing: (facing) => set({ facing }),
  setIsMoving: (moving) => set({ isMoving: moving }),
  setVelocity: (v) => set({ velocity: v }),

  // ── Lifecycle ──
  reset: () => set({
    ...initialState,
    zones: get().zones,  // сохранить кэш зон
  }),

  retreatToCorner: () => set(state => ({
    mode: 'retreat' as BillyMode,
    prevMode: state.mode,
    targetX: CORNER_POS.x,
    targetY: CORNER_POS.y,
    zone: 'corner',
    modeTimer: 0,
  })),

  returnFromRetreat: () => {
    const prevMode = get().prevMode;
    // Возврат в последний legal mode, не обязательно в место
    if (prevMode && prevMode !== 'retreat') {
      set({ mode: prevMode, prevMode: null, modeTimer: 0 });
    } else {
      set({ mode: 'patrol', prevMode: null, modeTimer: 0 });
    }
  },

  // ── Computed ──
  isOverlayOpen: () => {
    // W2: только trackInfoOpen. W3+: catalog, aiSettings, modals
    return useTrackInfoStore.getState().isOpen;
  },

  effectiveZIndex: () => {
    const { zone, mode } = get();
    if (mode === 'retreat') return ZONE_Z_INDEX.retreat;
    return ZONE_Z_INDEX[zone] ?? ZONE_Z_INDEX.corner;
  },
  }),
);

// ── Auto-reset on track change ──
if (typeof document !== 'undefined') {
  document.addEventListener('before-track-change', () => {
    useBillyRuntimeStore.getState().reset();
  });
}
