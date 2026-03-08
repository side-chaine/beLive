/**
 * Generate [min, max] peak pairs from a visible slice of audio data.
 * Called per-draw — only processes visible region (~1M samples max, <1ms).
 */
export function generatePeaks(
  data: Float32Array,
  startSample: number,
  endSample: number,
  numBins: number
): [number, number][] {
  const length = endSample - startSample;
  if (length <= 0 || numBins <= 0) return [];

  const samplesPerBin = Math.max(1, Math.floor(length / numBins));
  const peaks: [number, number][] = [];

  for (let i = 0; i < numBins; i++) {
    const binStart = startSample + i * samplesPerBin;
    const binEnd = Math.min(binStart + samplesPerBin, endSample);
    let min = 1.0;
    let max = -1.0;

    for (let j = binStart; j < binEnd; j++) {
      const s = data[j];
      if (s < min) min = s;
      if (s > max) max = s;
    }

    peaks.push([min, max]);
  }

  return peaks;
}
