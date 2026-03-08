/**
 * beLive AudioEngine v2 — Main Facade.
 * Hybrid architecture: fetch for reliable loading, <audio> for playback.
 * Fixes blob:null bug. Preserves pitch on tempo change.
 */

import { getAudioContext, ensureResumed } from './audioContext';
import { StemPlayer } from './StemPlayer';
import { VocalMix } from './VocalMix';
import { MicrophoneManager } from './MicrophoneManager';

export class AudioEngineV2 {
  // === Stems ===
  readonly stems: Map<string, StemPlayer> = new Map();

  // === Modules ===
  readonly vocalMix: VocalMix;
  readonly microphone: MicrophoneManager;

  // === State ===
  private _isPlaying = false;
  private _duration = 0;
  private _loadAbort: AbortController | null = null;

  // === Events ===
  private _onTrackLoadedCallbacks: Function[] = [];
  private _onPositionUpdateCallbacks: Function[] = [];
  private _onBothEndedCallbacks: Function[] = [];
  private _positionInterval: ReturnType<typeof setInterval> | null = null;

  // === Loop ===
  private _loopActive = false;
  private _loopStart = 0;
  private _loopEnd = 0;
  private _loopCheckInterval: ReturnType<typeof setInterval> | null = null;

  // === Playback rate ===
  private _playbackRate = 1.0;

  // === Track URLs (for WaveformEditor compat) ===
  private _trackUrls: { instrumental?: string; vocals?: string } = {};

  constructor() {
    this.vocalMix = new VocalMix();
    this.microphone = new MicrophoneManager();
    console.log('🚀 AudioEngine v2 (Hybrid) initialized');
  }

  // ============================================================
  // LOADING
  // ============================================================

