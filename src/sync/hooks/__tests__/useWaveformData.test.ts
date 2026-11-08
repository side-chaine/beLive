import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useWaveformData } from '../useWaveformData';

/** Окно с фасадом audioEngine — типизированный доступ, без any-каста (ratchet В1 п.6). */
type EngineWindow = Window & { audioEngine?: unknown };
const engineWindow = window as unknown as EngineWindow;

/** Фейковый AudioBuffer: волне нужны только duration/sampleRate/getChannelData. */
function makeBuffer(duration: number, sampleRate = 44100, fill = 0.25): AudioBuffer {
  const data = new Float32Array(8).fill(fill);
  return {
    duration,
    sampleRate,
    length: data.length,
    numberOfChannels: 1,
    getChannelData: () => data,
  } as unknown as AudioBuffer;
}

function installEngine(opts: {
  stems?: Record<string, AudioBuffer | null>;
  instrumentalUrl?: string | null;
  vocalsUrl?: string | null;
  decodeAudioData?: ReturnType<typeof vi.fn>;
}) {
  const decodeAudioData = opts.decodeAudioData ?? vi.fn(async () => makeBuffer(1));
  const audioContext = { decodeAudioData } as unknown as AudioContext;
  engineWindow.audioEngine = {
    hybridEngine: {
      instrumentalUrl: opts.instrumentalUrl ?? null,
      vocalsUrl: opts.vocalsUrl ?? null,
    },
    getStemAudioBuffer: (id: string) => opts.stems?.[id] ?? null,
    audioContext,
  };
  return { decodeAudioData };
}

beforeEach(() => {
  delete engineWindow.audioEngine;
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete engineWindow.audioEngine;
});

describe('useWaveformData (702-F0": волна не декодирует второй раз)', () => {
  it('оба стема уже в пайплайне → decodeAudioData НЕ вызывается вообще', async () => {
    const inst = makeBuffer(209, 48000, 0.5);
    const voc = makeBuffer(209, 48000, 0.7);
    const { decodeAudioData } = installEngine({
      stems: { instrumental: inst, vocals: voc },
      instrumentalUrl: 'blob:i',
      vocalsUrl: 'blob:v',
    });

    const { result } = renderHook(() => useWaveformData());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(decodeAudioData).not.toHaveBeenCalled();
    expect(result.current.instrumentalData?.[0]).toBeCloseTo(0.5);
    expect(result.current.vocalData?.[0]).toBeCloseTo(0.7);
    expect(result.current.sampleRate).toBe(48000);
    expect(result.current.duration).toBe(209);
    expect(result.current.error).toBeNull();
  });

  it('трек без вокала (нет ни буфера, ни URL) → тоже ноль декодов', async () => {
    const inst = makeBuffer(157, 44100, 0.3);
    const { decodeAudioData } = installEngine({
      stems: { instrumental: inst },
      instrumentalUrl: 'blob:i',
      vocalsUrl: null,
    });

    const { result } = renderHook(() => useWaveformData());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(decodeAudioData).not.toHaveBeenCalled();
    expect(result.current.instrumentalData?.[0]).toBeCloseTo(0.3);
    expect(result.current.vocalData).toBeNull();
  });

  it('вокал ещё грузится в пайплайн → грейс, и только потом декод ОДНОГО вокала', async () => {
    const inst = makeBuffer(209, 44100, 0.1);
    const voc = makeBuffer(209, 44100, 0.9);
    const decode = vi.fn(async () => voc);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ arrayBuffer: async () => new ArrayBuffer(8) })),
    );
    installEngine({
      stems: { instrumental: inst, vocals: null },
      instrumentalUrl: 'blob:i',
      vocalsUrl: 'blob:v',
      decodeAudioData: decode,
    });

    const { result } = renderHook(() => useWaveformData());

    // Внутри грейса декода нет — пайплайн ещё может успеть.
    await new Promise((r) => setTimeout(r, 400));
    expect(decode).not.toHaveBeenCalled();

    await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 4000 });
    expect(decode).toHaveBeenCalledTimes(1);
    expect(result.current.instrumentalData?.[0]).toBeCloseTo(0.1);
    expect(result.current.vocalData?.[0]).toBeCloseTo(0.9);
  }, 8000);

  it('пайплайн пуст → прежний путь через blob-URL (фолбэк жив)', async () => {
    const iBuf = makeBuffer(157, 44100, 0.2);
    const vBuf = makeBuffer(157, 44100, 0.8);
    const decode = vi.fn();
    decode.mockResolvedValueOnce(iBuf).mockResolvedValueOnce(vBuf);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ arrayBuffer: async () => new ArrayBuffer(8) })),
    );
    installEngine({
      stems: { instrumental: null, vocals: null },
      instrumentalUrl: 'blob:i',
      vocalsUrl: 'blob:v',
      decodeAudioData: decode,
    });

    const { result } = renderHook(() => useWaveformData());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(decode).toHaveBeenCalledTimes(2);
    expect(result.current.instrumentalData?.[0]).toBeCloseTo(0.2);
    expect(result.current.vocalData?.[0]).toBeCloseTo(0.8);
  });

  it('ни буферов, ни URL → через таймаут отдаёт ошибку, а не висит в loading', async () => {
    installEngine({ stems: { instrumental: null, vocals: null } });

    const { result } = renderHook(() => useWaveformData());

    // URL_POLL_TIMEOUT_MS = 6000 — ждём чуть дольше.
    await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 9000 });
    expect(result.current.error).toBe('No audio URLs available');
  }, 12000);
});
