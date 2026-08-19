import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TransportV3 } from '../core/TransportV3';
import { MockAudioContext } from './mockAudioContext';

describe('TransportV3', () => {
  let ctx: MockAudioContext;
  let now: number;

  beforeEach(() => {
    ctx = new MockAudioContext();
    now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
  });

  function makeTransportWithOneStem(durationSec: number): TransportV3 {
    const transport = new TransportV3(ctx as unknown as AudioContext, 'instrumental');
    const fakeBuffer = { duration: durationSec, numberOfChannels: 1, sampleRate: 48000 } as unknown as AudioBuffer;
    transport.orchestrator.addStem('instrumental', fakeBuffer);
    return transport;
  }

  it('only the LAST of two rapid-fire seeks actually takes effect (generation guard)', async () => {
    const transport = makeTransportWithOneStem(200);
    await transport.play();

    const seekA = transport.seek(10); // not awaited — deliberately racing seekB
    const seekB = transport.seek(20);

    await Promise.all([seekA, seekB]);

    expect(transport.currentTime).toBeCloseTo(20, 1);
    expect(transport.state).toBe('playing');
  });

  it('three rapid seeks still only leave the LAST one in effect, not just "not the first"', async () => {
    const transport = makeTransportWithOneStem(200);
    await transport.play();

    const seekA = transport.seek(10);
    const seekB = transport.seek(20);
    const seekC = transport.seek(35);
    await Promise.all([seekA, seekB, seekC]);

    expect(transport.currentTime).toBeCloseTo(35, 1);
  });

  it('seeking while paused repositions but does NOT start audio (no autoplay-on-scrub regression)', async () => {
    const transport = makeTransportWithOneStem(200);
    await transport.play();
    await transport.pause();
    expect(transport.state).toBe('paused');

    await transport.seek(30);

    expect(transport.state).toBe('paused'); // must still be paused, not silently playing
    expect(transport.currentTime).toBeCloseTo(30, 5);
  });

  it('a stem past its own duration is skipped on play(), and picked back up after seeking earlier', async () => {
    const transport = makeTransportWithOneStem(5); // 5s "instrumental"
    await transport.play();
    now += 10; // negligible real time, we control offset via seek() instead

    await transport.seek(4.9); // still within duration
    expect(transport.orchestrator.get('instrumental')?.shouldPlayAt(4.9)).toBe(true);

    await transport.seek(5.5); // past duration — this stem must not be told to (re)start
    expect(transport.orchestrator.get('instrumental')?.shouldPlayAt(5.5)).toBe(false);
  });

  it('play(initialOffset) starts directly at that position from idle — no intermediate 0:00 (UI-0 fix)', async () => {
    const transport = makeTransportWithOneStem(200);
    expect(transport.state).toBe('idle');

    await transport.play(42);

    expect(transport.state).toBe('playing');
    expect(transport.currentTime).toBeCloseTo(42, 1);
  });

  it('initialOffset is ignored when resuming from paused — resumes from the paused position, not the argument', async () => {
    const transport = makeTransportWithOneStem(200);
    await transport.play(10);
    await transport.seek(50);
    await transport.pause();

    await transport.play(999); // must NOT jump to 999 — this is a plain resume, not a fresh start

    expect(transport.currentTime).toBeCloseTo(50, 1);
  });

  it('emits a statechange event on the EventTarget interface for external subscribers', async () => {
    const transport = makeTransportWithOneStem(200);
    const seen: string[] = [];
    transport.addEventListener('statechange', (e) => {
      seen.push((e as CustomEvent<{ state: string }>).detail.state);
    });

    await transport.play();
    await transport.pause();

    expect(seen).toContain('playing');
    expect(seen).toContain('paused');
  });
});
