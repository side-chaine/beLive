/**
 * Vocal Onset Correction (VOC) — detects linear timing offset
 * between LRC markers and actual vocal amplitude in the stem.
 * 
 * Algorithm:
 * 1. Compute RMS envelope of vocal stem (50ms windows)
 * 2. Estimate background noise (10th percentile)
 * 3. Find first significant vocal onset (sustained above threshold)
 * 4. Compare with earliest M1 marker time
 * 5. Return offset if within actionable range
 */

import type { PersistedSyncMarker } from '../types/persistence.types';

/**
 * Result of vocal onset analysis
 */
export interface VocalOnsetResult {
  /**
   * Linear offset in seconds to apply to markers.
   * Positive = markers are early (vocal starts later than first marker).
   * Negative = markers are late (vocal starts earlier than first marker).
   */
  offset: number;

  /** Time in seconds where vocal onset was detected */
  vocalOnsetTime: number;

  /** Time in seconds of the earliest M1 marker */
  firstMarkerTime: number;

  /** Whether the offset was applied */
  applied: boolean;

  /** Reason if not applied */
  reason?: string;
}

/**
 * Configuration for onset detection
 */
const VOC_CONFIG = {
  /** RMS window size in seconds */
  windowSizeSec: 0.05, // 50ms

  /** Minimum consecutive windows above threshold to count as onset */
  minConsecutiveWindows: 3, // 150ms sustained

  /** Background noise multiplier for threshold */
  noiseMultiplier: 5,

  /** Minimum absolute RMS threshold (for near-silent stems) */
  minAbsoluteThreshold: 0.01,

  /** Minimum offset (seconds) to apply correction */
  minOffset: 0.3,

  /** Maximum offset (seconds) to apply correction */
  maxOffset: 3.0,

  /** Percentile of envelope used for background noise estimation */
  noisePercentile: 10,
};

/**
 * Compute RMS envelope of an AudioBuffer.
 * Returns array of RMS values, one per window.
 */
function computeRmsEnvelope(
  buffer: AudioBuffer,
  windowSizeSec: number,
): Float32Array {
  const channelData = buffer.getChannelData(0);
  const sampleRate = buffer.sampleRate;
  const windowSize = Math.floor(sampleRate * windowSizeSec);
  const numWindows = Math.floor(channelData.length / windowSize);
  const envelope = new Float32Array(numWindows);

  for (let w = 0; w < numWindows; w++) {
    const start = w * windowSize;
    let sum = 0;
    for (let i = 0; i < windowSize; i++) {
      const sample = channelData[start + i];
      sum += sample * sample;
    }
    envelope[w] = Math.sqrt(sum / windowSize);
  }

  return envelope;
}

/**
 * Estimate background noise level from RMS envelope.
 * Uses the given percentile of the envelope.
 */
function estimateBackgroundNoise(
  envelope: Float32Array,
  percentile: number,
): number {
  // Simple percentile: sort and pick index
  const sorted = Float32Array.from(envelope).sort();
  const idx = Math.floor(sorted.length * (percentile / 100));
  return sorted[Math.min(idx, sorted.length - 1)];
}

/**
 * Find the first sustained vocal onset in the RMS envelope.
 * Returns the time in seconds, or -1 if not found.
 */
function findFirstOnset(
  envelope: Float32Array,
  windowSizeSec: number,
  threshold: number,
  minConsecutive: number,
): number {
  let consecutive = 0;
  let onsetWindow = -1;

  for (let w = 0; w < envelope.length; w++) {
    if (envelope[w] > threshold) {
      consecutive++;
      if (consecutive === 1) {
        onsetWindow = w;
      }
      if (consecutive >= minConsecutive) {
        return onsetWindow * windowSizeSec;
      }
    } else {
      consecutive = 0;
      onsetWindow = -1;
    }
  }

  return -1; // No onset found
}

/**
 * Detect vocal onset offset between AudioBuffer and markers.
 * 
 * @param audioBuffer - Decoded vocal stem AudioBuffer
 * @param markers - Current sync markers (M1 and M2)
 * @returns VocalOnsetResult with offset and metadata
 */
