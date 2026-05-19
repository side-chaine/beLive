/**
 * Live Trail Controller Test
 * 
 * Verifies controller lifecycle and pipeline orchestration.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LiveTrailController } from './live-trail-controller';
import type { WaveformTierConfig } from './waveform-tier-config';
import type { LiveTrailSkin } from './waveform-skins';

describe('LiveTrailController', () => {
  let controller: LiveTrailController;
  let mockConfig: WaveformTierConfig;
  let mockSkin: LiveTrailSkin;
  let mockAnalyser: AnalyserNode;
  let mockCanvas: HTMLCanvasElement;

  beforeEach(() => {
    // Mock tier config
    mockConfig = {
      barCount: 96,
      skipFrames: 0,
      analyserFFT: 1024
    };

    // Mock skin
    mockSkin = {
      color: '#ffa500',
      opacity: 0.85,
      barGap: 0,
      glow: null
    };

    // Mock analyser
    mockAnalyser = {
      getFloatTimeDomainData: vi.fn()
    } as unknown as AnalyserNode;

    // Mock canvas
    mockCanvas = document.createElement('canvas');

    // Create controller
    controller = new LiveTrailController(mockConfig, mockSkin);
  });

  it('should compile and instantiate', () => {
    expect(controller).toBeDefined();
    expect(controller.getIsRunning()).toBe(false);
  });

  it('should attach to canvas', () => {
    expect(() => {
      controller.attachCanvas(mockCanvas);
    }).not.toThrow();
  });

  it('should set size correctly', () => {
    controller.attachCanvas(mockCanvas);
    
    expect(() => {
      controller.setSize(800, 200);
    }).not.toThrow();
    
    expect(mockCanvas.style.width).toBe('800px');
    expect(mockCanvas.style.height).toBe('200px');
  });

  it('should set analyser', () => {
    expect(() => {
      controller.setAnalyser(mockAnalyser);
    }).not.toThrow();
  });

  it('should set time range', () => {
    expect(() => {
      controller.setTimeRange({ startTime: 0, endTime: 30 });
    }).not.toThrow();
  });

  it('should update skin', () => {
    const newSkin: LiveTrailSkin = {
      color: '#ff0000',
      opacity: 0.9,
      barGap: 0,
      glow: { color: '#ff0000', blur: 8 }
    };

    expect(() => {
      controller.setSkin(newSkin);
    }).not.toThrow();
  });

  it('should start idempotently', () => {
    controller.attachCanvas(mockCanvas);
    controller.setAnalyser(mockAnalyser);
    controller.setTimeRange({ startTime: 0, endTime: 30 });

    // Mock audio engine
    (window as any).audioEngine = {
      isPlaying: true,
      getCurrentTime: () => 15
    };

    // First start
    controller.start();
    expect(controller.getIsRunning()).toBe(true);

    // Second start should be ignored
    controller.start();
    expect(controller.getIsRunning()).toBe(true);
  });

  it('should stop idempotently', () => {
    controller.attachCanvas(mockCanvas);
    controller.setAnalyser(mockAnalyser);
    controller.setTimeRange({ startTime: 0, endTime: 30 });

    (window as any).audioEngine = {
      isPlaying: true,
      getCurrentTime: () => 15
    };

    controller.start();
    expect(controller.getIsRunning()).toBe(true);

    // First stop
    controller.stop();
    expect(controller.getIsRunning()).toBe(false);

    // Second stop should be ignored
    controller.stop();
    expect(controller.getIsRunning()).toBe(false);
  });

  it('should dispose and clear resources', () => {
    controller.attachCanvas(mockCanvas);
    controller.setAnalyser(mockAnalyser);
    controller.setTimeRange({ startTime: 0, endTime: 30 });

    (window as any).audioEngine = {
      isPlaying: true,
      getCurrentTime: () => 15
    };

    controller.start();
    expect(controller.getIsRunning()).toBe(true);

    // Dispose should stop everything
    controller.dispose();
    expect(controller.getIsRunning()).toBe(false);
  });

  it('should use accumulator and renderer together', () => {
    controller.attachCanvas(mockCanvas);
    controller.setSize(800, 200);
    controller.setAnalyser(mockAnalyser);
    controller.setTimeRange({ startTime: 0, endTime: 30 });

    // Mock analyser data
    vi.mocked(mockAnalyser.getFloatTimeDomainData).mockImplementation((buffer: Float32Array) => {
      for (let i = 0; i < buffer.length; i++) {
        buffer[i] = 0.5;
      }
    });

    (window as any).audioEngine = {
      isPlaying: true,
      getCurrentTime: () => 15
    };

    controller.start();

    // Give rAF loop time to run
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const accumulator = controller.getAccumulator();
        expect(accumulator.headIndex).toBeGreaterThan(0);
        expect(accumulator.getWrittenBarCount()).toBeGreaterThan(0);
        
        controller.stop();
        resolve();
      }, 100);
    });
  });

  it('should handle frame skipping', () => {
    const skipConfig: WaveformTierConfig = {
      barCount: 48,
      skipFrames: 1, // Skip every other frame
      analyserFFT: 512
    };

    const skipController = new LiveTrailController(skipConfig, mockSkin);
    skipController.attachCanvas(mockCanvas);
    skipController.setAnalyser(mockAnalyser);
    skipController.setTimeRange({ startTime: 0, endTime: 30 });

    vi.mocked(mockAnalyser.getFloatTimeDomainData).mockImplementation((buffer: Float32Array) => {
      for (let i = 0; i < buffer.length; i++) {
        buffer[i] = 0.3;
      }
    });

    (window as any).audioEngine = {
      isPlaying: true,
      getCurrentTime: () => 15
    };

    skipController.start();

    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const accumulator = skipController.getAccumulator();
        // Should have fewer updates due to frame skipping
        expect(accumulator.getWrittenBarCount()).toBeLessThan(96);
        
        skipController.stop();
        skipController.dispose();
        resolve();
      }, 100);
    });
  });

  it('should clear canvas manually', () => {
    controller.attachCanvas(mockCanvas);
    controller.setSize(800, 200);

    expect(() => {
      controller.clearCanvas();
    }).not.toThrow();
  });

  it('should reset accumulator manually', () => {
    controller.attachCanvas(mockCanvas);
    controller.setAnalyser(mockAnalyser);
    controller.setTimeRange({ startTime: 0, endTime: 30 });

    vi.mocked(mockAnalyser.getFloatTimeDomainData).mockImplementation((buffer: Float32Array) => {
      for (let i = 0; i < buffer.length; i++) {
        buffer[i] = 0.5;
      }
    });

    (window as any).audioEngine = {
      isPlaying: true,
      getCurrentTime: () => 15
    };

    controller.start();

    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const accumulator = controller.getAccumulator();
        const writtenBars = accumulator.getWrittenBarCount();
        expect(writtenBars).toBeGreaterThan(0);

        // Reset accumulator
        controller.resetAccumulator();
        expect(accumulator.getWrittenBarCount()).toBe(0);

        controller.stop();
        resolve();
      }, 100);
    });
  });

  it('should tolerate missing analyser gracefully', () => {
    controller.attachCanvas(mockCanvas);
    controller.setTimeRange({ startTime: 0, endTime: 30 });

    (window as any).audioEngine = {
      isPlaying: true,
      getCurrentTime: () => 15
    };

    controller.start();

    // Should not throw without analyser
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        controller.stop();
        resolve();
      }, 50);
    });
  });

  it('should tolerate missing time range gracefully', () => {
    controller.attachCanvas(mockCanvas);
    controller.setAnalyser(mockAnalyser);

    (window as any).audioEngine = {
      isPlaying: true,
      getCurrentTime: () => 15
    };

    controller.start();

    // Should not throw without time range
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        controller.stop();
        resolve();
      }, 50);
    });
  });
});
