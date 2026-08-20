// src/audio/engine-v3/pipeline/IPipelineController.ts
// Интерфейс между TransportV3 и HybridPipelineService
// 4+3 Hybrid Per-Stem (Phase D)

export type BusType = 'A' | 'B'

export interface IPipelineController {
  /** Инициализация pipeline (WASM compile, AudioWorklet, настройка) */
  init(): Promise<void>

  /** Загрузить буфер в указанный стем (async — ждёт загрузки в WASM) */
  loadStem(stemId: string, buffer: AudioBuffer): Promise<void>

  /** Запустить pipeline с offset */
  play(offset: number, rate: number): Promise<void>

  /** Пауза */
  pause(): Promise<void>

  /** Останов */
  stop(): void

  /** Seek на позицию */
  seek(time: number, rate: number): Promise<void>

  /** Установить rate */
  setPlaybackRate(rate: number): void

  /** Set the mode rate before the next load, without dispatching a mode-change event. */
  setRate(rate: number): void

  /** Установить loop */
  setLoop(start: number, end: number): void

  /** Очистить loop */
  clearLoop(): void

  /** Mute/Unmute стема */
  muteStem(stemId: string, muted: boolean): void

  /** Solo стема */
  soloStem(stemId: string, soloed: boolean): void

  /** Плавная регулировка громкости стема */
  setStemVolume(stemId: string, volume: number): void

  /** Mute/unmute стема */
  setStemMuted(stemId: string, muted: boolean): void

  /** RMS-уровень (0-1) стема — с тапа после volume+mute+solo (366) */
  getStemMeterLevel(stemId: string): number

  /** Назначить стем на шину */
  assignStem(stemId: string, bus: BusType): void

  /** Текущее время */
  get currentTime(): number

  /** Длительность */
  get duration(): number

  /** Входной узел для MonitorRouter */
  get inputNode(): AudioNode

  /** Выходной узел → destination */
  get outputNode(): AudioNode

  /** Dispose */
  dispose(): void
}
