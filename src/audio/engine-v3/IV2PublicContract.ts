// ============================================================
// src/audio/engine-v3/IV2PublicContract.ts
// Публичный API AudioEngineV2 (frozen), доступный через V2Adapter.
// Ничего из этого файла НЕ является frozen — это описание контракта.
//
// ВСЕ обращения к V2 через V2Adapter должны проходить через этот интерфейс.
// Доступ к полям с префиксом _ ЗАПРЕЩЁН (Tier 1 breach).
// ============================================================

/**
 * Публичный контракт AudioEngineV2.
 * Только те методы/свойства, которые гарантированно есть в frozen V2.
 * Добавление нового метода сюда требует его существования в V2 (иначе Tier 3).
 */
export interface IV2PublicContract {
  // ── playback ──
  play(): void
  pause(): void
  stop(): void
  seekTo(time: number): void
  setCurrentTime(time: number): void

  // ── getters ──
  readonly isPlaying: boolean
  readonly duration: number
  getCurrentTime(): number

  // ── stems ──
  setStemVolume(stemId: string, volume: number): void
  setStemsEnabled(enabled: boolean): void
  setStemMute(stemId: string, muted: boolean): void
  setStemSolo(stemId: string, soloed: boolean): void
  setStemPan(stemId: string, pan: number): void
  setStemsMode(mode: 'performance' | 'studio'): void
  getStemMeterLevel(stemId: string): number
  getStemAnalyser(stemId: string): AnalyserNode | null
  getStemAudioBuffer(stemId: string): AudioBuffer | null
  setInstrumentalVolume(v: number): void
  setVocalsVolume(v: number): void

  // ── microphone ──
  enableMicrophone(): Promise<{ enabled: boolean; volume: number }>
  disableMicrophone(): void

  // ── vocal mix ──
  enableVocalMix(): void
  disableVocalMix(): void

  // ── playback rate ──
  getPlaybackRate(): number

  // ── program capture ──
  attachProgramSource(node: AudioNode, opts: { kind: string }): void
  detachProgramSource(node: AudioNode | null): void

  // ── buffer loading ──
  ensureInstrumentalBuffer(): Promise<AudioBuffer | null>

  // ── loop ──
  setLoop(start: number, end: number): boolean
  clearLoop(): boolean

  // ── effects ──
  setPlaybackRate(rate: number): void
  setMicrophoneVolume(volume: number): void

  // ── audio context (read-only, для AnalyserNode) ──
  readonly audioContext: AudioContext
}

/** Список разрешённых для чтения через getSync публичных геттеров */
export const PUBLIC_GETTERS: ReadonlySet<string> = new Set([
  'isPlaying',
  'duration',
  'currentTime', // через геттер AudioEngineV2.getCurrentTime()
])

/** Список разрешённых для вызова через delegateSync публичных методов */
export const PUBLIC_METHODS: ReadonlySet<string> = new Set([
  'play',
  'pause',
  'stop',
  'seekTo',
  'setCurrentTime',
  'getCurrentTime',
  'setStemVolume',
  'setStemsEnabled',
  'setStemMute',
  'setStemSolo',
  'setStemPan',
  'setStemsMode',
  'getStemMeterLevel',
  'getStemAnalyser',
  'getStemAudioBuffer',
  'setInstrumentalVolume',
  'setVocalsVolume',
  'enableMicrophone',
  'disableMicrophone',
  'enableVocalMix',
  'disableVocalMix',
  'getPlaybackRate',
  'attachProgramSource',
  'detachProgramSource',
  'ensureInstrumentalBuffer',
  'setLoop',
  'clearLoop',
  'setPlaybackRate',
  'setMicrophoneVolume',
])

/** Проверка что ключ не ведёт к приватному полю */
export function isPublicKey(key: string): boolean {
  if (key.startsWith('_')) return false
  return true
}
