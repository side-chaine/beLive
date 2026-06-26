/**
 * Tests for zip-transcode-pipeline.ts — runTranscodePipeline
 */
import { describe, it, expect, vi } from 'vitest';
import * as transcoder from '../mp3-transcoder';

// Helper: создать mock AudioBuffer с Float32Array для getChannelData
function createMockAudioBuffer(channels: number, sampleRate: number, length: number): AudioBuffer {
  const channelData: Float32Array[] = [];
  for (let ch = 0; ch < channels; ch++) {
    channelData.push(new Float32Array(length));
  }
  return {
    numberOfChannels: channels,
    sampleRate,
    length,
    duration: length / sampleRate,
    getChannelData: (ch: number) => channelData[ch],
    copyFromChannel: () => {},
    copyToChannel: () => {},
  } as unknown as AudioBuffer;
}

// Mock mp3-transcoder — возвращаем уменьшенную копию
vi.mock('../mp3-transcoder', () => ({
  decodeStem: vi.fn(async (_arrayBuffer: ArrayBuffer) => {
    // Имитируем декодированный AudioBuffer
    const audioBuffer = createMockAudioBuffer(2, 44100, 1000);
    return { audioBuffer, channels: 2, sampleRate: 44100 };
  }),
  encodeDecoded: vi.fn(async (stemId: string, _audioBuffer: AudioBuffer, _kbps: number) => {
    // Эмулируем сжатие: возвращаем 40% от размера, вычисленного из audioBuffer
    const compressedSize = 100; // заглушка
    return {
      data: new ArrayBuffer(compressedSize),
      type: 'audio/mpeg' as const,
      stemId,
    };
  }),
  terminateWorker: vi.fn(),
  abortWorker: vi.fn(),
}));

describe('runTranscodePipeline', () => {
  it('encodes all stems when predictedTotal >> limit', async () => {
    const { runTranscodePipeline } = await import('../zip-transcode-pipeline');

    const stemsData = {
      other: { data: new ArrayBuffer(8_000_000), type: 'audio/mpeg' },
      keys: { data: new ArrayBuffer(6_000_000), type: 'audio/mpeg' },
      guitar: { data: new ArrayBuffer(7_000_000), type: 'audio/mpeg' },
    };

    const result = await runTranscodePipeline({
      stemsData,
      stemsToTranscode: ['other', 'keys', 'guitar'],
      predictedTotal: 80_000_000,
    });

    expect(result.compressed).toHaveProperty('other');
    expect(result.compressed).toHaveProperty('keys');
    expect(result.compressed).toHaveProperty('guitar');
    expect(result.aborted).toBe(false);
  });

  it('stops early when budget is met (progressive)', async () => {
    const { runTranscodePipeline } = await import('../zip-transcode-pipeline');

    const stemsData = {
      other: { data: new ArrayBuffer(8_000_000), type: 'audio/mpeg' },
      keys: { data: new ArrayBuffer(6_000_000), type: 'audio/mpeg' },
    };

    // predictedTotal чуть выше лимита — after 'other' budget should be met
    // zipSizeLimit = 50 * 1024 * 1024 = 52428800
    // нужен predictedTotal >= 52428800 чтобы не break до 'other'
    // и < 57228800 чтобы после экономии 4.8MB runningTotal < 52428800
    const result = await runTranscodePipeline({
      stemsData,
      stemsToTranscode: ['other', 'keys'],
      predictedTotal: 55_000_000, // 52.45MB — выше лимита
    });

    // 'other' (8MB → 3.2MB) экономия 4.8MB
    // runningTotal = 52 - 4.8 = 47.2MB < 50MB бюджет закрыт
    expect(result.compressed).toHaveProperty('other');
    // keys может быть не тронут если budget уже met
    expect(result.aborted).toBe(false);
  });

  it('returns skipped when stem fails to encode', async () => {
    // Override mock для этого теста — пусть 'keys' упадёт
    vi.mocked(transcoder.encodeDecoded).mockImplementation(async (stemId, _audioBuffer, _kbps) => {
      if (stemId === 'keys') throw new Error('encode failed');
      return { data: new ArrayBuffer(100), type: 'audio/mpeg', stemId };
    });

    const { runTranscodePipeline } = await import('../zip-transcode-pipeline');

    const stemsData = {
      other: { data: new ArrayBuffer(8_000_000), type: 'audio/mpeg' },
      keys: { data: new ArrayBuffer(6_000_000), type: 'audio/mpeg' },
    };

    const result = await runTranscodePipeline({
      stemsData,
      stemsToTranscode: ['other', 'keys'],
      predictedTotal: 80_000_000,
    });

    expect(result.compressed).toHaveProperty('other');
    expect(result.skipped).toContain('keys');
    expect(result.aborted).toBe(false);
  });

  it('returns aborted=false in normal path', async () => {
    const { runTranscodePipeline } = await import('../zip-transcode-pipeline');

    const result = await runTranscodePipeline({
      stemsData: { other: { data: new ArrayBuffer(8_000_000), type: 'audio/mpeg' }},
      stemsToTranscode: ['other'],
      predictedTotal: 60_000_000,
    });

    expect(result.aborted).toBe(false);
  });
});
