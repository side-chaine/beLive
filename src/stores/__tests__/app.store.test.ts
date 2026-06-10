import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../app.store';

describe('app.store', () => {
  beforeEach(() => {
    useAppStore.setState({ surface: 'welcome', authChecked: false });
  });

  it('начальное состояние — welcome', () => {
    const s = useAppStore.getState();
    expect(s.surface).toBe('welcome');
    expect(s.authChecked).toBe(false);
  });

  it('setSurface(app) переключает поверхность', () => {
    useAppStore.getState().setSurface('app');
    expect(useAppStore.getState().surface).toBe('app');
  });

  it('setSurface(profile) переключает на профиль', () => {
    useAppStore.getState().setSurface('profile');
    expect(useAppStore.getState().surface).toBe('profile');
  });

  it('setSurface(welcome) возвращает на welcome', () => {
    useAppStore.getState().setSurface('app');
    useAppStore.getState().setSurface('welcome');
    expect(useAppStore.getState().surface).toBe('welcome');
  });

  it('setAuthChecked(true) отмечает проверку', () => {
    useAppStore.getState().setAuthChecked(true);
    expect(useAppStore.getState().authChecked).toBe(true);
  });
});
