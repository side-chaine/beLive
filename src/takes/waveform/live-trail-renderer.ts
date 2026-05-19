/**
 * Live Trail Renderer
 * 
 * Imperial canvas renderer for accumulated waveform trail.
 * Zero React, zero store dependencies, pure imperative rendering.
 * 
 * @module live-trail-renderer
 * @see live-waveform-accumulator for data source
 * @see waveform-skins for visual appearance
 */

import type { LiveTrailSkin } from './waveform-skins';
import type { LiveWaveformAccumulator } from './live-waveform-accumulator';

export class LiveTrailRenderer {
  private canvas: HTMLCanvasElement | null = null;
  private context: CanvasRenderingContext2D | null = null;
  private width: number = 0;
  private height: number = 0;
  private dpr: number = 1;

  /**
   * Attach renderer to a canvas element
   * 
   * @param canvas - Target canvas element for rendering
   */
  attach(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.context = canvas.getContext('2d');
    
    if (!this.context) {
      throw new Error('Failed to get 2D rendering context');
    }
  }

  /**
   * Detach renderer from current canvas
   */
  detach(): void {
    if (this.canvas && this.context) {
      this.context.clearRect(0, 0, this.width, this.height);
    }
    this.canvas = null;
    this.context = null;
    this.width = 0;
    this.height = 0;
  }

  /**
   * Resize the canvas backing store
   * 
   * @param width - CSS width in pixels
   * @param height - CSS height in pixels
   * @param dpr - Device pixel ratio (default: window.devicePixelRatio)
   */
  resize(width: number, height: number, dpr?: number): void {
    if (!this.canvas) {
      return;
    }

    const newDpr = dpr ?? (window.devicePixelRatio || 1);
    // Quantize to integer to prevent fractional resize storms
    const roundedWidth = Math.round(width);
    const roundedHeight = Math.round(height);

    // Early return if quantized size hasn't actually changed (idempotent)
    if (
      this.width === roundedWidth &&
      this.height === roundedHeight &&
      this.dpr === newDpr
    ) {
      return;
    }

    // Update stored dimensions with quantized values
    this.dpr = newDpr;
    this.width = roundedWidth;
    this.height = roundedHeight;

    // Set backing store size (scaled by DPR for Retina displays)
    this.canvas.width = Math.round(roundedWidth * this.dpr);
    this.canvas.height = Math.round(roundedHeight * this.dpr);

    // Set CSS display size
    this.canvas.style.width = `${roundedWidth}px`;
    this.canvas.style.height = `${roundedHeight}px`;

    // Scale context to match DPR
    if (this.context) {
      this.context.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    }
  }

  /**
   * Draw the accumulated waveform trail
   * 
   * Clears only the live trail canvas and draws bars from accumulator data.
   * No base context, no compare layers, no playhead - live trail only.
   * 
   * @param accumulator - Source of accumulated waveform data
   * @param skin - Visual appearance settings
   */
  private drawCallCount = 0;
  
  draw(
    accumulator: LiveWaveformAccumulator,
    skin: LiveTrailSkin
  ): void {
    // Safety: tolerate unattached canvas
    if (!this.canvas || !this.context) {
      return;
    }

    const ctx = this.context;
    const w = this.width;
    const h = this.height;
    const barCount = accumulator.barCount;
    const data = accumulator.data;

    // Clear entire canvas
    ctx.clearRect(0, 0, w, h);

    // Optional glow effect
    if (skin.glow) {
      ctx.shadowColor = skin.glow.color;
      ctx.shadowBlur = skin.glow.blur;
    } else {
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
    }

    // Set fill style
    ctx.fillStyle = this.hexToRgba(skin.color, skin.opacity);

    // Calculate bar dimensions
    const totalBarWidth = w / barCount;
    const mid = h / 2;

    // Draw each bar up to headIndex
    const headIndex = accumulator.headIndex;
    
    for (let i = 0; i <= headIndex && i < barCount; i++) {
      // Check if bar has been written
      const minIndex = i * 2;
      const maxIndex = i * 2 + 1;
      const min = data[minIndex];
      const max = data[maxIndex];

      // Skip unwritten bars (both min and max are 0)
      if (min === 0 && max === 0) {
        continue;
      }

      // Calculate bar position and size
      const x = i * totalBarWidth;
      const barW = totalBarWidth - skin.barGap;
      
      // Convert normalized amplitude (-1 to 1) to pixel coordinates
      // min is negative (bottom), max is positive (top)
      const yTop = mid - max * mid;
      const yBot = mid - min * mid;
      const barH = Math.max(1, yBot - yTop);

      // Dual-pass bar rendering for DAW-like appearance
      // PASS A: outer body (lower alpha, slightly wider)
      const outerW = Math.max(1, barW);
      const outerAlpha = skin.opacity * 0.45;
      ctx.fillStyle = this.hexToRgba(skin.color, outerAlpha);
      ctx.fillRect(x, yTop, outerW, barH);

      // PASS B: inner core (higher alpha, narrower)
      const innerW = Math.max(1, barW * 0.42);
      const innerX = x + (outerW - innerW) / 2;
      const innerAlpha = Math.min(1, skin.opacity);
      ctx.fillStyle = this.hexToRgba(skin.color, innerAlpha);
      ctx.fillRect(innerX, yTop, innerW, barH);
    }

    // Reset shadow for next frame
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
  }

  /**
   * Clear the canvas completely
   */
  clear(): void {
    if (!this.canvas || !this.context) {
      return;
    }

    const ctx = this.context;
    const w = this.width;
    const h = this.height;

    ctx.clearRect(0, 0, w, h);
  }

  /**
   * Get the attached canvas element
   * 
   * @returns Current canvas or null if not attached
   */
  getCanvas(): HTMLCanvasElement | null {
    return this.canvas;
  }

  /**
   * Check if renderer is attached to a canvas
   * 
   * @returns True if attached and ready to render
   */
  isAttached(): boolean {
    return this.canvas !== null && this.context !== null;
  }

  /**
   * Convert hex color to RGBA string
   * 
   * @param hex - Hex color (e.g., '#ffa500')
   * @param alpha - Alpha value (0.0 - 1.0)
   * @returns RGBA color string (e.g., 'rgba(255, 165, 0, 0.85)')
   */
  private hexToRgba(hex: string, alpha: number): string {
    // Remove '#' prefix
    const hexClean = hex.replace('#', '');
    
    // Parse RGB values
    const r = parseInt(hexClean.substring(0, 2), 16);
    const g = parseInt(hexClean.substring(2, 4), 16);
    const b = parseInt(hexClean.substring(4, 6), 16);

    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
}
