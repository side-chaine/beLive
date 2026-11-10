/**
 * First Path — предпроверка файла до отправки.
 *
 * Смысл: отказ должен приходить на этапе перетаскивания, а не после того, как
 * трек улетел на MVSEP и сжёг квоту. Проверяем ровно этот слой.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../services/auth.service', () => ({
  authService: { refreshSession: vi.fn(), applySession: vi.fn() },
}));

import { checkFirstPathFile, FIRST_PATH_REJECT_TEXT } from '../first-path.service';
import { useUserProfileStore } from '../../stores/user-profile.store';
import { useMvsepKeyStore } from '../../stores/mvsep-key.store';
import { useMvsepStore } from '../../stores/mvsep.store';

const fakeFile = (name: string, size = 1024) => ({ name, size } as File);

beforeEach(() => {
  useMvsepKeyStore.getState().clearApiKey();
  useMvsepStore.setState({ activeJobs: new Map() });
  useUserProfileStore.setState({
    isGuest: false,
    currentUser: {
      id: 'u1', name: 'Test', createdAt: '', lastSeenAt: '', isGuest: false, authToken: 'tok',
    },
  });
  localStorage.removeItem('belive:mvsep-usage');
});

describe('checkFirstPathFile', () => {
  it('не аудио — отказ до отправки', () => {
    expect(checkFirstPathFile(fakeFile('track.txt'))).toBe('not_audio');
  });

  it('больше 50 МБ — отказ до отправки', () => {
    expect(checkFirstPathFile(fakeFile('track.mp3', 51 * 1024 * 1024))).toBe('too_large');
  });

  it('гость — auth_required', () => {
    useUserProfileStore.setState({ isGuest: true });
    expect(checkFirstPathFile(fakeFile('track.mp3'))).toBe('auth_required');
  });

  it('лимит 10/10 исчерпан — limit_reached', () => {
    localStorage.setItem(
      'belive:mvsep-usage',
      JSON.stringify({ count: 10, date: new Date().toISOString().slice(0, 10) }),
    );
    expect(checkFirstPathFile(fakeFile('track.mp3'))).toBe('limit_reached');
  });

  it('идёт другой трек на общем ключе — concurrent', () => {
    useMvsepStore.getState().addJob('h1', 1, 'other.mp3', 'beLive');
    useMvsepStore.getState().updateJobStatus('h1', 'processing');
    expect(checkFirstPathFile(fakeFile('track.mp3'))).toBe('concurrent');
  });

  it('нормальный файл — пропускаем', () => {
    expect(checkFirstPathFile(fakeFile('track.wav'))).toBeNull();
  });

  it('у каждого кода отказа есть человеческий текст', () => {
    for (const text of Object.values(FIRST_PATH_REJECT_TEXT)) {
      expect(typeof text).toBe('string');
      expect(text.length).toBeGreaterThan(0);
    }
  });
});
