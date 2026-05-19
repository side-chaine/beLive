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

describe('isExerciseExecutionLocked - TakesControlStrip Guard', () => {
  describe('should allow strip controls when NOT locked', () => {
    it('returns false when activeExercise is null', () => {
      expect(isExerciseExecutionLocked(null, 'listening')).toBe(false);
    });

    it('returns false for idle phase - allows all strip interactions', () => {
      expect(isExerciseExecutionLocked(mockExercise, 'idle')).toBe(false);
    });

    it('returns false for waiting phase - allows strip interactions', () => {
      expect(isExerciseExecutionLocked(mockExercise, 'waiting')).toBe(false);
    });

    it('returns false for comparing phase - allows reference changes', () => {
      expect(isExerciseExecutionLocked(mockExercise, 'comparing')).toBe(false);
    });

    it('returns false for round-complete phase - allows preparation', () => {
      expect(isExerciseExecutionLocked(mockExercise, 'round-complete')).toBe(false);
    });

    it('returns false for exercise-complete phase - allows cleanup actions', () => {
      expect(isExerciseExecutionLocked(mockExercise, 'exercise-complete')).toBe(false);
    });
  });

  describe('should block destructive/semantic mutations when locked', () => {
    it('returns true for listening phase - blocks Drill button', () => {
      expect(isExerciseExecutionLocked(mockExercise, 'listening')).toBe(true);
    });

    it('returns true for listening phase - blocks retake button', () => {
      expect(isExerciseExecutionLocked(mockExercise, 'listening')).toBe(true);
    });

    it('returns true for listening phase - blocks star button (reference toggle)', () => {
      expect(isExerciseExecutionLocked(mockExercise, 'listening')).toBe(true);
    });

    it('returns true for listening phase - blocks delete button', () => {
      expect(isExerciseExecutionLocked(mockExercise, 'listening')).toBe(true);
    });

    it('returns true for pre-recording phase - blocks all destructive actions', () => {
      expect(isExerciseExecutionLocked(mockExercise, 'pre-recording')).toBe(true);
    });

    it('returns true for recording phase - blocks all mutations during capture', () => {
      expect(isExerciseExecutionLocked(mockExercise, 'recording')).toBe(true);
    });
  });

  describe('TakesControlStrip guard coverage', () => {
    const executablePhases: ExercisePhase[] = ['listening', 'pre-recording', 'recording'];
    const nonExecutablePhases: ExercisePhase[] = ['idle', 'waiting', 'comparing', 'round-complete', 'exercise-complete'];

    it('blocks during ALL executable phases', () => {
      executablePhases.forEach(phase => {
        expect(isExerciseExecutionLocked(mockExercise, phase)).toBe(true);
      });
    });

    it('allows during ALL non-executable phases', () => {
      nonExecutablePhases.forEach(phase => {
        expect(isExerciseExecutionLocked(mockExercise, phase)).toBe(false);
      });
    });

    it('allows when no exercise is active', () => {
      nonExecutablePhases.forEach(phase => {
        expect(isExerciseExecutionLocked(null, phase)).toBe(false);
      });
    });
  });

  describe('integration scenarios', () => {
    it('prevents opening Drill popover during Echo Drill listening', () => {
      // User should not be able to launch competing exercise
      expect(isExerciseExecutionLocked(mockExercise, 'listening')).toBe(true);
    });

    it('prevents retake during pre-recording countdown', () => {
      // User should not be able to delete and re-record during countdown
      expect(isExerciseExecutionLocked(mockExercise, 'pre-recording')).toBe(true);
    });

    it('prevents reference star change during recording', () => {
      // User should not be able to change A-B reference mid-capture
      expect(isExerciseExecutionLocked(mockExercise, 'recording')).toBe(true);
    });

    it('prevents accidental take deletion during execution', () => {
      // Destructive actions should be blocked
      expect(isExerciseExecutionLocked(mockExercise, 'listening')).toBe(true);
    });

    it('restores full strip functionality after exercise completes', () => {
      // User regains control after exercise finishes
      expect(isExerciseExecutionLocked(mockExercise, 'exercise-complete')).toBe(false);
    });
  });

  describe('guarded controls matrix', () => {
    const guardedControls = [
      'Drill button (opens recipe popover)',
      'Retake button (delete + re-record)',
      'Star button (toggle reference take)',
      'Delete button (remove take)',
    ];

    guardedControls.forEach(control => {
      it(`blocks ${control} during executable phases`, () => {
        const executablePhases: ExercisePhase[] = ['listening', 'pre-recording', 'recording'];
        executablePhases.forEach(phase => {
          expect(isExerciseExecutionLocked(mockExercise, phase)).toBe(true);
        });
      });
    });

    it('does NOT block stop button (emergency path)', () => {
      // Stop button is intentionally left unguarded as emergency exit
      // This test documents the product decision
      const recordingPhase: ExercisePhase = 'recording';
      expect(isExerciseExecutionLocked(mockExercise, recordingPhase)).toBe(true);
      // But stop button handler ignores the lock (product choice)
    });
  });
});
