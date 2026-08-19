/**
 * 062: DEV-only diagnostics contract для BPM switch race тестов.
 *
 * Возвращается HybridPipelineService.getBackendState() в DEV режиме.
 * Позволяет тестам проверять состояние без доступа к private полям.
 */
export interface BackendState {
  /** Текущий playback rate */
  rate: number
  /** Текущая позиция воспроизведения (сек) */
  position: number
  /** Активный backend */
  activeBackend: 'direct' | 'stretch' | 'unknown'
  /** Количество concurrent switchBackend вызовов (0 = стабильно) */
  concurrentSwitches: number
  /** Количество bus'ов с audible уровнем (норма: 1) */
  audibleBusCount: number
  /** Состояние Bus A (stretch) */
  busA: {
    audible: boolean
    /** Количество "старых" AudioBufferSourceNode (не остановленных после switch) */
    staleSourceCount: number
  }
  /** Состояние Bus B (direct/varispeed) */
  busB: {
    audible: boolean
    /** Количество "старых" AudioBufferSourceNode */
    staleSourceCount: number
  }
  /** Какие stretch слоты были запущены (не должен содержать 'stretch-6') */
  startedStretchSlots: string[]
  /** Сколько раз pauseAll был вызван после финального switch (должен быть 0) */
  pauseCallsAfterFinalSwitch: number
  /** Количество стемов в chainA (Bus A) */
  stemCountA: number
  /** Количество стемов в chainB (Bus B) */
  stemCountB: number
}
