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

  constructor() {
    this.gainNode = getAudioContext().createGain();
    this.gainNode.gain.value = this._volume;
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
