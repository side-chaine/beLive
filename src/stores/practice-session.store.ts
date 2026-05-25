/**
 * Practice Session Store — Wave G
 * Manages snapshot/restore lifecycle for practice scenarios.
 * Captures player state before a practice run and restores it after.
 */

import { create } from 'zustand';
import { useAudioStore } from './audio.store';
import { useModeStore } from './mode.store';
import { useLoopStore } from './loop.store';
import { useBlocksStore } from './blocks.store';
import { useStemStore } from '../stem/stem.store';
import type { PracticeScenarioId, PracticeContext, PracticeProgress } from '../practice/practice-scenarios';
import { BLOCK_TYPE_NAMES } from '../practice/practice-scenarios';

/* ═══ Types ═══ */

export interface PracticeSnapshot {
  playbackRate: number;
  mode: string;
  stemVolumes: Record<string, number>;
  hadLoop: boolean;
  vocalMixEnabled: boolean;
  stemsEnabled: boolean;
}

export interface PracticeSessionState {
  /** Whether a practice session is currently active */
  isActive: boolean;
  /** Current scenario ID (e.g. 'bpm-ramp', 'focus-mix') */
  scenarioId: string | null;
  /** Block ID being practiced (for TrackMap highlight) */
  targetBlockId: string | null;
  /** Snapshot captured at session start */
  snapshot: PracticeSnapshot | null;
  /** Human-readable label for the current practice */
  label: string | null;
  /** Current pass description (e.g. "80%", "Только минус", "Куплет") */
  passLabel: string | null;

  // ── Progress Tracking (Wave G) ──
  /** Number of completed passes */
  passesCount: number;
  /** Current playback rate for progress bar */
  currentRate: number;
  /** Session lifecycle status */
  practiceStatus: 'idle' | 'running' | 'paused' | 'completed';

  /** Actions */
  startPractice: (scenarioId: string, label?: string, preCapturedSnapshot?: PracticeSnapshot, targetBlockId?: string) => void;
  endPractice: () => void;
  cancelPractice: () => void;
  completeAndKeep: () => void;
  restoreAndCancel: (preCapturedSnapshot: PracticeSnapshot) => void;
  getSnapshot: () => PracticeSnapshot;

  // ── Progress Actions ──
  /** Execute perPassActions, increment passes + rate */
  nextPass: () => Promise<void>;
  /** Keep same tempo, don't increment */
  repeatPass: () => void;
  /** Pause the session (store state only) */
  pausePractice: () => void;
  /** Resume from paused */
  resumePractice: () => Promise<void>;
  /** Run onCompleteActions, then set completed */
  completePractice: () => Promise<void>;

  // ── UI State ──
  totalExpectedPasses: number;
  isAutoAdvance: boolean;
  isPassInProgress: boolean;
  toggleAutoAdvance: () => void;
}

/* ═══ Snapshot Capture ═══ */

/**
 * Capture current player state for later restore.
 */
function captureSnapshot(): PracticeSnapshot {
  const audioState = useAudioStore.getState();
  const modeState = useModeStore.getState();
  const stemState = useStemStore.getState();
  const loopState = useLoopStore.getState();

  return {
    playbackRate: audioState.playbackRate ?? 1,
    mode: modeState.mode,
    stemVolumes: { ...stemState.stemVolumes },
    hadLoop: loopState.isLooping,
    vocalMixEnabled: audioState.vocalMixEnabled ?? false,
    stemsEnabled: stemState.stemsEnabled,
  };
}

/**
 * Restore a previously captured snapshot.
 */
