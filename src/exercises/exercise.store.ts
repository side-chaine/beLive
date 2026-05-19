import { create } from 'zustand';
import type {
  CompletionMoment,
  Exercise,
  ExercisePhase,
  ExerciseProgressDisplay,
  ExerciseResult,
  ExerciseStep,
  Quest,
  RoundCaptureState,
  ScenarioMixOverride,
  SessionProgress,
} from './exercise.types';
import type { RecipeParams } from './exercise.recipes';
import { EXERCISE_RECIPES } from './exercise.recipes';
import {
  advanceExerciseCursor,
  getCurrentExerciseStep,
  getExerciseProgressDisplay,
  getPhaseForStepAction,
} from './exercise.runtime';

function resolveRecordSlot(step: ExerciseStep): number | null {
  if (typeof step.slot === 'number') return step.slot;
  return null; // null means "next"
}

interface ActivationState {
  phase: ExercisePhase;
  shouldTriggerRecord: boolean;
  recordSlot: number | null;
  recordMode: 'standard' | 'in-flight' | null;
}

interface ExerciseState {
  activeExercise: Exercise | null;
  activeQuest: Quest | null;

  phase: ExercisePhase;
  currentRound: number;
  currentStepIndex: number;

  resolvedTimeRange: { startTime: number; endTime: number } | null;
  savedVolumes: { instrumental: number; vocals: number } | null;
  savedPlaybackRate: number | null;
  savedVmixEnabled: boolean | null;

  sessionProgress: SessionProgress;
  currentExerciseResult: ExerciseResult | null;
  completionMoment: CompletionMoment | null;

  shouldTriggerRecord: boolean;
  recordSlot: number | null;
  recordMode: 'standard' | 'in-flight' | null;

  roundCapture: RoundCaptureState | null;
  scenarioMixOverride: ScenarioMixOverride | null;

  startRecipe: (recipeId: string, blockId: string, params?: RecipeParams) => void;
  startExercise: (exercise: Exercise) => void;
  advanceToNextStep: () => void;
  skipStep: () => void;
  cancelExercise: () => void;
  completeExercise: () => void;
  onStepCompleted: () => void;
  clearRecordTrigger: () => void;
  clearCompletionMoment: () => void;

  setPhase: (phase: ExercisePhase) => void;
  setResolvedTimeRange: (range: { startTime: number; endTime: number } | null) => void;
  setSavedVolumes: (volumes: { instrumental: number; vocals: number } | null) => void;
  setSavedPlaybackRate: (rate: number | null) => void;
  setSavedVmixEnabled: (v: boolean | null) => void;

  setRoundCapture: (value: RoundCaptureState | null) => void;
  setRoundCaptureLockedSlot: (slot: number | null) => void;
  setRoundCaptureRecorderArmed: (armed: boolean) => void;
  setRoundCaptureResponseActive: (active: boolean) => void;
  setRoundCaptureWindowIndex: (index: number) => void;
  clearRoundCapture: () => void;

  setScenarioMixOverride: (override: ScenarioMixOverride | null) => void;
  setInstrumentalOverride: (value: number | undefined) => void;
  setVocalOverride: (value: number | undefined) => void;
  clearScenarioMixOverride: () => void;

  getCurrentStep: () => ExerciseStep | null;
  isExerciseActive: () => boolean;
  getProgressDisplay: () => ExerciseProgressDisplay | null;
}

function createEmptySessionProgress(): SessionProgress {
  return {
    startedAt: Date.now(),
    exercisesCompleted: 0,
    questsCompleted: 0,
    blocksExercised: [],
    totalRoundsCompleted: 0,
  };
}

function activateCurrentStep(
  exercise: Exercise,
  currentRound: number,
  currentStepIndex: number,
): ActivationState {
  const step = getCurrentExerciseStep(exercise, currentStepIndex);
  
  if (!step) {
    return {
      phase: 'idle',
      shouldTriggerRecord: false,
      recordSlot: null,
      recordMode: null,
    };
  }

  const phase = getPhaseForStepAction(step.action);
  const isRecordStep = step.action === 'record';

  return {
    phase,
    shouldTriggerRecord: isRecordStep,
    recordSlot: isRecordStep ? resolveRecordSlot(step) : null,
    recordMode: isRecordStep ? (step.captureMode ?? 'standard') : null,
  };
}

