/**
 * MP3 Transcoder — main thread bridge.
 * Управляет Web Worker'ом для транскодинга.
 */

import { getZipAudioContext, ensureZipResumed } from './audio-context-manager';

interface TranscodeResult {
  data: ArrayBuffer;
  type: 'audio/mpeg';
  stemId: string;
}

interface TranscodeProgress {
  stemId: string;
  percent: number;
}

type TranscodeCallback = {
  onProgress?: (p: TranscodeProgress) => void;
  onAbort?: () => void;
};

let _worker: Worker | null = null;
let _jobCounter = 0;

function getWorker(): Worker {
  if (!_worker) {
    _worker = new Worker(
      new URL('./mp3-transcoder.worker.ts', import.meta.url),
      { type: 'module' }
    );
  }
  return _worker;
}

function terminateWorker(): void {
  if (_worker) {
    _worker.terminate();
    _worker = null;
  }
}

function abortWorker(): void {
  if (_worker) {
    // Worker проверяет (self as any).__aborted
    _worker.postMessage({ type: 'abort' });
  }
}

/**
 * Транскодировать стем: decode AudioContext → transfer PCM → encode в worker.
 */
export async function transcodeStem(
  stemId: string,
  arrayBuffer: ArrayBuffer,
  kbps: number,
  callbacks?: TranscodeCallback
): Promise<TranscodeResult> {
  await ensureZipResumed();
  const ctx = getZipAudioContext();
  const jobId = ++_jobCounter;

  // Decode на main thread
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));

  // PCM данные
  const channels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const leftPcm = audioBuffer.getChannelData(0);
  const rightPcm = channels > 1 ? audioBuffer.getChannelData(1) : null;

  // Отправляем в worker (transferable — 0 копий)
  const pcmData = [leftPcm.buffer as ArrayBuffer];
  if (rightPcm) pcmData.push(rightPcm.buffer as ArrayBuffer);

  const worker = getWorker();

  return new Promise<TranscodeResult>((resolve, reject) => {
    const onMessage = (e: MessageEvent) => {
      const msg = e.data;
      if (msg.jobId !== jobId) return;

      switch (msg.type) {
        case 'progress':
          callbacks?.onProgress?.({ stemId: msg.stemId, percent: msg.progress });
          break;
        case 'done': {
          worker.removeEventListener('message', onMessage);
          worker.removeEventListener('error', onError);
          resolve({
            data: msg.mp3Data,
            type: 'audio/mpeg',
            stemId: msg.stemId,
          });
          break;
        }
        case 'aborted': {
          worker.removeEventListener('message', onMessage);
          worker.removeEventListener('error', onError);
          reject(new Error(`Transcode aborted: ${msg.stemId}`));
          break;
        }
        case 'error': {
          worker.removeEventListener('message', onMessage);
          worker.removeEventListener('error', onError);
          reject(new Error(`Transcode error: ${msg.stemId} — ${msg.error}`));
          break;
        }
      }
    };

    const onError = (err: ErrorEvent) => {
      worker.removeEventListener('message', onMessage);
      worker.removeEventListener('error', onError);
      reject(new Error(`Worker error: ${err.message}`));
    };

    worker.addEventListener('message', onMessage);
    worker.addEventListener('error', onError);

    worker.postMessage(
      {
        type: 'encode',
        jobId,
        stemId,
        channels,
        sampleRate,
        kbps,
        pcmData: pcmData.map(b => new Float32Array(b)),
      },
      pcmData.map(b => b) // transferable
    );
  });
}

/**
 * TC-PERF-001: Декодировать стем (main thread) — отдельный шаг.
 * Возвращает AudioBuffer для последующего encodeDecoded().
 * Позволяет overlap: декодировать стем B пока стем A кодируется в worker.
 */
export async function decodeStem(
  arrayBuffer: ArrayBuffer,
): Promise<{ audioBuffer: AudioBuffer; channels: number; sampleRate: number }> {
  await ensureZipResumed();
  const ctx = getZipAudioContext();
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
  return {
    audioBuffer,
    channels: audioBuffer.numberOfChannels,
    sampleRate: audioBuffer.sampleRate,
  };
}

/**
 * TC-PERF-001: Закодировать предварительно декодированный AudioBuffer.
 * PCM данные передаются в worker как transferable.
 * @param stemId - идентификатор стема
 * @param audioBuffer - предварительно декодированный AudioBuffer
 * @param kbps - битрейт
 * @param callbacks - коллбеки
 */
export async function encodeDecoded(
  stemId: string,
  audioBuffer: AudioBuffer,
  kbps: number,
  callbacks?: TranscodeCallback
): Promise<TranscodeResult> {
  const jobId = ++_jobCounter;

  const channels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const leftPcm = audioBuffer.getChannelData(0);
  const rightPcm = channels > 1 ? audioBuffer.getChannelData(1) : null;

  // PCM данные для transfer в worker
  const pcmData = [leftPcm.buffer as ArrayBuffer];
  if (rightPcm) pcmData.push(rightPcm.buffer as ArrayBuffer);

  const worker = getWorker();

  return new Promise<TranscodeResult>((resolve, reject) => {
    const onMessage = (e: MessageEvent) => {
      const msg = e.data;
      if (msg.jobId !== jobId) return;

      switch (msg.type) {
        case 'progress':
          callbacks?.onProgress?.({ stemId: msg.stemId, percent: msg.progress });
          break;
        case 'done':
          worker.removeEventListener('message', onMessage);
          worker.removeEventListener('error', onError);
          resolve({ data: msg.mp3Data, type: 'audio/mpeg', stemId: msg.stemId });
          break;
        case 'aborted':
          worker.removeEventListener('message', onMessage);
          worker.removeEventListener('error', onError);
          reject(new Error(`Encode aborted: ${msg.stemId}`));
          break;
        case 'error':
          worker.removeEventListener('message', onMessage);
          worker.removeEventListener('error', onError);
          reject(new Error(`Encode error: ${msg.stemId} — ${msg.error}`));
          break;
      }
    };

    const onError = (err: ErrorEvent) => {
      worker.removeEventListener('message', onMessage);
      worker.removeEventListener('error', onError);
      reject(new Error(`Worker error: ${err.message}`));
    };

    worker.addEventListener('message', onMessage);
    worker.addEventListener('error', onError);

    worker.postMessage(
      { type: 'encode', jobId, stemId, channels, sampleRate, kbps, pcmData: pcmData.map(b => new Float32Array(b)) },
      pcmData.map(b => b)
    );
  });
}

export { terminateWorker, abortWorker };
