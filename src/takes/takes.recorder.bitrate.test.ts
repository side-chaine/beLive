import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Force the v3 acquisition path: it is the simplest branch in start() and keeps
// the test focused on the MediaRecorder contract rather than engine wiring.
vi.mock('../engine-mode', () => ({ ENGINE_MODE: 'v3' }));

import {
  TakesRecorder,
  TAKE_AUDIO_BITS_PER_SECOND,
  buildRecorderOptions,
} from './takes.recorder';

interface CtorCall {
  stream: unknown;
  options: MediaRecorderOptions;
}

const ctorCalls: CtorCall[] = [];

class FakeMediaRecorder {
  static isTypeSupported = vi.fn(() => true);
  static instances: FakeMediaRecorder[] = [];

  state: 'inactive' | 'recording' = 'inactive';
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;

  constructor(stream: unknown, options: MediaRecorderOptions) {
    ctorCalls.push({ stream, options });
    FakeMediaRecorder.instances.push(this);
  }

  start() {
    this.state = 'recording';
  }

  stop() {
    this.state = 'inactive';
    this.onstop?.();
  }
}

const fakeStream = { id: 'fake-raw-mic', getTracks: () => [] } as unknown as MediaStream;

function installAudioMocks() {
  const analyser = {
    fftSize: 0,
    smoothingTimeConstant: 0,
    connect: vi.fn(),
    disconnect: vi.fn(),
  };
  const ctx = {
    createMediaStreamSource: vi.fn(() => ({ connect: vi.fn(), disconnect: vi.fn() })),
    createAnalyser: vi.fn(() => analyser),
  };
  (window as unknown as Record<string, unknown>).audioEngine = { audioContext: ctx };
  (window as unknown as Record<string, unknown>).__belive = {
    micSource: { acquire: vi.fn(async () => fakeStream) },
  };
}

describe('TakesRecorder — encode rate contract', () => {
  beforeEach(() => {
    ctorCalls.length = 0;
    FakeMediaRecorder.instances.length = 0;
    (globalThis as unknown as Record<string, unknown>).MediaRecorder = FakeMediaRecorder;
    installAudioMocks();
  });

  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).audioEngine;
    delete (window as unknown as Record<string, unknown>).__belive;
  });

  it('hands the bitrate to the MediaRecorder constructor, not just to a local const', async () => {
    const recorder = new TakesRecorder();
    await recorder.start();

    expect(ctorCalls).toHaveLength(1);
    expect(ctorCalls[0].options).toEqual({
      mimeType: 'audio/webm;codecs=opus',
      audioBitsPerSecond: 128_000,
    });
  });

  it('buildRecorderOptions keeps mimeType and pins the rate', () => {
    expect(buildRecorderOptions('audio/mp4')).toEqual({
      mimeType: 'audio/mp4',
      audioBitsPerSecond: TAKE_AUDIO_BITS_PER_SECOND,
    });
  });

  it('never drops below 96 kbps — a lower rate would regress every studio take', () => {
    // Guard against a future "optimisation" like 48000 that quietly halves quality.
    expect(TAKE_AUDIO_BITS_PER_SECOND).toBeGreaterThanOrEqual(96_000);
  });
});
