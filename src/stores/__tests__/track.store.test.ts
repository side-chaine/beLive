import { describe, it, expect, beforeEach } from 'vitest';
import { useTrackStore } from '../track.store';

const mockTrack = (id: string, title: string) => ({
  id, title, index: 0, artist: 'Test',
});

describe('track.store', () => {
  beforeEach(() => {
    useTrackStore.setState({
      tracksMeta: [],
      currentTrack: null,
      currentTrackIndex: -1,
      currentCoverTheme: null,
      hasBlockScenes: false,
    });
  });

  it('начальное состояние — пусто', () => {
    const s = useTrackStore.getState();
    expect(s.tracksMeta).toEqual([]);
    expect(s.currentTrack).toBeNull();
    expect(s.currentTrackIndex).toBe(-1);
  });

  it('setTracksMeta заполняет список', () => {
    const tracks = [mockTrack('1', 'Song A'), mockTrack('2', 'Song B')];
    useTrackStore.getState().setTracksMeta(tracks);
    expect(useTrackStore.getState().tracksMeta).toHaveLength(2);
  });

  it('setCurrentTrackIndex запоминает позицию', () => {
    useTrackStore.getState().setCurrentTrackIndex(2);
    expect(useTrackStore.getState().currentTrackIndex).toBe(2);
  });

  it('removeTrack удаляет трек и корректирует индекс', () => {
    const tracks = [mockTrack('1', 'A'), mockTrack('2', 'B'), mockTrack('3', 'C')];
    useTrackStore.getState().setTracksMeta(tracks);
    useTrackStore.getState().setCurrentTrackIndex(2); // на C

    useTrackStore.getState().removeTrack('2'); // удаляем B

    expect(useTrackStore.getState().tracksMeta).toHaveLength(2);
    expect(useTrackStore.getState().currentTrackIndex).toBe(1); // сместился
  });

  it('removeTrack последнего трека сбрасывает индекс в -1', () => {
    const tracks = [mockTrack('1', 'A')];
    useTrackStore.getState().setTracksMeta(tracks);
    useTrackStore.getState().setCurrentTrackIndex(0);

    useTrackStore.getState().removeTrack('1');

    expect(useTrackStore.getState().tracksMeta).toHaveLength(0);
    expect(useTrackStore.getState().currentTrackIndex).toBe(-1);
  });

  it('setCurrentCoverTheme обновляет тему', () => {
    const theme = { primary: '#ff0000', secondary: '#00ff00' } as any;
    useTrackStore.getState().setCurrentCoverTheme(theme);
    expect(useTrackStore.getState().currentCoverTheme).toEqual(theme);
  });

  it('setHasBlockScenes(true)', () => {
    useTrackStore.getState().setHasBlockScenes(true);
    expect(useTrackStore.getState().hasBlockScenes).toBe(true);
  });
});
