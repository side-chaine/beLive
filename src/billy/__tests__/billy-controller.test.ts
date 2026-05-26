import { describe, it, expect } from 'vitest';
import { stepBilly, type BillyInputs, type BillyStepResult, DEFAULT_TARGET_CONTEXT } from '../billy-controller';
import type { BillyTargetContext } from '../billy-controller';
import type { BillyMode, BillyZone } from '../billy.constants';
import type { ZoneBounds } from '../billy-runtime.store';

// ── Types ──
// Local state type matching stepBilly's anonymous parameter type
interface StepState {
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
}

// ── Helpers ──

const CORNER_ZONES: ZoneBounds = {
  ground: { top: 0.1, bottom: 0.85, left: 0.02, right: 0.98 },
  corner: { x: 0.92, y: 0.85 },  // corner.y = ground.bottom (INV-BILLY-SURFACE)
};

function makeState(overrides: Partial<StepState> = {}): StepState {
  return {
    posX: 0.92,
    posY: 0.92,
    targetX: 0.92,
    targetY: 0.92,
    mode: 'patrol',
    prevMode: null,
    zone: 'corner',
    facing: 'right',
    isMoving: false,
    modeTimer: 0,
    velocity: 0,
    zones: CORNER_ZONES,
    ...overrides,
  };
}

function makeInputs(overrides: Partial<BillyInputs> = {}): BillyInputs {
  return {
    isPlaying: false,
    isAiStreaming: false,
    hasTrack: true,
    isLooping: false,
    isRecording: false,
    isOverlayOpen: false,
    bpm: 120,
    activeLineIndex: -1,
    activeBlockType: null,
    mode: 'rehearsal',
    ...overrides,
  };
}

const DT = 1 / 60; // ~16.67ms

// ── Wrapper: stepBilly returns BillyStepResult without zones.
//     For chained calls we preserve zones from previous state. ──
function step(state: StepState, inputs: BillyInputs, dt = DT): StepState {
  return { ...stepBilly(state, inputs, dt), zones: state.zones };
}

// ── Test Suite ──

