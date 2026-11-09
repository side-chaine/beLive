/**
 * Настройки комнаты: графика и ИИ.
 *
 * Проверяем то, что реально может сломаться:
 *  - выбор тира пишется в performance.store и выключает автоопределение;
 *  - автоопределение переключается и отражается в бейдже;
 *  - гость видит вход, а не форму ключа (форма без аккаунта бессмысленна).
 */

import { describe, expect, it, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { GraphicsSection } from '../GraphicsSection';
import { AiSection } from '../AiSection';
import { usePerformanceStore } from '../../../../../performance/performance.store';
import { useUserProfileStore } from '../../../../../stores/user-profile.store';

const PERF_DEFAULT = {
  tier: usePerformanceStore.getState().tier,
  autoDetect: usePerformanceStore.getState().autoDetect,
  detectedTier: usePerformanceStore.getState().detectedTier,
};

afterEach(() => {
  cleanup();
  usePerformanceStore.setState(PERF_DEFAULT);
  useUserProfileStore.setState({ isGuest: true });
});

describe('GraphicsSection', () => {
  it('1. рисует 4 тира и отмечает активный', () => {
    usePerformanceStore.setState({ autoDetect: false, tier: 'balanced' });
    render(<GraphicsSection />);

    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(4);

    const balanced = screen.getByRole('radio', { name: /Balanced/ });
    expect(balanced.getAttribute('aria-checked')).toBe('true');

    const lite = screen.getByRole('radio', { name: /Lite/ });
    expect(lite.getAttribute('aria-checked')).toBe('false');
  });

  it('2. клик по тиру пишет в стор и гасит автоопределение', () => {
    usePerformanceStore.setState({ autoDetect: true, tier: 'balanced' });
    render(<GraphicsSection />);

    fireEvent.click(screen.getByRole('radio', { name: /Ultra/ }));

    const s = usePerformanceStore.getState();
    expect(s.tier).toBe('ultra');
    expect(s.autoDetect).toBe(false);
  });

  it('3. тумблер авто: включён по умолчанию, выключается кликом', () => {
    usePerformanceStore.setState({ autoDetect: true });
    render(<GraphicsSection />);

    const sw = screen.getByRole('switch', { name: /Автоопределение/ });
    expect(sw.getAttribute('aria-checked')).toBe('true');

    fireEvent.click(sw);
    expect(usePerformanceStore.getState().autoDetect).toBe(false);
  });

  it('4. при авто в бейдже видно, что выбрала система', () => {
    usePerformanceStore.setState({ autoDetect: true, detectedTier: 'max' });
    render(<GraphicsSection />);
    expect(screen.getByText(/Авто · Max/)).toBeTruthy();
  });
});

describe('AiSection', () => {
  it('5. гость — вход через Google, без полей ключа', () => {
    useUserProfileStore.setState({ isGuest: true });
    render(<AiSection />);

    expect(screen.getByRole('button', { name: 'Войти через Google' })).toBeTruthy();
    expect(screen.queryByPlaceholderText('sk-or-v1-...')).toBeNull();
  });

  it('6. залогиненный — имя коуча и раскрывашка «свой AI»', () => {
    useUserProfileStore.setState({ isGuest: false });
    render(<AiSection />);

    expect(screen.getByDisplayValue('Билли')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Настроить свой AI/ })).toBeTruthy();
    // ключ спрятан до раскрытия
    expect(screen.queryByPlaceholderText('sk-or-v1-...')).toBeNull();
  });

  it('7. раскрывашка показывает поле ключа', () => {
    useUserProfileStore.setState({ isGuest: false });
    render(<AiSection />);

    fireEvent.click(screen.getByRole('button', { name: /Настроить свой AI/ }));
    expect(screen.getByPlaceholderText('sk-or-v1-...')).toBeTruthy();
  });
});
