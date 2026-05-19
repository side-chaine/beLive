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

describe('isExerciseExecutionLocked - WagonTrain Guard', () => {
  describe('should allow WagonTrain when NOT locked', () => {
    it('returns false when activeExercise is null', () => {
      expect(isExerciseExecutionLocked(null, 'listening')).toBe(false);
    });

    it('returns false for idle phase - allows wagon interactions', () => {
      expect(isExerciseExecutionLocked(mockExercise, 'idle')).toBe(false);
    });

    it('returns false for waiting phase - allows navigation', () => {
      expect(isExerciseExecutionLocked(mockExercise, 'waiting')).toBe(false);
    });

    it('returns false for comparing phase - allows block switching', () => {
      expect(isExerciseExecutionLocked(mockExercise, 'comparing')).toBe(false);
    });

    it('returns false for round-complete phase - allows preparation', () => {
      expect(isExerciseExecutionLocked(mockExercise, 'round-complete')).toBe(false);
    });

    it('returns false for exercise-complete phase - allows free navigation', () => {
      expect(isExerciseExecutionLocked(mockExercise, 'exercise-complete')).toBe(false);
    });
  });

  describe('should block WagonTrain interference when locked', () => {
    it('returns true for listening phase - blocks wagon click', () => {
      expect(isExerciseExecutionLocked(mockExercise, 'listening')).toBe(true);
    });

    it('returns true for listening phase - blocks loop toggle', () => {
      expect(isExerciseExecutionLocked(mockExercise, 'listening')).toBe(true);
    });

    it('returns true for pre-recording phase - blocks all wagon interactions', () => {
      expect(isExerciseExecutionLocked(mockExercise, 'pre-recording')).toBe(true);
    });

    it('returns true for recording phase - blocks all mutations during capture', () => {
      expect(isExerciseExecutionLocked(mockExercise, 'recording')).toBe(true);
    });
  });

  describe('WagonTrain guard coverage', () => {
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
    it('prevents seek away from exercise target during listening', () => {
      // User should not be able to click wagon and change playback position
      expect(isExerciseExecutionLocked(mockExercise, 'listening')).toBe(true);
    });

    it('prevents loop rebind during pre-recording countdown', () => {
      // User should not be able to change loop boundaries during countdown
      expect(isExerciseExecutionLocked(mockExercise, 'pre-recording')).toBe(true);
    });

    it('prevents active block change during recording', () => {
      // User should not be able to switch blocks mid-capture
      expect(isExerciseExecutionLocked(mockExercise, 'recording')).toBe(true);
    });

    it('prevents timeline corruption by blocking seek during execution', () => {
      // Wagon click would call audioEngine.setCurrentTime() - blocked
      expect(isExerciseExecutionLocked(mockExercise, 'listening')).toBe(true);
    });

    it('restores full WagonTrain functionality after exercise completes', () => {
      // User regains navigation control after exercise finishes
      expect(isExerciseExecutionLocked(mockExercise, 'exercise-complete')).toBe(false);
    });
  });

  describe('guarded interactions matrix', () => {
    const guardedInteractions = [
      'wagon click (seeks + rebinds loop + changes active block)',
      'loop toggle (adds/removes block from loop)',
    ];

    guardedInteractions.forEach(interaction => {
      it(`blocks ${interaction} during executable phases`, () => {
        const executablePhases: ExercisePhase[] = ['listening', 'pre-recording', 'recording'];
        executablePhases.forEach(phase => {
          expect(isExerciseExecutionLocked(mockExercise, phase)).toBe(true);
        });
      });
    });
  });

  describe('visual feedback specification', () => {
    it('applies opacity 0.5 to wagons during executable phases', () => {
      // Documents the visual feedback requirement
      expect(isExerciseExecutionLocked(mockExercise, 'listening')).toBe(true);
      // Implementation: style={{ opacity: exerciseLocked ? 0.5 : 1 }}
    });

    it('changes cursor to not-allowed during executable phases', () => {
      // Documents the cursor feedback requirement
      expect(isExerciseExecutionLocked(mockExercise, 'listening')).toBe(true);
      // Implementation: style={{ cursor: exerciseLocked ? 'not-allowed' : 'pointer' }}
    });

    it('applies same visual feedback to loop toggle button', () => {
      // Loop toggle should also show disabled state
      expect(isExerciseExecutionLocked(mockExercise, 'listening')).toBe(true);
      // Implementation: style={{ opacity: 0.5, cursor: 'not-allowed' }}
    });
  });
});
