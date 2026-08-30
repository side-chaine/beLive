import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PitchEngine } from '../../audio/pitch/pitch-engine';
import { usePitchStore } from '../pitch.store';

describe('pitch.store', () => {
  beforeEach(() => {
    PitchEngine.get().destroy();
    usePitchStore.setState({
      status: 'idle',
      error: null,
      frequency: null,
      note: null,
      midi: null,
      cents: 0,
      confidence: 0,
      isSinging: false,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('кейс-1: happy-path + guard — running, повторный старт no-op', async () => {
    const initSpy = vi.spyOn(PitchEngine.prototype, 'initFromMic').mockResolvedValue(undefined);
    vi.spyOn(PitchEngine.prototype, 'subscribe').mockReturnValue(vi.fn());

    await usePitchStore.getState().startPitch();

    expect(usePitchStore.getState().status).toBe('running');

    await usePitchStore.getState().startPitch();

    expect(usePitchStore.getState().status).toBe('running');
    expect(initSpy).toHaveBeenCalledTimes(1);
  });

  it('кейс-2: V3-бросок (мок) + повтор — error, initFromMic снова', async () => {
    const initSpy = vi
      .spyOn(PitchEngine.prototype, 'initFromMic')
      .mockRejectedValue(new Error('audioEngine.audioContext not found'));

    await usePitchStore.getState().startPitch();

    const s = usePitchStore.getState();
    expect(s.status).toBe('error');
    expect(s.error).toBe('audioEngine.audioContext not found');

    await usePitchStore.getState().startPitch();

    expect(initSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('кейс-3: stopPitch порядок — строго [unsub, destroy]', async () => {
    const calls: string[] = [];
    const engine = PitchEngine.get();
    const realDestroy = engine.destroy.bind(engine);

    vi.spyOn(PitchEngine.prototype, 'initFromMic').mockResolvedValue(undefined);
    vi.spyOn(PitchEngine.prototype, 'subscribe').mockReturnValue(
      vi.fn(() => {
        calls.push('unsub');
      })
    );
    vi.spyOn(PitchEngine.prototype, 'destroy').mockImplementation(() => {
      calls.push('destroy');
      realDestroy();
    });

    await usePitchStore.getState().startPitch();
    usePitchStore.getState().stopPitch();

    expect(calls).toEqual(['unsub', 'destroy']);
  });

  it('кейс-4: poison-путь БЕЗ моков — singleton не отравлен, повтор честен', async () => {
    await usePitchStore.getState().startPitch();

    const s = usePitchStore.getState();
    expect(s.status).toBe('error');
    expect(s.error).toBe('audioEngine.audioContext not found');

    expect(PitchEngine.get().status).toBe('idle');

    await usePitchStore.getState().startPitch();

    expect(usePitchStore.getState().status).toBe('error');
  });
});
