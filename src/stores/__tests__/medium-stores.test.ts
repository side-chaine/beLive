import { describe, it, expect, beforeEach } from 'vitest';

// ─── loop.store ───
import { useLoopStore } from '../loop.store';
describe('loop.store', () => {
  beforeEach(() => useLoopStore.setState({ loopStart: null, loopEnd: null, loopActive: false }));
  it('начальное состояние — нет лупа', () => {
    const s = useLoopStore.getState();
    expect(s.loopStart).toBeNull();
    expect(s.loopEnd).toBeNull();
    expect(s.loopActive).toBe(false);
  });
});

// ─── pitch.store ───
import { usePitchStore } from '../pitch.store';
describe('pitch.store', () => {
  beforeEach(() => usePitchStore.setState({ pitchEnabled: false }));
  it('начальное состояние — питч отключён', () => {
    expect(usePitchStore.getState().pitchEnabled).toBe(false);
  });
});

// ─── textStyle.store ───
import { useTextStyleStore } from '../textStyle.store';
describe('textStyle.store', () => {
  beforeEach(() => useTextStyleStore.setState({ activeStyleId: 'default' }));
  it('начальное состояние — default стиль', () => {
    expect(useTextStyleStore.getState().activeStyleId).toBe('default');
  });
});

// ─── markers.store ───
import { useMarkersStore } from '../markers.store';
describe('markers.store', () => {
  beforeEach(() => useMarkersStore.setState({ markers: [], sections: [] }));
  it('начальное состояние — пусто', () => {
    expect(useMarkersStore.getState().markers).toEqual([]);
  });
});

// ─── lyrics.store ───
import { useLyricsStore } from '../lyrics.store';
describe('lyrics.store', () => {
  beforeEach(() => useLyricsStore.setState({ lyrics: [], activeLineIndex: -1 }));
  it('начальное состояние — без строк', () => {
    expect(useLyricsStore.getState().lyrics).toEqual([]);
    expect(useLyricsStore.getState().activeLineIndex).toBe(-1);
  });
});

// ─── monitor.store ───
import { useMonitorStore } from '../monitor.store';
describe('monitor.store', () => {
  beforeEach(() => useMonitorStore.setState({ enabled: false }));
  it('начальное состояние — монитор выключен', () => {
    expect(useMonitorStore.getState().enabled).toBe(false);
  });
});

// ─── wordSync.store ───
import { useWordSyncStore } from '../wordSync.store';
describe('wordSync.store', () => {
  beforeEach(() => useWordSyncStore.setState({ isWordSyncReady: false }));
  it('начальное состояние — word sync не готов', () => {
    expect(useWordSyncStore.getState().isWordSyncReady).toBe(false);
  });
});
