/**
 * beLive AudioEngine v2 — Singleton AudioContext.
 * Lazy creation. Handles suspended state (iOS Safari).
 */

let _ctx: AudioContext | null = null;

export function setAudioContext(ctx: AudioContext): void {
  _ctx = ctx;
}

export function getAudioContext(): AudioContext {
  if (!_ctx) {
    _ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return _ctx;
}

export async function ensureResumed(): Promise<void> {
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') {
    await ctx.resume();
  }
}

export function getSampleRate(): number {
  return getAudioContext().sampleRate;
}
