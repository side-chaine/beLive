/**
 * beLive AudioEngine v2 — AudioLoader.
 * Reliable audio loading: fetch → validate → clean blob URL.
 * Fixes the blob:null bug permanently.
 */

import { getAudioContext } from './audioContext';

export interface LoadResult {
  cleanBlobUrl: string;
  audioBuffer: AudioBuffer | null;  // null if skipDecode (OI-7)
  // arrayBuffer УДАЛЁН — DEAD CODE (OI-8), ~245MB saved
  duration: number;
}

const RETRY_DELAYS = [0, 500, 1500];
const FETCH_TIMEOUT = 30000;

export async function loadAudio(
  url: string,
  abortSignal?: AbortSignal,
  skipDecode: boolean = false
): Promise<LoadResult> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < RETRY_DELAYS.length; attempt++) {
    if (attempt > 0) {
      await delay(RETRY_DELAYS[attempt]);
    }
    if (abortSignal?.aborted) {
      throw new DOMException('Load aborted', 'AbortError');
    }
    try {
      return await _loadOnce(url, abortSignal, skipDecode);
    } catch (err: any) {
      lastError = err;
      if (err.name === 'AbortError') throw err;
      if (err.message?.includes('404')) throw err;
      if (err.message?.includes('decode')) throw err;
      console.warn(`AudioLoader: attempt ${attempt + 1} failed:`, err.message);
    }
  }
  throw lastError || new Error('AudioLoader: all retries failed');
}

async function _loadOnce(
  url: string,
  abortSignal?: AbortSignal,
  skipDecode: boolean = false
): Promise<LoadResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  const signal = abortSignal
    ? _combineSignals(abortSignal, controller.signal)
    : controller.signal;

  try {
    const response = await fetch(url, { signal });
    clearTimeout(timeoutId);
    if (!response.ok) {
      throw new Error(`Fetch failed: ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();

    let audioBuffer: AudioBuffer | null = null;
    let duration = 0;

    if (skipDecode) {
      // Duration = 0. StemPlayer.duration получит реальное значение
      // из audio.duration после loadedmetadata (TC-7.2-A)
    } else {
      const ctx = getAudioContext();
      audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
      duration = audioBuffer.duration;
    }

    const blob = new Blob([arrayBuffer], { type: _guessType(url) });
    const cleanBlobUrl = URL.createObjectURL(blob);

    // arrayBuffer goes out of scope here — GC can collect (~35MB freed per stem)
    return {
      cleanBlobUrl,
      audioBuffer,
      duration,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

function _combineSignals(a: AbortSignal, b: AbortSignal): AbortSignal {
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  a.addEventListener('abort', onAbort, { once: true });
  b.addEventListener('abort', onAbort, { once: true });
  return controller.signal;
}

function _guessType(url: string): string {
  const lower = url.toLowerCase();
  if (lower.includes('.wav')) return 'audio/wav';
  if (lower.includes('.ogg')) return 'audio/ogg';
  if (lower.includes('.m4a')) return 'audio/mp4';
  if (lower.includes('.flac')) return 'audio/flac';
  return 'audio/mpeg';
}

function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}
