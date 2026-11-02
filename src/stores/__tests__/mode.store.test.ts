import { describe, it, expect, vi } from 'vitest';
import { useModeStore } from '../mode.store';

// Тавтология снята: beforeEach писал mode='rehearsal', тест это же и проверял.
describe('mode.store', () => {
  it('начальное состояние — rehearsal (реальный инициализатор)', async () => {
    // resetModules + динамический импорт: стор создаётся заново настоящим
    // инициализатором, а не значением, которое тест сам же и записал выше.
    vi.resetModules();
    const store = (await import('../mode.store')).useModeStore;
    expect(store.getState().mode).toBe('rehearsal');
  });

  it('setMode(karaoke) переключает режим', () => {
    useModeStore.getState().setMode('karaoke');
    expect(useModeStore.getState().mode).toBe('karaoke');
  });

  it('setMode(concert) переключает на concert', () => {
    useModeStore.getState().setMode('concert');
    expect(useModeStore.getState().mode).toBe('concert');
  });

  it('setMode(live) переключает на live', () => {
    useModeStore.getState().setMode('live');
    expect(useModeStore.getState().mode).toBe('live');
  });

  it('повторный setMode с тем же значением не меняет', () => {
    useModeStore.getState().setMode('karaoke');
    useModeStore.getState().setMode('karaoke');
    expect(useModeStore.getState().mode).toBe('karaoke');
  });
});
