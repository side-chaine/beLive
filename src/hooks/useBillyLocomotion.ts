import { useEffect, useRef, type RefObject } from 'react';
import { stepBilly, type BillyInputs } from '../billy/billy-controller';
import {
  getBillyHotState,
  setBillyHotState,
  computePixelPosition,
  resetBillyHotState,
  updateLineSlotCache,
  getActiveLineSlot,
} from '../billy/billy-runtime';
import { useBillyRuntimeStore } from '../billy/billy-runtime.store';
import { useAudioStore } from '../stores/audio.store';
import { useTrackInfoStore } from '../stores/trackInfo.store';
import { useTrackStore } from '../stores/track.store';
import { useLoopStore } from '../stores/loop.store';
import { useRecordingStore } from '../stores/recording.store';
import { useModeStore } from '../stores/mode.store';
import { useLyricsStore } from '../stores/lyrics.store';
import { usePerformanceStore } from '../performance/performance.store';
import { isBillyControlActive } from './useBillyControl';
import {
  BILLY_HALF_WIDTH,
  BILLY_HEIGHT,
  POSITION_DEADZONE,
  PUPIL_OFFSET_MAX_X,
  PUPIL_OFFSET_MAX_Y,
  PUPIL_RADIUS_BASE,
  PUPIL_RADIUS_MIN,
  PUPIL_RADIUS_MAX,
  PUPIL_FOCUS_DELTA,
} from '../billy/billy.constants';

// ── Module-level rAF guard for HMR / StrictMode ──
// Prevents duplicate rAF loops when React re-mounts the effect
// without proper cleanup (fast-refresh / StrictMode edge cases).
let _loopRunning = false;
let _loopRafId: number | null = null;

// ═══ Billy Locomotion Hook ═══
// INV-BILLY-TICK: tickBilly не знает откуда её зовут
// INV-BILLY-NO-RERENDER: Пишет transform напрямую в DOM через ref

interface LocomotionRefs {
  rootRef: RefObject<HTMLDivElement | null>;
  onPupilUpdate?: (offsetX: number, offsetY: number, radius: number) => void;
}