describe('billy-controller (stepBilly)', () => {

  // ── Mode Transitions ──

  describe('mode transitions', () => {

    it('no track → sleep', () => {
      const state = makeState({ mode: 'patrol' });
      const inputs = makeInputs({ hasTrack: false });
      const result = step(state, inputs, DT);
      expect(result.mode).toBe('sleep');
    });

    it('has track + not playing + not streaming → patrol', () => {
      const state = makeState({ mode: 'sleep' });
      const inputs = makeInputs({ hasTrack: true, isPlaying: false, isAiStreaming: false });
      const result = step(state, inputs, DT);
      expect(result.mode).toBe('patrol');
    });

    it('isPlaying → groove', () => {
      const state = makeState({ mode: 'patrol' });
      const inputs = makeInputs({ isPlaying: true });
      const result = step(state, inputs, DT);
      expect(result.mode).toBe('groove');
    });

    it('isAiStreaming → think (overrides groove)', () => {
      const state = makeState({ mode: 'groove' });
      const inputs = makeInputs({ isAiStreaming: true, isPlaying: true });
      const result = step(state, inputs, DT);
      expect(result.mode).toBe('think');
    });

    it('streaming stops while playing → groove', () => {
      const state = makeState({ mode: 'think' });
      const inputs = makeInputs({ isAiStreaming: false, isPlaying: true });
      const result = step(state, inputs, DT);
      expect(result.mode).toBe('groove');
    });

    it('streaming stops while not playing → patrol', () => {
      const state = makeState({ mode: 'think' });
      const inputs = makeInputs({ isAiStreaming: false, isPlaying: false });
      const result = step(state, inputs, DT);
      expect(result.mode).toBe('patrol');
    });

    it('playing stops → patrol', () => {
      const state = makeState({ mode: 'groove' });
      const inputs = makeInputs({ isPlaying: false });
      const result = step(state, inputs, DT);
      expect(result.mode).toBe('patrol');
    });
  });

  // ── Priority Chain ──

  describe('priority chain', () => {

    it('sleep < patrol < groove < think (priority order)', () => {
      // No track = sleep, regardless of other flags
      const s1 = step(makeState(), makeInputs({ hasTrack: false, isPlaying: true, isAiStreaming: true }), DT);
      expect(s1.mode).toBe('sleep');

      // Has track, not playing, streaming = think
      const s2 = step(makeState(), makeInputs({ hasTrack: true, isPlaying: false, isAiStreaming: true }), DT);
      expect(s2.mode).toBe('think');

      // Has track, playing, streaming = think (think > groove)
      const s3 = step(makeState(), makeInputs({ hasTrack: true, isPlaying: true, isAiStreaming: true }), DT);
      expect(s3.mode).toBe('think');

      // Has track, playing, not streaming = groove
      const s4 = step(makeState(), makeInputs({ hasTrack: true, isPlaying: true, isAiStreaming: false }), DT);
      expect(s4.mode).toBe('groove');
    });
  });

  // ── Facing ──

  describe('facing', () => {

    it('does not flip without movement', () => {
      const state = makeState({ facing: 'right' });
      const inputs = makeInputs({ isPlaying: false });
      const result = step(state, inputs, DT);
      expect(result.facing).toBe('right');
    });
  });

  // ── modeTimer ──

  describe('modeTimer', () => {

    it('increments each tick', () => {
      const state = makeState({ modeTimer: 0 });
      const inputs = makeInputs();
      const result = step(state, inputs, DT);
      expect(result.modeTimer).toBeGreaterThan(0);
    });

    it('resets on mode change', () => {
      const state = makeState({ mode: 'patrol', modeTimer: 5000 });
      const inputs = makeInputs({ isPlaying: true }); // → groove
      const result = step(state, inputs, DT);
      expect(result.mode).toBe('groove');
      expect(result.modeTimer).toBeLessThan(DT * 1000 + 1); // fresh timer
    });
  });

  // ── Edge Cases ──

  describe('edge cases', () => {

    it('dt = 0 does not crash', () => {
      const state = makeState();
      const inputs = makeInputs();
      expect(() => step(state, inputs, 0)).not.toThrow();
    });

    it('very large dt does not crash', () => {
      const state = makeState();
      const inputs = makeInputs();
      expect(() => step(state, inputs, 10)).not.toThrow();
    });

    it('same mode returns consistent state', () => {
      const state = makeState({ mode: 'patrol' });
      const inputs = makeInputs({ hasTrack: true, isPlaying: false, isAiStreaming: false });
      const r1 = step(state, inputs, DT);
      const r2 = step(r1, inputs, DT);
      expect(r1.mode).toBe(r2.mode);
    });

    it('multiple rapid mode changes', () => {
      let state = makeState({ mode: 'sleep' });

      // sleep → patrol (track loaded)
      state = step(state, makeInputs({ hasTrack: true }), DT);
      expect(state.mode).toBe('patrol');

      // patrol → groove (play)
      state = step(state, makeInputs({ hasTrack: true, isPlaying: true }), DT);
      expect(state.mode).toBe('groove');

      // groove → think (AI starts)
      state = step(state, makeInputs({ hasTrack: true, isPlaying: true, isAiStreaming: true }), DT);
      expect(state.mode).toBe('think');

      // think → patrol (AI stops, play stops)
      state = step(state, makeInputs({ hasTrack: true, isPlaying: false, isAiStreaming: false }), DT);
      expect(state.mode).toBe('patrol');

      // patrol → sleep (track removed)
      state = step(state, makeInputs({ hasTrack: false }), DT);
      expect(state.mode).toBe('sleep');
    });
  });

  // ── Position ──

  describe('position', () => {

    it('sleep mode stays in corner', () => {
      const state = makeState({ mode: 'sleep', posX: 0.92, posY: 0.85 });
      const inputs = makeInputs({ hasTrack: false });
      const result = step(state, inputs, DT);
      expect(result.posX).toBeCloseTo(0.92, 1);
      expect(result.posY).toBeCloseTo(0.85, 1); // surfaceY = ground.bottom
    });

    it('patrol mode stays in place', () => {
      const state = makeState({ mode: 'patrol', posX: 0.5, posY: 0.85 });
      const inputs = makeInputs({ hasTrack: true });
      const result = step(state, inputs, DT);
      expect(result.posX).toBeCloseTo(0.5, 1);
    });
  });

  // ── Overlay Retreat ──

  describe('overlay retreat', () => {

    it('isOverlayOpen → retreat', () => {
      const state = makeState({ mode: 'groove' });
      const inputs = makeInputs({ isOverlayOpen: true, isPlaying: true });
      const result = step(state, inputs, DT);
      expect(result.mode).toBe('retreat');
    });

    it('returns to previous mode after retreat duration', () => {
      // After RETREAT_DURATION ms, retreat should end
      const RETREAT_DURATION = 400;
      const state = makeState({ mode: 'retreat', prevMode: 'groove', modeTimer: RETREAT_DURATION + 1, posY: 0.85 });
      const inputs = makeInputs({ isOverlayOpen: false, isPlaying: true });
      const result = step(state, inputs, DT);
      expect(result.mode).toBe('groove');
    });
  });
});

