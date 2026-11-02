import { describe, it, expect } from 'vitest';
import { freshStore } from '../../test/fresh-store';
import { useAppStore } from '../app.store';

// Тавтология снята: раньше здесь стоял
//   beforeEach(() => useAppStore.setState({ surface: 'welcome', authChecked: false }))
// и следующий тест проверял именно эти два значения — то есть setState
// сравнивался со своим же аргументом. Дефолт в сторе мог стать любым,
// тест оставался зелёным.
describe('app.store', () => {
  it('начальное состояние — welcome, authChecked=false (реальный инициализатор)', async () => {
    const store = await freshStore(async () => (await import('../app.store')).useAppStore);
    expect(store.getState().surface).toBe('welcome');
    expect(store.getState().authChecked).toBe(false);
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