function restoreSnapshot(snapshot: PracticeSnapshot): void {
  const audioState = useAudioStore.getState();
  const stemState = useStemStore.getState();
  const loopState = useLoopStore.getState();

  // 1. Restore playback rate
  if (snapshot.playbackRate !== undefined) {
    audioState.setPlaybackRate(snapshot.playbackRate);
    const ae = (window as any).audioEngine;
    if (ae?.setPlaybackRate) {
      ae.setPlaybackRate(snapshot.playbackRate);
    }
  }

  // 2. Restore stem volumes
  if (snapshot.stemVolumes) {
    for (const [stemId, vol] of Object.entries(snapshot.stemVolumes)) {
      stemState.setStemVolume(stemId, vol);
      const ae = (window as any).audioEngine;
      if (ae?.setStemVolume) {
        ae.setStemVolume(stemId, vol);
      }
    }
  }

  // 3. Restore vocal mix
  if (snapshot.vocalMixEnabled !== undefined) {
    audioState.setVocalMixEnabled(snapshot.vocalMixEnabled);
    const ae = (window as any).audioEngine;
    if (snapshot.vocalMixEnabled) {
      ae?.enableVocalMix?.();
    } else {
      ae?.disableVocalMix?.();
    }
  }

  // 4. Clear loop if it wasn't looping before
  if (!snapshot.hadLoop && loopState.isLooping) {
    loopState.clearLoop();
  }

  // 5. Restore mode (via bridge for full lifecycle)
  if (snapshot.mode) {
    const switchFn = (window as any).beLiveSwitchMode;
    if (switchFn) {
      switchFn(snapshot.mode);
    } else {
      useModeStore.getState().setMode(snapshot.mode as any);
    }
  }

  // 6. Restore stems enabled state
  if (snapshot.stemsEnabled !== undefined) {
    useStemStore.setState({ stemsEnabled: snapshot.stemsEnabled });
  }
}

/* ═══ Store ═══ */

// Guard flag: prevents safety sync from detecting practice's own rate changes
let _isPracticeRateChange = false;

function emitPracticeEvent(type: string, detail: unknown) {
  if (typeof document !== 'undefined') {
    document.dispatchEvent(new CustomEvent(`practice:${type}`, { detail }));
  }
}

// Auto-pass: listen for loop completion
let autoPassListener: ((e: Event) => void) | null = null;

function startAutoPassDetection() {
  if (autoPassListener) return;
  
  autoPassListener = ((e: Event) => {
    const state = usePracticeStore.getState();
    if (!state.isActive || state.practiceStatus !== 'running' || !state.isAutoAdvance) return;
    if (state.isPassInProgress) return;
    
    // Loop completed one cycle → auto +5%
    state.nextPass();
  }) as EventListener;
  
  document.addEventListener('loopcompleted', autoPassListener);
}

function stopAutoPassDetection() {
  if (autoPassListener) {
    document.removeEventListener('loopcompleted', autoPassListener);
    autoPassListener = null;
  }
}

