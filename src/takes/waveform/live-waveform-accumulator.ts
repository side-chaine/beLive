/**
 * Live Waveform Accumulator
 * 
 * Session-local canonical envelope buffer for accumulated waveform visualization.
 * Zero React, zero canvas, no runtime allocations after construction.
 * 
 * @module live-waveform-accumulator
 * @see waveform-tier-config for bar count configuration
 */

export class LiveWaveformAccumulator {
  private buffer: Float32Array;
  private _headIndex: number;
  private readonly _barCount: number;
  private _hasWritten = false;

  /**
   * Create a new live waveform accumulator
   * 
   * @param barCount - Number of bars for the accumulated waveform
   */
  constructor(barCount: number) {
    if (barCount <= 0) {
      throw new Error('barCount must be positive');
    }

    this._barCount = barCount;
    this._headIndex = 0;
    
    // Interleaved buffer: [min0, max0, min1, max1, ..., minN, maxN]
    // Each bar uses 2 floats (min and max amplitude)
    this.buffer = new Float32Array(barCount * 2);
    
    // Initialize buffer to zeros
    this.reset();
  }

  /**
   * Reset the accumulator buffer to initial state
   * Clears all accumulated data
   */
  reset(): void {
    this.buffer.fill(0);
    this._headIndex = 0;
    this._hasWritten = false;
  }

  /**
   * Update accumulator with new analyser data
   * 
   * @param analyser - AnalyserNode providing time domain data
   * @param progress - Current playback progress (0.0 - 1.0)
   * @param scratch - Scratch Float32Array for analyser data (reused each frame)
   */
  update(
    analyser: AnalyserNode,
    progress: number,
    scratch: Float32Array
  ): void {
    // Get analyser data into scratch buffer
    analyser.getFloatTimeDomainData(scratch);

    // Compute min/max for entire current frame
    let frameMin = 0;
    let frameMax = 0;
    
    for (let i = 0; i < scratch.length; i++) {
      const sample = scratch[i] || 0;
      if (sample < frameMin) frameMin = sample;
      if (sample > frameMax) frameMax = sample;
    }

    // Compute which bar to update based on progress
    const barIndex = Math.floor(progress * this._barCount);
    
    // Clamp to valid range
    const clampedBarIndex = Math.min(this._barCount - 1, Math.max(0, barIndex));

    // Catch-up logic: fill gaps if progress jumped multiple bins
    if (!this._hasWritten) {
      // First write: initialize current bar only
      const minIndex = clampedBarIndex * 2;
      const maxIndex = clampedBarIndex * 2 + 1;
      
      this.buffer[minIndex] = frameMin;
      this.buffer[maxIndex] = frameMax;
      
      this._headIndex = clampedBarIndex;
      this._hasWritten = true;
      return;
    }

    // Subsequent writes: check for jumps
    if (clampedBarIndex > this._headIndex + 1) {
      // Jumped forward: fill intermediate bars with current frame data
      for (let bar = this._headIndex + 1; bar <= clampedBarIndex; bar++) {
        const minIndex = bar * 2;
        const maxIndex = bar * 2 + 1;
        
        const prevMin = this.buffer[minIndex];
        const prevMax = this.buffer[maxIndex];
        
        this.buffer[minIndex] = Math.min(prevMin, frameMin);
        this.buffer[maxIndex] = Math.max(prevMax, frameMax);
      }
    } else {
      // Normal case: update current bar only
      const minIndex = clampedBarIndex * 2;
      const maxIndex = clampedBarIndex * 2 + 1;
      
      const prevMin = this.buffer[minIndex];
      const prevMax = this.buffer[maxIndex];
      
      this.buffer[minIndex] = Math.min(prevMin, frameMin);
      this.buffer[maxIndex] = Math.max(prevMax, frameMax);
    }

    // Update head position
    this._headIndex = clampedBarIndex;
  }

  /**
   * Get the accumulated waveform data
   * 
   * @returns Readonly Float32Array with interleaved [min, max] pairs
   */
  get data(): Readonly<Float32Array> {
    return this.buffer;
  }

  /**
   * Get the number of bars
   * 
   * @returns Total bar count
   */
  get barCount(): number {
    return this._barCount;
  }

  /**
   * Get the current head index (last updated bar)
   * 
   * @returns Current head bar index (0-based)
   */
  get headIndex(): number {
    return this._headIndex;
  }

  /**
   * Get min/max values for a specific bar
   * 
   * @param index - Bar index (0 to barCount - 1)
   * @returns Tuple [min, max] or null if index out of range
   */
  getBar(index: number): [number, number] | null {
    if (index < 0 || index >= this._barCount) {
      return null;
    }
    
    const minIndex = index * 2;
    const maxIndex = index * 2 + 1;
    
    return [this.buffer[minIndex], this.buffer[maxIndex]];
  }

  /**
   * Check if a bar has been written (non-zero)
   * 
   * @param index - Bar index to check
   * @returns True if bar has accumulated data
   */
  isBarWritten(index: number): boolean {
    if (index < 0 || index >= this._barCount) {
      return false;
    }
    
    const minIndex = index * 2;
    const maxIndex = index * 2 + 1;
    
    // A bar is considered written if either min or max is non-zero
    return this.buffer[minIndex] !== 0 || this.buffer[maxIndex] !== 0;
  }

  /**
   * Get the number of written bars
   * 
   * @returns Count of bars with accumulated data
   */
  getWrittenBarCount(): number {
    let count = 0;
    
    for (let i = 0; i < this._barCount; i++) {
      if (this.isBarWritten(i)) {
        count++;
      }
    }
    
    return count;
  }
}
