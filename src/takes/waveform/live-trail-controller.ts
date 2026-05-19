/**
 * Live Trail Controller
 * 
 * Lifecycle owner for the complete live waveform rendering pipeline.
 * Orchestrates analyser → accumulator → renderer with rAF loop management.
 * Zero React dependencies, pure imperative control.
 * 
 * @module live-trail-controller
 * @see live-waveform-accumulator for data accumulation
 * @see live-trail-renderer for canvas rendering
 * @see waveform-tier-config for performance configuration
 */

import type { WaveformTierConfig } from './waveform-tier-config';
import type { LiveTrailSkin } from './waveform-skins';
import { LiveWaveformAccumulator } from './live-waveform-accumulator';
import { LiveTrailRenderer } from './live-trail-renderer';

export interface TimeRange {
  startTime: number;
  endTime: number;
}

export class LiveTrailController {
  private readonly config: WaveformTierConfig;
  private skin: LiveTrailSkin;
  
  // Owned components
  private readonly accumulator: LiveWaveformAccumulator;
  private readonly renderer: LiveTrailRenderer;
  private readonly scratchBuffer: Float32Array;
  
  // State
  private analyser: AnalyserNode | null = null;
  private timeRange: TimeRange | null = null;
  private rafId: number | null = null;
  private isRunning: boolean = false;
  
  // Frame skipping for lower tiers
  private frameCount: number = 0;
  
  // Diagnostic logging
  private _logCount = 0;

  /**
   * Create a new live trail controller
   * 
   * @param config - Performance tier configuration (bar count, FFT size, etc.)
   * @param skin - Visual appearance settings
   */
  constructor(
    config: WaveformTierConfig,
    skin: LiveTrailSkin
  ) {
    this.config = config;
    this.skin = skin;
    
    // Initialize owned components
    this.accumulator = new LiveWaveformAccumulator(config.barCount);
    this.renderer = new LiveTrailRenderer();
    this.scratchBuffer = new Float32Array(config.analyserFFT);
    this.frameCount = 0;
  }

  /**
   * Attach to the live trail canvas element
   * 
   * @param canvas - Target canvas for rendering
   */
  attachCanvas(canvas: HTMLCanvasElement): void {
    this.renderer.attach(canvas);
  }

  /**
   * Set the canvas size and handle DPI scaling
   * 
   * @param width - CSS width in pixels
   * @param height - CSS height in pixels
   * @param dpr - Device pixel ratio (optional, defaults to window.devicePixelRatio)
   */
  setSize(width: number, height: number, dpr?: number): void {
    this.renderer.resize(width, height, dpr);
  }

  /**
   * Set the analyser node for audio data
   * 
   * @param analyser - AnalyserNode providing time domain data
   */
  setAnalyser(analyser: AnalyserNode): void {
    this.analyser = analyser;
  }

  /**
   * Set the time range for progress calculation
   * 
   * @param range - Time range with start/end times in seconds
   */
  setTimeRange(range: TimeRange): void {
    this.timeRange = range;
  }

  /**
   * Update the visual skin during runtime
   * 
   * @param skin - New visual appearance settings
   */
  setSkin(skin: LiveTrailSkin): void {
    this.skin = skin;
  }

  /**
   * Start the rAF loop
   * Idempotent: does nothing if already running
   */
  start(): void {
    // Idempotent: ignore if already running
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.frameCount = 0;
    this._logCount = 0;
    this.tick();
  }

  /**
   * Stop the rAF loop
   * Idempotent: does nothing if already stopped
   */
  stop(): void {
    // Idempotent: ignore if already stopped
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  /**
   * Clean up all resources
   * Stops rAF loop and clears references
   */
  dispose(): void {
    // Stop rAF loop
    this.stop();
    
    // Clear analyser reference
    this.analyser = null;
    
    // Clear time range
    this.timeRange = null;
    
    // Detach renderer from canvas
    this.renderer.detach();
    
    // Reset accumulator
    this.accumulator.reset();
    
    // Reset frame counter
    this.frameCount = 0;
  }

  /**
   * Main rAF tick function
   * Orchestrates the complete pipeline: analyser → accumulator → renderer
   */
  private tick(): void {
    // Don't schedule next frame if stopped
    if (!this.isRunning) {
      return;
    }

    // Schedule next frame first (ensures consistent timing)
    this.rafId = requestAnimationFrame(() => this.tick());

    // Check prerequisites
    if (!this.analyser || !this.timeRange) {
      return;
    }

    // Get audio engine state
    const ae = (window as any).audioEngine;
    if (!ae?.isPlaying) {
      return;
    }

    // Handle frame skipping for lower tiers (e.g., lite skips every other frame)
    if (this.config.skipFrames > 0) {
      this.frameCount++;
      if (this.frameCount % (this.config.skipFrames + 1) === 0) {
        // Skip this frame - don't update or render
        return;
      }
    }

    // Compute current playback progress within block
    const currentTime = ae.getCurrentTime?.() ?? 0;
    const progress = (currentTime - this.timeRange.startTime) / 
                     (this.timeRange.endTime - this.timeRange.startTime);
    
    // Clamp to valid range [0, 1]
    const clampedProgress = Math.max(0, Math.min(1, progress));

    // Update accumulator with new analyser data
    this.accumulator.update(this.analyser, clampedProgress, this.scratchBuffer);

    // Render the accumulated waveform
    this.renderer.draw(this.accumulator, this.skin);
  }

  /**
   * Check if controller is currently running
   * 
   * @returns True if rAF loop is active
   */
  getIsRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Get the accumulator instance for inspection/debugging
   * 
   * @returns LiveWaveformAccumulator instance
   */
  getAccumulator(): LiveWaveformAccumulator {
    return this.accumulator;
  }

  /**
   * Get the renderer instance for manual operations
   * 
   * @returns LiveTrailRenderer instance
   */
  getRenderer(): LiveTrailRenderer {
    return this.renderer;
  }

  /**
   * Manually clear the canvas without stopping the loop
   */
  clearCanvas(): void {
    this.renderer.clear();
  }

  /**
   * Reset the accumulator without stopping the loop
   */
  resetAccumulator(): void {
    this.accumulator.reset();
  }
}
