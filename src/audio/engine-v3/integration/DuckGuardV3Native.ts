/**
 * Pure scheduling helper around a single GainNode.gain AudioParam. Stateless — knows
 * nothing about stems, loops, or transport. Everything is scheduled on the ctx.currentTime
 * domain via the AudioParam's own automation, which is what avoids JS-thread jitter
 * (there is no "loop wrapped" event to react to from native AudioBufferSourceNode looping,
 * so wrap-boundary ducks must be pre-scheduled in advance, not applied reactively).
 */
export class DuckGuardV3Native {
  constructor(private readonly gainParam: AudioParam) {}

  /** One-shot duck: dip to `ratio` of `fromGain`, hold, restore. For track-change etc. */
  duck(fromGain: number, ratio: number, holdMs: number, ctxNow: number, attackMs = 20, releaseMs = 50): void {
    const restoreAt = ctxNow + holdMs / 1000;
    this.gainParam.cancelScheduledValues(ctxNow);
    this.gainParam.setValueAtTime(fromGain, ctxNow);
    this.gainParam.linearRampToValueAtTime(fromGain * ratio, ctxNow + attackMs / 1000);
    this.gainParam.setValueAtTime(fromGain * ratio, restoreAt);
    this.gainParam.linearRampToValueAtTime(fromGain, restoreAt + releaseMs / 1000);
  }

  /**
   * Pre-schedules a small gain dip around each upcoming native-loop wrap point.
   * Call again (it cancels + reschedules from scratch) whenever loop points, rate,
   * or the source's start time change — stale schedules are not reused.
   */
  scheduleLoopWrapDucks(params: {
    baseGain: number;
    ctxNow: number;
    firstWrapAt: number; // ctx.currentTime of the first wrap, already in the future
    wrapPeriodSec: number; // MUST be the canonical (shared-across-all-stems) loop duration
    wrapCount: number;
    dipTo?: number; // fraction of baseGain, default 0.85
    preRollMs?: number;
    postRollMs?: number;
  }): void {
    const {
      baseGain,
      ctxNow,
      firstWrapAt,
      wrapPeriodSec,
      wrapCount,
      dipTo = 0.85,
      preRollMs = 15,
      postRollMs = 20,
    } = params;
    if (wrapPeriodSec <= 0 || wrapCount <= 0) return;

    this.gainParam.cancelScheduledValues(ctxNow);
    this.gainParam.setValueAtTime(baseGain, ctxNow);

    for (let n = 0; n < wrapCount; n++) {
      const wrapAt = firstWrapAt + n * wrapPeriodSec;
      const dipStart = wrapAt - preRollMs / 1000;
      if (dipStart < ctxNow) continue; // never schedule into the past
      this.gainParam.setValueAtTime(baseGain, dipStart);
      this.gainParam.linearRampToValueAtTime(baseGain * dipTo, wrapAt);
      this.gainParam.linearRampToValueAtTime(baseGain, wrapAt + postRollMs / 1000);
    }
  }

  /** Wipes any scheduled automation and pins the gain at a fixed value right now. */
  cancel(ctxNow: number, holdGain: number): void {
    this.gainParam.cancelScheduledValues(ctxNow);
    this.gainParam.setValueAtTime(holdGain, ctxNow);
  }
}
