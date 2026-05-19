import type {
  Exercise,
  ExerciseStep,
  ExerciseScope,
} from './exercise.types';

export interface ExerciseValidationResult {
  ok: boolean;
  error?: string;
}

function isValidScope(scope: ExerciseScope): boolean {
  if (!scope.blockId) return false;
  if (!scope.lineRange) return true;
  const [start, end] = scope.lineRange;
  return Number.isInteger(start) && Number.isInteger(end) && start >= 0 && end >= start;
}

function isValidStep(step: ExerciseStep): boolean {
  if (!step.action) return false;
  if (step.scope && !isValidScope(step.scope)) return false;
  if (step.slot !== undefined && step.slot !== 'next') {
    if (!Number.isInteger(step.slot) || step.slot < 0 || step.slot > 2) return false;
  }
  if (step.waitSec !== undefined && step.waitSec < 0) return false;
  return true;
}

export function validateExerciseDefinition(exercise: Exercise): ExerciseValidationResult {
  if (!exercise.id) return { ok: false, error: 'Missing exercise.id' };
  if (!exercise.recipeId) return { ok: false, error: 'Missing exercise.recipeId' };
  if (!exercise.name) return { ok: false, error: 'Missing exercise.name' };
  if (!isValidScope(exercise.scope)) return { ok: false, error: 'Invalid exercise.scope' };
  if (!exercise.steps.length) return { ok: false, error: 'Exercise must have at least one step' };
  if (!exercise.steps.every(isValidStep)) return { ok: false, error: 'Invalid exercise step' };
  if (exercise.repeat.count <= 0) return { ok: false, error: 'repeat.count must be > 0' };

  return { ok: true };
}
