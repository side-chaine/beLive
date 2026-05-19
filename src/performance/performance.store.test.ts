import { describe, it, expect, beforeEach } from 'vitest';
import { usePerformanceStore, useVisualBudget, useEffectiveTier } from './performance.store';
import { DEFAULT_PERFORMANCE_TIER, PERFORMANCE_PRESETS } from './performance.presets';

describe('usePerformanceStore state access', () => {
  it('store can be accessed and has required methods', () => {
    const state = usePerformanceStore.getState();
    
    // Verify store structure
    expect(state).toBeDefined();
    expect(typeof state.setTier).toBe('function');
    expect(typeof state.setAutoDetect).toBe('function');
    expect(typeof state.refreshDetectedTier).toBe('function');
    expect(typeof state.getEffectiveTier).toBe('function');
    expect(typeof state.getBudget).toBe('function');
  });

  it('initial state has expected properties', () => {
    const state = usePerformanceStore.getState();
    
    expect(state.tier).toBeDefined();
    expect(state.autoDetect).toBeDefined();
    expect(state.detectedTier).toBeDefined();
  });
});

describe('convenience functions (non-hook usage)', () => {
  it('store methods are accessible directly', () => {
    const state = usePerformanceStore.getState();
    const budget = state.getBudget();
    
    expect(budget).toBeDefined();
    expect(budget.tier).toBeDefined();
    expect(budget.word).toBeDefined();
    expect(budget.line).toBeDefined();
    expect(budget.background).toBeDefined();
  });

  it('getEffectiveTier is accessible via store', () => {
    const state = usePerformanceStore.getState();
    const tier = state.getEffectiveTier();
    
    expect(tier).toBeDefined();
    expect(['lite', 'balanced', 'max', 'ultra']).toContain(tier);
  });
});

describe('PERFORMANCE_PRESETS structure', () => {
  it('has all four tiers defined', () => {
    expect(Object.keys(PERFORMANCE_PRESETS)).toEqual(['lite', 'balanced', 'max', 'ultra']);
  });

  it('lite tier has correct structure', () => {
    const lite = PERFORMANCE_PRESETS.lite;
    expect(lite.tier).toBe('lite');
    expect(lite.word.allowBounce).toBe(false);
    expect(lite.audioReactive.enabled).toBe(false);
  });

  it('balanced tier enables basic features', () => {
    const balanced = PERFORMANCE_PRESETS.balanced;
    expect(balanced.tier).toBe('balanced');
    expect(balanced.word.allowBounce).toBe(true);
    expect(balanced.audioReactive.enabled).toBe(true);
  });

  it('max tier enables advanced features', () => {
    const max = PERFORMANCE_PRESETS.max;
    expect(max.tier).toBe('max');
    expect(max.word.allowHeavyNeon).toBe(true);
    expect(max.background.allowParticles).toBe(true);
    expect(max.scene.allow3D).toBe(true);
  });

  it('ultra tier has maximum settings', () => {
    const ultra = PERFORMANCE_PRESETS.ultra;
    expect(ultra.tier).toBe('ultra');
    expect(ultra.word.maxCueWords).toBe(3);
    expect(ultra.word.maxGlowLayers).toBe(3);
    expect(ultra.audioReactive.maxBands).toBe(8);
  });

  it('tier progression increases capabilities', () => {
    expect(PERFORMANCE_PRESETS.lite.word.maxCueWords)
      .toBeLessThan(PERFORMANCE_PRESETS.balanced.word.maxCueWords);
    expect(PERFORMANCE_PRESETS.balanced.word.maxCueWords)
      .toBeLessThan(PERFORMANCE_PRESETS.max.word.maxCueWords);
    expect(PERFORMANCE_PRESETS.max.word.maxCueWords)
      .toBeLessThan(PERFORMANCE_PRESETS.ultra.word.maxCueWords);
  });
});

describe('DEFAULT_PERFORMANCE_TIER', () => {
  it('is set to balanced', () => {
    expect(DEFAULT_PERFORMANCE_TIER).toBe('balanced');
  });

  it('exists in PERFORMANCE_PRESETS', () => {
    expect(PERFORMANCE_PRESETS[DEFAULT_PERFORMANCE_TIER]).toBeDefined();
  });
});
