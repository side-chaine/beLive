import type {
  BackingMode,
  Exercise,
  ExercisePhase,
  ExerciseProgressDisplay,
  ExerciseStep,
  StepAction,
} from './exercise.types';

export function resolveBackingVolumes(
  backing: BackingMode,
): { instrumental: number; vocals: number } {
  switch (backing) {
    case 'full':
      return { instrumental: 1, vocals: 1 };
    case 'instrumental':
      return { instrumental: 1, vocals: 0 };
    case 'guide':
      return { instrumental: 1, vocals: 0.25 };
    case 'silent':
      return { instrumental: 0, vocals: 0 };
    case 'vocals-only':
      return { instrumental: 0, vocals: 1 };
  }
}

export function getCurrentExerciseStep(
  exercise: Exercise | null,
  stepIndex: number,
): ExerciseStep | null {
  if (!exercise) return null;
  if (stepIndex < 0 || stepIndex >= exercise.steps.length) return null;
  return exercise.steps[stepIndex] ?? null;
}

export function getPhaseForStepAction(
  action: StepAction,
): ExercisePhase {
  switch (action) {
    case 'listen':
      return 'listening';
    case 'record':
      return 'pre-recording';
    case 'compare':
      return 'comparing';
    case 'wait':
      return 'waiting';
  }
}

export interface ExerciseCursorResult {
  nextRound: number;
  nextStepIndex: number;
  completed: boolean;
  roundCompleted: boolean;
}

export function advanceExerciseCursor(
  exercise: Exercise,
  currentRound: number,
  currentStepIndex: number,
): ExerciseCursorResult {
  const lastStepIndex = exercise.steps.length - 1;

  if (currentStepIndex < lastStepIndex) {
    return {
      nextRound: currentRound,
      nextStepIndex: currentStepIndex + 1,
      completed: false,
      roundCompleted: false,
    };
  }

  const nextRound = currentRound + 1;

  if (nextRound < exercise.repeat.count) {
    return {
      nextRound,
      nextStepIndex: 0,
      completed: false,
      roundCompleted: true,
    };
  }

  return {
    nextRound: currentRound,
    nextStepIndex: currentStepIndex,
    completed: true,
    roundCompleted: true,
  };
}

export function getExerciseProgressDisplay(
  exercise: Exercise | null,
  phase: ExercisePhase,
  currentRound: number,
  currentStepIndex: number,
): ExerciseProgressDisplay | null {
  if (!exercise) return null;

  const step = getCurrentExerciseStep(exercise, currentStepIndex);
  const stepAction = step?.action ?? 'wait';

  const iconMap: Record<StepAction, string> = {
    listen: '🎧',
    record: '🎤',
    compare: '⚖️',
    wait: '⏸',
  };

  return {
    round: currentRound,
    totalRounds: exercise.repeat.count,
    step: currentStepIndex,
    totalSteps: exercise.steps.length,
    icon: iconMap[stepAction],
    instruction:
      step?.instruction ??
      (phase === 'exercise-complete'
        ? 'Complete'
        : stepAction),
  };
}

/**
 * Unified exercise execution lock check.
 * Returns true if exercise is actively executing and should not be interrupted.
 * 
 * @param activeExercise - Current active exercise (null if none)
 * @param phase - Current exercise phase
 * @returns True if exercise is in executable phase (listening, pre-recording, recording)
 */
export function isExerciseExecutionLocked(
  activeExercise: Exercise | null,
  phase: ExercisePhase,
): boolean {
  return (
    activeExercise !== null &&
    (phase === 'listening' ||
     phase === 'pre-recording' ||
     phase === 'recording')
  );
}
