/**
 * AudioContext singleton для ZIP-экспорта.
 * Один контекст на всю сессию → избегает iOS Safari лимита (~6 контекстов).
 * Создаётся ТОЛЬКО на transcode path (не создавать на fast path).
 * Обязательно закрыть в finally.
 */
let _ctx: AudioContext | null = null;

export function getZipAudioContext(): AudioContext {
  if (!_ctx) {
    _ctx = new AudioContext({ sampleRate: 44100 });
  }
  return _ctx;
}

const ZIP_RESUME_TIMEOUT = 3000;

/**
 * Resume ZIP AudioContext с таймаутом + post-verify.
 * Аналог ensureResumed() из audioContext.ts — Phase 7 / 1b.
 */
export async function ensureZipResumed(): Promise<void> {
  const ctx = getZipAudioContext();
  if (ctx.state === 'suspended') {
    const timeout = new Promise<void>((_, reject) =>
      setTimeout(() => reject(new Error('zip ctx.resume() timed out')), ZIP_RESUME_TIMEOUT)
    );
    await Promise.race([ctx.resume(), timeout]);
    if ((ctx.state as AudioContextState) !== 'running') {
      throw new Error(`zip ctx.resume() resolved but state=${ctx.state}`);
    }
  }
}

export function closeZipAudioContext(): void {
  if (_ctx) {
    _ctx.close().catch(() => {});
    _ctx = null;
  }
}

/**
 * Проверка: создан ли контекст.
 */
export function hasZipAudioContext(): boolean {
  return _ctx !== null;
}
