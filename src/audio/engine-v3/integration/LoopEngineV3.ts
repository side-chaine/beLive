export interface ZeroCrossingOptions {
  sampleRate: number;
  searchWindowSec?: number; // default 50ms
  threshold?: number; // default 0.01
}

/**
 * Finds the nearest sample (searching outward: target, +1, -1, +2, -2, ...) where
 * EVERY given channel is simultaneously near-zero. Falls back to any single channel
 * being near-zero if no fully-silent point exists in the window, then to the
 * unmodified target time as a last resort (never throws, never leaves the caller
 * without a usable number).
 *
 * Multi-channel-simultaneous is the point: snapping only channel 0 can still leave
 * a DC discontinuity on channel 1 for real stereo material.
 */
export function findZeroCrossing(
  channels: Float32Array[],
  targetTime: number,
  opts: ZeroCrossingOptions,
): number {
  const { sampleRate, searchWindowSec = 0.05, threshold = 0.01 } = opts;
  const firstChannel = channels[0];
  if (!firstChannel || firstChannel.length === 0 || sampleRate <= 0) return targetTime;

  const centerIdx = Math.round(targetTime * sampleRate);
  const maxOffset = Math.max(1, Math.round(searchWindowSec * sampleRate));
  const len = firstChannel.length;

  const sampleAt = (ch: Float32Array, idx: number): number => (idx >= 0 && idx < ch.length ? (ch[idx] ?? 0) : NaN);

  const allChannelsQuiet = (idx: number): boolean => {
    if (idx < 0 || idx >= len) return false;
    for (const ch of channels) {
      const v = sampleAt(ch, idx);
      if (!Number.isFinite(v) || Math.abs(v) >= threshold) return false;
    }
    return true;
  };
  const anyChannelQuiet = (idx: number): boolean => {
    if (idx < 0 || idx >= len) return false;
    const v = sampleAt(firstChannel, idx);
    return Number.isFinite(v) && Math.abs(v) < threshold;
  };

  for (let offset = 0; offset <= maxOffset; offset++) {
    const fwd = centerIdx + offset;
    const bwd = centerIdx - offset;
    if (allChannelsQuiet(fwd)) return fwd / sampleRate;
    if (offset > 0 && allChannelsQuiet(bwd)) return bwd / sampleRate;
  }
  for (let offset = 0; offset <= maxOffset; offset++) {
    const fwd = centerIdx + offset;
    const bwd = centerIdx - offset;
    if (anyChannelQuiet(fwd)) return fwd / sampleRate;
    if (offset > 0 && anyChannelQuiet(bwd)) return bwd / sampleRate;
  }
  return targetTime;
}

export interface CanonicalLoop {
  start: number;
  end: number;
  durationSec: number;
}

/**
 * Computes ONE loop start + duration, derived only from the reference (master-clock)
 * stem's waveform. Every other stem must reuse this exact durationSec rather than
 * independently snapping its own end point — independent snapping produces slightly
 * different loop lengths per stem (different waveforms cross zero at different
 * sample offsets), and since native AudioBufferSourceNode.loop wraps each source
 * autonomously inside the browser with no cross-node sync, stems with different
 * loop lengths drift out of phase with each other after repeated cycles even though
 * each one individually loops perfectly cleanly.
 */
export function computeCanonicalLoop(
  referenceChannels: Float32Array[],
  requestedStart: number,
  requestedEnd: number,
  sampleRate: number,
  zcOpts: Omit<ZeroCrossingOptions, 'sampleRate'> = {},
): CanonicalLoop {
  const start = findZeroCrossing(referenceChannels, requestedStart, { sampleRate, ...zcOpts });
  const rawEnd = findZeroCrossing(referenceChannels, requestedEnd, { sampleRate, ...zcOpts });
  const durationSec = Math.max(rawEnd - start, 1 / sampleRate);
  return { start, end: start + durationSec, durationSec };
}
