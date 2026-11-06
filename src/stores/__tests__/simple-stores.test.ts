import { describe, it, expect } from 'vitest';

// ─────────────────────────────────────────────────────────────────────────────
// Правило: НЕ вызывать setState в beforeEach (см. medium-stores.test.ts).
// Тест читает начальное состояние стора, а не то, что сам в него записал.
// ─────────────────────────────────────────────────────────────────────────────

// ─── blocks.store ───
import { useBlocksStore } from '../blocks.store';
describe('blocks.store', () => {
  it('начальное состояние — блоков нет', () => {
    const s = useBlocksStore.getState();
    expect(s.blocks).toEqual([]);
    expect(s.blockCount).toBe(0);
  });
});

// ─── camera.store ───
import { useCameraStore } from '../camera.store';
describe('camera.store', () => {
  it('начальное состояние — камера выключена, потока нет', () => {
    const s = useCameraStore.getState();
    expect(s.cameraOn).toBe(false);
    expect(s.facingMode).toBe('user');
    expect(s.stream).toBeNull();
    expect(s.error).toBeNull();
  });
});

// ─── piano.store ───
import { usePianoStore } from '../piano.store';
describe('piano.store', () => {
  it('начальное состояние — пианино скрыто, микрофон не активен', () => {
    const s = usePianoStore.getState();
    expect(s.open).toBe(false);
    expect(s.micActive).toBe(false);
  });
});

// ─── plate.store ───
import { usePlateStore } from '../plate.store';
describe('plate.store', () => {
  it('начальное состояние — дефолтные размеры плашки', () => {
    const s = usePlateStore.getState();
    expect(s.width).toBe(80);
    expect(s.coverBg).toBe(true);
    expect(s.useAutoBg).toBe(true);
    expect(s.glowIntensity).toBe(40);
    expect(s.vignetteIntensity).toBe(30);
    expect(s.transitionPreset).toBe('smooth');
  });
});

// ─── recording.store ───
import { useRecordingStore } from '../recording.store';
describe('recording.store', () => {
  it('начальное состояние — не записывает', () => {
    const s = useRecordingStore.getState();
    expect(s.isRecording).toBe(false);
    expect(s.duration).toBe(0);
    expect(s.error).toBeNull();
  });
});

// ─── deck.store ───
import { useDeckStore } from '../deck.store';
describe('deck.store', () => {
  it('начальное состояние — док свёрнут, вкладки нет', () => {
    const s = useDeckStore.getState();
    expect(s.expanded).toBe(false);
    expect(s.activeTabId).toBe('');
    expect(s.pianoWasOpen).toBe(false);
    expect(s.visualMode).toBe(false);
  });
});
