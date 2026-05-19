import { describe, it, expect } from 'vitest';
import { LOW_CONFIDENCE, HIGH_CONFIDENCE, getConfidenceBand, shouldEnableWordHighlight, isRepairCandidate } from './confidence';

describe('confidence thresholds', () => {
  it('LOW_CONFIDENCE is 0.55', () => {
    expect(LOW_CONFIDENCE).toBe(0.55);
  });

  it('HIGH_CONFIDENCE is 0.8', () => {
    expect(HIGH_CONFIDENCE).toBe(0.8);
  });

  it('LOW_CONFIDENCE is less than HIGH_CONFIDENCE', () => {
    expect(LOW_CONFIDENCE).toBeLessThan(HIGH_CONFIDENCE);
  });

  it('LOW_CONFIDENCE is between 0 and 1', () => {
    expect(LOW_CONFIDENCE).toBeGreaterThan(0);
    expect(LOW_CONFIDENCE).toBeLessThan(1);
  });

  it('HIGH_CONFIDENCE is between 0 and 1', () => {
    expect(HIGH_CONFIDENCE).toBeGreaterThan(0);
    expect(HIGH_CONFIDENCE).toBeLessThan(1);
  });
});

describe('getConfidenceBand', () => {
  it('returns low for null value', () => {
    expect(getConfidenceBand(null)).toBe('low');
  });

  it('returns low for undefined value', () => {
    expect(getConfidenceBand(undefined)).toBe('low');
  });

  it('returns low for values below LOW_CONFIDENCE', () => {
    expect(getConfidenceBand(0.3)).toBe('low');
    expect(getConfidenceBand(0.5)).toBe('low');
  });

  it('returns low for value exactly at LOW_CONFIDENCE - 0.01', () => {
    expect(getConfidenceBand(0.54)).toBe('low');
  });

  it('returns medium for values between LOW and HIGH confidence', () => {
    expect(getConfidenceBand(0.6)).toBe('medium');
    expect(getConfidenceBand(0.7)).toBe('medium');
    expect(getConfidenceBand(0.79)).toBe('medium');
  });

  it('returns medium for value exactly at LOW_CONFIDENCE', () => {
    expect(getConfidenceBand(0.55)).toBe('medium');
  });

  it('returns high for values at or above HIGH_CONFIDENCE', () => {
    expect(getConfidenceBand(0.8)).toBe('high');
    expect(getConfidenceBand(0.85)).toBe('high');
    expect(getConfidenceBand(0.95)).toBe('high');
    expect(getConfidenceBand(1.0)).toBe('high');
  });

  it('returns high for value exactly at HIGH_CONFIDENCE', () => {
    expect(getConfidenceBand(0.8)).toBe('high');
  });
});

describe('shouldEnableWordHighlight', () => {
  it('returns false for null confidence', () => {
    expect(shouldEnableWordHighlight(null)).toBe(false);
  });

  it('returns false for undefined confidence', () => {
    expect(shouldEnableWordHighlight(undefined)).toBe(false);
  });

  it('returns false for low confidence', () => {
    expect(shouldEnableWordHighlight(0.3)).toBe(false);
    expect(shouldEnableWordHighlight(0.5)).toBe(false);
  });

  it('returns true for medium confidence', () => {
    expect(shouldEnableWordHighlight(0.6)).toBe(true);
    expect(shouldEnableWordHighlight(0.7)).toBe(true);
  });

  it('returns true for high confidence', () => {
    expect(shouldEnableWordHighlight(0.8)).toBe(true);
    expect(shouldEnableWordHighlight(0.9)).toBe(true);
  });

  it('returns true for value exactly at LOW_CONFIDENCE', () => {
    expect(shouldEnableWordHighlight(0.55)).toBe(true);
  });
});

describe('isRepairCandidate', () => {
  it('returns false for null confidence', () => {
    expect(isRepairCandidate(null)).toBe(false);
  });

  it('returns false for undefined confidence', () => {
    expect(isRepairCandidate(undefined)).toBe(false);
  });

  it('returns false for low confidence', () => {
    expect(isRepairCandidate(0.3)).toBe(false);
    expect(isRepairCandidate(0.5)).toBe(false);
  });

  it('returns true for medium confidence (repair zone)', () => {
    expect(isRepairCandidate(0.6)).toBe(true);
    expect(isRepairCandidate(0.7)).toBe(true);
    expect(isRepairCandidate(0.79)).toBe(true);
  });

  it('returns false for high confidence', () => {
    expect(isRepairCandidate(0.8)).toBe(false);
    expect(isRepairCandidate(0.9)).toBe(false);
  });

  it('returns true for value exactly at LOW_CONFIDENCE', () => {
    expect(isRepairCandidate(0.55)).toBe(true);
  });

  it('returns false for value exactly at HIGH_CONFIDENCE', () => {
    expect(isRepairCandidate(0.8)).toBe(false);
  });
});
