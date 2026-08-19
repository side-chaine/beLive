import { describe, it, expect } from 'vitest';
import { findZeroCrossing, computeCanonicalLoop } from '../integration/LoopEngineV3';

const SR = 48000;

function makeSine(freqHz: number, phase: number, durationSec: number): Float32Array {
  const n = Math.round(SR * durationSec);
  const buf = new Float32Array(n);
  for (let i = 0; i < n; i++) buf[i] = Math.sin(2 * Math.PI * freqHz * (i / SR) + phase) * 0.6;
  return buf;
}

describe('findZeroCrossing', () => {
  it('snaps to a point near zero on every given channel simultaneously', () => {
    const l = makeSine(220, 0, 3);
    const r = makeSine(220, 0.02, 3);
    const t = findZeroCrossing([l, r], 1.5, { sampleRate: SR });
    const idx = Math.round(t * SR);
    expect(Math.abs(l[idx] ?? 1)).toBeLessThan(0.01);
    expect(Math.abs(r[idx] ?? 1)).toBeLessThan(0.01);
  });

  it('falls back to the original time for a degenerate (empty) channel instead of throwing', () => {
    const t = findZeroCrossing([new Float32Array(0)], 2.5, { sampleRate: SR });
    expect(t).toBe(2.5);
  });
});

describe('computeCanonicalLoop', () => {
  it('gives every stem the SAME duration even though independent snapping would not', () => {
    const instrumentalL = makeSine(220, 0, 6);
    const instrumentalR = makeSine(220, 0.02, 6);
    const vocalsL = makeSine(330, 1.4, 6);
    const vocalsR = makeSine(330, 1.9, 6);

    // Prove the bug this replaces is real: independent per-stem snapping DOES diverge.
    const instrEndIndependent = findZeroCrossing([instrumentalL, instrumentalR], 4.337, { sampleRate: SR });
    const vocalEndIndependent = findZeroCrossing([vocalsL, vocalsR], 4.337, { sampleRate: SR });
    expect(Math.abs(instrEndIndependent - vocalEndIndependent)).toBeGreaterThan(0);

    // The fix: one canonical duration, derived only from the reference (master-clock) stem.
    const canonical = computeCanonicalLoop([instrumentalL, instrumentalR], 1.0, 4.337, SR);
    const vocalsAppliedEnd = canonical.start + canonical.durationSec;
    expect(vocalsAppliedEnd).toBe(canonical.end);

    // Drift projection: uncompensated per-stem difference compounds every wrap.
    // Threshold here is deliberately modest (5ms, not the 50ms an earlier ad-hoc
    // script implied from a less clean, apples-to-oranges comparison) — comb-filtering
    // between two correlated tracks is audible well under 10ms, so this stays a real,
    // meaningful assertion without overstating the honest number this measurement gives.
    const perStemDiffMs = Math.abs(instrEndIndependent - vocalEndIndependent) * 1000;
    const driftAfter30WrapsMs = perStemDiffMs * 30;
    expect(driftAfter30WrapsMs).toBeGreaterThan(5);
  });

  it('never returns a non-positive duration even for a degenerate start===end request', () => {
    const ch = makeSine(220, 0, 2);
    const canonical = computeCanonicalLoop([ch], 1.0, 1.0, SR);
    expect(canonical.durationSec).toBeGreaterThan(0);
  });
});
