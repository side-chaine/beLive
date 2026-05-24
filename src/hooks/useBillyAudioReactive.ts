import { useEffect, useRef, useCallback } from 'react';
import type { BillyAnimation } from './useBillyState';

/**
 * Audio-reactive micro-movements for BillyDock.
 *
 * Architecture: Dual SVG layers
 *   - Outer <g>: CSS keyframes (base dance pattern, always works)
 *   - Inner <g>: JS audio-reactive (chaos overlay, reads CSS vars)
 *
 * Performance:
 *   - 30fps default (every other rAF frame)
 *   - Batched getComputedStyle (1 call per tick, cached for 30ms)
 *   - Only active during 'dance' animation state
 *   - Respects prefers-reduced-motion
 *
 * CSS vars (confirmed by 007):
 *   --bl-audio-energy   → overall mix energy
 *   --bl-audio-bass     → kick drum  → body micro-bounce
 *   --bl-audio-mid      → snare/guitar → arm chaos amplitude
 *   --bl-audio-high     → cymbals    → arm chaos frequency
 *   --bl-audio-beat     → beat hit   → one-shot micro-jump
 *   --bl-stem-vocals-energy → vocal energy (may not exist if vocals not loaded)
 *     fallback: --bl-audio-energy
 */

interface BillyRefs {
  billySvg: SVGSVGElement | null;
  bodyInner: SVGGElement | null;
  headInner: SVGGElement | null;
  armLInner: SVGGElement | null;
  armRInner: SVGGElement | null;
}

interface AudioData {
  energy: number;
  bass: number;
  mid: number;
  high: number;
  beat: number;
  vocal: number;
}

// ── Cached audio data reader (batched getComputedStyle) ──

let _cachedData: AudioData = { energy: 0, bass: 0, mid: 0, high: 0, beat: 0, vocal: 0 };
let _cacheTime = 0;
const CACHE_TTL = 30; // ms — one cache per 30fps tick

function clamp01(v: number): number {
  return v >= 0 && v <= 1 ? v : (v < 0 ? 0 : 1);
}

function readAudioData(): AudioData {
  const now = performance.now();
  if ((now - _cacheTime) < CACHE_TTL) {
    return _cachedData;
  }

  // ONE getComputedStyle call — read all vars at once
  const cs = getComputedStyle(document.documentElement);
  const get = (name: string) => clamp01(parseFloat(cs.getPropertyValue(name)) || 0);

  // Try vocals-specific var, fallback to overall energy
  const vocalRaw = cs.getPropertyValue('--bl-stem-vocals-energy').trim();
  const vocal = vocalRaw ? clamp01(parseFloat(vocalRaw) || 0) : get('--bl-audio-energy');

  _cachedData = {
    energy: get('--bl-audio-energy'),
    bass: get('--bl-audio-bass'),
    mid: get('--bl-audio-mid'),
    high: get('--bl-audio-high'),
    beat: get('--bl-audio-beat'),
    vocal,
  };
  _cacheTime = now;
  return _cachedData;
}

// ── Reset inline transforms helper ──

function resetTransforms(refs: React.RefObject<BillyRefs>) {
  const r = refs.current;
  if (!r) return;
  if (r.bodyInner) r.bodyInner.style.transform = '';
  if (r.armLInner) r.armLInner.style.transform = '';
  if (r.armRInner) r.armRInner.style.transform = '';
  if (r.headInner) r.headInner.style.transform = '';
}

/**
 * Audio-reactive micro-movements for BillyDock.
 *
 * @param refs - Stable ref object pointing to Billy's SVG elements
 * @param animation - Current Billy animation state from useBillyState
 */
export function useBillyAudioReactive(
  refs: React.RefObject<BillyRefs>,
  animation: BillyAnimation,
) {
  const frameCountRef = useRef(0);
  const beatDecayRef = useRef(0);

  const tick = useCallback(() => {
    if (animation !== 'dance') return;

    const r = refs.current;
    if (!r) return;

    frameCountRef.current++;

    // 30fps throttle — skip every other frame
    if (frameCountRef.current % 2 !== 0) return;

    const audio = readAudioData();

    // Beat detection → decay over 3 ticks
    if (audio.beat > 0.5) {
      beatDecayRef.current = 1;
    } else {
      beatDecayRef.current = Math.max(0, beatDecayRef.current - 0.33);
    }

    // Body micro-bounce from bass + beat
    // Applied to SVG root — additive with CSS danceBody keyframe
    const bodyOffset = (audio.bass * -2) + (beatDecayRef.current * -3);
    if (r.bodyInner) {
      r.bodyInner.style.transform = `translateY(${bodyOffset}px)`;
    }

    // Arm chaos from mid + high — applied to INNER groups
    const armChaos = (audio.mid + audio.high) * 0.5;
    const time = frameCountRef.current * 0.15;

    // Arms: static in dance — animated only in celebrations (W2)
    // INV-BILLY-T1: CSS keyframes OR JS inline transform on same <g> — never both
    // if (r.armLInner) {
    //   const angleL = Math.sin(time * 3.7) * armChaos * 18;
    //   r.armLInner.style.transform = `rotate(${angleL}deg)`;
    // }
    // if (r.armRInner) {
    //   const angleR = Math.cos(time * 4.3) * armChaos * 18;
    //   r.armRInner.style.transform = `rotate(${angleR}deg)`;
    // }

    // Head bob from vocal — applied to INNER group
    if (r.headInner) {
      const headBob = Math.sin(time * 2.1) * audio.vocal * 3;
      const headTilt = Math.cos(time * 1.7) * audio.vocal * 2;
      r.headInner.style.transform = `rotate(${headTilt}deg) translateY(${headBob}px)`;
    }
  }, [animation, refs]);

  useEffect(() => {
    if (animation !== 'dance') {
      // Reset inline transforms when not dancing
      resetTransforms(refs);
      return;
    }

    // Respect reduced motion preference — no micro-movements
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mq.matches) {
      resetTransforms(refs);
      return;
    }

    let rafId: number;
    const loop = () => {
      tick();
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);

    // Listen for reduced-motion changes at runtime
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        cancelAnimationFrame(rafId);
        resetTransforms(refs);
      }
    };
    mq.addEventListener('change', onChange);

    return () => {
      cancelAnimationFrame(rafId);
      mq.removeEventListener('change', onChange);
    };
  }, [animation, tick, refs]);
}
