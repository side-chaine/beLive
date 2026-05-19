import { describe, it, expect } from 'vitest';
import { isExerciseExecutionLocked } from './exercise.runtime';
import type { Exercise, ExercisePhase } from './exercise.types';

const mockExercise: Exercise = {
  id: 'test-exercise',
  recipeId: 'echo-drill',
  name: 'Test Exercise',
  icon: '🎧',
  description: 'Test',
  scope: { blockId: 'block-1' },
  steps: [
    { action: 'listen', backing: 'full', instruction: 'Listen' },
    { action: 'record', backing: 'instrumental', slot: 0, instruction: 'Record' },
  ],
  repeat: { count: 3, mode: 'fixed' },
  goal: { type: 'rounds', count: 3 },
  defaultBacking: 'instrumental',
};

describe('isExerciseExecutionLocked', () => {
  it('returns false when activeExercise is null', () => {
    expect(isExerciseExecutionLocked(null, 'listening')).toBe(false);
  });

  it('returns false when phase is idle', () => {
    expect(isExerciseExecutionLocked(mockExercise, 'idle')).toBe(false);
  });

  it('returns false when phase is waiting', () => {
    expect(isExerciseExecutionLocked(mockExercise, 'waiting')).toBe(false);
  });

  it('returns false when phase is comparing', () => {
    expect(isExerciseExecutionLocked(mockExercise, 'comparing')).toBe(false);
  });

  it('returns false when phase is round-complete', () => {
    expect(isExerciseExecutionLocked(mockExercise, 'round-complete')).toBe(false);
  });

  it('returns false when phase is exercise-complete', () => {
    expect(isExerciseExecutionLocked(mockExercise, 'exercise-complete')).toBe(false);
  });

  it('returns true when phase is listening', () => {
    expect(isExerciseExecutionLocked(mockExercise, 'listening')).toBe(true);
  });

  it('returns true when phase is pre-recording', () => {
    expect(isExerciseExecutionLocked(mockExercise, 'pre-recording')).toBe(true);
  });

  it('returns true when phase is recording', () => {
    expect(isExerciseExecutionLocked(mockExercise, 'recording')).toBe(true);
  });
});
