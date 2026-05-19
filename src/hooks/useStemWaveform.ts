import { useEffect, useRef } from 'react';
import { usePerformanceStore } from '../performance/performance.store';

interface UseStemWaveformOptions {
  stemId: string;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  enabled: boolean;
}

/**
 * useStemWaveform — Canvas Waveform Hook for Visual Mixer
 *
 * Draws frequency bars on a canvas element using per-stem AnalyserNode data.
 * Optimized with Uint8Array caching (no per-frame allocation) and FPS throttling.
 *
 * @param stemId - Stem identifier (e.g., 'drums', 'vocals')
 * @param canvasRef - Ref to the canvas element to draw on
 * @param enabled - When false, cancels animation and clears canvas
 */
export function useStemWaveform({ stemId, canvasRef, enabled }: UseStemWaveformOptions) {
  const rafRef = useRef<number>(0);
  const lastDrawRef = useRef<number>(0);
  // КЭШ массива — НЕ аллоцировать каждый frame!
  const dataArrayRef = useRef<Uint8Array | null>(null);
  // TC-13-07: Color cache — avoid getComputedStyle every frame
  const colorRef = useRef<string | null>(null);
  
  // TC-13-11: Tier-based waveform configuration
  // TC-13-15: Uniform balanced config for testing/calibration
  const TIER_WAVEFORM: Record<string, {
    bars: number;
    fps: number;
    shadow: number;
    peak: boolean;
    reflection: boolean;
  }> = {
    lite:     { bars: 16, fps: 20, shadow: 3, peak: false, reflection: false },
    balanced: { bars: 16, fps: 20, shadow: 3, peak: false, reflection: false },
    max:      { bars: 16, fps: 20, shadow: 3, peak: false, reflection: false },
    ultra:    { bars: 16, fps: 20, shadow: 3, peak: false, reflection: false },
  };

  /**
   * TC-13-14: Per-stem frequency focus ranges.
   * Only visualize frequencies where the instrument actually has energy.
   * This prevents bars from being empty on the right side.
   */
  const STEM_FREQ_RANGE: Record<string, { low: number; high: number }> = {
    bass:    { low: 20,   high: 600 },
    drums:   { low: 30,   high: 10000 },
    keys:    { low: 80,   high: 8000 },
    guitar:  { low: 80,   high: 8000 },
    vocals:  { low: 80,   high: 8000 },
    backing: { low: 200,  high: 8000 },
    other:   { low: 30,   high: 10000 },
  };
  const DEFAULT_FREQ_RANGE = { low: 30, high: 10000 };

  useEffect(() => {
    // TC-13-07: Reset color cache on stemId change
    colorRef.current = null;
    
    if (!enabled) {
      // Disabled: clear canvas and cancel rAF
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx?.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // TC-13-11: Read performance budget (imperative — inside rAF context)
    const vmBudget = usePerformanceStore.getState().getBudget()?.visualMixer;
    // Lite tier: waveform disabled entirely
    if (vmBudget && !vmBudget.allowWaveform) return;

    const tier = document.documentElement.getAttribute('data-visual-tier') ?? 'balanced';
    const waveConfig = TIER_WAVEFORM[tier] ?? TIER_WAVEFORM.balanced;
    const targetFps = vmBudget?.cardUpdateFps ?? waveConfig.fps;
    const frameInterval = 1000 / targetFps;
    
    // TC-13-07: Dynamic canvas size with ResizeObserver
    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const w = Math.floor(rect.width * dpr);
      const h = Math.floor(rect.height * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
    };
    resizeCanvas();
    const canvasObserver = new ResizeObserver(() => resizeCanvas());
    canvasObserver.observe(canvas);
    
    // TC-13-13: Per-stem Auto-Gain Control
    // Tracks peak level over time — normalizes quiet stems to fill canvas
    let runningPeak = 5;     // Lower initial — faster lock-on
    const peakAttack = 0.3;  // 30% — catches peak in ~3 frames (fast!)
    const peakDecay = 0.995; // Holds ~200 frames (10 sec at 20fps)
    
    const ae = (window as any).audioEngine;
    
    const draw = (timestamp: number) => {
      rafRef.current = requestAnimationFrame(draw);

      if (timestamp - lastDrawRef.current < frameInterval) return;
      lastDrawRef.current = timestamp;

      const analyser = ae?.getStemAnalyser?.(stemId) as AnalyserNode | null;
      if (!analyser) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
      }

      if (!dataArrayRef.current || dataArrayRef.current.length !== analyser.frequencyBinCount) {
        dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);
      }
      analyser.getByteFrequencyData(dataArrayRef.current);
      const dataArray = dataArrayRef.current;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // ─── TC-13-13: LOGARITHMIC frequency mapping ───
      // Allocates more bars to bass/mids where most energy lives
      const binCount = dataArray.length;
      const barCount = waveConfig.bars;
      const logPower = 1.8; // Slightly less aggressive — focused range already helps

      // TC-13-14: Focus on stem's frequency range only
      const sampleRate = analyser.context.sampleRate || 44100;
      const freqRange = STEM_FREQ_RANGE[stemId] ?? DEFAULT_FREQ_RANGE;
      const hzToBin = (hz: number) => Math.min(binCount - 1, Math.max(0, Math.round(hz / (sampleRate / 2) * binCount)));
      const lowBin = hzToBin(freqRange.low);
      const highBin = hzToBin(freqRange.high);
      const rangeBins = Math.max(1, highBin - lowBin);

      const binRanges: Array<{ start: number; end: number }> = [];
      for (let i = 0; i < barCount; i++) {
        const logStart = lowBin + Math.floor(Math.pow(i / barCount, logPower) * rangeBins);
        const logEnd = lowBin + Math.floor(Math.pow((i + 1) / barCount, logPower) * rangeBins);
        binRanges.push({ start: logStart, end: Math.max(logStart + 1, logEnd) });
      }

      // ─── Calculate barValues using MAX + AVG blend ───
      const barValues: number[] = [];
      let frameMax = 0;

      for (let i = 0; i < barCount; i++) {
        const { start, end } = binRanges[i];
        let maxVal = 0;
        let sum = 0;
        let count = 0;
        for (let j = start; j < end; j++) {
          if (dataArray[j] > maxVal) maxVal = dataArray[j];
          sum += dataArray[j];
          count++;
        }
        const avgVal = count > 0 ? sum / count : 0;
        const barValue = maxVal * 0.7 + avgVal * 0.3;
        barValues.push(barValue);
        if (barValue > frameMax) frameMax = barValue;
      }

      // ─── TC-13-13: AGC — Auto-Gain Control ───
      // Normalizes each stem to fill its own canvas regardless of loudness
      if (frameMax > runningPeak) {
        runningPeak = runningPeak + (frameMax - runningPeak) * peakAttack;
      } else {
        runningPeak = runningPeak * peakDecay;
      }
      // Lower floor — allows quiet stems to normalize faster
      runningPeak = Math.max(runningPeak, 5);

      // ─── Bar layout calculation ───
      const barGap = Math.max(1, Math.round(canvas.width * 0.03));
      const barWidth = Math.max(2, Math.floor((canvas.width - barGap * (barCount - 1)) / barCount));
      const totalBarsWidth = barCount * barWidth + (barCount - 1) * barGap;
      const offsetX = Math.floor((canvas.width - totalBarsWidth) / 2);

      // ─── CENTER ORIGIN — bars grow from vertical center ───
      const centerY = Math.floor(canvas.height / 2);
      const maxBarHeight = centerY * 0.9; // 90% of half-canvas (leaves small margin)

      // ─── Get stem color ───
      if (!colorRef.current) {
        const cardEl = canvas.closest('[data-stem-id]');
        if (cardEl) {
          colorRef.current = getComputedStyle(cardEl as HTMLElement)
            .getPropertyValue('--stem-color')?.trim() || '#ff9f43';
        }
      }
      const stemColor = colorRef.current || '#ff9f43';

      // ─── Draw bars ───
      ctx.shadowColor = stemColor;
      ctx.shadowBlur = waveConfig.shadow;

      for (let i = 0; i < barCount; i++) {
        // Normalize: 0-1 relative to stem's own dynamic range
        const normalizedValue = Math.min(1, barValues[i] / runningPeak);

        // Signal detection for minimum height
        const hasSignal = barValues[i] > 3;
        const signalFloor = hasSignal ? 0.06 : 0.02; // 6% if signal, 2% if silence

        const barHeight = Math.max(
          centerY * signalFloor,
          normalizedValue * maxBarHeight
        );

        const x = offsetX + i * (barWidth + barGap);

        // Draw UPWARD from center
        const gradient = ctx.createLinearGradient(x, centerY - barHeight, x, centerY);
        gradient.addColorStop(0, stemColor);
        gradient.addColorStop(1, stemColor + '40'); // 25% opacity at base
        ctx.fillStyle = gradient;
        ctx.fillRect(x, centerY - barHeight, barWidth, barHeight);

        // Draw DOWNWARD mirror (40% height, 30% opacity)
        const mirrorHeight = barHeight * 0.4;
        const mirrorGradient = ctx.createLinearGradient(x, centerY, x, centerY + mirrorHeight);
        mirrorGradient.addColorStop(0, stemColor + '4D'); // 30% opacity at center
        mirrorGradient.addColorStop(1, 'transparent');
        ctx.fillStyle = mirrorGradient;
        ctx.fillRect(x, centerY, barWidth, mirrorHeight);

        // Peak indicator (max/ultra only)
        if (waveConfig.peak && normalizedValue > 0.5) {
          ctx.shadowBlur = 0;
          ctx.fillStyle = '#fff';
          ctx.fillRect(x, centerY - barHeight, barWidth, Math.max(1, Math.min(2, barHeight * 0.06)));
          ctx.shadowBlur = waveConfig.shadow;
        }

        // Bottom reflection (ultra only)
        if (waveConfig.reflection && normalizedValue > 0.7) {
          ctx.shadowBlur = 0;
          ctx.globalAlpha = 0.12;
          ctx.fillStyle = stemColor;
          const reflHeight = Math.min(mirrorHeight * 0.5, 8);
          ctx.fillRect(x, centerY + mirrorHeight, barWidth, reflHeight);
          ctx.globalAlpha = 1.0;
          ctx.shadowBlur = waveConfig.shadow;
        }
      }

      // ─── Center reference line (subtle) ───
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 0.15;
      ctx.fillStyle = stemColor;
      ctx.fillRect(offsetX, centerY, totalBarsWidth, 1);
      ctx.globalAlpha = 1.0;
      ctx.shadowBlur = 0;
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
      canvasObserver.disconnect();
    };
  }, [stemId, enabled, canvasRef]);
}
