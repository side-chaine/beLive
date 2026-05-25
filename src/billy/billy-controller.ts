import {
  RESPONSIVENESS,
  POSITION_DEADZONE,
  CORNER_POS,
  BPM_BASE,
  BPM_SOFT_CAP_THRESHOLD,
  BPM_SOFT_CAP_DECAY,
  SPEED_BASE,
  SPEED_MIN,
  SPEED_MAX,
  RETREAT_DURATION,
  JUMP_DURATION,
  type BillyMode,
  type BillyZone,
} from './billy.constants';
import type { ZoneBounds } from './billy-runtime.store';

// ═══ Billy Controller — Pure Function FSM ═══
// INV-BILLY-DOMAINS: Tier ⊥ FSM ⊥ Audio
// No side effects. No DOM. No events. 100% testable.

// ── Inputs (fixed interface, part unused in W2) ──
export interface BillyInputs {
  isPlaying: boolean;
  isAiStreaming: boolean;
  hasTrack: boolean;
  isLooping: boolean;
  isRecording: boolean;
  isOverlayOpen: boolean;
  bpm: number;
  activeLineIndex: number;
  activeBlockType: string | null;
  mode: string; // app mode: rehearsal/karaoke/concert/live

  // W3 — Control Mode (INV-BILLY-CTRL: modifier, not mode)
  controlActive: boolean;
  controlDirection: 'left' | 'right' | 'none';
  jumpRequest: 'single' | 'double' | null;
  attackRequest: string | null; // 'limb' | null (W5: Mic Grab)
}

// ── Step Result ──
export interface BillyStepResult {
  posX: number;
  posY: number;
  targetX: number;
  targetY: number;
  mode: BillyMode;
  prevMode: BillyMode | null;
  zone: BillyZone;
  facing: 'left' | 'right';
  isMoving: boolean;
  modeTimer: number;
  velocity: number;
}

// ── BPM Speed Calculation ──
// Soft-cap: linear до 1.5x, затухание после
export function computeBpmSpeed(bpm: number): number {
  const factor = (bpm || BPM_BASE) / BPM_BASE;
  const speedFactor = factor < BPM_SOFT_CAP_THRESHOLD
    ? factor
    : BPM_SOFT_CAP_THRESHOLD + (factor - BPM_SOFT_CAP_THRESHOLD) * BPM_SOFT_CAP_DECAY;
  return Math.max(SPEED_MIN, Math.min(SPEED_MAX, SPEED_BASE * speedFactor));
}

// ── Frame-rate Independent Lerp ──
// INV-BILLY-FRAMERATE: lerpAdj = 1 - Math.pow(1 - base, dt * 60)
export function lerpFir(
  current: number,
  target: number,
  base: number,
  dt: number,
): number {
  if (Math.abs(target - current) < POSITION_DEADZONE) return target;
  const lerpAdj = 1 - Math.pow(1 - base, dt * 60);
  return current + (target - current) * lerpAdj;
}

// ── Mode Resolution (priority-based) ──
export function resolveMode(
  currentMode: BillyMode,
  inputs: BillyInputs,
  modeTimer: number,
): BillyMode {
  // Transient: check duration first
  if (currentMode === 'retreat' && modeTimer < RETREAT_DURATION) return 'retreat';
  if (currentMode === 'jump' && modeTimer < JUMP_DURATION) return 'jump';

  // Overlay retreat (highest non-transient priority)
  if (inputs.isOverlayOpen) return 'retreat';

  // Core mode resolution (priority: sleep > think > groove > patrol)
  if (!inputs.hasTrack) return 'sleep';
  if (inputs.isAiStreaming) return 'think';
  if (inputs.isPlaying) return 'groove';
  return 'patrol';
}

