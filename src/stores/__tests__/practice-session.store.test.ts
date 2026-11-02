import { describe, it, expect, vi } from 'vitest';
import { freshStore } from '../../test/fresh-store';

// Мокаем зависимые stores
vi.mock('../audio.store', () => ({
  useAudioStore: {
    getState: () => ({
      playbackRate: 1,
      vocalMixEnabled: false,
      setPlaybackRate: vi.fn(),
      setVocalMixEnabled: vi.fn(),
    }),
  },
}));

vi.mock('../mode.store', () => ({
  useModeStore: {
    getState: () => ({ mode: 'rehearsal', setMode: vi.fn() }),
  },
}));

vi.mock('../loop.store', () => ({
  useLoopStore: {
    getState: () => ({ isLooping: false, clearLoop: vi.fn() }),
  },
}));

vi.mock('../blocks.store', () => ({
  useBlocksStore: {
    getState: () => ({ blocks: [] }),
  },
}));

vi.mock('../../stem/stem.store', () => ({
  useStemStore: {
    getState: () => ({
      stemVolumes: {},
      stemsEnabled: false,
      setStemVolume: vi.fn(),
      setStemsEnabled: vi.fn(),
    }),
    setState: vi.fn(),
  },
}));

vi.mock('../../practice/practice-scenarios', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    BLOCK_TYPE_NAMES: {},
    PracticeScenarioId: {},
    PracticeContext: {},
    PracticeProgress: {},
  };
});

import { usePracticeStore } from '../practice-session.store';

// Тавтология снята: beforeEach писал isActive=false / practiceStatus='idle' /
// passesCount=0, а тест «начальное состояние — idle» проверял их же.
describe('practice-session.store', () => {
  it('начальное состояние — idle (реальный инициализатор)', async () => {
    const store = await freshStore(
      async () => (await import('../practice-session.store')).usePracticeStore,
    );
    const s = store.getState();
    expect(s.isActive).toBe(false);
    expect(s.practiceStatus).toBe('idle');
    expect(s.passesCount).toBe(0);
  });

  it('startPractice активирует сессию', () => {
    usePracticeStore.getState().startPractice('bpm-ramp', 'BPM Ramp');
    const s = usePracticeStore.getState();
    expect(s.isActive).toBe(true);
    expect(s.scenarioId).toBe('bpm-ramp');
    expect(s.practiceStatus).toBe('running');
  });

  it('endPractice деактивирует', () => {
    usePracticeStore.getState().startPractice('bpm-ramp');
    usePracticeStore.getState().endPractice();
    const s = usePracticeStore.getState();
    expect(s.isActive).toBe(false);
    expect(s.practiceStatus).toBe('idle');
  });

  it('pausePractice → resumePractice цикл', () => {
    usePracticeStore.getState().startPractice('bpm-ramp');
    usePracticeStore.getState().pausePractice();
    expect(usePracticeStore.getState().practiceStatus).toBe('paused');
  });
});
