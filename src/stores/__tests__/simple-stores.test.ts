import { describe, it, expect, beforeEach } from 'vitest';

// ─── blocks.store ───
import { useBlocksStore } from '../blocks.store';
describe('blocks.store', () => {
  beforeEach(() => useBlocksStore.setState({ blocks: [], typeCounts: {} }));
  it('начальное состояние — пусто', () => {
    expect(useBlocksStore.getState().blocks).toEqual([]);
  });
});

// ─── camera.store ───
import { useCameraStore } from '../camera.store';
describe('camera.store', () => {
  beforeEach(() => useCameraStore.setState({ cameraActive: false }));
  it('начальное состояние — камера выключена', () => {
    expect(useCameraStore.getState().cameraActive).toBe(false);
  });
});

// ─── piano.store ───
import { usePianoStore } from '../piano.store';
describe('piano.store', () => {
  beforeEach(() => usePianoStore.setState({ pianoOpen: false }));
  it('начальное состояние — пианино скрыто', () => {
    expect(usePianoStore.getState().pianoOpen).toBe(false);
  });
});

// ─── plate.store ───
import { usePlateStore } from '../plate.store';
describe('plate.store', () => {
  beforeEach(() => usePlateStore.setState({ activePresetId: null, isAnimating: false }));
  it('начальное состояние — без пресета', () => {
    expect(usePlateStore.getState().activePresetId).toBeNull();
  });
});

// ─── recording.store ───
import { useRecordingStore } from '../recording.store';
describe('recording.store', () => {
  beforeEach(() => useRecordingStore.setState({ isRecording: false, isPaused: false }));
  it('начальное состояние — не записывает', () => {
    expect(useRecordingStore.getState().isRecording).toBe(false);
  });
});

// ─── deck.store ───
import { useDeckStore } from '../deck.store';
describe('deck.store', () => {
  beforeEach(() => useDeckStore.setState({ activeTab: null }));
  it('начальное состояние — нет активной вкладки', () => {
    expect(useDeckStore.getState().activeTab).toBeNull();
  });
});
