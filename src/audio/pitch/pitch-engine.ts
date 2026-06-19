import type { WorkletMessage } from './types';
import { PitchRingBuffer } from './ring-buffer';
import { YinDetector } from './yin-detect';

export type PitchStatus = 'idle' | 'starting' | 'running' | 'error';
export type PitchListener = (msg: WorkletMessage) => void;

let _workletLoaded = false;

/**
 * Pitch detection engine.
 *
 * Two modes:
 *   initFromMic()  — AudioWorklet (low latency, audio thread)
 *                    Safe: mic output doesn't go to speakers
 *
 *   initFromNode() — AnalyserNode + main-thread YIN (passive)
 *                    Safe: zero audio thread impact, no crackling
 */
export class PitchEngine {
  readonly ring = new PitchRingBuffer(300);

  private _status: PitchStatus = 'idle';
  private _ctx: AudioContext | null = null;
  private _stream: MediaStream | null = null;
  private _source: AudioNode | null = null;
  private _hp: BiquadFilterNode | null = null;
  private _lp: BiquadFilterNode | null = null;
  private _worklet: AudioWorkletNode | null = null;
  private _listeners = new Set<PitchListener>();
  private _ownStream = false;

  /* Passive mode (initFromNode) */
  private _analyser: AnalyserNode | null = null;
  private _timer: number | null = null;
  private _yinBuf: Float32Array | null = null;
  private _detector: YinDetector | null = null;
  private _freqBuf: Float32Array | null = null;

  get status(): PitchStatus {
    return this._status;
  }

  /* ── Get shared AudioContext ───────────────────── */

  private _getContext(): AudioContext {
    const ae = (window as any).audioEngine;
    const ctx = (ae?.audioContext as AudioContext) ?? null;
    if (!ctx) throw new Error('audioEngine.audioContext not found');
    this._ctx = ctx;
    return ctx;
  }

  /* ── Mode A: Microphone (AudioWorklet — audio thread) ── */

  async initFromMic(): Promise<void> {
    if (this._status === 'running' || this._status === 'starting') return;
    this._status = 'starting';

    try {
      const ctx = this._getContext();
      if (ctx.state === 'suspended') await ctx.resume();

      /* Mic stream */
      const ae = (window as any).audioEngine;
      const existing = ae?.microphoneStream as MediaStream | undefined;
      if (existing && existing.getAudioTracks().some((t: MediaStreamTrack) => t.readyState === 'live')) {
        this._stream = existing;
        this._ownStream = false;
      } else {
        this._stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        });
        this._ownStream = true;
      }

      this._source = ctx.createMediaStreamSource(this._stream);

      /* Filters */
      this._hp = ctx.createBiquadFilter();
      this._hp.type = 'highpass';
      this._hp.frequency.value = 80;
      this._lp = ctx.createBiquadFilter();
      this._lp.type = 'lowpass';
      this._lp.frequency.value = 2000;

      /* Worklet */
      if (!_workletLoaded) {
        const url = new URL('./yin-processor.js', import.meta.url);
        await ctx.audioWorklet.addModule(url);
        _workletLoaded = true;
      }
      this._worklet = new AudioWorkletNode(ctx, 'yin-processor');

      this._source.connect(this._hp);
      this._hp.connect(this._lp);
      this._lp.connect(this._worklet);

