import { describe, it, expect, vi } from 'vitest';
import { useAppStore } from '../app.store';

// Тавтология снята: раньше здесь стоял
//   beforeEach(() => useAppStore.setState({ surface: 'welcome', authChecked: false }))
// и следующий тест проверял именно эти два значения — то есть setState
// сравнивался со своим же аргументом. Дефолт в сторе мог стать любым,
// тест оставался зелёным.
describe('app.store', () => {
  it('начальное состояние — welcome, authChecked=false (реальный инициализатор)', async () => {
    // resetModules + динамический импорт: стор создаётся заново настоящим
    // инициализатором, а не значением, которое тест сам же и записал выше.
    vi.resetModules();
    const store = (await import('../app.store')).useAppStore;
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
