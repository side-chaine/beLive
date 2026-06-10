import { describe, it, expect, beforeEach } from 'vitest';
import { useModeStore } from '../mode.store';

describe('mode.store', () => {
  beforeEach(() => {
    useModeStore.setState({ mode: 'rehearsal' });
  });

  it('начальное состояние — rehearsal', () => {
    expect(useModeStore.getState().mode).toBe('rehearsal');
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
