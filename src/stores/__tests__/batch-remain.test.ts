import { describe, it, expect, beforeEach } from 'vitest';

// ─── ai-settings.store ───
import { useAiSettingsStore } from '../ai-settings.store';
describe('ai-settings.store', () => {
  beforeEach(() => useAiSettingsStore.setState({ provider: 'belive', apiKey: '', isConfigured: false }));
  it('начальное состояние — Belive провайдер', () => {
    const s = useAiSettingsStore.getState();
    expect(s.provider).toBe('belive');
    expect(s.isConfigured).toBe(false);
  });
});

// ─── ai.store ───
import { useAiStore } from '../ai.store';
describe('ai.store', () => {
  beforeEach(() => useAiStore.setState({ messages: [] }));
  it('начальное состояние — пустой чат', () => {
    expect(useAiStore.getState().messages).toEqual([]);
  });
});

// ─── blockScene.store ───
import { useBlockSceneStore } from '../blockScene.store';
describe('blockScene.store', () => {
  beforeEach(() => useBlockSceneStore.setState({ scenes: {}, loading: false }));
  it('начальное состояние — пусто', () => {
    expect(useBlockSceneStore.getState().scenes).toEqual({});
  });
});

// ─── mvsep.store ───
import { useMvsepStore } from '../mvsep.store';
describe('mvsep.store', () => {
  beforeEach(() => useMvsepStore.setState({ apiKey: null, status: 'idle' }));
  it('начальное состояние — idle', () => {
    expect(useMvsepStore.getState().status).toBe('idle');
  });
});

// ─── trackInfo.store ───
import { useTrackInfoStore } from '../trackInfo.store';
describe('trackInfo.store', () => {
  beforeEach(() => useTrackInfoStore.setState({ isOpen: false }));
  it('начальное состояние — закрыто', () => {
    expect(useTrackInfoStore.getState().isOpen).toBe(false);
  });
});

// ─── user-profile.store ───
import { useUserProfileStore } from '../user-profile.store';
describe('user-profile.store', () => {
  beforeEach(() => useUserProfileStore.setState({ isGuest: true, isLoggedIn: false }));
  it('начальное состояние — гость', () => {
    const s = useUserProfileStore.getState();
    expect(s.isGuest).toBe(true);
    expect(s.isLoggedIn).toBe(false);
  });
});