export const usePracticeStore = create<PracticeSessionState>((set, get) => ({
  isActive: false,
  scenarioId: null,
  targetBlockId: null,
  snapshot: null,
  label: null,
  passLabel: null,
  passesCount: 0,
  currentRate: 1.0,
  practiceStatus: 'idle' as const,
  totalExpectedPasses: 4,
  isAutoAdvance: true,
  isPassInProgress: false,

  startPractice: (scenarioId, label, preCapturedSnapshot, targetBlockId) => {
    if (get().isActive) {
      get().endPractice();
    }
    const snapshot = preCapturedSnapshot || captureSnapshot();
    // Scenario-specific start rate (bpm-ramp=0.8, others=1.0)
    let startRate = 0.8;
    if (scenarioId === 'focus-mix' || scenarioId === 'section-breakdown') {
      startRate = 1.0;
    }
    let totalExpectedPasses = 4;
    if (scenarioId === 'focus-mix') {
      const stemState = useStemStore.getState();
      const musicStems = (stemState.loadedStems || []).filter(id =>
        id !== 'vocals' && id !== 'backing' && id !== 'instrumental'
      );
      totalExpectedPasses = musicStems.length;
    }
    else if (scenarioId === 'section-breakdown') {
      const blocks = useBlocksStore.getState().blocks || [];
      totalExpectedPasses = blocks.length || 4;
    }
    set({
      isActive: true,
      scenarioId,
      targetBlockId: targetBlockId ?? null,
      snapshot,
      label: label ?? scenarioId,
      passesCount: 0,
      currentRate: startRate,
      practiceStatus: 'running',
      totalExpectedPasses,
      isAutoAdvance: true,
      isPassInProgress: false,
      passLabel: scenarioId === 'focus-mix' ? 'Полный микс' : null,
    });
    startAutoPassDetection();
    emitPracticeEvent('started', { scenarioId });
  },

  endPractice: () => {
    stopAutoPassDetection();
    const s = get();
    if (s.snapshot) {
      restoreSnapshot(s.snapshot);
    }
    emitPracticeEvent('ended', { scenarioId: s.scenarioId });
    set({
      isActive: false, scenarioId: null, targetBlockId: null, snapshot: null, label: null,
      passesCount: 0, currentRate: 1.0, practiceStatus: 'idle',
    });
  },

  completeAndKeep: () => {
    stopAutoPassDetection();
    if (!get().isActive) return;
    const loopState = useLoopStore.getState();
    if (loopState.isLooping) {
      loopState.clearLoop();
    }
    emitPracticeEvent('completed-kept', { passesCount: get().passesCount });
    set({
      isActive: false, scenarioId: null, targetBlockId: null, snapshot: null, label: null,
      passesCount: 0, currentRate: 1.0, practiceStatus: 'idle',
    });
  },

  toggleAutoAdvance: () => {
    const current = get().isAutoAdvance;
    set({ isAutoAdvance: !current });
    emitPracticeEvent(current ? 'auto-paused' : 'auto-resumed', {});
  },

  cancelPractice: () => {
    stopAutoPassDetection();
    const s = get();
    if (s.practiceStatus !== 'idle') {
      emitPracticeEvent('cancelled', { scenarioId: s.scenarioId });
    }
    set({
      isActive: false, scenarioId: null, targetBlockId: null, snapshot: null, label: null,
      passesCount: 0, currentRate: 1.0, practiceStatus: 'idle',
    });
  },

  restoreAndCancel: (preCapturedSnapshot) => {
    stopAutoPassDetection();
    try {
      restoreSnapshot(preCapturedSnapshot);
    } catch {
      // Best effort — session cleaned regardless
    }
    set({
      isActive: false, scenarioId: null, targetBlockId: null, snapshot: null, label: null,
      passesCount: 0, currentRate: 1.0, practiceStatus: 'idle',
    });
    emitPracticeEvent('cancelled', { reason: 'partial-failure' });
  },

  getSnapshot: () => {
    return captureSnapshot();
  },

  nextPass: async () => {
    const s = get();
    if (!s.isActive || s.practiceStatus !== 'running') return;
    if (s.isPassInProgress) return; // ★ GUARD ★
    
    set({ isPassInProgress: true });
    
    try {
      const { getScenario } = await import('../practice/practice-scenarios');
      const { runPracticeActions } = await import('../practice/billy-action-runner');
      const scenario = getScenario(s.scenarioId as PracticeScenarioId);
      if (!scenario) return;

      const newPasses = s.passesCount + 1;
      const newRate = Math.min(1.0, s.currentRate + 0.05);

      const progress: PracticeProgress = {
        currentRate: newRate,
        totalPasses: newPasses,
        completedBlockIds: [],
      };

      const ctx: PracticeContext = {};
      const actions = typeof scenario.perPassActions === 'function'
        ? scenario.perPassActions(ctx, progress)
        : scenario.perPassActions;

      // ★ SET FLAG: rate change is from practice, not external ★
      _isPracticeRateChange = true;
      
      try {
        if (actions.length > 0) {
          const results = await runPracticeActions({ actions });
          if (!results.every(r => r.result.success)) return;
        }
      } finally {
        _isPracticeRateChange = false;
      }

      // Verify loop still active
      const loopState = useLoopStore.getState();
      if (!loopState.isLooping && s.snapshot?.hadLoop) {
        console.warn('[PracticeStore] Loop cleared during nextPass');
      }

      // Compute passLabel based on scenario
      let passLabel: string | null = null;
      if (s.scenarioId === 'focus-mix') {
        const stemState = useStemStore.getState();
        const musicStems = (stemState.loadedStems || []).filter(id =>
          id !== 'vocals' && id !== 'backing' && id !== 'instrumental'
        );
        const RU_STEM_LABELS: Record<string, string> = {
          bass: 'Бас', drums: 'Барабаны', guitar: 'Гитара', keys: 'Клавиши', other: 'Прочее',
        };
        const focusIndex = newPasses - 1;
        if (focusIndex >= 0 && focusIndex < musicStems.length) {
          const stemId = musicStems[focusIndex];
          passLabel = `Вокал + ${RU_STEM_LABELS[stemId] || stemId}`;
        }
      } else if (s.scenarioId === 'section-breakdown') {
        const blocks = useBlocksStore.getState().blocks || [];
        const currentBlock = blocks[newPasses];
        if (currentBlock) {
          passLabel = BLOCK_TYPE_NAMES[currentBlock.type] || currentBlock.type;
        }
      } else if (s.scenarioId === 'bpm-ramp') {
        passLabel = `${Math.round(newRate * 100)}%`;
      }

      set({ passesCount: newPasses, currentRate: newRate, passLabel });
      emitPracticeEvent('pass-complete', { passesCount: newPasses, currentRate: newRate, passLabel });

      // Check completion
      if (scenario.isComplete(progress, ctx)) {
        const completeActions = typeof scenario.onCompleteActions === 'function'
          ? scenario.onCompleteActions(ctx, progress)
          : scenario.onCompleteActions;
        if (completeActions.length > 0) {
          await runPracticeActions({ actions: completeActions });
        }
        set({ practiceStatus: 'completed' });
        emitPracticeEvent('completed', { passesCount: newPasses, currentRate: newRate });
      }
    } finally {
      set({ isPassInProgress: false });
    }
  },

  repeatPass: () => {
    // Stay at same tempo, don't increment passes
    // User wants another attempt at same level
  },

  pausePractice: () => {
    set({ practiceStatus: 'paused' });
  },

  resumePractice: async () => {
    set({ practiceStatus: 'running' });
  },

  completePractice: async () => {
    const s = get();
    const { getScenario } = await import('../practice/practice-scenarios');
    const { runPracticeActions } = await import('../practice/billy-action-runner');
    const scenario = s.scenarioId ? getScenario(s.scenarioId as PracticeScenarioId) : null;

    if (scenario) {
      const progress: PracticeProgress = {
        currentRate: s.currentRate,
        totalPasses: s.passesCount,
        completedBlockIds: [],
      };
      const completeActions = typeof scenario.onCompleteActions === 'function'
        ? scenario.onCompleteActions({}, progress)
        : scenario.onCompleteActions;

      if (completeActions.length > 0) {
        await runPracticeActions({ actions: completeActions });
      }
    }

    set({ practiceStatus: 'completed' });
  },
}));

// Cleanup on track change
if (typeof document !== 'undefined') {
  document.addEventListener('before-track-change', () => {
    const state = usePracticeStore.getState();
    if (state.isActive) {
      state.cancelPractice();
    }
  });
}

// Safety sync: external rate changes during active practice
if (typeof document !== 'undefined') {
  document.addEventListener('playback-rate-changed', ((e: Event) => {
    // ★ IGNORE if rate change came from practice system ★
    if (_isPracticeRateChange) return;
    
    const state = usePracticeStore.getState();
    if (!state.isActive) return;

    const newRate = (e as CustomEvent).detail?.rate;
    if (newRate != null && Math.abs(newRate - state.currentRate) > 0.001) {
      // External rate change detected during practice — sync currentRate
      console.warn('[PracticeStore] External rate change detected during practice:', {
        was: state.currentRate,
        now: newRate,
      });
      usePracticeStore.setState({ currentRate: newRate });
    }
  }) as EventListener);
}
