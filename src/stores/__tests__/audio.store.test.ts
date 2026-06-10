import { describe, it, expect, beforeEach } from 'vitest';
import { useAudioStore } from '../audio.store';

describe('audio.store', () => {
  beforeEach(() => {
    useAudioStore.setState({
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      hasVocals: false,
      playbackRate: 1,
      vocalMixEnabled: false,
      micEnabled: false,
      micVolume: 1,
    });
  });

  it('начальное состояние — idle', () => {
    const s = useAudioStore.getState();
    expect(s.isPlaying).toBe(false);
    expect(s.currentTime).toBe(0);
    expect(s.playbackRate).toBe(1);
  });

  it('setPlaying(true) запускает воспроизведение', () => {
    useAudioStore.getState().setPlaying(true);
    expect(useAudioStore.getState().isPlaying).toBe(true);
  });

  it('setCurrentTime обновляет позицию', () => {
    useAudioStore.getState().setCurrentTime(42);
    expect(useAudioStore.getState().currentTime).toBe(42);
  });

  it('setDuration обновляет длительность', () => {
    useAudioStore.getState().setDuration(180);
    expect(useAudioStore.getState().duration).toBe(180);
  });

  it('setPlaybackRate(1.5) ускоряет', () => {
    useAudioStore.getState().setPlaybackRate(1.5);
    expect(useAudioStore.getState().playbackRate).toBe(1.5);
  });

  it('setVocalMixEnabled(true) включает вокал микс', () => {
    useAudioStore.getState().setVocalMixEnabled(true);
    expect(useAudioStore.getState().vocalMixEnabled).toBe(true);
  });

  it('setMicEnabled(true) включает микрофон', () => {
    useAudioStore.getState().setMicEnabled(true);
    expect(useAudioStore.getState().micEnabled).toBe(true);
  });

  it('W4a: instrumentalVolume/ vocalsVolume отсутствуют', () => {
    const s = useAudioStore.getState() as any;
    expect(s.instrumentalVolume).toBeUndefined();
    expect(s.vocalsVolume).toBeUndefined();
  });
});
