/** Мониторинг монотонного роста currentTime после play() */
export class PlaybackWatchdog {
  private samples: number[] = [];
  private intervalId: ReturnType<typeof setInterval> | null = null;

  start(getCurrentTime: () => number, onSuccess: () => void, onFail: () => void, windowMs = 400) {
    this.stop();
    this.samples = [];
    const startedAt = Date.now();
    this.intervalId = setInterval(() => {
      this.samples.push(getCurrentTime());
      if (Date.now() - startedAt >= windowMs) {
        this.stop();
        const monotonic = this.samples.every((v, i) => i === 0 || v > this.samples[i - 1] - 0.001);
        const advanced = this.samples[this.samples.length - 1] > this.samples[0];
        if (monotonic && advanced) onSuccess();
        else onFail();
      }
    }, 40);
  }

  stop() {
    if (this.intervalId != null) clearInterval(this.intervalId);
    this.intervalId = null;
  }
}

/** Экспоненциальный бэкофф для seek-коррекций */
export class DriftCorrector {
  private lockUntil = 0;
  private lockDurationMs = 1000;
  private lastCorrectionAt = 0;

  maybeCorrect(driftMs: number, targetMediaTime: number, seekFn: (t: number) => void) {
    const now = Date.now();
    if (now < this.lockUntil) return;
    if (Math.abs(driftMs) <= 40) {
      if (now - this.lastCorrectionAt > 5000) this.lockDurationMs = 1000;
      return;
    }
    seekFn(targetMediaTime);
    this.lockDurationMs = now - this.lastCorrectionAt < 2000
      ? Math.min(this.lockDurationMs * 2, 5000)
      : 1000;
    this.lastCorrectionAt = now;
    this.lockUntil = now + this.lockDurationMs;
  }
}

/** Debounce burst команд (play+seek) в один apply */
export class CommandCoalescer {
  private pending: { mediaTime?: number; isPlaying?: boolean } = {};
  private timerId: ReturnType<typeof setTimeout> | null = null;

  push(partial: { mediaTime?: number; isPlaying?: boolean }, flush: (merged: { mediaTime?: number; isPlaying?: boolean }) => void, delayMs = 30) {
    this.pending = { ...this.pending, ...partial };
    if (this.timerId != null) clearTimeout(this.timerId);
    this.timerId = setTimeout(() => {
      const merged = this.pending;
      this.pending = {};
      this.timerId = null;
      flush(merged);
    }, delayMs);
  }

  /** Сброс накопленных команд — при snapshot их применять уже не нужно */
  cancel() {
    if (this.timerId != null) { clearTimeout(this.timerId); this.timerId = null; }
    this.pending = {};
  }
}
