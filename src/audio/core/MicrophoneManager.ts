/**
 * beLive AudioEngine v2 — MicrophoneManager.
 * Manages microphone access via getUserMedia.
 * Keeps stream alive to avoid repeated permission prompts.
 */

import { getAudioContext } from './audioContext';

export class MicrophoneManager {
  gainNode: GainNode;
  stream: MediaStream | null = null;
  private _sourceNode: MediaStreamAudioSourceNode | null = null;
  private _enabled = false;
  private _volume = 0.7;
  private _deviceId = '';

  constructor() {
    this.gainNode = getAudioContext().createGain();
    this.gainNode.gain.value = this._volume;
    try { this._deviceId = localStorage.getItem('mic:deviceId') ?? '' } catch { this._deviceId = '' }
  }

  get enabled(): boolean { return this._enabled; }
  get volume(): number { return this._volume; }

  async enable(): Promise<{ enabled: boolean; volume: number }> {
    if (this._enabled) {
      return { enabled: true, volume: this._volume };
    }

    if (!this.stream) {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          ...(this._deviceId ? { deviceId: { exact: this._deviceId } } : {}),
        },
      });
    }

    if (!this._sourceNode) {
      const ctx = getAudioContext();
      this._sourceNode = ctx.createMediaStreamSource(this.stream);
    }

    try { this._sourceNode.disconnect(); } catch (_) {}
    this._sourceNode.connect(this.gainNode);
    this._enabled = true;
    this._emitState();
    return { enabled: true, volume: this._volume };
  }

  disable(): void {
    try { this._sourceNode?.disconnect(); } catch (_) {}
    // Keep stream alive — Chrome won't ask permission again
    this._enabled = false;
    this._emitState();
  }

  toggle(): Promise<{ enabled: boolean; volume: number }> | { enabled: boolean; volume: number } {
    if (this._enabled) {
      this.disable();
      return { enabled: false, volume: this._volume };
    }
    return this.enable();
  }

  get deviceId(): string { return this._deviceId }

  /** Выбрать устройство ввода (deviceId). При включённом микрофоне — пере-включение с новым устройством.
   *  При недоступности выбранного устройства — авто-fallback на default. */
  async setDeviceId(deviceId: string): Promise<{ enabled: boolean; volume: number }> {
    const wasEnabled = this._enabled;
    this._deviceId = deviceId || '';
    try { localStorage.setItem('mic:deviceId', this._deviceId) } catch {}
    // Сброс закешированного stream — следующий getUserMedia возьмёт новое устройство
    this._resetStream();
    if (wasEnabled) {
      this.disable();
      try {
        return await this.enable();
      } catch (err) {
        // Fallback: устройство недоступно → откат на default
        console.warn('[MicrophoneManager] device unavailable, fallback to default:', err);
        this._deviceId = '';
        try { localStorage.setItem('mic:deviceId', '') } catch {}
        this._resetStream();
        return this.enable();
      }
    }
    return { enabled: this._enabled, volume: this._volume };
  }

  /** Сбросить закешированный stream (остановить треки) — следующий getUserMedia возьмёт новое устройство. */
  private _resetStream(): void {
    if (this.stream) {
      this.stream.getTracks().forEach(t => { try { t.stop() } catch {} });
      this.stream = null;
      this._sourceNode = null;
    }
  }

  setVolume(v: number): void {
    this._volume = Math.max(0, Math.min(1, v));
    this.gainNode.gain.value = this._volume;
    this._emitState();
  }

  getState(): { enabled: boolean; volume: number } {
    return { enabled: this._enabled, volume: this._volume };
  }

  // Processed stream destination (lazy)
  private _processedDest: MediaStreamAudioDestinationNode | null = null;

  /**
   * Get microphone MediaStream for WebRTC or recording.
   * 'raw' = direct from getUserMedia (no volume applied)
   * 'processed' = through gainNode (volume applied)
   */
  getStream(kind: 'raw' | 'processed' = 'processed'): MediaStream | null {
    if (!this._enabled || !this.stream) return null;
    if (kind === 'raw') return this.stream;

    if (!this._processedDest) {
      const ctx = getAudioContext();
      this._processedDest = ctx.createMediaStreamDestination();
      this.gainNode.connect(this._processedDest);
    }
    return this._processedDest.stream;
  }

  dispose(): void {
    this.disable();
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
    this._sourceNode = null;
  }

  private _emitState(): void {
    const evt = new CustomEvent('microphone-state-changed', {
      detail: { enabled: this._enabled, volume: this._volume },
    });
    document.dispatchEvent(evt);
  }
}
