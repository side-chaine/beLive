/**
 * ZIP transcode pipeline — «Sample & Tighten» + overlap
 * 
 * TC-PERF-001: Decode следующего стема НАЧИНАЕТСЯ пока текущий кодируется в worker.
 * Prefetch depth = 1 (только 1 предварительно декодированный стем в памяти).
 * 
 * Single T0 pass: все стемы кодируются 128kbps последовательно.
 * Progressive budget: pipeline останавливается когда runningTotal < zipSizeLimit.
 */
import { STEM_TRANSCODE_CONFIG } from '../config/stem-transcode.config';
import { decodeStem, encodeDecoded, terminateWorker } from './mp3-transcoder';
import { logZipEvent } from './zip-logger';

export interface PipelineOptions {
  stemsData: Record<string, { data: ArrayBuffer; type: string }>;
  stemsToTranscode: string[];
  predictedTotal: number;
  onProgress?: (stemId: string, percent: number) => void;
}

export interface PipelineResult {
  compressed: Record<string, ArrayBuffer>;
  skipped: string[];
  aborted: boolean;
  partial: boolean;
}

/**
 * Запустить pipeline с overlap (decode следующего во время encode текущего).
 * Prefetch depth = 1.
 */
export async function runTranscodePipeline(
  options: PipelineOptions
): Promise<PipelineResult> {
  const { stemsData, stemsToTranscode, predictedTotal, onProgress } = options;
  const compressed: Record<string, ArrayBuffer> = {};
  const skipped: string[] = [];
  let runningTotal = predictedTotal;

  logZipEvent('export-start', { totalToTranscode: stemsToTranscode.length, predictedTotal });

  if (stemsToTranscode.length === 0) {
    return { compressed, skipped, aborted: false, partial: false };
  }

  // Decode первого стема
  terminateWorker();
  let prevDecoded: { stemId: string; audioBuffer: AudioBuffer; channels: number; sampleRate: number } | null = null;

  try {
    const entry = stemsData[stemsToTranscode[0]];
    if (entry?.data) {
      logZipEvent('stem-decode-start', { stemId: stemsToTranscode[0], srcSize: entry.data.byteLength });
      prevDecoded = { stemId: stemsToTranscode[0], ...await decodeStem(entry.data) };
    }
  } catch (err) {
    logZipEvent('stem-skip', { stemId: stemsToTranscode[0], reason: `Decode failed: ${err}` });
    skipped.push(stemsToTranscode[0]);
    return { compressed, skipped, aborted: false, partial: true };
  }

  // Main loop: encode current, prefetch decode next
  for (let i = 0; i < stemsToTranscode.length; i++) {
    const stemId = stemsToTranscode[i];
    if (!prevDecoded || prevDecoded.stemId !== stemId) {
      // Пропускаем — нет декодированных данных
      continue;
    }

    // Progressive budget check
    const threshold = STEM_TRANSCODE_CONFIG.zipSizeLimit - STEM_TRANSCODE_CONFIG.zipOverheadSlack;
    if (runningTotal < threshold) {
      logZipEvent('budget-met', { runningTotal, stoppedAt: stemId });
      break;
    }

    const entry = stemsData[stemId];
    if (!entry?.data) continue;

    logZipEvent('stem-decode-start', { stemId, srcSize: entry.data.byteLength });

    // Prefetch decode следующего стема (depth=1)
    const nextDecodePromise = (async () => {
      if (i + 1 < stemsToTranscode.length) {
        const nextId = stemsToTranscode[i + 1];
        const nextEntry = stemsData[nextId];
        if (nextEntry?.data) {
          try {
            terminateWorker(); // свежий worker для следующего
            const decoded = await decodeStem(nextEntry.data);
            return { stemId: nextId, ...decoded };
          } catch (err) {
            logZipEvent('stem-skip', { stemId: nextId, reason: `Prefetch decode failed: ${err}` });
            skipped.push(nextId);
            return null;
          }
        }
      }
      return null;
    })();

    // Encode текущего
    try {
      const result = await encodeDecoded(stemId, prevDecoded.audioBuffer, STEM_TRANSCODE_CONFIG.defaultBitrate, {
        onProgress: onProgress ? (p) => onProgress(p.stemId, p.percent) : undefined,
      });
      compressed[stemId] = result.data;

      const savings = entry.data.byteLength - result.data.byteLength;
      runningTotal -= savings;

      logZipEvent('stem-ok', { stemId, tier: 'T0', outSize: result.data.byteLength, savings, runningTotal });
    } catch (err) {
      logZipEvent('stem-skip', { stemId, reason: `T0 failed: ${err}` });
      skipped.push(stemId);
    }

    // Дожидаемся prefetch следующего (уже параллельно декодировался)
    prevDecoded = await nextDecodePromise;
  }

  // Cleanup
  terminateWorker();

  logZipEvent('export-done', {
    compressed: Object.keys(compressed).length,
    skipped: skipped.length,
    runningTotal,
  });

  return { compressed, skipped, aborted: false, partial: skipped.length > 0 };
}
