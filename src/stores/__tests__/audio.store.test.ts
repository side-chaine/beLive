import { describe, it, expect } from 'vitest';
import { freshStore } from '../../test/fresh-store';
import { useAudioStore } from '../audio.store';

// Тавтология снята: beforeEach писал isPlaying=false / currentTime=0 /
// playbackRate=1, тест «начальное состояние — idle» проверял их же.
describe('audio.store', () => {
  it('начальное состояние — idle (реальный инициализатор)', async () => {
    const store = await freshStore(async () => (await import('../audio.store')).useAudioStore);
    const s = store.getState();
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
