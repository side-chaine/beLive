// @TC-0b: Frozen zone protection tests
import { describe, it, expect } from 'vitest';
import { PERFORMANCE_PRESETS } from './performance.presets';

describe('PERFORMANCE_PRESETS frozen', () => {
  it('is deeply frozen (AC-0.4)', () => {
    expect(Object.isFrozen(PERFORMANCE_PRESETS)).toBe(true);
    expect(Object.isFrozen(PERFORMANCE_PRESETS.lite)).toBe(true);
    expect(Object.isFrozen(PERFORMANCE_PRESETS.lite.word)).toBe(true);
    expect(Object.isFrozen(PERFORMANCE_PRESETS.balanced)).toBe(true);
    expect(Object.isFrozen(PERFORMANCE_PRESETS.balanced.scene)).toBe(true);
    expect(Object.isFrozen(PERFORMANCE_PRESETS.max)).toBe(true);
    expect(Object.isFrozen(PERFORMANCE_PRESETS.ultra)).toBe(true);
  });

  it('throws on mutation in strict mode (AC-0.5)', () => {
    expect(() => {
      'use strict';
      (PERFORMANCE_PRESETS as any).lite = 'hacked';
    }).toThrow();
  });
});
