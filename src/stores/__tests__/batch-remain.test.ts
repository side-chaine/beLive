import { describe, it, expect } from 'vitest';

// ─────────────────────────────────────────────────────────────────────────────
// Правило: НЕ вызывать setState в beforeEach (см. medium-stores.test.ts).
// Тест читает начальное состояние стора, а не то, что сам в него записал.
// ─────────────────────────────────────────────────────────────────────────────

// ─── ai-settings.store ───
import { useAiSettingsStore } from '../ai-settings.store';
describe('ai-settings.store', () => {
  it('начальное состояние — провайдер Belive', () => {
    const s = useAiSettingsStore.getState();
    expect(s.provider).toBe('belive');
    expect(s.openRouterApiKey).toBe('');
    expect(s.coachName).toBe('Билли');
    expect(s.temperature).toBe(0.7);
    // showSettings убран 09.11: модалка AI Configuration удалена,
    // настройки ИИ живут в комнате (SettingsBlock → AiSection).
    expect('showSettings' in s).toBe(false);
  });

  it('isConfigured — это метод, а не флаг', () => {
    // Прошлая версия делала setState({ isConfigured: false }) и проверяла
    // isConfigured === false. Но isConfigured — функция () => boolean:
    // setState ЗАМЕНЯЛ метод булевым значением, и тест это «подтверждал».
    // Для belive-провайдера метод обязан вернуть true.
    const s = useAiSettingsStore.getState();
    expect(typeof s.isConfigured).toBe('function');
    expect(s.isConfigured()).toBe(true);
  });
});

// ─── ai.store ───
import { useAiStore } from '../ai.store';
describe('ai.store', () => {
  it('начальное состояние — пустой чат', () => {
    const s = useAiStore.getState();
    expect(s.messages).toEqual([]);
    expect(s.isStreaming).toBe(false);
    expect(s.displayTarget).toBe('both');
  });
});

// ─── blockScene.store ───
import { useBlockSceneStore } from '../blockScene.store';
describe('blockScene.store', () => {
  it('начальное состояние — модалка закрыта, выбора нет', () => {
    const s = useBlockSceneStore.getState();
    expect(s.isOpen).toBe(false);
    expect(s.selectedBlockIndex).toBeNull();
    expect(s.expandedBlockIndex).toBeNull();
    expect(s.selectedLineIndex).toBeNull();
  });
});

// ─── mvsep.store ───
import { useMvsepStore } from '../mvsep.store';
describe('mvsep.store', () => {
  it('начальное состояние — задач нет, дневной счётчик пуст', () => {
    const s = useMvsepStore.getState();
    expect(s.activeJobs).toBeInstanceOf(Map);
    expect(s.activeJobs.size).toBe(0);
    expect(s.dailyUsage.count).toBe(0);
    // Дата выставляется на текущий день, а не в null.
    expect(s.dailyUsage.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// ─── trackInfo.store ───
import { useTrackInfoStore } from '../trackInfo.store';
describe('trackInfo.store', () => {
  it('начальное состояние — панель закрыта, трека нет', () => {
    const s = useTrackInfoStore.getState();
    expect(s.isOpen).toBe(false);
    expect(s.trackId).toBeNull();
    expect(s.isFirstReveal).toBe(true);
  });
});

// ─── user-profile.store ───
import { useUserProfileStore } from '../user-profile.store';
describe('user-profile.store', () => {
  it('начальное состояние — гость, не залогинен', () => {
    const s = useUserProfileStore.getState();
    expect(s.isLoggedIn).toBe(false);
    expect(s.isGuest).toBe(true);
  });
});
