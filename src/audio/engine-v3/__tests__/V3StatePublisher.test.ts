import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TransportV3 } from '../core/TransportV3';
import { V3StatePublisher } from '../integration/V3StatePublisher';
import { useAudioStore } from '../../../stores/audio.store';
import { eventBus, EventBusChannel } from '../../../foundation/event-bus';
import { MockAudioContext } from './mockAudioContext';

describe('V3StatePublisher', () => {
  let ctx: MockAudioContext;
  let now: number;
  let transport: TransportV3;
  let publisher: V3StatePublisher;

  beforeEach(() => {
    ctx = new MockAudioContext();
    now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    transport = new TransportV3(ctx as unknown as AudioContext, 'instrumental');
    const fakeBuffer = { duration: 200, numberOfChannels: 1, sampleRate: 48000 } as unknown as AudioBuffer;
    transport.orchestrator.addStem('instrumental', fakeBuffer);
    publisher = new V3StatePublisher(transport);
  });

  afterEach(() => {
    // eventBus is a module-level singleton — without this, subscriptions from
    // earlier tests in this file keep accumulating on it.
    eventBus.clear();
  });

  it('publishSeek always goes through the EventBus as seek-position-changed, exactly once', () => {
    const spy = vi.fn();
    eventBus.subscribe(EventBusChannel.Audio, 'seek-position-changed', spy);

    publisher.publishSeek(42, 200);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith({ currentTime: 42, duration: 200 });
    expect(useAudioStore.getState().currentTime).toBe(42);
  });

  it('a tick smaller than the epsilon does NOT update the store (avoids redundant re-renders)', () => {
    // Accessing the private tick-gate directly — the gating logic has no rAF/document
    // dependency, only start()'s loop-scheduling does, so testing it in isolation is
    // honest, not a workaround for something that matters.
    const p = publisher as unknown as { _publishTickIfChanged(t: number): void };
    p._publishTickIfChanged(10); // seed _lastPublishedTime through the real path, not by poking the store directly

    p._publishTickIfChanged(10.02); // 20ms movement, epsilon is 50ms

    expect(useAudioStore.getState().currentTime).toBe(10); // unchanged by the second call
  });

  it('a tick larger than the epsilon DOES update the store', () => {
    const p = publisher as unknown as { _publishTickIfChanged(t: number): void };

    p._publishTickIfChanged(10.2); // first call always passes the gate (_lastPublishedTime starts unset)

    expect(useAudioStore.getState().currentTime).toBeCloseTo(10.2, 5);
  });

  it('ticks never publish seek-position-changed — only actual seeks do', () => {
    const spy = vi.fn();
    eventBus.subscribe(EventBusChannel.Audio, 'seek-position-changed', spy);
    const p = publisher as unknown as { _publishTickIfChanged(t: number): void };

    p._publishTickIfChanged(1);
    p._publishTickIfChanged(2);
    p._publishTickIfChanged(3);

    expect(spy).not.toHaveBeenCalled();
  });

  it('statechange -> playing publishes playback-state-changed with isPlaying true, unthrottled', async () => {
    const spy = vi.fn();
    eventBus.subscribe(EventBusChannel.Audio, 'playback-state-changed', spy);

    await transport.play();

    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ isPlaying: true }));
    expect(useAudioStore.getState().isPlaying).toBe(true);
  });

  // ── В1 п.2: ended-watchdog ──────────────────────────────────────────────

  it('ended-watchdog (а): tick при t>=duration-eps зовёт notifyNaturalEnd ровно 1 раз; повторные тики не дублируют', async () => {
    const spy = vi.spyOn(transport, 'notifyNaturalEnd');
    const p = publisher as unknown as { _checkNaturalEnd(): void };

    await transport.play();
    expect(transport.state).toBe('playing');

    now = 200 * 1000; // currentTime = 200s >= duration(200) − 50ms

    p._checkNaturalEnd(); // первый тик в окне
    expect(spy).toHaveBeenCalledTimes(1);
    expect(transport.state).toBe('ended');

    p._checkNaturalEnd(); // повторные тики после ended
    p._checkNaturalEnd();
    expect(spy).toHaveBeenCalledTimes(1); // без дублей
  });

  it('ended-watchdog (б): loop=true — natural-end НЕ срабатывает', async () => {
    const spy = vi.spyOn(transport, 'notifyNaturalEnd');
    const p = publisher as unknown as { _checkNaturalEnd(): void };

    // loop-канон требует getChannelData у мастер-стема (StemOrchestrator.setLoopOnAllStems)
    const loopableBuffer = {
      duration: 200,
      numberOfChannels: 1,
      sampleRate: 48000,
      getChannelData: () => new Float32Array(0),
    } as unknown as AudioBuffer;
    transport.orchestrator.addStem('instrumental', loopableBuffer);

    await transport.setLoop(0, 30);
    await transport.play();
    expect(transport.loopEnabled).toBe(true);

    now = 200 * 1000;
    p._checkNaturalEnd();

    expect(spy).not.toHaveBeenCalled();
    expect(transport.state).toBe('playing');
  });

  it('ended-watchdog (в): повторный play снимает идемпотент-флаг — natural-end доступен снова, без дублей в сеансе', async () => {
    const spy = vi.spyOn(transport, 'notifyNaturalEnd');
    const p = publisher as unknown as { _checkNaturalEnd(): void };

    await transport.play();
    now = 200 * 1000;
    p._checkNaturalEnd();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(transport.state).toBe('ended');

    // тики после ended НЕ дублируют
    p._checkNaturalEnd();
    expect(spy).toHaveBeenCalledTimes(1);

    // повторный play (ended → ready → playing) снимает флаг через statechange
    now = 0;
    await transport.play();
    now = 200 * 1000;
    p._checkNaturalEnd();
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
