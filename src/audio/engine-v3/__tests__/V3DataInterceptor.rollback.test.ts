import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { V3DataInterceptor, DECODE_BATCH, type TrackRecord } from '../integration/V3DataInterceptor';

// 6 music stems + vocals = 7 jobs — ровно тот случай «Crawling 3:29», на котором
// считался пик в FROZEN-REQUEST §3 (7 × 70.3 МиБ).
const MUSIC_STEMS = ['drums', 'bass', 'keys', 'guitar', 'backing', 'other'];

function makeRecord(musicSizes: number[]): TrackRecord {
  const stemsData: Record<string, { data: ArrayBuffer; type: string }> = {};
  MUSIC_STEMS.forEach((id, i) => {
    stemsData[id] = { data: new ArrayBuffer(musicSizes[i]), type: 'audio/mpeg' };
  });
  return {
    instrumentalData: new ArrayBuffer(1),
    instrumentalType: 'audio/mpeg',
    vocalsData: new ArrayBuffer(99),
    vocalsType: 'audio/mpeg',
    stemsData,
  };
}

const fakeBuffer = { duration: 209, numberOfChannels: 2, sampleRate: 44100 } as unknown as AudioBuffer;

describe('V3DataInterceptor — FROZEN-REQUEST A+B (память при смене трека)', () => {
  let decodeMock: ReturnType<typeof vi.fn>;
  let liveStems: string[];
  let pipeline: {
    liveStems: string[];
    reset: ReturnType<typeof vi.fn>;
    loadStem: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
  };
  let orchestrator: { disposeAll: ReturnType<typeof vi.fn>; addStem: ReturnType<typeof vi.fn> };
  let transport: {
    stop: ReturnType<typeof vi.fn>;
    play: ReturnType<typeof vi.fn>;
    pause: ReturnType<typeof vi.fn>;
    state: string;
    duration: number;
    dispatchEvent: ReturnType<typeof vi.fn>;
  };
  let setV3Active: ReturnType<typeof vi.fn>;
  let interceptor: V3DataInterceptor;

  beforeEach(() => {
    decodeMock = vi.fn();

    liveStems = ['old-stem'];
    pipeline = {
      liveStems,
      reset: vi.fn(async () => {
        liveStems.length = 0;
      }),
      loadStem: vi.fn(async (id: string) => {
        liveStems.push(id);
      }),
      stop: vi.fn(),
    };

    orchestrator = { disposeAll: vi.fn(), addStem: vi.fn() };
    transport = {
      stop: vi.fn(),
      play: vi.fn(async () => {}),
      pause: vi.fn(),
      state: 'playing',
      duration: 209,
      dispatchEvent: vi.fn(),
    };

    setV3Active = vi.fn();
    (window as unknown as { __setV3Active: unknown }).__setV3Active = setV3Active;

    interceptor = new V3DataInterceptor(
      { decodeAudioData: decodeMock } as unknown as AudioContext,
      orchestrator as unknown as never,
      transport as unknown as never,
    );
    interceptor.attachPipeline(pipeline as unknown as never);
  });

  afterEach(() => {
    delete (window as unknown as { __setV3Active?: unknown }).__setV3Active;
    vi.restoreAllMocks();
  });

  it('T1: все декоды упали — reset не вызван, старый стем жив, событие отправлено, флаг V3 восстановлен', async () => {
    decodeMock.mockImplementation(async () => {
      throw new Error('decode failed');
    });

    // src/test/setup.ts подменяет глобальный dispatchEvent на vi.fn() (window ===
    // globalThis в jsdom), поэтому реальные слушатели не срабатывают — проверяем
    // сам факт отправки через мок.
    const dispatch = window.dispatchEvent as unknown as ReturnType<typeof vi.fn>;
    dispatch.mockClear();

    const res = await interceptor.loadTrack(makeRecord([101, 102, 103, 104, 105, 106]));

    const failedEvent = dispatch.mock.calls
      .map((c) => c[0] as CustomEvent<{ failedStemIds: string[] }>)
      .find((e) => e?.type === 'belive:track-load-failed');

    expect(res.loadedStemIds).toEqual([]);
    expect(res.failedStemIds).toHaveLength(7);
    expect(pipeline.reset).not.toHaveBeenCalled();
    expect(pipeline.liveStems).toContain('old-stem');
    expect(failedEvent).toBeDefined();
    expect(failedEvent!.detail.failedStemIds).toHaveLength(7);
    // на входе флаг сброшен (false), на провале возвращён (true)
    expect(setV3Active.mock.calls.at(-1)).toEqual([true]);
  });

  it('T2: 1 из 7 декодов успешен — reset вызван один раз, старый стем вытеснен, новый загружен', async () => {
    decodeMock.mockImplementation(async (buf: ArrayBuffer) => {
      if (buf.byteLength === 101) {return fakeBuffer;}
      throw new Error('decode failed');
    });

    const res = await interceptor.loadTrack(makeRecord([101, 102, 103, 104, 105, 106]));

    expect(pipeline.reset).toHaveBeenCalledTimes(1);
    expect(pipeline.liveStems).not.toContain('old-stem');
    expect(pipeline.liveStems).toContain('drums');
    expect(res.loadedStemIds).toEqual(['drums']);
  });

  it('T3: 7 задач — decodeAudioData никогда не в полёте больше DECODE_BATCH, максимум ровно 2', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    decodeMock.mockImplementation(async () => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      try {
        await new Promise<void>((r) => setTimeout(r, 5));
        return fakeBuffer;
      } finally {
        inFlight--;
      }
    });

    const res = await interceptor.loadTrack(makeRecord([101, 102, 103, 104, 105, 106]));

    expect(decodeMock).toHaveBeenCalledTimes(7);
    expect(maxInFlight).toBeLessThanOrEqual(DECODE_BATCH);
    expect(maxInFlight).toBe(2);
    expect(res.loadedStemIds).toHaveLength(7);
  });

  it('T4: смена generation между батчами — оставшиеся батчи не декодируются, возврат пустой', async () => {
    const sizesSeen: number[] = [];
    let calls = 0;
    let secondLoad: Promise<unknown> | null = null;

    decodeMock.mockImplementation(async (buf: ArrayBuffer) => {
      calls++;
      sizesSeen.push(buf.byteLength);
      if (calls === 2) {
        // Вторая загрузка стартует, пока первый батч ещё в полёте: ++_loadGeneration
        // должен остановить первый трек на следующем межбатчевом гарде.
        secondLoad = interceptor.loadTrack({
          instrumentalData: new ArrayBuffer(201),
          instrumentalType: 'audio/mpeg',
        });
      }
      await Promise.resolve();
      return fakeBuffer;
    });

    const res = await interceptor.loadTrack(makeRecord([101, 102, 103, 104, 105, 106]));
    if (secondLoad) {await secondLoad;}

    expect(res.loadedStemIds).toEqual([]);
    // Первый батч = [vocals(99), drums(101)]; 102..106 (музыка) не должны декодироваться.
    const firstLoadSizes = sizesSeen.filter((s) => s !== 201);
    expect(firstLoadSizes).toEqual([99, 101]);
  });
});