export function useBillyLocomotion(refs: LocomotionRefs) {
  const frameCountRef = useRef(0);

  // (removed spam log — mounted state visible via first tick/first write logs)

  // ── Diagnostic flags (one-shot) ──
  // (removed debug flags)

  // ── Idle Curiosity — closure vars (НЕ singleton, НЕ store) ──
  // Меняется < 1 раз/сек → не hot state. Живёт внутри hook lifecycle.
  let _curiosityShift = { x: 0, y: 0 };
  let _curiosityTimer = 0;
  let _nextCuriosityAt = 8000 + Math.random() * 7000;
  let _lastLineIndex = -1;
  // (removed — diagnostic complete)

  // ── Tick Function (чистая, INV-BILLY-TICK) ──
  const tickBilly = useRef(() => {
    const rootEl = refs.rootRef?.current;
    if (!rootEl) {
      console.warn('[Billy] tick: rootEl is null');
      return;
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

    const currentLineIdx = useLyricsStore.getState().activeLineIndex;

    // 4. Collect inputs
    // ═══ W3 — Control Mode: direction из data-attr ═══
    const controlActive = isBillyControlActive();
    const dirAttr = document.documentElement.getAttribute('data-billy-direction');
    const rawDirection = (dirAttr === 'left' || dirAttr === 'right') ? dirAttr : 'none';
    const controlDirection = controlActive ? rawDirection : 'none';

    const inputs: BillyInputs = {
      isPlaying: useAudioStore.getState().isPlaying,
      isAiStreaming: useTrackInfoStore.getState().isAiStreaming,
      hasTrack: !!useTrackStore.getState().currentTrack,
      isLooping: useLoopStore.getState().isLooping,
      isRecording: useRecordingStore.getState().isRecording,
      isOverlayOpen: useTrackInfoStore.getState().isOpen,
      bpm: useTrackInfoStore.getState().meta?.bpm ?? 120,
      activeLineIndex: currentLineIdx,
      activeBlockType: null,    // TODO W8: из blocks.store
      mode: useModeStore.getState().mode,
      controlActive,
      controlDirection,
      jumpRequest: null,         // W5: из keyboard handler
      attackRequest: null,       // W5: из keyboard handler
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
        modeTimer: hotState.modeTimer,  // singleton, не store
        velocity: hotState.velocity,
        zones: storeState.zones,
      },
      inputs,
      dt,
    );

    // 6. Convert to pixels
    const { pixelX, pixelY } = computePixelPosition(result.posX, result.posY);

    // 7. Update hot state (singleton) — modeTimer тоже здесь, не в store
    setBillyHotState({
      posX: result.posX,
      posY: result.posY,
      targetX: result.targetX,
      targetY: result.targetY,
      pixelX,
      pixelY,
      velocity: result.velocity,
      isMoving: result.isMoving,
      modeTimer: result.modeTimer,
    });

    // ═══ Surface Snap: мгновенная коррекция при сдвиге поверхности ═══
    // INV-BILLY-SNAP: при surface shift >5% — мгновенный snap
    const GROUNDED_MODES = new Set(['sleep', 'patrol', 'groove', 'think', 'retreat']);
    if (GROUNDED_MODES.has(result.mode)) {
      const surfaceY = storeState.zones.corner.y; // = groundBottom
      const gap = Math.abs(result.posY - surfaceY);

      if (gap > 0.05) {
        // Поверхность сдвинулась значительно — мгновенный snap
        setBillyHotState({
          posY: surfaceY,
          targetY: surfaceY,
        });
        // Обновляем pixelY тоже
        const snapPixel = computePixelPosition(result.posX, surfaceY);
        setBillyHotState({ pixelY: snapPixel.pixelY });
      } else if (gap > 0.005) {
        // Небольшой зазор — ускоренный lerp (50% за тик)
        const correctedY = result.posY + (surfaceY - result.posY) * 0.5;
        const snapPixel = computePixelPosition(result.posX, correctedY);
        setBillyHotState({ posY: correctedY, pixelY: snapPixel.pixelY });
      }
    }

    // 8. Write transform directly to DOM (INV-BILLY-NO-RERENDER)
    const scaleX = result.facing === 'left' ? -1 : 1;
    rootEl.style.transform = `translate(${pixelX}px, ${pixelY}px) scaleX(${scaleX})`;

    // ═══ Eye Tracking (INV-BILLY-CACHE) ═══

    // Обновляем кэш строки (только при смене — ~1/сек, НЕ каждый кадр)
    if (currentLineIdx !== _lastLineIndex) {
      updateLineSlotCache(currentLineIdx);
      _lastLineIndex = currentLineIdx;
    }

    // ═══ Eye Tracking — 2D direction (INV-BILLY-CACHE) ═══
    let pupilOffsetX = 0;
    let pupilOffsetY = 0;
    const slot = getActiveLineSlot();
    if (slot && slot.isAboveFold) {
      const billyCenterX = result.posX * window.innerWidth + BILLY_HALF_WIDTH;
      const billyCenterY = result.posY * window.innerHeight - BILLY_HEIGHT * 0.4; // eye level
      const dx = slot.centerX - billyCenterX;
      const dy = slot.centerY - billyCenterY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 10) {
        // Нормализованная direction × интенсивность
        // intensity зависит от расстояния с diminishing returns
        const intensity = Math.min(1, dist / 400);
        const nx = dx / dist;
        const ny = dy / dist;
        pupilOffsetX = nx * PUPIL_OFFSET_MAX_X * intensity;
        pupilOffsetY = ny * PUPIL_OFFSET_MAX_Y * intensity;
      }
    }

    // ═══ Idle Curiosity (closure vars, НЕ singleton) ═══
    if (result.mode === 'patrol') {
      _curiosityTimer += dt * 1000;
      if (_curiosityTimer > _nextCuriosityAt) {
        _curiosityShift = {
          x: (Math.random() - 0.5) * 2,   // ±1px
          y: (Math.random() - 0.5) * 1,    // ±0.5px
        };
        _curiosityTimer = 0;
        _nextCuriosityAt = 8000 + Math.random() * 7000; // 8-15 сек
      }
      // Exponential decay — возврат к центру за ~2s
      const decay = Math.pow(0.85, dt * 60);
      _curiosityShift.x *= decay;
      _curiosityShift.y *= decay;
    } else {
      // Сброс при выходе из patrol
      _curiosityShift = { x: 0, y: 0 };
      _curiosityTimer = 0;
    }

    // ═══ Pupil Dilation ═══
    let pupilRadius = PUPIL_RADIUS_BASE;
    const effectiveTier = usePerformanceStore.getState().getEffectiveTier();

    // Lite tier: dilation OFF
    if (effectiveTier !== 'lite') {
      // Control mode → focus → сужение
      if (inputs.controlActive) pupilRadius += PUPIL_FOCUS_DELTA;
      // W7: if (hotState.celebration) pupilRadius += PUPIL_CELEBRATE_DELTA;
      // W11: audio beat → PUPIL_BEAT_DELTA
    }
    pupilRadius = Math.max(PUPIL_RADIUS_MIN, Math.min(PUPIL_RADIUS_MAX, pupilRadius));

    // ═══ Compose & emit ═══
    const totalOffsetX = pupilOffsetX + _curiosityShift.x;
    const totalOffsetY = pupilOffsetY + _curiosityShift.y;
    refs.onPupilUpdate?.(totalOffsetX, totalOffsetY, pupilRadius);

    // (diagnostic removed — eye tracking verified working)

    // 9. Write .moving class (for will-change) — с guard от лишних мутаций
    const hasMoving = rootEl.classList.contains('moving');
    if (result.isMoving && !hasMoving) {
      rootEl.classList.add('moving');
    } else if (!result.isMoving && hasMoving) {
      rootEl.classList.remove('moving');
    }

    // 10. Update store ONLY on mode/zone/facing change (low-freq)
    // modeTimer живёт в singleton (hotState), не в store — нет store write на каждый tick
    const modeChanged = result.mode !== storeState.mode;
    const zoneChanged = result.zone !== storeState.zone;
    const facingChanged = result.facing !== storeState.facing;

    if (modeChanged || zoneChanged || facingChanged) {
      useBillyRuntimeStore.setState({
        mode: result.mode,
        prevMode: result.prevMode,
        zone: result.zone,
        facing: result.facing,
      });
    }
  });

  // ── rAF Runner (INV-BILLY-TICK: tick не знает об оркестраторе) ──
  useEffect(() => {
    // Module-level guard: prevent duplicate rAF loops on HMR / StrictMode
    if (_loopRunning) {
      console.warn('[Billy] useBillyLocomotion: loop already running — skipping duplicate (HMR/StrictMode guard)');
      return;
    }
    _loopRunning = true;

    console.log('[Billy] rAF loop useEffect starting');
    // W2: собственный rAF. W3: миграция в scheduler — одна строка
    const loop = () => {
      frameCountRef.current++;

      // 30fps default (каждый 2-й кадр)
      // TODO: читать tier из performance.store для fps
      if (frameCountRef.current % 2 === 0) {
        tickBilly.current();
      }

      _loopRafId = requestAnimationFrame(loop);
    };

    _loopRafId = requestAnimationFrame(loop);

    return () => {
      _loopRunning = false;
      if (_loopRafId !== null) {
        cancelAnimationFrame(_loopRafId);
        _loopRafId = null;
      }
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