  async loadTrack(
    instrumentalUrl: string,
    vocalsUrl: string | null = null
  ): Promise<{ duration: number; hasVocals: boolean }> {
    // Abort previous load if in progress
    if (this._loadAbort) {
      this._loadAbort.abort();
    }
    this._loadAbort = new AbortController();
    const signal = this._loadAbort.signal;

    // Stop current playback
    this.stop();

    // Store URLs for WaveformEditor compat
    this._trackUrls = {
      instrumental: instrumentalUrl,
      vocals: vocalsUrl ?? undefined,
    };

    try {
      // Load instrumental (required)
      const instStem = new StemPlayer('instrumental');
      await instStem.load(instrumentalUrl, signal);
      this.stems.set('instrumental', instStem);
      this._duration = instStem.duration;
      console.log(`✅ INSTRUMENTAL loaded: ${this._duration.toFixed(2)}s`);

      // Load vocals (optional, non-blocking)
      let hasVocals = false;
      if (vocalsUrl) {
        try {
          const vocStem = new StemPlayer('vocals');
          await vocStem.load(vocalsUrl, signal);
          this.stems.set('vocals', vocStem);
          hasVocals = true;
          console.log(`✅ VOCALS loaded: ${vocStem.duration.toFixed(2)}s`);
        } catch (err: any) {
          if (err.name === 'AbortError') throw err;
          console.warn('⚠️ Vocals load failed, instrumental-only mode:', err.message);
        }
      }

      // Connect stems to routing
      this._connectRouting();

      // Apply current playback rate
      this.stems.forEach(s => s.setPlaybackRate(this._playbackRate));

      // Notify
      this._notifyTrackLoaded(hasVocals);

      return { duration: this._duration, hasVocals };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('🛑 Load aborted (new track requested)');
      }
      throw err;
    }
  }

  // ============================================================
  // ROUTING
  // ============================================================

  private _connectRouting(): void {
    const ctx = getAudioContext();
    const musicGains: GainNode[] = [];
    let vocalsGain: GainNode | null = null;

    this.stems.forEach((stem, name) => {
      stem.disconnect();
      if (name === 'vocals') {
        vocalsGain = stem.gainNode;
      } else {
        musicGains.push(stem.gainNode);
      }
    });

    this.vocalMix.updateRouting(
      musicGains,
      vocalsGain,
      this.microphone.enabled ? this.microphone.gainNode : null,
      ctx.destination
    );
  }

  // ============================================================
  // VOLUME
  // ============================================================

  setInstrumentalVolume(v: number): void {
    this.stems.get('instrumental')?.setVolume(v);
  }

  setVocalsVolume(v: number): void {
    this.stems.get('vocals')?.setVolume(v);
  }

  setMicrophoneVolume(v: number): void {
    this.microphone.setVolume(v);
  }

  // ============================================================
  // LOOP
  // ============================================================

  get loopActive(): boolean { return this._loopActive; }
  get loopStart(): number | null { return this._loopActive ? this._loopStart : null; }
  get loopEnd(): number | null { return this._loopActive ? this._loopEnd : null; }

  setLoop(start: number, end: number): boolean {
    if (isNaN(start) || isNaN(end) || start < 0 || end <= start) return false;
    this._loopStart = Math.max(0, Math.min(start, this._duration));
    this._loopEnd = Math.min(end, this._duration);
    this._loopActive = true;
    this._startLoopCheck();
    document.dispatchEvent(new CustomEvent('loop-set', {
      detail: { startTime: this._loopStart, endTime: this._loopEnd },
    }));
    return true;
  }

  clearLoop(): boolean {
    this._stopLoopCheck();
    const wasActive = this._loopActive;
    this._loopActive = false;
    if (wasActive && this.getCurrentTime() <= this._loopEnd + 0.05) {
      this.setCurrentTime(Math.min(this._loopEnd + 0.03, this._duration - 0.02));
    }
    document.dispatchEvent(new CustomEvent('loop-cleared', {
      detail: { time: this.getCurrentTime() },
    }));
    return true;
  }

  private _startLoopCheck(): void {
    this._stopLoopCheck();
    this._loopCheckInterval = setInterval(() => {
      if (!this._loopActive || !this._isPlaying) return;
      const now = this.getCurrentTime();
      if (now >= this._loopEnd - 0.01) {
        const target = this._loopStart + 0.005;
        this.setCurrentTime(target);
        document.dispatchEvent(new CustomEvent('loopcompleted', {
          detail: { previousTime: now, newTime: target, loopStart: this._loopStart, loopEnd: this._loopEnd },
        }));
      }
    }, 50);
  }

  // ============================================================
  // MICROPHONE & VOCALMIX
  // ============================================================

  async enableMicrophone() { const r = await this.microphone.enable(); this._connectRouting(); return r; }
  disableMicrophone(): void { this.microphone.disable(); this._connectRouting(); }
  toggleMicrophone() { return this.microphone.toggle(); }
  getMicrophoneState() { return this.microphone.getState(); }

  /**
   * Get microphone MediaStream for WebRTC.
   * 'raw' = direct from getUserMedia
   * 'processed' = through gainNode (volume applied)
   */
  getMicrophoneStream(kind: 'raw' | 'processed' = 'processed'): MediaStream | null {
    return this.microphone.getStream(kind);
  }

  enableVocalMix(): void { this.vocalMix.enable(); this._connectRouting(); this._emitVocalMix(); }
  disableVocalMix(): void { this.vocalMix.disable(); this._connectRouting(); this._emitVocalMix(); }
  toggleVocalMix(): void { if (this.vocalMix.enabled) this.disableVocalMix(); else this.enableVocalMix(); }
  getVocalMixState(): boolean { return this.vocalMix.enabled; }

  private _emitVocalMix(): void {
    document.dispatchEvent(new CustomEvent('vocalmix-state-changed', {
      detail: { enabled: this.vocalMix.enabled },
    }));
  }

  // ============================================================
  // PLAYBACK RATE
  // ============================================================

  setPlaybackRate(rate: number): void {
    this._playbackRate = Math.max(0.25, Math.min(4, rate));
    this.stems.forEach(s => s.setPlaybackRate(this._playbackRate));
    document.dispatchEvent(new CustomEvent('playback-rate-changed', {
      detail: { rate: this._playbackRate },
    }));
  }

  getPlaybackRate(): number { return this._playbackRate; }

  // ============================================================
  // PROPERTIES
  // ============================================================

  get duration(): number { return this._duration; }
  get isPlaying(): boolean { return this._isPlaying; }
  set isPlaying(v: boolean) { this._isPlaying = v; }
  get audioContext(): AudioContext { return getAudioContext(); }

  get hybridEngine() {
    return {
      instrumentalUrl: this._trackUrls.instrumental ?? null,
      vocalsUrl: this._trackUrls.vocals ?? null,
    };
  }

  // ============================================================
  // TRANSPORT
  // ============================================================

  async play(): Promise<void> {
    if (!this.stems.has('instrumental')) return;
    await ensureResumed();
    const inst = this.stems.get('instrumental')!;
    const voc = this.stems.get('vocals');
    // Sync vocals position BEFORE play
    if (voc?.loaded) {
      voc.setCurrentTime(inst.getCurrentTime());
    }
    // Start both simultaneously
    const promises: Promise<void>[] = [inst.play()];
    if (voc?.loaded) promises.push(voc.play().catch(() => {}));
    await Promise.all(promises);
    this._isPlaying = true;
    this._startPositionUpdates();
    this._notifyPlaybackState();
  }

  pause(): void {
    this.stems.forEach(s => s.pause());
    this._isPlaying = false;
    this._stopPositionUpdates();
    this._notifyPlaybackState();
  }

  getCurrentTime(): number {
    return this.stems.get('instrumental')?.getCurrentTime() ?? 0;
  }

  setCurrentTime(time: number): void {
    this.stems.forEach(s => s.setCurrentTime(time));
    // Re-sync vocals after short delay
    setTimeout(() => {
      const inst = this.stems.get('instrumental');
      const voc = this.stems.get('vocals');
      if (inst && voc?.loaded) {
        const t = inst.getCurrentTime();
        if (Math.abs(voc.getCurrentTime() - t) > 0.05) {
          voc.setCurrentTime(t);
        }
      }
    }, 80);
  }

  seekTo(time: number): void { this.setCurrentTime(time); }

  getDuration(): number { return this._duration; }

  private _startPositionUpdates(): void {
    this._stopPositionUpdates();
    this._positionInterval = setInterval(() => {
      const t = this.getCurrentTime();
      // Sync nudger: keep vocals aligned to instrumental
      const voc = this.stems.get('vocals');
      if (voc?.loaded && this._isPlaying) {
        const drift = voc.getCurrentTime() - t;
        if (Math.abs(drift) > 0.05) {
          voc.setCurrentTime(t);
        }
      }
      this._onPositionUpdateCallbacks.forEach(cb => {
        try { cb(t); } catch (_) {}
      });

      // Track end detection for playlist auto-next
      if (this._isPlaying && this._duration > 0 && t >= this._duration - 0.15) {
        this._isPlaying = false;
        this._stopPositionUpdates();
        const cbs = [...this._onBothEndedCallbacks];
        this._onBothEndedCallbacks = [];
        cbs.forEach(cb => { try { cb(); } catch (_) {} });
      }
    }, 50);
  }

  private _notifyPlaybackState(): void {
    const event = new CustomEvent('playback-state-changed', {
      detail: {
        isPlaying: this._isPlaying,
        currentTime: this.getCurrentTime(),
        duration: this._duration,
      },
    });
    window.dispatchEvent(event);
  }

  // ============================================================
  // EVENT SUBSCRIPTIONS
  // ============================================================

  onTrackLoaded(cb: Function): void { this._onTrackLoadedCallbacks.push(cb); }

  onPositionUpdate(cb: Function): void {
    this._onPositionUpdateCallbacks.push(cb);
    if (this._isPlaying) this._startPositionUpdates();
  }

  onBothEnded(cb: Function): () => void {
    this._onBothEndedCallbacks.push(cb);
    return () => { this._onBothEndedCallbacks = this._onBothEndedCallbacks.filter(c => c !== cb); };
  }

  removeEventListener(type: string, cb: Function): void {
    if (type === 'trackLoaded') this._onTrackLoadedCallbacks = this._onTrackLoadedCallbacks.filter(c => c !== cb);
    else if (type === 'positionUpdate') this._onPositionUpdateCallbacks = this._onPositionUpdateCallbacks.filter(c => c !== cb);
  }

  // ============================================================
  // CAPTURE STREAM
  // ============================================================

  private _streamDest: MediaStreamAudioDestinationNode | null = null;

  captureStream(): MediaStream {
    if (!this._streamDest) {
      this._streamDest = getAudioContext().createMediaStreamDestination();
      this.stems.forEach(s => { try { s.gainNode.connect(this._streamDest!); } catch (_) {} });
    }
    return this._streamDest.stream;
  }

  // ============================================================
  // RESET
  // ============================================================

  reset(): void { this.dispose(); }

  // ============================================================
  // CLEANUP
  // ============================================================

  stop(): void {
    this._isPlaying = false;
    this._stopPositionUpdates();
    this._stopLoopCheck();
    this.stems.forEach(s => s.stop());
  }

  dispose(): void {
    this.stop();
    this.stems.forEach(s => s.dispose());
    this.stems.clear();
    this.vocalMix.dispose();
    this.microphone.dispose();
    this._trackUrls = {};
    this._duration = 0;
  }

  // ============================================================
  // EVENTS (stubs — will flesh out in TC-AE-09)
  // ============================================================

  private _notifyTrackLoaded(hasVocals: boolean): void {
    const detail = { duration: this._duration, hasVocals };
    const event = new CustomEvent('track-loaded', { detail });
    document.dispatchEvent(event);
    this._onTrackLoadedCallbacks.forEach(cb => {
      try { cb(detail); } catch (_) {}
    });
  }

  private _stopPositionUpdates(): void {
    if (this._positionInterval) {
      clearInterval(this._positionInterval);
      this._positionInterval = null;
    }
  }

  private _stopLoopCheck(): void {
    if (this._loopCheckInterval) {
      clearInterval(this._loopCheckInterval);
      this._loopCheckInterval = null;
    }
  }
}