export const useExerciseStore = create<ExerciseState>((set, get) => ({
  activeExercise: null,
  activeQuest: null,

  phase: 'idle',
  currentRound: 0,
  currentStepIndex: 0,

  resolvedTimeRange: null,
  savedVolumes: null,
  savedPlaybackRate: null,
  savedVmixEnabled: null,

  sessionProgress: createEmptySessionProgress(),
  currentExerciseResult: null,
  completionMoment: null,

  shouldTriggerRecord: false,
  recordSlot: null,
  recordMode: null,

  roundCapture: null,
  scenarioMixOverride: null,

  startRecipe: (recipeId, blockId, params) => {
    const recipe = EXERCISE_RECIPES.find((r) => r.id === recipeId);
    if (!recipe) return;
    get().startExercise(recipe.generate(blockId, params));
  },

  startExercise: (exercise) => {
    const activation = activateCurrentStep(exercise, 0, 0);
    
    // Initialize roundCapture if first step is roundCapture record step
    let initialRoundCapture: RoundCaptureState | null = null;
    const firstStep = getCurrentExerciseStep(exercise, 0);
    if (firstStep?.roundCaptureMode === true && firstStep.action === 'record') {
      initialRoundCapture = {
        active: true,
        lockedSlot: activation.recordSlot,
        currentWindowIndex: firstStep.responseWindowIndex ?? 0,
        totalWindows: firstStep.totalResponseWindows ?? 1,
        recorderArmed: false,
        responseActive: false,
      };
    }
    
    set((state) => ({
      activeExercise: exercise,
      activeQuest: null,
      phase: activation.phase,
      currentRound: 0,
      currentStepIndex: 0,
      resolvedTimeRange: null,
      savedVolumes: null,
      savedPlaybackRate: null,
      savedVmixEnabled: null,
      shouldTriggerRecord: activation.shouldTriggerRecord,
      recordSlot: activation.recordSlot,
      recordMode: activation.recordMode,
      roundCapture: initialRoundCapture,
      scenarioMixOverride: null,
      completionMoment: null,
      currentExerciseResult: {
        exerciseId: exercise.id,
        recipeId: exercise.recipeId,
        roundsCompleted: 0,
        roundsTotal: exercise.repeat.count,
        attempts: [],
        starredSlot: null,
        completedAt: null,
      },
      sessionProgress: {
        ...state.sessionProgress,
        blocksExercised: state.sessionProgress.blocksExercised.includes(exercise.scope.blockId)
          ? state.sessionProgress.blocksExercised
          : [...state.sessionProgress.blocksExercised, exercise.scope.blockId],
      },
    }));
  },

  advanceToNextStep: () => {
    const exercise = get().activeExercise;
    if (!exercise) return;

    const result = advanceExerciseCursor(
      exercise,
      get().currentRound,
      get().currentStepIndex,
    );

    if (result.completed) {
      get().completeExercise();
      return;
    }

    const activation = activateCurrentStep(
      exercise,
      result.nextRound,
      result.nextStepIndex,
    );
    
    const nextStep = getCurrentExerciseStep(exercise, result.nextStepIndex);
    const isRoundCaptureRecord = nextStep?.roundCaptureMode === true && nextStep.action === 'record';
    
    // Handle round boundary - clear roundCapture before initializing new round truth
    if (result.nextRound !== get().currentRound) {
      get().clearRoundCapture();
    }
    
    // Build roundCapture state for next step
    let nextRoundCapture: RoundCaptureState | null = null;
    if (isRoundCaptureRecord) {
      const existingRoundCapture = get().roundCapture;
      if (existingRoundCapture) {
        // Preserve lockedSlot, update window info
        nextRoundCapture = {
          ...existingRoundCapture,
          currentWindowIndex: nextStep.responseWindowIndex ?? 0,
          totalWindows: nextStep.totalResponseWindows ?? 1,
          active: true,
        };
      } else {
        // Initialize new roundCapture
        nextRoundCapture = {
          active: true,
          lockedSlot: activation.recordSlot,
          currentWindowIndex: nextStep.responseWindowIndex ?? 0,
          totalWindows: nextStep.totalResponseWindows ?? 1,
          recorderArmed: false,
          responseActive: false,
        };
      }
    }
    
    // Determine effective recordSlot: use activation slot directly (per-window semantics)
    // NOTE: roundCapture metadata preserved for future architecture, but not used for slot authority
    let effectiveRecordSlot: number | null = activation.recordSlot;
    // REMOVED: forced slot locking from roundCapture.lockedSlot
    // This breaks multi-window recorder session ownership assumption

    set((state) => ({
      currentRound: result.nextRound,
      currentStepIndex: result.nextStepIndex,
      phase: activation.phase,
      shouldTriggerRecord: activation.shouldTriggerRecord,
      recordSlot: effectiveRecordSlot,
      recordMode: activation.recordMode,
      roundCapture: nextRoundCapture,
      currentExerciseResult: state.currentExerciseResult
        ? {
            ...state.currentExerciseResult,
            roundsCompleted: result.roundCompleted
              ? Math.max(state.currentExerciseResult.roundsCompleted, result.nextRound)
              : state.currentExerciseResult.roundsCompleted,
          }
        : null,
      sessionProgress: result.roundCompleted
        ? {
            ...state.sessionProgress,
            totalRoundsCompleted: state.sessionProgress.totalRoundsCompleted + 1,
          }
        : state.sessionProgress,
    }));
  },

  skipStep: () => {
    get().advanceToNextStep();
  },

  cancelExercise: () => {
    set({
      activeExercise: null,
      activeQuest: null,
      phase: 'idle',
      currentRound: 0,
      currentStepIndex: 0,
      resolvedTimeRange: null,
      savedVolumes: null,
      savedPlaybackRate: null,
      savedVmixEnabled: null,
      shouldTriggerRecord: false,
      recordSlot: null,
      recordMode: null,
      roundCapture: null,
      scenarioMixOverride: null,
      completionMoment: null,
      currentExerciseResult: null,
    });
  },

  completeExercise: () => {
    set((state) => {
      const completedAt = Date.now();
      const exercise = state.activeExercise;
      
      // Create completion-moment payload before clearing activeExercise
      let completionMoment: CompletionMoment | null = null;
      if (exercise && state.currentExerciseResult) {
        completionMoment = {
          exerciseId: exercise.id,
          recipeId: exercise.recipeId,
          name: exercise.name,
          icon: exercise.icon,
          blockId: exercise.scope.blockId,
          roundsCompleted: state.currentExerciseResult.roundsTotal,
          roundsTotal: state.currentExerciseResult.roundsTotal,
          completedAt,
        };
      }

      return {
        activeExercise: null,
        phase: 'exercise-complete',
        shouldTriggerRecord: false,
        recordSlot: null,
        recordMode: null,
        roundCapture: null,
        scenarioMixOverride: null,
        savedVmixEnabled: null,
        completionMoment,
        currentExerciseResult: state.currentExerciseResult
          ? {
              ...state.currentExerciseResult,
              completedAt,
              roundsCompleted: state.currentExerciseResult.roundsTotal,
            }
          : null,
        sessionProgress: {
          ...state.sessionProgress,
          exercisesCompleted: state.sessionProgress.exercisesCompleted + 1,
        },
      };
    });
  },

  onStepCompleted: () => {
    get().advanceToNextStep();
  },

  clearRecordTrigger: () => {
    set({ shouldTriggerRecord: false, recordSlot: null, recordMode: null });
  },

  clearCompletionMoment: () => {
    set({ completionMoment: null });
  },

  setRoundCapture: (value) => {
    set({ roundCapture: value });
  },

  setRoundCaptureLockedSlot: (slot) => {
    const state = get();
    if (!state.roundCapture) return;
    set({ roundCapture: { ...state.roundCapture, lockedSlot: slot } });
  },

  setRoundCaptureRecorderArmed: (armed) => {
    const state = get();
    if (!state.roundCapture) return;
    set({ roundCapture: { ...state.roundCapture, recorderArmed: armed } });
  },

  setRoundCaptureResponseActive: (active) => {
    const state = get();
    if (!state.roundCapture) return;
    set({ roundCapture: { ...state.roundCapture, responseActive: active } });
  },

  setRoundCaptureWindowIndex: (index) => {
    const state = get();
    if (!state.roundCapture) return;
    set({ roundCapture: { ...state.roundCapture, currentWindowIndex: index } });
  },

  clearRoundCapture: () => {
    set({ roundCapture: null });
  },

  setScenarioMixOverride: (override) => {
    set({ scenarioMixOverride: override });
  },

  setInstrumentalOverride: (value) => {
    const state = get();
    set({
      scenarioMixOverride: {
        ...state.scenarioMixOverride,
        instrumental: value,
      },
    });
  },

  setVocalOverride: (value) => {
    const state = get();
    set({
      scenarioMixOverride: {
        ...state.scenarioMixOverride,
        vocal: value,
      },
    });
  },

  clearScenarioMixOverride: () => {
    set({ scenarioMixOverride: null });
  },

  setPhase: (phase) => set({ phase }),
  setResolvedTimeRange: (range) => set({ resolvedTimeRange: range }),
  setSavedVolumes: (volumes) => set({ savedVolumes: volumes }),
  setSavedPlaybackRate: (rate) => set({ savedPlaybackRate: rate }),
  setSavedVmixEnabled: (v) => set({ savedVmixEnabled: v }),

  getCurrentStep: () => {
    return getCurrentExerciseStep(get().activeExercise, get().currentStepIndex);
  },

  isExerciseActive: () => {
    return !!get().activeExercise;
  },

  getProgressDisplay: () => {
    return getExerciseProgressDisplay(
      get().activeExercise,
      get().phase,
      get().currentRound,
      get().currentStepIndex,
    );
  },
}));
