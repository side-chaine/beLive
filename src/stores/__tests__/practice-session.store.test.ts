import { describe, it, expect, beforeEach, vi } from 'vitest';

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

vi.mock('../../practice/practice-scenarios', () => ({
  BLOCK_TYPE_NAMES: {},
  PracticeScenarioId: {},
  PracticeContext: {},
  PracticeProgress: {},
}));

import { usePracticeStore } from '../practice-session.store';

describe('practice-session.store', () => {
  beforeEach(() => {
    usePracticeStore.setState({
      isActive: false,
      scenarioId: null,
      targetBlockId: null,
      snapshot: null,
      label: null,
      passLabel: null,
      passesCount: 0,
      currentRate: 1,
      practiceStatus: 'idle',
      totalExpectedPasses: 0,
      isAutoAdvance: false,
      isPassInProgress: false,
    });
  });

  it('начальное состояние — idle', () => {
    const s = usePracticeStore.getState();
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
