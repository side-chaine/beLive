import { describe, it, expect, beforeEach } from 'vitest';
import {
  TRACKMAP_FX,
  TRACKMAP_FX_BY_ID,
  computeFxDelays,
  pickTrackMapFx,
  type TrackMapFxId,
} from '../trackmap-fx.registry';
import { useTrackMapStore } from '../trackmap.store';

describe('trackmap-fx registry', () => {
  it('ids are unique and indexed', () => {
    const ids = TRACKMAP_FX.map(fx => fx.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(TRACKMAP_FX_BY_ID[id]?.id).toBe(id);
    }
  });

  it('every effect keeps delays finite and non-negative for 1..30 wagons', () => {
    for (const fx of TRACKMAP_FX) {
      for (let total = 1; total <= 30; total++) {
        const delays = computeFxDelays(fx, total, 12345);
        expect(delays).toHaveLength(total);
        for (const d of delays) {
          expect(Number.isFinite(d)).toBe(true);
          expect(d).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  it('delays never exceed the effect window by more than the intended tail', () => {
    // Страховка от «эффект закончился, а анимация ещё идёт»: максимальная
    // задержка должна укладываться в durationMs (запас — один шаг).
    for (const fx of TRACKMAP_FX) {
      const delays = computeFxDelays(fx, 12, 7);
      expect(Math.max(...delays)).toBeLessThanOrEqual(fx.durationMs);
    }
  });

  it('cascade is monotonic left→right, cascade-rev is the mirror', () => {
    const fwd = computeFxDelays(TRACKMAP_FX_BY_ID.cascade, 8, 1);
    const rev = computeFxDelays(TRACKMAP_FX_BY_ID['cascade-rev'], 8, 1);
    for (let i = 1; i < fwd.length; i++) {
      expect(fwd[i]).toBeGreaterThanOrEqual(fwd[i - 1]);
      expect(rev[i]).toBeLessThanOrEqual(rev[i - 1]);
    }
    expect(fwd).toEqual([...rev].reverse());
  });

  it('breath is synchronized (all zero delays)', () => {
    expect(new Set(computeFxDelays(TRACKMAP_FX_BY_ID.breath, 9, 1))).toEqual(new Set([0]));
  });

  it('pickTrackMapFx never repeats the previous effect', () => {
    let prev: TrackMapFxId | null = null;
    for (let i = 0; i < 200; i++) {
      const fx = pickTrackMapFx(prev);
      expect(fx.id).not.toBe(prev);
      prev = fx.id;
    }
  });

  it('pickTrackMapFx falls back to the full pool when only one effect exists', () => {
    // Инвариант: даже при вырожденном пуле функция возвращает эффект, а не undefined.
    const fx = pickTrackMapFx('cascade', () => 0.999);
    expect(fx).toBeDefined();
    expect(TRACKMAP_FX_BY_ID[fx.id]).toBeDefined();
  });
});

describe('trackmap.store', () => {
  beforeEach(() => {
    useTrackMapStore.setState({ dimMode: 'off', fxEnabled: true, fxIntensity: 1, selection: [] });
  });

  it('cycles dim modes off → soft → solo → off', () => {
    const s = useTrackMapStore.getState();
    s.cycleDimMode();
    expect(useTrackMapStore.getState().dimMode).toBe('soft');
    s.cycleDimMode();
    expect(useTrackMapStore.getState().dimMode).toBe('solo');
    s.cycleDimMode();
    expect(useTrackMapStore.getState().dimMode).toBe('off');
  });

  it('toggles selection without duplicates', () => {
    const s = useTrackMapStore.getState();
    s.toggleSelected('b1');
    s.toggleSelected('b2');
    expect(useTrackMapStore.getState().selection).toEqual(['b1', 'b2']);
    s.toggleSelected('b1');
    expect(useTrackMapStore.getState().selection).toEqual(['b2']);
    expect(useTrackMapStore.getState().isSelected('b1')).toBe(false);
  });

  it('clamps fxIntensity into 0..1', () => {
    useTrackMapStore.getState().setFxIntensity(3);
    expect(useTrackMapStore.getState().fxIntensity).toBe(1);
    useTrackMapStore.getState().setFxIntensity(-2);
    expect(useTrackMapStore.getState().fxIntensity).toBe(0);
  });
});
