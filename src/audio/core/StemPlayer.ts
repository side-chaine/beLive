/**
 * beLive AudioEngine v2 — StemPlayer.
 * One stem = reliable loading + <audio> playback + Web Audio routing.
 * Uses <audio>.preservesPitch for pitch-preserved tempo changes.
 */

import { getAudioContext } from './audioContext';
import { loadAudio, LoadResult } from './AudioLoader';

export class StemPlayer {
  readonly name: string;
  audio: HTMLAudioElement | null = null;
  sourceNode: MediaElementAudioSourceNode | null = null;
  gainNode: GainNode;
  audioBuffer: AudioBuffer | null = null;
  private _cleanBlobUrl: string | null = null;
  private _loaded = false;

  constructor(name: string) {
    this.name = name;
    this.gainNode = getAudioContext().createGain();
  }

  get loaded(): boolean { return this._loaded; }
  get duration(): number { return this.audioBuffer?.duration ?? 0; }
  get volume(): number { return this.gainNode.gain.value; }

  async load(url: string, abortSignal?: AbortSignal): Promise<void> {
    this.dispose();
    const result: LoadResult = await loadAudio(url, abortSignal);
    this._cleanBlobUrl = result.cleanBlobUrl;
    this.audioBuffer = result.audioBuffer;

    this.audio = new Audio();
    this.audio.crossOrigin = 'anonymous';
    this.audio.preload = 'auto';
    this.audio.playsInline = true;
    this._applyPreservePitch(this.audio);
    this.audio.src = result.cleanBlobUrl;

    await new Promise<void>((resolve, reject) => {
      const onReady = () => { cleanup(); resolve(); };
      const onError = (e: Event) => { cleanup(); reject(new Error(`${this.name}: audio load failed`)); };
      const cleanup = () => {
        this.audio?.removeEventListener('loadedmetadata', onReady);
        this.audio?.removeEventListener('error', onError);
      };
      this.audio!.addEventListener('loadedmetadata', onReady);
      this.audio!.addEventListener('error', onError);
    });

    const ctx = getAudioContext();
    this.sourceNode = ctx.createMediaElementSource(this.audio);
    this.sourceNode.connect(this.gainNode);
    this._loaded = true;
  }

  connect(destination: AudioNode): void {
    this.gainNode.connect(destination);
  }

  disconnect(): void {
    try { this.gainNode.disconnect(); } catch (_) {}
  }

  setVolume(v: number): void {
    this.gainNode.gain.value = Math.max(0, Math.min(1, v));
  }

  setPlaybackRate(rate: number): void {
    if (this.audio) {
      this.audio.playbackRate = Math.max(0.25, Math.min(4, rate));
      this._applyPreservePitch(this.audio);
    }
  }

  async play(): Promise<void> {
    if (this.audio) await this.audio.play();
  }

  pause(): void {
    if (this.audio) this.audio.pause();
  }

  stop(): void {
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
    }
  }

  getCurrentTime(): number {
    return this.audio?.currentTime ?? 0;
  }

  setCurrentTime(t: number): void {
    if (this.audio) this.audio.currentTime = t;
  }

  dispose(): void {
    try { this.sourceNode?.disconnect(); } catch (_) {}
    if (this.audio) {
      this.audio.pause();
      this.audio.removeAttribute('src');
      this.audio.load();
    }
    if (this._cleanBlobUrl) {
      URL.revokeObjectURL(this._cleanBlobUrl);
    }
    this.audio = null;
    this.sourceNode = null;
    this.audioBuffer = null;
    this._cleanBlobUrl = null;
    this._loaded = false;
  }

  private _applyPreservePitch(el: HTMLAudioElement): void {
    try {
      if ('preservesPitch' in el) (el as any).preservesPitch = true;
      if ('mozPreservesPitch' in el) (el as any).mozPreservesPitch = true;
      if ('webkitPreservesPitch' in el) (el as any).webkitPreservesPitch = true;
    } catch (_) {}
  }
}
