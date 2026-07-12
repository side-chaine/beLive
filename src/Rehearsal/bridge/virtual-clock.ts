/**
 * Virtual Transport Clock — аналитическая позиция, независимая от <audio>.currentTime.
 *
 * Позиция считается по формуле:
 *   position = anchorMediaTime + (performance.now() - anchorPerfTime) / 1000 * playbackRate
 *
 * anchor() вызывается после seek, loop jump, resume — там где реальная позиция известна.
 * drift-монитор bridge читает getPosition() вместо engine.getCurrentTime().
 * Это устраняет Resume Latency Hole: во время _atomicResumeFromSeek (200-1500ms)
 * virtual clock продолжает тикать, engine "догоняет" — drift-чек видит реальный дрифт,
 * а не артефакт замороженного currentTime.
 */
export class VirtualClock {
  private anchorMediaTime = 0;
  private anchorPerfTime = 0;
  private rate = 1;

  /** Переанкоровка — после seek, loop jump, applySnapshot */
  anchor(mediaTime: number, playbackRate = 1) {
    this.anchorMediaTime = mediaTime;
    this.anchorPerfTime = performance.now();
    this.rate = playbackRate;
  }

  /** Текущая расчётная позиция */
  getPosition(): number {
    const elapsed = (performance.now() - this.anchorPerfTime) / 1000;
    return this.anchorMediaTime + elapsed * this.rate;
  }

  /** Обновление playbackRate (при смене темпа) */
  setRate(rate: number) {
    // Переанкорируемся на текущую расчётную позицию с новым rate
    this.anchor(performance.now(), rate);
  }
}
