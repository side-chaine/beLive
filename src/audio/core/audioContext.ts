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
    const TIMEOUT_MS = 3000;
    const timeout = new Promise<void>((_, reject) =>
      setTimeout(() => reject(new Error('ctx.resume() timed out')), TIMEOUT_MS)
    );
    await Promise.race([ctx.resume(), timeout]);
    if ((ctx.state as AudioContextState) !== 'running') {
      throw new Error(`ctx.resume() resolved but state=${ctx.state}`);
    }
  }
}

export function getSampleRate(): number {
  return getAudioContext().sampleRate;
}
