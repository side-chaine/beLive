import { describe, it, expect } from 'vitest';
import { applyRecordingSafeClamp } from './performance.clamp';
import type { VisualBudget } from './performance.types';

describe('applyRecordingSafeClamp', () => {
  const baseBudget: VisualBudget = {
    tier: 'balanced',
    word: {
      allowBounce: true,
      allowHeavyNeon: true,
      allowLookahead: true,
      maxCueWords: 2,
      progressMode: 'full',
      maxGlowLayers: 2,
      maxTrailDepth: 'scene',
    },
    line: {
      allowPreviewGlow: true,
      allowPreviewHandoff: true,
      maxLineGlow: 'full',
      allowBlockAwareColor: true,
    },
    background: {
      blurLevel: 1,
      reactiveIntensity: 'low',
      allowParticles: true,
    },
    audioReactive: {
      enabled: true,
      maxBands: 64,
      allowBeatPulse: true,
      allowSpectral: true,
    },
    scene: {
      allow3D: false,
      allowAvatar: false,
      maxSceneComplexity: 'basic',
    },
    visualMixer: {
      enabled: true,
      maxCards: 10,
      cardUpdateFps: 30,
      allowPulsation: true,
      allowCardGlow: true,
      allowHitFlash: true,
      allowWaveform: true,
      maxPulseIntensity: 'medium',
      allowScenarios: true,
    },
    feed: {
      allowHeroFade: true,
      allowKenBurns: true,
      allowHoverScale: true,
      allowAutoPlay: true,
      allowVinylAnimation: true,
      heroFadeDuration: 500,
      maxScrollSnapCards: 6,
    },
  };

  it('clamps word properties correctly', () => {
    const clamped = applyRecordingSafeClamp(baseBudget);
    expect(clamped.word.maxTrailDepth).toBe('off');
    expect(clamped.word.allowBounce).toBe(false);
    expect(clamped.word.allowHeavyNeon).toBe(false);
    expect(clamped.word.maxCueWords).toBe(0);
  });

  it('disables visualMixer features and limits fps', () => {
    const clamped = applyRecordingSafeClamp(baseBudget);
    const vm = clamped.visualMixer;
    expect(vm.enabled).toBe(true);
    expect(vm.allowPulsation).toBe(false);
    expect(vm.allowCardGlow).toBe(false);
    expect(vm.allowHitFlash).toBe(false);
    expect(vm.allowWaveform).toBe(false);
    expect(vm.maxPulseIntensity).toBe('off');
    expect(vm.cardUpdateFps).toBeLessThanOrEqual(10);
    expect(vm.allowScenarios).toBe(false);
  });

  it('preserves unchanged line properties', () => {
    const clamped = applyRecordingSafeClamp(baseBudget);
    expect(clamped.line.allowPreviewHandoff).toBe(false);
    expect(clamped.line.allowPreviewGlow).toBe(true);
  });
});
