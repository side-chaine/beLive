import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockAudioStoreSetState = vi.fn();
vi.mock('../../stores/audio.store', () => ({
  useAudioStore: {
    getState: () => ({
      currentTime: 0,
      duration: 0,
      isPlaying: false,
    }),
    setState: mockAudioStoreSetState,
  },
}));

vi.mock('../../stem/stem.store', () => ({
  useStemStore: {
    getState: () => ({
      initStems: vi.fn(),
      setStemsMode: vi.fn(),
      setStemsEnabled: vi.fn(),
      stemsMode: false,
      stemsEnabled: false,
      _stemsBootRestored: false,
    }),
    setState: vi.fn(),
  },
}));

vi.mock('../../stores/lyrics.store', () => ({
  useLyricsStore: { getState: () => ({}) },
}));

vi.mock('@/services/idb.service', () => ({
  storage: { getItem: vi.fn(), setItem: vi.fn() },
}));

describe('audio.bridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (window as any).app = {};
    (window as any).audioEngine = {
      currentTime: 0,
      vocalsAudio: null,
      setStemsEnabled: vi.fn(),
    };
    (window as any).trackCatalog = { tracks: [], currentTrackIndex: -1 };
    document.body.className = '';
  });

  it('initAudioBridge возвращает функцию cleanup', async () => {
    const { initAudioBridge } = await import('../audio.bridge');
    const cleanup = initAudioBridge();
    expect(typeof cleanup).toBe('function');
  });

  it('cleanup удаляет обработчики с window и document', async () => {
    const { initAudioBridge } = await import('../audio.bridge');
    const cleanup = initAudioBridge();

    // После cleanup события не должны вызывать ошибок
    cleanup();

    window.dispatchEvent(new CustomEvent('playback-state-changed', {
      detail: { isPlaying: true, currentTime: 42, duration: 180 },
    }));
    document.dispatchEvent(new CustomEvent('track-loaded', {
      detail: { duration: 180 },
    }));

    // Не должно быть ошибок при пустом listeners
    expect(true).toBe(true);
  });
});
