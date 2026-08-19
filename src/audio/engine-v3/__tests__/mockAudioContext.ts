export class MockAudioParam {
  value = 0;
  setValueAtTime(value: number, _time: number): this {
    this.value = value;
    return this;
  }
  linearRampToValueAtTime(value: number, _time: number): this {
    this.value = value;
    return this;
  }
  cancelScheduledValues(_time: number): this {
    return this;
  }
}

export class MockAudioNode {
  connect(_dest: unknown): unknown {
    return _dest;
  }
  disconnect(_dest?: unknown): void {
    /* noop */
  }
}

export class MockGainNode extends MockAudioNode {
  gain = new MockAudioParam();
}

export class MockAnalyserNode extends MockAudioNode {
  fftSize = 2048;
  get frequencyBinCount(): number {
    return this.fftSize / 2;
  }
  getFloatTimeDomainData(_arr: Float32Array): void {
    /* noop */
  }
}

export class MockAudioBufferSourceNode extends MockAudioNode {
  buffer: unknown = null;
  playbackRate = new MockAudioParam();
  loop = false;
  loopStart = 0;
  loopEnd = 0;
  onended: (() => void) | null = null;
  private _started = false;

  // Simplification: real Web Audio API specifically dislikes stop() called after
  // start() but before the scheduled `when` has elapsed on the audio clock (the
  // Safari behaviour StemPlayerV3._killSourceSafe's try/catch defends against).
  // This mock only models the simpler, universally-agreed case (stop() with no
  // start() at all) — good enough to prove the try/catch doesn't propagate, which
  // is what actually matters for the tests here.
  start(_when?: number, _offset?: number): void {
    this._started = true;
  }
  stop(): void {
    if (!this._started) throw new DOMException('cannot stop before start', 'InvalidStateError');
  }

  /** Test helper, not a real Web Audio API method. */
  __simulateEnded(): void {
    this.onended?.();
  }
}

export class MockDelayNode extends MockAudioNode {
  delayTime = new MockAudioParam();
}

export class MockAudioContext extends EventTarget {
  state: AudioContextState | 'interrupted' = 'running';
  currentTime = 0;
  sampleRate = 48000;
  destination = new MockAudioNode();

  createGain(): MockGainNode {
    return new MockGainNode();
  }
  createAnalyser(): MockAnalyserNode {
    return new MockAnalyserNode();
  }
  createDelay(_maxDelay?: number): MockDelayNode {
    return new MockDelayNode();
  }
  createBufferSource(): MockAudioBufferSourceNode {
    return new MockAudioBufferSourceNode();
  }
  decodeAudioData(_data: ArrayBuffer): Promise<unknown> {
    return Promise.resolve({});
  }

  async resume(): Promise<void> {
    this.state = 'running';
    this.dispatchEvent(new Event('statechange'));
  }

  /** Test helper: force a state transition and fire the real event, exactly like the browser would. */
  __setState(s: AudioContextState | 'interrupted'): void {
    this.state = s;
    this.dispatchEvent(new Event('statechange'));
  }
}
