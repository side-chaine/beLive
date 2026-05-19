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

describe('isExerciseExecutionLocked - Canvas Seek Guard', () => {
  describe('should allow canvas seek when NOT locked', () => {
    it('returns false when activeExercise is null', () => {
      expect(isExerciseExecutionLocked(null, 'listening')).toBe(false);
    });

    it('returns false for idle phase - allows normal seek', () => {
      expect(isExerciseExecutionLocked(mockExercise, 'idle')).toBe(false);
    });

    it('returns false for waiting phase - allows seek during wait step', () => {
      expect(isExerciseExecutionLocked(mockExercise, 'waiting')).toBe(false);
    });

    it('returns false for comparing phase - allows seek during compare', () => {
      expect(isExerciseExecutionLocked(mockExercise, 'comparing')).toBe(false);
    });

    it('returns false for round-complete phase - allows seek between rounds', () => {
      expect(isExerciseExecutionLocked(mockExercise, 'round-complete')).toBe(false);
    });

    it('returns false for exercise-complete phase - allows seek after completion', () => {
      expect(isExerciseExecutionLocked(mockExercise, 'exercise-complete')).toBe(false);
    });
  });

  describe('should block canvas seek when locked', () => {
    it('returns true for listening phase - blocks seek during listen step', () => {
      expect(isExerciseExecutionLocked(mockExercise, 'listening')).toBe(true);
    });

    it('returns true for pre-recording phase - blocks seek during countdown', () => {
      expect(isExerciseExecutionLocked(mockExercise, 'pre-recording')).toBe(true);
    });

    it('returns true for recording phase - blocks seek during recording', () => {
      expect(isExerciseExecutionLocked(mockExercise, 'recording')).toBe(true);
    });
  });

  describe('canvas seek guard coverage', () => {
    const executablePhases: ExercisePhase[] = ['listening', 'pre-recording', 'recording'];
    const nonExecutablePhases: ExercisePhase[] = ['idle', 'waiting', 'comparing', 'round-complete', 'exercise-complete'];

    it('blocks seek during ALL executable phases', () => {
      executablePhases.forEach(phase => {
        expect(isExerciseExecutionLocked(mockExercise, phase)).toBe(true);
      });
    });

    it('allows seek during ALL non-executable phases', () => {
      nonExecutablePhases.forEach(phase => {
        expect(isExerciseExecutionLocked(mockExercise, phase)).toBe(false);
      });
    });

    it('allows seek when no exercise is active', () => {
      nonExecutablePhases.forEach(phase => {
        expect(isExerciseExecutionLocked(null, phase)).toBe(false);
      });
    });
  });

  describe('integration scenarios', () => {
    it('blocks seek during Echo Drill listening phase', () => {
      // User should not be able to seek away from exercise target
      expect(isExerciseExecutionLocked(mockExercise, 'listening')).toBe(true);
    });

    it('blocks seek during Call & Response pre-recording countdown', () => {
      // User should not be able to seek during countdown
      expect(isExerciseExecutionLocked(mockExercise, 'pre-recording')).toBe(true);
    });

    it('blocks seek during recording to prevent timeline corruption', () => {
      // User should not be able to seek while recording
      expect(isExerciseExecutionLocked(mockExercise, 'recording')).toBe(true);
    });

    it('restores seek capability after exercise completes', () => {
      // User should regain control after exercise finishes
      expect(isExerciseExecutionLocked(mockExercise, 'exercise-complete')).toBe(false);
    });
  });
});