export function detectVocalOffset(
  audioBuffer: AudioBuffer,
  markers: PersistedSyncMarker[],
): VocalOnsetResult {
  // Find earliest M1 marker time
  const m1Markers = markers.filter(m => m.markerType !== 'M2');
  if (m1Markers.length === 0) {
    return {
      offset: 0,
      vocalOnsetTime: -1,
      firstMarkerTime: -1,
      applied: false,
      reason: 'No M1 markers found',
    };
  }

  const firstMarkerTime = Math.min(...m1Markers.map(m => m.time));

  // Compute RMS envelope
  const envelope = computeRmsEnvelope(
    audioBuffer,
    VOC_CONFIG.windowSizeSec,
  );

  if (envelope.length === 0) {
    return {
      offset: 0,
      vocalOnsetTime: -1,
      firstMarkerTime,
      applied: false,
      reason: 'Empty envelope (zero-length audio?)',
    };
  }

  // Estimate background noise
  const bgNoise = estimateBackgroundNoise(
    envelope,
    VOC_CONFIG.noisePercentile,
  );

  // Compute threshold
  const threshold = Math.max(
    bgNoise * VOC_CONFIG.noiseMultiplier,
    VOC_CONFIG.minAbsoluteThreshold,
  );

  // Find first vocal onset
  const vocalOnsetTime = findFirstOnset(
    envelope,
    VOC_CONFIG.windowSizeSec,
    threshold,
    VOC_CONFIG.minConsecutiveWindows,
  );

  if (vocalOnsetTime < 0) {
    return {
      offset: 0,
      vocalOnsetTime: -1,
      firstMarkerTime,
      applied: false,
      reason: 'No vocal onset detected',
    };
  }

  // Compute offset
  const offset = vocalOnsetTime - firstMarkerTime;
  const absOffset = Math.abs(offset);

  // Decide whether to apply
  if (absOffset < VOC_CONFIG.minOffset) {
    return {
      offset,
      vocalOnsetTime,
      firstMarkerTime,
      applied: false,
      reason: `Offset too small (${offset.toFixed(3)}s < ${VOC_CONFIG.minOffset}s)`,
    };
  }

  if (absOffset > VOC_CONFIG.maxOffset) {
    return {
      offset,
      vocalOnsetTime,
      firstMarkerTime,
      applied: false,
      reason: `Offset too large (${offset.toFixed(3)}s > ${VOC_CONFIG.maxOffset}s), likely different song`,
    };
  }

  return {
    offset,
    vocalOnsetTime,
    firstMarkerTime,
    applied: true,
  };
}

/**
 * Apply linear offset to all markers (M1 and M2).
 * Returns new array with shifted times.
 */
export function applyOffsetToMarkers(
  markers: PersistedSyncMarker[],
  offset: number,
): PersistedSyncMarker[] {
  return markers.map(m => ({
    ...m,
    time: m.time + offset,
  }));
}

// ═══════════════════════════════════════════════════════════
// L3: Multi-Anchor Correction
// ═══════════════════════════════════════════════════════════

/** Anchor point: verified timing at a block boundary */
export interface AnchorPoint {
  blockId: string;
  blockType: string;
  expectedTime: number;      // From first M1 marker of this block
  actualOnsetTime: number;   // Detected vocal onset (or = expected if not found)
  offset: number;            // actualOnsetTime - expectedTime
  found: boolean;            // Whether a real onset was detected
}

/** Result of multi-anchor analysis */
export interface MultiAnchorResult {
  anchors: AnchorPoint[];
  applied: boolean;
  reason?: string;
}

/** Config for multi-anchor detection */
const ANCHOR_CONFIG = {
  /** Search window around each block's expected start time (±seconds) */
  searchWindowSec: 5.0,
  /** Minimum offset range between anchors to justify L3 over L2 */
  // L3 disabled — amplitude approach unreliable for continuous vocal. See TC-REVERT-01.
  minOffsetRange: 999.0,
  /** Maximum single anchor offset (safety net) */
  maxSingleOffset: 3.0,
};

