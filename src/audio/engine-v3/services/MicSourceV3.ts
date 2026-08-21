// src/audio/engine-v3/services/MicSourceV3.ts
// F-1 (431): Acquisition-слой микрофона для V3.
// Мик-стрим живёт ВЫШЕ плейбек-pipeline (pipeline = playback-DSP).
// Владелец стрима — MicSourceV3; потребители берут stream через acquire()/release().
// Parity с C11: ключ localStorage 'mic:deviceId', exact-constraint + auto-fallback.
// R9: {echoCancellation:false, noiseSuppression:false, autoGainControl:false}.
// F-2 (будущее): монитор-маршрут stream → router.micInput; гейт G14 — БЕЗ дефолтного _micDelay.

export type MicErrorKind = 'permission-denied' | 'no-device' | 'stream-fail';

export class MicAcquireError extends Error {
  constructor(public readonly kind: MicErrorKind, public readonly original?: unknown) {
    super(`[MicSourceV3] acquire failed: ${kind}`);
  }
}

const MIC_DEVICE_KEY = 'mic:deviceId'; // parity C11 (MicrophoneManager — файл не импортируем, зона №2)

export class MicSourceV3 {
  private _stream: MediaStream | null = null;
  private _refCount = 0;
  private _deviceId = '';

  constructor() {
    try { this._deviceId = localStorage.getItem(MIC_DEVICE_KEY) ?? ''; } catch { /* private mode */ }
  }

  get deviceId(): string { return this._deviceId; }
  get isActive(): boolean { return this._stream !== null; }

  /** Взять стрим (refcounted). Повторный вызов возвращает тот же живой стрим. */
  async acquire(): Promise<MediaStream> {
    this._refCount++;
    if (this._stream) return this._stream;
    try {
      this._stream = await this._open();
      return this._stream;
    } catch (e) {
      this._refCount--;
      throw e;
    }
  }

  /** Отдать стрим. При refCount=0 — dispose-tracks. */
  release(): void {
    this._refCount = Math.max(0, this._refCount - 1);
    if (this._refCount === 0) this._stop();
  }

  /** Выбор устройства (parity C11). Персистит; при живом стриме переоткрывает на новом. */
  async setDevice(id: string): Promise<void> {
    if (this._deviceId === id) return;
    this._deviceId = id;
    try { localStorage.setItem(MIC_DEVICE_KEY, id); } catch { /* private mode */ }
    if (!this._stream) return;
    // Живой стрим: перезапуск на новом устройстве (refCount сохраняем).
    // Если переоткрытие упало — стрим остаётся закрыт до следующего acquire (degraded, честный отказ).
    this._stop();
    this._stream = await this._open();
  }

  private _stop(): void {
    this._stream?.getTracks().forEach(t => t.stop()); // dispose-tracks
    this._stream = null;
  }

  private async _open(): Promise<MediaStream> {
    const base: MediaTrackConstraints = { echoCancellation: false, noiseSuppression: false, autoGainControl: false }; // R9
    const constraints: MediaTrackConstraints = { ...base };
    if (this._deviceId) constraints.deviceId = { exact: this._deviceId }; // C11 parity: exact-constraint
    try {
      return await navigator.mediaDevices.getUserMedia({ audio: constraints });
    } catch (e: any) {
      if (e?.name === 'NotAllowedError' || e?.name === 'SecurityError') throw new MicAcquireError('permission-denied', e);
      // C11 parity: auto-fallback на дефолтное устройство при битом exact-constraint
      if (this._deviceId && (e?.name === 'OverconstrainedError' || e?.name === 'NotFoundError')) {
        try {
          return await navigator.mediaDevices.getUserMedia({ audio: { ...base } });
        } catch (e2: any) { throw this._classify(e2); }
      }
      throw this._classify(e);
    }
  }

  private _classify(e: any): MicAcquireError {
    if (e instanceof MicAcquireError) return e;
    if (e?.name === 'NotFoundError' || e?.name === 'DevicesNotFoundError') return new MicAcquireError('no-device', e);
    return new MicAcquireError('stream-fail', e);
  }
}
