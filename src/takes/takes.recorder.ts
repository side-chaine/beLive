import { ENGINE_MODE } from '../engine-mode';

/**
 * TakesRecorder — thin MediaRecorder wrapper for vocal take capture.
 * 
 * Recording source: engine getMicrophoneStream('raw')
 * Format: audio/webm;codecs=opus (primary) or audio/mp4 (Safari fallback)
 * Live visualization: AnalyserNode tap (not connected to output)
 * 
 * NOT: captureStream, screen recording, processed mic, mixed output
 */

/** Detect best supported audio recording MIME type */
export function detectAudioMime(): string {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
  ] as const;

  for (const mime of candidates) {
    if (MediaRecorder.isTypeSupported(mime)) return mime;
  }

  throw new Error('No supported audio recording MIME type found');
}

/** Get file extension for a MIME type */
export function mimeToExtension(mime: string): string {
  if (mime.includes('webm')) return 'webm';
  if (mime.includes('mp4')) return 'm4a';
  if (mime.includes('ogg')) return 'ogg';
  return 'bin';
}

export class TakesRecorder {
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private _analyser: AnalyserNode | null = null;
  private _sourceNode: MediaStreamAudioSourceNode | null = null;
  private _mimeType: string = '';
  private _lastError: string | null = null;
  private _v3Owned = false;

  /** Current analyser node for live waveform visualization */
  get analyser(): AnalyserNode | null {
    return this._analyser;
  }

  /** F-1 (431): причина последнего неудачного start() ('permission-denied'|'no-device'|'stream-fail'|'mic-source-unavailable') */
  get lastError(): string | null {
    return this._lastError;
  }

  /** Whether currently recording */
  get isRecording(): boolean {
    return this.recorder?.state === 'recording';
  }

  /** MIME type used for recording */
  get mimeType(): string {
    return this._mimeType;
  }

  /**
   * Start recording from raw mic stream.
   * Creates AnalyserNode for live visualization (not connected to output).
   */
  async start(): Promise<void> {
    const ae = (window as any).audioEngine;
    if (!ae) throw new Error('AudioEngine not available');
    const engineMode = ENGINE_MODE;
    let stream: MediaStream | null = null;

    if (engineMode === 'v3') {
      // F-1 (431): acquisition через MicSourceV3 (мик ВЫШЕ плейбек-pipeline)
      const src = (window as any).__belive?.micSource;
      if (!src) {
        this._lastError = 'mic-source-unavailable';
        console.error('[TakesRecorder] __belive.micSource недоступен');
        return;
      }
      try {
        stream = await src.acquire();
        this._v3Owned = true;
      } catch (e: any) {
        this._lastError = e?.kind ?? 'stream-fail';
        console.error(`[TakesRecorder] mic acquire failed: ${this._lastError}`);
        return;
      }
    } else {
      // Ensure mic is enabled (this also routes to output — headphones required)
      if (!ae.microphone?.enabled) {
        await (window as any).__belive?.micSource?.acquire();
        (window as any).__belive?.monitorRouter?.setMicMonitor(true);
      }
      // Get raw mic stream (unaffected by volume slider)
      stream = ae.getMicrophoneStream?.('raw') ?? ae.microphone?.getStream?.('raw');
    }

    if (!stream) throw new Error('Raw mic stream not available');
    this._lastError = null;

    // Detect format
    this._mimeType = detectAudioMime();

    // Create AnalyserNode for live waveform (listen-only tap)
    const ctx: AudioContext = engineMode === 'v3'
      ? ((window as any).__belive?.pipeline?.ctx ?? ae.audioContext)
      : (ae.audioContext ?? ae._audioContext);
    if (ctx) {
      this._sourceNode = ctx.createMediaStreamSource(stream);
      this._analyser = ctx.createAnalyser();
      this._analyser.fftSize = 1024;
      this._analyser.smoothingTimeConstant = 0.1;
      this._sourceNode.connect(this._analyser);
      // NOT connected to destination — just a tap
    }

    // Create recorder
    this.chunks = [];
    this.recorder = new MediaRecorder(stream, { mimeType: this._mimeType });
    this.recorder.ondataavailable = (e: BlobEvent) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };

    // Start recording (no timeslice)
    this.recorder.start();
  }

  /**
   * Stop recording and return the recorded Blob.
   * Cleans up AnalyserNode and source connections.
   */
  stop(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.recorder || this.recorder.state !== 'recording') {
        reject(new Error('Not recording'));
        return;
      }

      this.recorder.onstop = () => {
        const blob = new Blob(this.chunks, { type: this._mimeType });
        console.log('[REC-SYNC·COMMIT]', {
          blobSize: blob.size,
          ts: Math.round(performance.now()),
        });
        this.cleanupNodes();
        resolve(blob);
      };

      this.recorder.onerror = (e) => {
        this.cleanupNodes();
        reject(e);
      };

      this.recorder.stop();
    });
  }

  /** Force cancel without producing a blob */
  cancel(): void {
    if (this.recorder && this.recorder.state === 'recording') {
      this.recorder.onstop = null;
      this.recorder.stop();
    }
    this.cleanupNodes();
    this.chunks = [];
  }

  private cleanupNodes(): void {
    try { this._sourceNode?.disconnect(); } catch (_) {}
    try { this._analyser?.disconnect(); } catch (_) {}
    if (this._v3Owned) {
      try { (window as any).__belive?.micSource?.release(); } catch (_) {}
      this._v3Owned = false;
    }
    this._sourceNode = null;
    this._analyser = null;
    this.recorder = null;
    this.chunks = [];
  }
}