/**
 * Find first sustained onset within a specific envelope range.
 * Returns the index within the sub-envelope, or -1 if not found.
 */
function findOnsetInRange(
  envelope: Float32Array,
  startIdx: number,
  endIdx: number,
  threshold: number,
  minConsecutive: number,
): number {
  let consecutive = 0;
  let onsetIdx = -1;

  for (let i = startIdx; i < endIdx && i < envelope.length; i++) {
    if (envelope[i] > threshold) {
      consecutive++;
      if (consecutive === 1) onsetIdx = i;
      if (consecutive >= minConsecutive) return onsetIdx;
    } else {
      consecutive = 0;
      onsetIdx = -1;
    }
  }
  return -1;
}

/**
 * Detect multi-anchor offsets for each block.
 * For each block, searches for vocal onset within ±5s of the expected
 * start time (from first M1 marker). Creates anchor points.
 * If anchors show non-uniform offsets (range > 0.3s), L3 is warranted.
 *
 * Safety Net (Nikita's Rule):
 * Onset search is CONSTRAINED to ±5s of expected block boundary.
 * A scream before chorus is OUTSIDE the chorus window → ignored.
 */
export function detectMultiAnchorOffsets(
  audioBuffer: AudioBuffer,
  markers: PersistedSyncMarker[],
  blocks: Array<{ id: string; type: string; lineIndices: number[] }>,
): MultiAnchorResult {
  // 1. Get M1 markers
  const m1Markers = markers.filter(m => m.markerType !== 'M2');
  if (m1Markers.length === 0) {
    return { anchors: [], applied: false, reason: 'No M1 markers' };
  }

  if (blocks.length === 0) {
    return { anchors: [], applied: false, reason: 'No blocks data' };
  }

  // 2. Compute RMS envelope (once for entire vocal stem)
  const envelope = computeRmsEnvelope(audioBuffer, VOC_CONFIG.windowSizeSec);
  if (envelope.length === 0) {
    return { anchors: [], applied: false, reason: 'Empty envelope' };
  }

  // 3. Estimate background noise
  const bgNoise = estimateBackgroundNoise(envelope, VOC_CONFIG.noisePercentile);
  const threshold = Math.max(
    bgNoise * VOC_CONFIG.noiseMultiplier,
    VOC_CONFIG.minAbsoluteThreshold,
  );

  // >>> VOC LOGGING (TC-L3TUNE-01) <<<
  // Summary only — offset warnings removed (known -5s issue, TC-VOC-01 pending)
  console.log(
    `[VOC] Track: ${audioBuffer.duration.toFixed(1)}s, ` +
    `${m1Markers.length} markers, ${blocks.length} blocks`
  );

  // 4. For each block, find anchor point
  const anchors: AnchorPoint[] = [];

  for (const block of blocks) {
    // Find first M1 marker that belongs to this block
    const blockMarker = m1Markers.find(m =>
      block.lineIndices.includes(m.lineIndex)
    );

    if (!blockMarker) {
      continue; // No M1 marker for this block
    }

    const expectedTime = blockMarker.time;

    // Search window: ±5s from expected time
    const windowStart = Math.max(0, expectedTime - ANCHOR_CONFIG.searchWindowSec);
    const windowEnd = Math.min(audioBuffer.duration, expectedTime + ANCHOR_CONFIG.searchWindowSec);

    // Convert to envelope indices
    const startIdx = Math.floor(windowStart / VOC_CONFIG.windowSizeSec);
    const endIdx = Math.ceil(windowEnd / VOC_CONFIG.windowSizeSec);

    if (startIdx >= endIdx || startIdx >= envelope.length) {
      continue; // Invalid search window
    }

    // Search for onset in this window
    const onsetIdx = findOnsetInRange(
      envelope,
      startIdx,
      endIdx,
      threshold,
      VOC_CONFIG.minConsecutiveWindows,
    );

    if (onsetIdx >= 0) {
      const actualTime = onsetIdx * VOC_CONFIG.windowSizeSec;
      const offset = actualTime - expectedTime;

      // Safety net: reject if single anchor offset too large
      if (Math.abs(offset) <= ANCHOR_CONFIG.maxSingleOffset) {
        // Anchor found within threshold — silent success
        anchors.push({
          blockId: block.id,
          blockType: block.type,
          expectedTime,
          actualOnsetTime: actualTime,
          offset,
          found: true,
        });
      } else {
        // Offset too large — trust LRC (known -5s issue)
        anchors.push({
          blockId: block.id,
          blockType: block.type,
          expectedTime,
          actualOnsetTime: expectedTime,
          offset: 0,
          found: false,
        });
      }
    } else {
      // No onset detected — trust LRC
      anchors.push({
        blockId: block.id,
        blockType: block.type,
        expectedTime,
        actualOnsetTime: expectedTime,
        offset: 0,
        found: false,
      });
    }
  }

  // 5. Check if we have enough found anchors
  const foundAnchors = anchors.filter(a => a.found);
  if (foundAnchors.length < 2) {
    console.log(
      `[VOC] L2 APPLIED: linear offset (only ${foundAnchors.length}/${anchors.length} anchors found, need ≥2)`
    );
    return { anchors, applied: false, reason: `Only ${foundAnchors.length} anchor(s) found, need ≥2` };
  }

  // 6. Check if offsets vary significantly (non-linear drift exists)
  const offsets = foundAnchors.map(a => a.offset);
  const maxOffset = Math.max(...offsets);
  const minOffset = Math.min(...offsets);
  const offsetRange = maxOffset - minOffset;

  if (offsetRange < ANCHOR_CONFIG.minOffsetRange) {
    // All anchors agree — linear offset (L2) is sufficient
    console.log(
      `[VOC] L2 APPLIED: linear offset (range=${offsetRange.toFixed(2)}s < ${ANCHOR_CONFIG.minOffsetRange}s)`
    );
    return {
      anchors,
      applied: false,
      reason: `Offsets too uniform (range=${offsetRange.toFixed(2)}s), L2 sufficient`,
    };
  }

  console.log(
    `[VOC] L3 APPLIED: ${foundAnchors.length}/${anchors.length} anchors, ` +
    `non-linear correction (range=${offsetRange.toFixed(3)}s)`
  );

  return { anchors, applied: true };
}

