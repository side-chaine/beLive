import { useEffect, useRef, type RefObject } from 'react';
import { stepBilly, type BillyInputs } from '../billy/billy-controller';
import {
  getBillyHotState,
  setBillyHotState,
  computePixelPosition,
  resetBillyHotState,
} from '../billy/billy-runtime';
import { useBillyRuntimeStore } from '../billy/billy-runtime.store';
import { useAudioStore } from '../stores/audio.store';
import { useTrackInfoStore } from '../stores/trackInfo.store';
import { useTrackStore } from '../stores/track.store';
import { POSITION_DEADZONE, RESPONSIVENESS, LOCOMOTION_FPS } from '../billy/billy.constants';

// ═══ Billy Locomotion Hook ═══
// INV-BILLY-TICK: tickBilly не знает откуда её зовут
// INV-BILLY-NO-RERENDER: Пишет transform напрямую в DOM через ref

interface LocomotionRefs {
  rootRef: RefObject<HTMLDivElement | null>;
}

export function useBillyLocomotion(refs: LocomotionRefs) {
  const frameCountRef = useRef(0);

  console.log('[Billy] useBillyLocomotion MOUNTED, rootRef:', refs.rootRef?.current);

  // ── Diagnostic flags (one-shot) ──
  let _loggedFirstTick = false;
  let _loggedFirstWrite = false;

  // ── Tick Function (чистая, INV-BILLY-TICK) ──
  const tickBilly = useRef(() => {
    const rootEl = refs.rootRef?.current;
    if (!rootEl) {
      console.warn('[Billy] tick: rootEl is null');
      return;
    }

    // One-shot first-tick log
    if (!_loggedFirstTick) {
      console.log('[Billy] first tick, mode:', useBillyRuntimeStore.getState().mode);
      _loggedFirstTick = true;
    }

    // 1. Read hot state (singleton, no re-render)
    const hotState = getBillyHotState();

    // 2. Read low-freq state (store, no subscribe)
    const storeState = useBillyRuntimeStore.getState();

    // 3. Compute dt
    const now = performance.now();
    const dtMs = now - hotState._lastTickTime;
    const dt = Math.min(dtMs / 1000, 0.1); // cap at 100ms
    setBillyHotState({ _lastTickTime: now });

    // 4. Collect inputs
    const inputs: BillyInputs = {
      isPlaying: useAudioStore.getState().isPlaying,
      isAiStreaming: useTrackInfoStore.getState().isAiStreaming,
      hasTrack: !!useTrackStore.getState().currentTrack,
      isLooping: false,         // TODO: из loop.store
      isRecording: false,       // TODO: из recording.store
      isOverlayOpen: useTrackInfoStore.getState().isOpen,
      bpm: 120,                 // TODO: из audio.store.bpm
      activeLineIndex: -1,      // TODO: из lyrics.store
      activeBlockType: null,    // TODO: из blocks.store
      mode: 'rehearsal',       // TODO: из mode.store
    };

    // 5. Step FSM
    const result = stepBilly(
      {
        posX: hotState.posX,
        posY: hotState.posY,
        targetX: hotState.targetX,
        targetY: hotState.targetY,
        mode: storeState.mode,
        prevMode: storeState.prevMode,
        zone: storeState.zone,
        facing: storeState.facing,
        isMoving: hotState.isMoving,
        modeTimer: storeState.modeTimer,
        velocity: hotState.velocity,
        zones: storeState.zones,
      },
      inputs,
      dt,
    );

    // 6. Convert to pixels
    const { pixelX, pixelY } = computePixelPosition(result.posX, result.posY);

    // 7. Update hot state (singleton)
    setBillyHotState({
      posX: result.posX,
      posY: result.posY,
      targetX: result.targetX,
      targetY: result.targetY,
      pixelX,
      pixelY,
      velocity: result.velocity,
      isMoving: result.isMoving,
    });

    // 8. Write transform directly to DOM (INV-BILLY-NO-RERENDER)
    const scaleX = result.facing === 'left' ? -1 : 1;
    if (!_loggedFirstWrite) {
      console.log('[Billy] first style write:', `translate(${pixelX}px, ${pixelY}px) scaleX(${scaleX})`);
      _loggedFirstWrite = true;
    }
    rootEl.style.transform = `translate(${pixelX}px, ${pixelY}px) scaleX(${scaleX})`;

    // 9. Write .moving class (for will-change)
    if (result.isMoving) {
      rootEl.classList.add('moving');
    } else {
      rootEl.classList.remove('moving');
    }

    // 10. Update store ONLY on mode/zone/facing change (low-freq)
    const modeChanged = result.mode !== storeState.mode;
    const zoneChanged = result.zone !== storeState.zone;
    const facingChanged = result.facing !== storeState.facing;

    if (modeChanged || zoneChanged || facingChanged) {
      useBillyRuntimeStore.setState({
        mode: result.mode,
        prevMode: result.prevMode,
        zone: result.zone,
        facing: result.facing,
        modeTimer: result.modeTimer,
      });
    } else if (result.modeTimer !== storeState.modeTimer) {
      // Timer update only (cheap)
      useBillyRuntimeStore.setState({ modeTimer: result.modeTimer });
    }
  });

  // ── rAF Runner (INV-BILLY-TICK: tick не знает об оркестраторе) ──
  useEffect(() => {
    console.log('[Billy] rAF loop useEffect starting');
    // W2: собственный rAF. W3: миграция в scheduler — одна строка
    let rafId: number;
    const loop = () => {
      frameCountRef.current++;

      // 30fps default (каждый 2-й кадр)
      // TODO: читать tier из performance.store для fps
      if (frameCountRef.current % 2 === 0) {
        tickBilly.current();
      }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, []);

  // ── Reset on track change ──
  useEffect(() => {
    const handler = () => {
      resetBillyHotState();
      useBillyRuntimeStore.getState().reset();
    };
    document.addEventListener('before-track-change', handler);
    return () => document.removeEventListener('before-track-change', handler);
  }, []);
}