describe('control movement', () => {
  it('control right → targetX increases from current position', () => {
    const ctx: BillyTargetContext = {
      ...DEFAULT_TARGET_CONTEXT,
      controlActive: true,
      controlDirection: 'right',
      currentPosX: 0.5,
    };
    const result = stepBilly(
      makeState({ mode: 'patrol', posX: 0.5 }),
      makeInputs({ controlActive: true, controlDirection: 'right' }),
      DT,
      ctx,
    );
    expect(result.targetX).toBeGreaterThan(0.5);
  });

  it('control left → targetX decreases from current position', () => {
    const ctx: BillyTargetContext = {
      ...DEFAULT_TARGET_CONTEXT,
      controlActive: true,
      controlDirection: 'left',
      currentPosX: 0.5,
    };
    const result = stepBilly(
      makeState({ mode: 'patrol', posX: 0.5 }),
      makeInputs({ controlActive: true, controlDirection: 'left' }),
      DT,
      ctx,
    );
    expect(result.targetX).toBeLessThan(0.5);
  });

  it('control none → stays in place', () => {
    const ctx: BillyTargetContext = {
      ...DEFAULT_TARGET_CONTEXT,
      controlActive: true,
      controlDirection: 'none',
      currentPosX: 0.5,
    };
    const result = stepBilly(
      makeState({ mode: 'patrol', posX: 0.5 }),
      makeInputs({ controlActive: true, controlDirection: 'none' }),
      DT,
      ctx,
    );
    expect(result.targetX).toBeCloseTo(0.5, 2);
  });

  it('control right → facing right', () => {
    const ctx: BillyTargetContext = {
      ...DEFAULT_TARGET_CONTEXT,
      controlActive: true,
      controlDirection: 'right',
      currentPosX: 0.5,
    };
    const result = stepBilly(
      makeState({ mode: 'patrol', posX: 0.5, facing: 'left' }),
      makeInputs({ controlActive: true, controlDirection: 'right' }),
      DT,
      ctx,
    );
    expect(result.facing).toBe('right');
  });

  it('control left → facing left', () => {
    const ctx: BillyTargetContext = {
      ...DEFAULT_TARGET_CONTEXT,
      controlActive: true,
      controlDirection: 'left',
      currentPosX: 0.5,
    };
    const result = stepBilly(
      makeState({ mode: 'patrol', posX: 0.5, facing: 'right' }),
      makeInputs({ controlActive: true, controlDirection: 'left' }),
      DT,
      ctx,
    );
    expect(result.facing).toBe('left');
  });

  it('clamped at ground.left boundary', () => {
    const ctx: BillyTargetContext = {
      ...DEFAULT_TARGET_CONTEXT,
      controlActive: true,
      controlDirection: 'left',
      currentPosX: CORNER_ZONES.ground.left,
    };
    const result = stepBilly(
      makeState({ mode: 'patrol', posX: CORNER_ZONES.ground.left }),
      makeInputs({ controlActive: true, controlDirection: 'left' }),
      DT,
      ctx,
    );
    expect(result.targetX).toBeGreaterThanOrEqual(CORNER_ZONES.ground.left);
  });

  it('clamped at ground.right boundary', () => {
    const ctx: BillyTargetContext = {
      ...DEFAULT_TARGET_CONTEXT,
      controlActive: true,
      controlDirection: 'right',
      currentPosX: CORNER_ZONES.ground.right,
    };
    const result = stepBilly(
      makeState({ mode: 'patrol', posX: CORNER_ZONES.ground.right }),
      makeInputs({ controlActive: true, controlDirection: 'right' }),
      DT,
      ctx,
    );
    expect(result.targetX).toBeLessThanOrEqual(CORNER_ZONES.ground.right);
  });

});
