import { describe, it, expect, beforeEach } from 'vitest';
import {
  useMvsepKeyStore,
  migrateMvsepKeyFromProfile,
  MVSEP_KEY_STORAGE_NAME,
} from '../mvsep-key.store';
import { useUserProfileStore } from '../user-profile.store';

function guestProfile(extra: Record<string, unknown> = {}) {
  useUserProfileStore.setState({
    currentUser: {
      id: 'guest-1', name: 'Гость', createdAt: '', lastSeenAt: '', isGuest: true, ...extra,
    } as any,
  });
}

beforeEach(() => {
  useMvsepKeyStore.getState().clearApiKey();
  guestProfile();
});

describe('mvsep-key.store (D5, Q4)', () => {
  it('ключ trim-ится, пустой превращается в null', () => {
    useMvsepKeyStore.getState().setApiKey('  abc  ');
    expect(useMvsepKeyStore.getState().apiKey).toBe('abc');
    useMvsepKeyStore.getState().setApiKey('   ');
    expect(useMvsepKeyStore.getState().apiKey).toBeNull();
  });

  it('ключ персистится отдельным ключом localStorage', () => {
    useMvsepKeyStore.getState().setApiKey('abc');
    const raw = localStorage.getItem(MVSEP_KEY_STORAGE_NAME);
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw!).state.apiKey).toBe('abc');
  });

  it('I8: ключ переживает гость → логин (createOAuthProfile пересоздаёт профиль)', () => {
    useMvsepKeyStore.getState().setApiKey('abc');

    useUserProfileStore.getState().createOAuthProfile({
      name: 'Nikita', email: 'n@x.io', serverId: 'srv-1', authToken: 'jwt',
    } as any);

    expect(useUserProfileStore.getState().currentUser?.isGuest).toBe(false);
    expect(useMvsepKeyStore.getState().apiKey).toBe('abc');
  });

  it('I8: ключ переживает логаут (решение Q4)', () => {
    useMvsepKeyStore.getState().setApiKey('abc');
    useUserProfileStore.getState().logout();
    expect(useMvsepKeyStore.getState().apiKey).toBe('abc');
  });

  it('удаляется только явным clearApiKey — и из localStorage тоже', () => {
    useMvsepKeyStore.getState().setApiKey('abc');
    useMvsepKeyStore.getState().clearApiKey();
    expect(useMvsepKeyStore.getState().apiKey).toBeNull();
    expect(JSON.parse(localStorage.getItem(MVSEP_KEY_STORAGE_NAME)!).state.apiKey).toBeNull();
  });
});

describe('миграция из профиля', () => {
  it('переносит старый currentUser.mvsepApiKey и обнуляет его в профиле', () => {
    guestProfile({ mvsepApiKey: ' old-key ' });

    expect(migrateMvsepKeyFromProfile()).toBe(true);

    expect(useMvsepKeyStore.getState().apiKey).toBe('old-key');
    expect(useUserProfileStore.getState().currentUser?.mvsepApiKey).toBeNull();
  });

  it('не затирает уже сохранённый ключ, но чистит дубль в профиле', () => {
    useMvsepKeyStore.getState().setApiKey('new-key');
    guestProfile({ mvsepApiKey: 'old-key' });

    migrateMvsepKeyFromProfile();

    expect(useMvsepKeyStore.getState().apiKey).toBe('new-key');
    expect(useUserProfileStore.getState().currentUser?.mvsepApiKey).toBeNull();
  });

  it('идемпотентна: без старого ключа ничего не делает', () => {
    expect(migrateMvsepKeyFromProfile()).toBe(false);
    expect(useMvsepKeyStore.getState().apiKey).toBeNull();
  });
});
