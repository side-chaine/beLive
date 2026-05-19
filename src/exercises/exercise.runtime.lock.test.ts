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

describe('isExerciseExecutionLocked - ControlDeck host residency', () => {
  describe('should allow navigation when NOT locked', () => {
    it('returns false when activeExercise is null', () => {
      expect(isExerciseExecutionLocked(null, 'listening')).toBe(false);
    });

    it('returns false for idle phase', () => {
      expect(isExerciseExecutionLocked(mockExercise, 'idle')).toBe(false);
    });

    it('returns false for waiting phase', () => {
      expect(isExerciseExecutionLocked(mockExercise, 'waiting')).toBe(false);
    });

    it('returns false for comparing phase', () => {
      expect(isExerciseExecutionLocked(mockExercise, 'comparing')).toBe(false);
    });

    it('returns false for round-complete phase', () => {
      expect(isExerciseExecutionLocked(mockExercise, 'round-complete')).toBe(false);
    });

    it('returns false for exercise-complete phase', () => {
      expect(isExerciseExecutionLocked(mockExercise, 'exercise-complete')).toBe(false);
    });
  });

  describe('should block navigation when locked', () => {
    it('returns true for listening phase', () => {
      expect(isExerciseExecutionLocked(mockExercise, 'listening')).toBe(true);
    });

    it('returns true for pre-recording phase', () => {
      expect(isExerciseExecutionLocked(mockExercise, 'pre-recording')).toBe(true);
    });

    it('returns true for recording phase', () => {
      expect(isExerciseExecutionLocked(mockExercise, 'recording')).toBe(true);
    });
  });
});
