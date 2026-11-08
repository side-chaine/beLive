import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, waitFor, cleanup } from '@testing-library/react';
import { useTrackMapFx, type TrackMapFxRun } from '../use-trackmap-fx';
import { useTrackMapStore } from '../trackmap.store';
import { useTrackStore } from '../../stores/track.store';
import { TRACKMAP_FX_BY_ID } from '../trackmap-fx.registry';

/**
 * Регрессия на баг 06.11 (нашёл Никита): презентация TrackMap не срабатывала
 * при загрузке трека и входе в режим репетиции — только после ручного клика по
 * блоку. Причина: триггером был переход isPlaying false→true, а play к этому
 * моменту уже случился (или блоки пришли в стор позже полосы).
 *
 * Теперь триггер — появление вагонов. Эти тесты фиксируют именно это.
 */

let latest: TrackMapFxRun | null = null;

function Probe({ total }: { total: number }) {
  latest = useTrackMapFx(total);
  return null;
}

describe('useTrackMapFx — presentation trigger', () => {
  beforeEach(() => {
    latest = null;
    useTrackMapStore.setState({ dimMode: 'off', fxEnabled: true, fxIntensity: 1, selection: [] });
    useTrackStore.setState({ currentTrack: { id: 'track-1', index: 0 } });
  });

  afterEach(() => cleanup());

  it('blinks on mount when the strip has wagons — no play required', async () => {
    render(<Probe total={8} />);

    await waitFor(() => {
      expect(latest?.fxId).not.toBeNull();
    });

    const fx = TRACKMAP_FX_BY_ID[latest!.fxId!];
    expect(fx).toBeDefined();
    expect(latest!.delays).toHaveLength(8);
    expect(latest!.durationMs).toBe(fx.durationMs);
  });

  it('does not blink while there are no wagons yet', async () => {
    render(<Probe total={0} />);
    await new Promise(r => setTimeout(r, 80));
    expect(latest?.fxId ?? null).toBeNull();
  });

  it('respects the fxEnabled taste switch', async () => {
    useTrackMapStore.setState({ fxEnabled: false });
    render(<Probe total={5} />);
    await new Promise(r => setTimeout(r, 80));
    expect(latest?.fxId ?? null).toBeNull();
  });

  it('delays are index-aligned with the rendered wagons', async () => {
    render(<Probe total={6} />);
    await waitFor(() => expect(latest?.fxId).not.toBeNull());
    expect(latest!.delays).toHaveLength(6);
    for (const d of latest!.delays) expect(d).toBeGreaterThanOrEqual(0);
  });
});
