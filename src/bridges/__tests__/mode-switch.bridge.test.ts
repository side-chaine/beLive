// src/bridges/__tests__/mode-switch.bridge.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Моки для всех импортов mode-switch.bridge.ts
vi.mock('../../stores/textStyle.store', () => ({
  useTextStyleStore: { getState: () => ({ setStyleId: vi.fn() }) },
}));

vi.mock('../../stores/markers.store', () => ({
  useMarkersStore: { getState: () => ({}) },
}));

vi.mock('../../stem/stem.store', () => ({
  useStemStore: { getState: () => ({ stemsMode: 'performance' }) },
}));

vi.mock('../../stem/stemTypes', () => ({
  BUILTIN_STEMS: [],
  MODE_STEM_POLICIES: {},
}));

vi.mock('@/services/idb.service', () => ({
  storage: { getItem: vi.fn(), setItem: vi.fn() },
}));

// Моки store, которые реально использует bridge
const mockSetActiveMode = vi.fn();
vi.mock('../../stores/mode.store', () => ({
  useModeStore: {
    getState: () => ({ activeMode: 'rehearsal', setActiveMode: mockSetActiveMode }),
  },
}));

describe('mode-switch.bridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.className = '';
    // ⚡ window.app обязателен — иначе ранний exit
    (window as any).app = {};
    (window as any).audioEngine = { currentTime: 42 };
  });

  it('switchMode(karaoke) устанавливает DOM-класс и диспатчит событие', async () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    const { switchMode } = await import('../mode-switch.bridge');
    switchMode('karaoke');

    // DOM class set
    expect(document.body.classList.contains('mode-karaoke')).toBe(true);
    // Event dispatched
    expect(dispatchSpy).toHaveBeenCalled();
    const event = dispatchSpy.mock.calls[0][0] as CustomEvent;
    expect(event.detail.to).toBe('karaoke');
  });

  it('switchMode(concert) диспатчит событие на window', async () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    const { switchMode } = await import('../mode-switch.bridge');
    switchMode('concert');

    expect(dispatchSpy).toHaveBeenCalled();
    const event = dispatchSpy.mock.calls[0][0] as CustomEvent;
    expect(event.type).toBe('mode-changed');
    expect(event.detail.to).toBe('concert');
  });

  it('switchMode(live) сохраняет currentTime аудиодвижка', async () => {
    const { switchMode } = await import('../mode-switch.bridge');
    switchMode('live');
    
    expect((window as any).audioEngine.currentTime).toBe(42);
  });
});
