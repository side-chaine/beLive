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
  audioBuffer: AudioBuffer | null = null;  // null when skipDecode=true (OI-7)
  private _cleanBlobUrl: string | null = null;
  private _loaded = false;

  constructor(name: string) {
    this.name = name;
    this.gainNode = getAudioContext().createGain();
  }

  get loaded(): boolean { return this._loaded; }

  /** ★10 Public accessor for internal blob URL — used by _hotPlugStem for _trackUrls sync.
   *  Replaces (stem as any)._cleanBlobUrl — typed access is safer. */
  public get cleanBlobUrl(): string | null {
    return this._cleanBlobUrl;
  }

  /**
   * TC-DS-08-FIX: Lazy decode audioBuffer from cleanBlobUrl.
   * Called by TakesCanvas when skipDecode=true left audioBuffer=null.
   * Result is cached — subsequent calls return immediately.
   */
  async ensureAudioBuffer(): Promise<AudioBuffer | null> {
    if (this.audioBuffer) return this.audioBuffer;
    if (!this._cleanBlobUrl) return null;

    try {
      const response = await fetch(this._cleanBlobUrl);
      const arrayBuffer = await response.arrayBuffer();
      const ctx = getAudioContext();
      this.audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
      return this.audioBuffer;
    } catch (e) {
      console.warn('[StemPlayer] ensureAudioBuffer failed:', e);
      return null;
    }
  }

  get duration(): number {
    const ad = this.audio?.duration;
    return (ad && isFinite(ad) ? ad : 0) || this.audioBuffer?.duration || 0;
  }
  get volume(): number { return this.gainNode.gain.value; }

  async load(url: string, abortSignal?: AbortSignal, skipDecode: boolean = false): Promise<void> {
    this.dispose();
    const result: LoadResult = await loadAudio(url, abortSignal, skipDecode);
    this._cleanBlobUrl = result.cleanBlobUrl;
    this.audioBuffer = result.audioBuffer;  // null for music stems (OI-7)

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

  /**
   * Load from ArrayBuffer directly — no fetch round-trip.
   * Used for progressive loading where orchestrator passes raw data.
   * Creates Blob URL internally, cleans up in dispose().
   */
  async loadFromArrayBuffer(
    data: ArrayBuffer,
    type: string,
    abortSignal?: AbortSignal,
    skipDecode: boolean = false
  ): Promise<void> {
    this.dispose();
    if (abortSignal?.aborted) throw new DOMException('Load aborted', 'AbortError');

    // Decode for vocal/instrumental (waveform + VOC need AudioBuffer)
    if (!skipDecode) {
      const ctx = getAudioContext();
      this.audioBuffer = await ctx.decodeAudioData(data.slice(0));
    }

    // Create Blob URL internally — this stem owns the lifecycle
    const blobUrl = URL.createObjectURL(new Blob([data], { type }));
    this._cleanBlobUrl = blobUrl;

    this.audio = new Audio();
    this.audio.crossOrigin = 'anonymous';
    this.audio.preload = 'auto';
    this.audio.playsInline = true;
    this._applyPreservePitch(this.audio);
    this.audio.src = blobUrl;

    await new Promise<void>((resolve, reject) => {
      const onReady = () => { cleanup(); resolve(); };
      const onError = () => { cleanup(); reject(new Error(`${this.name}: loadFromArrayBuffer failed`)); };
      const cleanup = () => {
        this.audio!.removeEventListener('loadedmetadata', onReady);
        this.audio!.removeEventListener('error', onError);
      };
      this.audio!.addEventListener('loadedmetadata', onReady);
      this.audio!.addEventListener('error', onError);
    });

    if (abortSignal?.aborted) {
      this.dispose();
      throw new DOMException('Load aborted', 'AbortError');
    }

    const ctx = getAudioContext();
    this.sourceNode = ctx.createMediaElementSource(this.audio);
    this.sourceNode.connect(this.gainNode);
    this._loaded = true;
  }

  connect(destination: AudioNode): void {
    this.gainNode.connect(destination);
  }

  disconnect(): void {
    // ❌ FORBIDDEN: this.sourceNode.disconnect() — ONLY in dispose()! (OI-1)
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
    try { this.gainNode.disconnect(); } catch (_) {}
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