/**
 * Apply multi-anchor correction to markers.
 * For each marker, interpolates the offset between surrounding anchors.
 * Markers before first anchor use first anchor's offset.
 * Markers after last anchor use last anchor's offset.
 * Markers between anchors use linearly interpolated offset.
 */
export function applyMultiAnchorCorrection(
  markers: PersistedSyncMarker[],
  anchors: AnchorPoint[],
): PersistedSyncMarker[] {
  if (anchors.length === 0) return markers;

  // Sort anchors by expected time
  const sorted = [...anchors].sort((a, b) => a.expectedTime - b.expectedTime);

  return markers.map(m => {
    const offset = interpolateOffset(m.time, sorted);
    return { ...m, time: m.time + offset };
  });
}

/**
 * Interpolate offset at a given time using anchor points.
 */
function interpolateOffset(
  time: number,
  sortedAnchors: AnchorPoint[],
): number {
  if (sortedAnchors.length === 0) return 0;
  if (sortedAnchors.length === 1) return sortedAnchors[0].offset;

  // Before first anchor
  if (time <= sortedAnchors[0].expectedTime) {
    return sortedAnchors[0].offset;
  }

  // After last anchor
  if (time >= sortedAnchors[sortedAnchors.length - 1].expectedTime) {
    return sortedAnchors[sortedAnchors.length - 1].offset;
  }

  // Between two anchors — linear interpolation
  for (let i = 0; i < sortedAnchors.length - 1; i++) {
    const a1 = sortedAnchors[i];
    const a2 = sortedAnchors[i + 1];

    if (time >= a1.expectedTime && time <= a2.expectedTime) {
      const span = a2.expectedTime - a1.expectedTime;
      if (span === 0) return a1.offset;
      const t = (time - a1.expectedTime) / span;
      return a1.offset + t * (a2.offset - a1.offset);
    }
  }

  // Fallback (should not reach here)
  return 0;
}
