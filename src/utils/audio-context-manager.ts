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
