import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HybridClock } from '../core/HybridClock';
import { MockAudioContext } from './mockAudioContext';

describe('HybridClock', () => {
  let ctx: MockAudioContext;
  let now: number;

  beforeEach(() => {
    ctx = new MockAudioContext();
    now = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
  });

  it('reports elapsed wall-clock time while playing at rate 1.0', () => {
    const clock = new HybridClock(ctx as unknown as AudioContext);
    clock.start(10);
    now += 2000;
    expect(clock.getCurrentTime()).toBeCloseTo(12, 5);
  });

  it('scales elapsed time by playbackRate', () => {
    const clock = new HybridClock(ctx as unknown as AudioContext);
    clock.start(0);
    clock.setPlaybackRate(0.5);
    now += 4000;
    expect(clock.getCurrentTime()).toBeCloseTo(2, 5);
  });

  it('compensates a "suspended" interruption — real-world time lost does not count', () => {
    const clock = new HybridClock(ctx as unknown as AudioContext);
    clock.start(0);
    now += 1000;
    ctx.__setState('suspended');
    now += 10000;
    ctx.__setState('running');
    now += 500;
    expect(clock.getCurrentTime()).toBeCloseTo(1.5, 5);
  });

  it('treats iOS "interrupted" identically to "suspended" (not a state suspended-only code would catch)', () => {
    const clock = new HybridClock(ctx as unknown as AudioContext);
    clock.start(0);
    now += 1000;
    ctx.__setState('interrupted');
    now += 8000;
    ctx.__setState('running');
    now += 1000;
    expect(clock.getCurrentTime()).toBeCloseTo(2, 5);
  });

  it('does not double-compensate across two separate suspend/resume cycles', () => {
    const clock = new HybridClock(ctx as unknown as AudioContext);
    clock.start(0);
    now += 1000;
    ctx.__setState('suspended');
    now += 5000;
    ctx.__setState('running');
    now += 1000;
    ctx.__setState('suspended');
    now += 3000;
    ctx.__setState('running');
    now += 1000;
    expect(clock.getCurrentTime()).toBeCloseTo(3, 5);
  });

  it('pause() freezes the reported position regardless of real time passing', () => {
    const clock = new HybridClock(ctx as unknown as AudioContext);
    clock.start(0);
    now += 2000;
    clock.pause();
    now += 5000;
    expect(clock.getCurrentTime()).toBeCloseTo(2, 5);
  });

  it('seek() while paused repositions; a later start() continues correctly from there', () => {
    const clock = new HybridClock(ctx as unknown as AudioContext);
    clock.start(0);
    now += 2000;
    clock.pause();
    clock.seek(50);
    expect(clock.getCurrentTime()).toBe(50);
    clock.start(50);
    now += 1000;
    expect(clock.getCurrentTime()).toBeCloseTo(51, 5);
  });

  it('ensureResumed() resolves true once the context reports running', async () => {
    ctx.state = 'suspended';
    const clock = new HybridClock(ctx as unknown as AudioContext);
    const result = await clock.ensureResumed();
    expect(result).toBe(true);
    expect(ctx.state).toBe('running');
  });
});
