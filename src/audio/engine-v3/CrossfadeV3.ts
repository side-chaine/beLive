// ============================================================
// src/audio/engine-v3/CrossfadeV3.ts
// V3-06: CrossfadeV3 — плавный переход между стемами
// ============================================================

export class CrossfadeV3 {
  private _fadeDuration = 0.05 // 50ms default

  setFadeDuration(ms: number): void {
    this._fadeDuration = ms / 1000
  }

  /** Плавное переключение между стемами. Предотвращает double sound. */
  async crossfade(
    currentGain: GainNode | null,
    nextGain: GainNode | null,
    ctx: AudioContext,
  ): Promise<void> {
    if (currentGain) {
      currentGain.gain.linearRampToValueAtTime(0, ctx.currentTime + this._fadeDuration)
    }
    if (nextGain) {
      nextGain.gain.setValueAtTime(0, ctx.currentTime)
      nextGain.gain.linearRampToValueAtTime(1, ctx.currentTime + this._fadeDuration)
    }
    await new Promise(resolve => setTimeout(resolve, this._fadeDuration * 1000 + 50))
  }

  /** Мгновенный стоп (для seek) */
  cut(currentGain: GainNode | null): void {
    if (currentGain) {
      currentGain.gain.value = 0
    }
  }
}
