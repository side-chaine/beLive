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
  WALK_TARGET_OFFSET,
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

// ── Target Context (W3: control mode) ──
export interface BillyTargetContext {
  controlActive: boolean;
  controlDirection: 'left' | 'right' | 'none';
  patrolWaypointX: number;  // -1 = не активен
  currentPosX: number;
  currentPosY: number;
}

export const DEFAULT_TARGET_CONTEXT: BillyTargetContext = {
  controlActive: false,
  controlDirection: 'none',
  patrolWaypointX: -1,
  currentPosX: 0,
  currentPosY: 0,
};

// ── Target Position by Mode ──
export function resolveTarget(
  mode: BillyMode,
  zones: ZoneBounds,
  ctx: BillyTargetContext = DEFAULT_TARGET_CONTEXT,
): { x: number; y: number } {
  // ═══ Единая поверхность: верх ControlDeck ═══
  const surfaceY = zones.ground.bottom;

  // ═══ Control Mode: перехватывает ВСЕ режимы кроме jump ═══
  if (ctx.controlActive && mode !== 'jump' && mode !== 'retreat') {
    if (ctx.controlDirection !== 'none') {
      const targetX = ctx.controlDirection === 'right'
        ? Math.min(ctx.currentPosX + WALK_TARGET_OFFSET, zones.ground.right)
        : Math.max(ctx.currentPosX - WALK_TARGET_OFFSET, zones.ground.left);
      return { x: targetX, y: surfaceY };
    }
    // Стрелка отпущена — стоим на месте
    return { x: ctx.currentPosX, y: surfaceY };
  }

  switch (mode) {
    case 'sleep':
    case 'retreat':
      // Дом — правый нижний угол, ноги НА поверхности
      return { x: zones.corner.x, y: surfaceY };

    case 'think':
      // Наблюдает — ноги НА поверхности (не парит!)
      return { x: zones.corner.x, y: surfaceY };

    case 'patrol': {
      // NPC patrol: к waypoint или fallback на corner
      if (ctx.patrolWaypointX >= 0) {
        return { x: ctx.patrolWaypointX, y: surfaceY };
      }
      return { x: zones.corner.x, y: surfaceY };
    }

    case 'groove':
      // W2: стоит на месте, CSS танцует, глаза следят
      return { x: zones.corner.x, y: surfaceY };

    case 'jump':
      // Прыжок = CSS анимация, позиция НЕ меняется
      return { x: ctx.currentPosX, y: ctx.currentPosY };

    default:
      return { x: zones.corner.x, y: surfaceY };
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
  const target = resolveTarget(newMode, state.zones, {
    controlActive: inputs.controlActive,
    controlDirection: inputs.controlDirection,
    patrolWaypointX: -1,
    currentPosX: state.posX,
    currentPosY: state.posY,
  });
  const targetX = target.x;
  const targetY = target.y;

  // 4. Choose lerp responsiveness
  const lerpBase = resolveLerpBase(newMode);
  // Control Mode override — PLAYER responsiveness
  const effectiveLerpBase = inputs.controlActive
    ? RESPONSIVENESS.PLAYER
    : lerpBase;

  // 5. Apply frame-rate independent lerp
  const posX = lerpFir(state.posX, targetX, effectiveLerpBase, dt);
  const posY = lerpFir(state.posY, targetY, effectiveLerpBase, dt);

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