      this._worklet.port.onmessage = (e: MessageEvent) => this._onMsg(e.data);
      this._status = 'running';
    } catch (err) {
      this._status = 'error';
      console.error('[PitchEngine] initFromMic failed:', err);
      this.destroy();
      throw err;
    }
  }

  /* ── Mode B: AudioNode source (AnalyserNode — main thread) ── */

  async initFromNode(sourceNode: AudioNode): Promise<void> {
    if (this._status === 'running' || this._status === 'starting') return;
    this._status = 'starting';

    try {
      const ctx = this._getContext();
      if (ctx.state === 'suspended') await ctx.resume();

      this._source = sourceNode;

      /* Passive tap — zero audio thread impact */
      this._analyser = ctx.createAnalyser();
      this._analyser.fftSize = 2048;
      this._analyser.smoothingTimeConstant = 0;
      this._source.connect(this._analyser);

      this._yinBuf = new Float32Array(2048);
      this._freqBuf = new Float32Array(this._analyser!.frequencyBinCount);
      this._detector = new YinDetector(2048);

      /* Main thread interval — ~21.5Hz (matching worklet rate) */
      this._timer = window.setInterval(() => {
        this._passiveTick(ctx);
      }, 46);

      this._status = 'running';
    } catch (err) {
      this._status = 'error';
      console.error('[PitchEngine] initFromNode failed:', err);
      this.destroy();
      throw err;
    }
  }

  /**
   * Spectral Flatness Measure (200-5000Hz).
   * Returns normalized noise score 0..1.
   * Bins computed dynamically from actual sampleRate/fftSize.
   */
  private _computeSFM(freqDb: Float32Array, sampleRate: number, fftSize: number): number {
    const binRes = sampleRate / fftSize;
    const lo = Math.ceil(200 / binRes);
    const hi = Math.min(Math.floor(5000 / binRes), freqDb.length - 1);
    let logSum = 0, linSum = 0, n = 0;
    for (let i = lo; i <= hi; i++) {
      const lin = Math.pow(10, freqDb[i] / 20);
      const safe = Math.max(lin, 1e-10);
      logSum += Math.log(safe);
      linSum += safe;
      n++;
    }
    if (n === 0 || linSum < 1e-10) return 0;
    const sfm = Math.exp(logSum / n) / (linSum / n);
    const baseline = 0.20;
    return Math.max(0, Math.min(1, (sfm - baseline) / (1 - baseline)));
  }

  private _passiveTick(ctx: AudioContext): void {
    if (!this._analyser || !this._yinBuf || !this._detector) return;

    this._analyser.getFloatTimeDomainData(this._yinBuf as any);
    this._analyser!.getFloatFrequencyData(this._freqBuf! as any);
    const noiseFromSFM = this._computeSFM(this._freqBuf! as any, ctx.sampleRate, this._analyser!.fftSize);
    const result = this._detector.detect(this._yinBuf as any, ctx.sampleRate);

    if (result) {
      this._onMsg({
        type: 'pitch',
        frequency: result.frequency,
        confidence: result.confidence,
        rms: result.rms,
        midi: result.midi,
        timestamp: ctx.currentTime,

        depth: (result as any).depth,
        subharmonicRatio: (result as any).subharmonicRatio,
        subFrequency: (result as any).subFrequency,
        subMidi: (result as any).subMidi,
        subScore: (result as any).subharmonicRatio ?? 0,
        noiseScore: noiseFromSFM,
      });
    } else {
      // Check RMS from time domain to distinguish real silence from scream-no-pitch
      let rmsCheck = 0;
      for (let i = 0; i < this._yinBuf!.length; i++) rmsCheck += this._yinBuf![i] * this._yinBuf![i];
      rmsCheck = Math.sqrt(rmsCheck / this._yinBuf!.length);
      if (rmsCheck > 0.003) {
        this._onMsg({ type: 'no_pitch', rms: rmsCheck, noiseScore: noiseFromSFM });
      } else {
        this._onMsg({ type: 'silence', rms: 0 });
      }
    }
  }

  /* ── Cleanup ── */

  destroy(): void {
    /* Worklet cleanup (mic mode) */
    try { this._worklet?.port.postMessage({ type: 'reset' }); } catch (_) {}
    this._worklet?.disconnect();
    this._lp?.disconnect();
    this._hp?.disconnect();

    /* Passive cleanup (node mode) */
    if (this._timer !== null) {
      clearInterval(this._timer);
      this._timer = null;
    }
    this._analyser?.disconnect();
    this._detector?.reset();

    /* Source cleanup */
    if (this._ownStream && this._source) {
      this._source.disconnect();
      this._stream?.getTracks().forEach((t) => t.stop());
    }

    this._worklet = null;
    this._lp = null;
    this._hp = null;
    this._source = null;
    this._stream = null;
    this._analyser = null;
    this._yinBuf = null;
    this._freqBuf = null;
    this._detector = null;
    this._ctx = null;
    this._ownStream = false;

    this.ring.clear();
    this._status = 'idle';
  }

  /* ── Retarget: hot-swap source node ── */

  async retarget(newSource: AudioNode): Promise<void> {
    if (this._status !== 'running') return;
    if (this._timer !== null) {
      clearInterval(this._timer);
      this._timer = null;
    }
    this._analyser?.disconnect();
    this._source = newSource;
    this._analyser = this._ctx!.createAnalyser();
    this._analyser.fftSize = 2048;
    this._analyser.smoothingTimeConstant = 0;
    this._source.connect(this._analyser);
    this._timer = window.setInterval(() => {
      this._passiveTick(this._ctx!);
    }, 46);
  }

  /* ── Pause/resume (tab visibility) ── */

  pause(): void {
    if (this._timer !== null && this._status === 'running') {
      clearInterval(this._timer);
      this._timer = null;
    }
  }

  resume(): void {
    if (this._timer === null && this._analyser && this._ctx && this._status === 'running') {
      this._timer = window.setInterval(() => {
        this._passiveTick(this._ctx!);
      }, 46);
    }
  }

  /* ── Subscriber API ── */

  subscribe(fn: PitchListener): () => void {
    this._listeners.add(fn);
    return () => { this._listeners.delete(fn); };
  }

  /* ── Message handler ── */

  private _onMsg(msg: WorkletMessage): void {
    if (msg.type === 'pitch') {
      this.ring.push({
        frequency: msg.frequency,
        midi: msg.midi,
        confidence: msg.confidence,
        timestamp: msg.timestamp,
      });
    }
    this._listeners.forEach((fn) => fn(msg));
  }
}
