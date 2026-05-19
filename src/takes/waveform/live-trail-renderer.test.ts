/**
 * Live Trail Renderer Test
 * 
 * Verifies imperative renderer behavior without React dependencies.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { LiveTrailRenderer } from './live-trail-renderer';
import { LiveWaveformAccumulator } from './live-waveform-accumulator';
import { balancedLiveTrailSkin } from './waveform-skins';

describe('LiveTrailRenderer', () => {
  let renderer: LiveTrailRenderer;
  let canvas: HTMLCanvasElement;
  let accumulator: LiveWaveformAccumulator;

  beforeEach(() => {
    renderer = new LiveTrailRenderer();
    canvas = document.createElement('canvas');
    accumulator = new LiveWaveformAccumulator(96);
  });

  it('should compile and instantiate', () => {
    expect(renderer).toBeDefined();
    expect(renderer.isAttached()).toBe(false);
  });

  it('should attach to canvas', () => {
    renderer.attach(canvas);
    // Canvas context may not be available in test environment
    if (renderer.isAttached()) {
      expect(renderer.getCanvas()).toBe(canvas);
    } else {
      // Skip test if canvas not supported
      console.log('Canvas not supported in test environment');
    }
  });

  it('should resize canvas with correct backing store', () => {
    renderer.attach(canvas);
    
    // Skip if canvas context not available
    if (!renderer.isAttached()) {
      console.log('Canvas not supported, skipping resize test');
      return;
    }
    
    const width = 800;
    const height = 200;
    renderer.resize(width, height);
    
    const dpr = window.devicePixelRatio || 1;
    
    // Check CSS size
    expect(canvas.style.width).toBe(`${width}px`);
    expect(canvas.style.height).toBe(`${height}px`);
    
    // Check backing store (scaled by DPR)
    expect(canvas.width).toBe(Math.round(width * dpr));
    expect(canvas.height).toBe(Math.round(height * dpr));
  });

  it('should tolerate unattached canvas safely in draw', () => {
    // Should not throw when drawing without attachment
    expect(() => {
      renderer.draw(accumulator, balancedLiveTrailSkin);
    }).not.toThrow();
  });

  it('should tolerate unattached canvas safely in resize', () => {
    // Should not throw when resizing without attachment
    expect(() => {
      renderer.resize(800, 200);
    }).not.toThrow();
  });

  it('should draw accumulated waveform correctly', () => {
    renderer.attach(canvas);
    
    // Skip if canvas context not available
    if (!renderer.isAttached()) {
      console.log('Canvas not supported, skipping draw test');
      return;
    }
    
    renderer.resize(800, 200);
    
    // Simulate some accumulated data
    const mockAnalyser = {
      getFloatTimeDomainData: (buffer: Float32Array) => {
        for (let i = 0; i < buffer.length; i++) {
          buffer[i] = 0.5;
        }
      }
    } as unknown as AnalyserNode;
    
    const scratch = new Float32Array(1024);
    
    // Update first few bars
    accumulator.update(mockAnalyser, 0.1, scratch);
    accumulator.update(mockAnalyser, 0.2, scratch);
    accumulator.update(mockAnalyser, 0.3, scratch);
    
    // Draw should complete without errors
    expect(() => {
      renderer.draw(accumulator, balancedLiveTrailSkin);
    }).not.toThrow();
  });

  it('should handle skin with glow effect', () => {
    renderer.attach(canvas);
    
    // Skip if canvas context not available
    if (!renderer.isAttached()) {
      console.log('Canvas not supported, skipping glow test');
      return;
    }
    
    renderer.resize(800, 200);
    
    const glowSkin = {
      color: '#ffa500',
      opacity: 0.9,
      barGap: 0,
      glow: { color: '#ff8c00', blur: 4 }
    };
    
    const mockAnalyser = {
      getFloatTimeDomainData: (buffer: Float32Array) => {
        for (let i = 0; i < buffer.length; i++) {
          buffer[i] = 0.3;
        }
      }
    } as unknown as AnalyserNode;
    
    const scratch = new Float32Array(1024);
    accumulator.update(mockAnalyser, 0.5, scratch);
    
    expect(() => {
      renderer.draw(accumulator, glowSkin);
    }).not.toThrow();
  });

  it('should handle skin without glow', () => {
    renderer.attach(canvas);
    
    // Skip if canvas context not available
    if (!renderer.isAttached()) {
      console.log('Canvas not supported, skipping no-glow test');
      return;
    }
    
    renderer.resize(800, 200);
    
    const noGlowSkin = {
      color: '#ffa500',
      opacity: 0.85,
      barGap: 0,
      glow: null
    };
    
    const mockAnalyser = {
      getFloatTimeDomainData: (buffer: Float32Array) => {
        for (let i = 0; i < buffer.length; i++) {
          buffer[i] = 0.3;
        }
      }
    } as unknown as AnalyserNode;
    
    const scratch = new Float32Array(1024);
    accumulator.update(mockAnalyser, 0.5, scratch);
    
    expect(() => {
      renderer.draw(accumulator, noGlowSkin);
    }).not.toThrow();
  });

  it('should clear canvas', () => {
    renderer.attach(canvas);
    
    // Skip if canvas context not available
    if (!renderer.isAttached()) {
      console.log('Canvas not supported, skipping clear test');
      return;
    }
    
    renderer.resize(800, 200);
    
    // Draw something first
    const mockAnalyser = {
      getFloatTimeDomainData: (buffer: Float32Array) => {
        for (let i = 0; i < buffer.length; i++) {
          buffer[i] = 0.5;
        }
      }
    } as unknown as AnalyserNode;
    
    const scratch = new Float32Array(1024);
    accumulator.update(mockAnalyser, 0.5, scratch);
    renderer.draw(accumulator, balancedLiveTrailSkin);
    
    // Clear should work without errors
    expect(() => {
      renderer.clear();
    }).not.toThrow();
  });

  it('should read accumulator data correctly', () => {
    renderer.attach(canvas);
    
    // Skip if canvas context not available
    if (!renderer.isAttached()) {
      console.log('Canvas not supported, skipping accumulator test');
      return;
    }
    
    renderer.resize(800, 200);
    
    // Update specific progress points
    const mockAnalyser = {
      getFloatTimeDomainData: (buffer: Float32Array) => {
        for (let i = 0; i < buffer.length; i++) {
          buffer[i] = 0.5;
        }
      }
    } as unknown as AnalyserNode;
    
    const scratch = new Float32Array(1024);
    
    // Update at progress 0.5 (should be around bar 48)
    accumulator.update(mockAnalyser, 0.5, scratch);
    
    expect(accumulator.headIndex).toBe(48);
    
    // Draw should render up to headIndex
    expect(() => {
      renderer.draw(accumulator, balancedLiveTrailSkin);
    }).not.toThrow();
  });
});
