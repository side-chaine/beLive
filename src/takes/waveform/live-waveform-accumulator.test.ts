/**
 * Live Waveform Accumulator Test
 * 
 * Verifies accumulator behavior without React dependencies.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { LiveWaveformAccumulator } from './live-waveform-accumulator';

describe('LiveWaveformAccumulator', () => {
  let accumulator: LiveWaveformAccumulator;

  beforeEach(() => {
    accumulator = new LiveWaveformAccumulator(96);
  });

  it('should initialize with correct bar count', () => {
    expect(accumulator.barCount).toBe(96);
  });

  it('should start with headIndex at 0', () => {
    expect(accumulator.headIndex).toBe(0);
  });

  it('should reset buffer to zeros', () => {
    const data = accumulator.data;
    // Manually set some values
    (data as Float32Array)[0] = 0.5;
    (data as Float32Array)[1] = -0.5;
    
    accumulator.reset();
    
    expect(accumulator.headIndex).toBe(0);
    expect(accumulator.data[0]).toBe(0);
    expect(accumulator.data[1]).toBe(0);
  });

  it('should accumulate min/max instead of overwriting', () => {
    // Create mock analyser and scratch buffer
    const mockAnalyser = {
      getFloatTimeDomainData: (buffer: Float32Array) => {
        // Fill with test values
        for (let i = 0; i < buffer.length; i++) {
          buffer[i] = 0.3;
        }
      }
    } as unknown as AnalyserNode;

    const scratch = new Float32Array(1024);
    
    // First update at progress 0
    accumulator.update(mockAnalyser, 0, scratch);
    const firstMin = accumulator.data[0];
    const firstMax = accumulator.data[1];
    
    // Second update with weaker values should preserve extremes
    (mockAnalyser as any).getFloatTimeDomainData = (buffer: Float32Array) => {
      for (let i = 0; i < buffer.length; i++) {
        buffer[i] = 0.1; // Weaker than 0.3
      }
    };
    
    accumulator.update(mockAnalyser, 0, scratch);
    
    // Should still have the more extreme values
    expect(accumulator.data[0]).toBeLessThanOrEqual(firstMin);
    expect(accumulator.data[1]).toBeGreaterThanOrEqual(firstMax);
  });

  it('should update correct headIndex based on progress', () => {
    const mockAnalyser = {
      getFloatTimeDomainData: () => {}
    } as unknown as AnalyserNode;
    const scratch = new Float32Array(1024);
    
    // Progress 0.5 should map to bar ~48 (of 96)
    accumulator.update(mockAnalyser, 0.5, scratch);
    expect(accumulator.headIndex).toBe(48);
    
    // Progress 1.0 should map to last bar
    accumulator.update(mockAnalyser, 1.0, scratch);
    expect(accumulator.headIndex).toBe(95);
  });

  it('should clamp barIndex to valid range', () => {
    const mockAnalyser = {
      getFloatTimeDomainData: () => {}
    } as unknown as AnalyserNode;
    const scratch = new Float32Array(1024);
    
    // Negative progress should clamp to 0
    accumulator.update(mockAnalyser, -0.1, scratch);
    expect(accumulator.headIndex).toBe(0);
    
    // Progress > 1 should clamp to last bar
    accumulator.reset();
    accumulator.update(mockAnalyser, 1.5, scratch);
    expect(accumulator.headIndex).toBe(95);
  });

  it('should handle first write correctly', () => {
    const mockAnalyser = {
      getFloatTimeDomainData: (buffer: Float32Array) => {
        for (let i = 0; i < buffer.length; i++) {
          buffer[i] = 0.5;
        }
      }
    } as unknown as AnalyserNode;
    const scratch = new Float32Array(1024);
    
    // First update at bar 10
    accumulator.update(mockAnalyser, 10 / 96, scratch);
    
    expect(accumulator.headIndex).toBe(10);
    expect(accumulator.isBarWritten(10)).toBe(true);
  });

  it('should fill intermediate bars on jump from bar 10 to bar 13', () => {
    const mockAnalyser = {
      getFloatTimeDomainData: (buffer: Float32Array) => {
        for (let i = 0; i < buffer.length; i++) {
          buffer[i] = 0.5;
        }
      }
    } as unknown as AnalyserNode;
    const scratch = new Float32Array(1024);
    
    // Start at bar 10
    accumulator.update(mockAnalyser, 10 / 96, scratch);
    expect(accumulator.headIndex).toBe(10);
    
    // Jump to bar 13 - should fill 11, 12, 13
    accumulator.update(mockAnalyser, 13 / 96, scratch);
    
    expect(accumulator.headIndex).toBe(13);
    expect(accumulator.isBarWritten(11)).toBe(true);
    expect(accumulator.isBarWritten(12)).toBe(true);
    expect(accumulator.isBarWritten(13)).toBe(true);
  });

  it('should small step update one bar', () => {
    const mockAnalyser = {
      getFloatTimeDomainData: (buffer: Float32Array) => {
        for (let i = 0; i < buffer.length; i++) {
          buffer[i] = 0.3;
        }
      }
    } as unknown as AnalyserNode;
    const scratch = new Float32Array(1024);
    
    // Update at bar 20
    accumulator.update(mockAnalyser, 20 / 96, scratch);
    expect(accumulator.headIndex).toBe(20);
    
    // Small step to bar 21
    accumulator.update(mockAnalyser, 21 / 96, scratch);
    expect(accumulator.headIndex).toBe(21);
    
    // Bar 20 should be written, bar 22 should not
    expect(accumulator.isBarWritten(20)).toBe(true);
    expect(accumulator.isBarWritten(22)).toBe(false);
  });

  it('should reset clears _hasWritten flag', () => {
    const mockAnalyser = {
      getFloatTimeDomainData: (buffer: Float32Array) => {
        for (let i = 0; i < buffer.length; i++) {
          buffer[i] = 0.5;
        }
      }
    } as unknown as AnalyserNode;
    const scratch = new Float32Array(1024);
    
    // Write some data
    accumulator.update(mockAnalyser, 0.5, scratch);
    expect(accumulator.headIndex).toBeGreaterThan(0);
    
    // Reset
    accumulator.reset();
    expect(accumulator.headIndex).toBe(0);
    
    // Next write should behave as first write
    accumulator.update(mockAnalyser, 0.3, scratch);
    // Should write only the current bar, not fill gaps
  });
});