// ── Target Position by Mode ──
export function resolveTarget(
  mode: BillyMode,
  zones: ZoneBounds,
): { x: number; y: number } {
  switch (mode) {
    case 'sleep':
    case 'think':
    case 'retreat':
      // Corner — "дом" Билли
      return { x: zones.corner.x, y: zones.corner.y };

    case 'patrol':
      // W2: idle drift на месте. W4: patrol по ground зоне
      return { x: zones.corner.x, y: zones.corner.y };

    case 'groove':
      // Танцует на месте. Анимация = CSS, позиция стабильна
      return { x: zones.corner.x, y: zones.corner.y };

    case 'jump':
      // Jump = CSS анимация, позиция не меняется
      return { x: zones.corner.x, y: zones.corner.y };

    default:
      return { x: CORNER_POS.x, y: CORNER_POS.y };
  }
}

// ── Lerp Responsiveness by Mode ──
export function resolveLerpBase(mode: BillyMode): number {
  switch (mode) {
    case 'retreat':  return RESPONSIVENESS.CHASE;       // Быстро в угол
    case 'patrol':   return RESPONSIVENESS.NPC_PATROL;  // Ленивый
    case 'groove':   return RESPONSIVENESS.NPC_GROOVE;  // На месте
    case 'think':    return RESPONSIVENESS.IDLE_DRIFT;  // Почти статичный
    case 'sleep':    return RESPONSIVENESS.IDLE_DRIFT;  // Почти статичный
    case 'jump':     return RESPONSIVENESS.IDLE_DRIFT;  // CSS animates
    default:         return RESPONSIVENESS.IDLE_DRIFT;
  }
}

// ── Zone by Mode ──
export function resolveZone(mode: BillyMode): BillyZone {
  switch (mode) {
    case 'patrol':
    case 'groove':
      return 'ground'; // W2: логически ground, физически corner (нет zone CSS vars)
    case 'sleep':
    case 'think':
    case 'retreat':
    case 'jump':
      return 'corner';
    default:
      return 'corner';
  }
}

// ── Main Step Function ──
// Pure function: state + inputs + dt → new state
// No side effects. No DOM. No events.
export function stepBilly(
  state: {
    posX: number;
    posY: number;
    targetX: number;
    targetY: number;
    mode: BillyMode;
    prevMode: BillyMode | null;
    zone: BillyZone;
    facing: 'left' | 'right';
    isMoving: boolean;
    modeTimer: number;
    velocity: number;
    zones: ZoneBounds;
  },
  inputs: BillyInputs,
  dt: number,
): BillyStepResult {
  // 1. Resolve mode
  const newMode = resolveMode(state.mode, inputs, state.modeTimer);

  // 2. Track mode change
  const modeChanged = newMode !== state.mode;
  const prevMode = modeChanged ? state.mode : state.prevMode;
  const modeTimer = modeChanged ? 0 : state.modeTimer + dt * 1000;

  // 3. Resolve target position
  const target = resolveTarget(newMode, state.zones);
  const targetX = target.x;
  const targetY = target.y;

  // 4. Choose lerp responsiveness
  const lerpBase = resolveLerpBase(newMode);

  // 5. Apply frame-rate independent lerp
  const posX = lerpFir(state.posX, targetX, lerpBase, dt);
  const posY = lerpFir(state.posY, targetY, lerpBase, dt);

  // 6. Compute movement state
  const dx = targetX - posX;
  const dy = targetY - posY;
  const isMoving = Math.abs(dx) > POSITION_DEADZONE
    || Math.abs(dy) > POSITION_DEADZONE;

  // 7. Facing direction
  const facing = dx > POSITION_DEADZONE
    ? 'right'
    : dx < -POSITION_DEADZONE
      ? 'left'
      : state.facing;

  // 8. Velocity (BPM-dependent when moving)
  const velocity = isMoving ? computeBpmSpeed(inputs.bpm) : 0;

  // 9. Zone
  const zone = resolveZone(newMode);

  return {
    posX,
    posY,
    targetX,
    targetY,
    mode: newMode,
    prevMode,
    zone,
    facing,
    isMoving,
    modeTimer,
    velocity,
  };
}
