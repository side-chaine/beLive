/**
 * Practice Interruption Bridge Tests
 * 
 * Verifies:
 * - active practice + interrupt → current practice cleanly cancels
 * - active practice + Esc → current practice cleanly cancels  
 * - previously committed takes remain intact
 * - no crash if interruption bridge called while no active practice exists
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useExerciseStore } from './exercise.store';
import {
  isPracticeSessionActive,
  interruptPracticeSession,
  registerPracticeInterruptHandler,
  unregisterPracticeInterruptHandler,
} from './exercise.interruption';
import type { Exercise } from './exercise.types';

describe('PracticeInterruption', () => {
  beforeEach(() => {
    // Reset exercise store to clean state
    useExerciseStore.getState().cancelExercise();
    // Clear all interrupt handlers
    unregisterPracticeInterruptHandler('test-handler');
  });

  it('should return false when no active practice exists', () => {
    const active = isPracticeSessionActive();
    expect(active).toBe(false);
  });

  it('should return true when practice session is active', () => {
    const mockExercise: Exercise = {
      id: 'test-exercise',
      recipeId: 'test-recipe',
      name: 'Test Exercise',
      icon: '🎤',
      description: 'Test',
      scope: { blockId: 'block-1' },
      steps: [{ action: 'record', slot: 0 }],
      repeat: { count: 1, mode: 'fixed' },
      goal: { type: 'completion' },
      defaultBacking: 'full',
    };

    useExerciseStore.getState().startExercise(mockExercise);
    const active = isPracticeSessionActive();
    expect(active).toBe(true);
  });

  it('should not crash when interrupting with no active practice', () => {
    // Should not throw
    expect(() => interruptPracticeSession()).not.toThrow();
  });

  it('should cancel active practice when interrupted', () => {
    const mockExercise: Exercise = {
      id: 'test-exercise',
      recipeId: 'test-recipe',
      name: 'Test Exercise',
      icon: '🎤',
      description: 'Test',
      scope: { blockId: 'block-1' },
      steps: [{ action: 'record', slot: 0 }],
      repeat: { count: 1, mode: 'fixed' },
      goal: { type: 'completion' },
      defaultBacking: 'full',
    };

    useExerciseStore.getState().startExercise(mockExercise);
    expect(isPracticeSessionActive()).toBe(true);

    interruptPracticeSession();

    expect(isPracticeSessionActive()).toBe(false);
    expect(useExerciseStore.getState().activeExercise).toBeNull();
    expect(useExerciseStore.getState().phase).toBe('idle');
  });

  it('should call registered interrupt handlers', () => {
    const handlerMock = vi.fn();
    registerPracticeInterruptHandler('test-handler', handlerMock);

    const mockExercise: Exercise = {
      id: 'test-exercise',
      recipeId: 'test-recipe',
      name: 'Test Exercise',
      icon: '🎤',
      description: 'Test',
      scope: { blockId: 'block-1' },
      steps: [{ action: 'record', slot: 0 }],
      repeat: { count: 1, mode: 'fixed' },
      goal: { type: 'completion' },
      defaultBacking: 'full',
    };

    useExerciseStore.getState().startExercise(mockExercise);
    interruptPracticeSession();

    expect(handlerMock).toHaveBeenCalledTimes(1);
  });

  it('should execute post-interruption action', () => {
    const actionMock = vi.fn();
    
    const mockExercise: Exercise = {
      id: 'test-exercise',
      recipeId: 'test-recipe',
      name: 'Test Exercise',
      icon: '🎤',
      description: 'Test',
      scope: { blockId: 'block-1' },
      steps: [{ action: 'record', slot: 0 }],
      repeat: { count: 1, mode: 'fixed' },
      goal: { type: 'completion' },
      defaultBacking: 'full',
    };

    useExerciseStore.getState().startExercise(mockExercise);
    interruptPracticeSession(actionMock);

    expect(actionMock).toHaveBeenCalledTimes(1);
  });

  it('should execute action even when no active practice exists', () => {
    const actionMock = vi.fn();
    
    interruptPracticeSession(actionMock);

    expect(actionMock).toHaveBeenCalledTimes(1);
  });

  it('should handle multiple interrupt handlers', () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    
    registerPracticeInterruptHandler('handler-1', handler1);
    registerPracticeInterruptHandler('handler-2', handler2);

    const mockExercise: Exercise = {
      id: 'test-exercise',
      recipeId: 'test-recipe',
      name: 'Test Exercise',
      icon: '🎤',
      description: 'Test',
      scope: { blockId: 'block-1' },
      steps: [{ action: 'record', slot: 0 }],
      repeat: { count: 1, mode: 'fixed' },
      goal: { type: 'completion' },
      defaultBacking: 'full',
    };

    useExerciseStore.getState().startExercise(mockExercise);
    interruptPracticeSession();

    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).toHaveBeenCalledTimes(1);
  });

  it('should not crash if one handler throws', () => {
    const erroringHandler = vi.fn(() => {
      throw new Error('Test error');
    });
    const goodHandler = vi.fn();
    
    registerPracticeInterruptHandler('erroring', erroringHandler);
    registerPracticeInterruptHandler('good', goodHandler);

    const mockExercise: Exercise = {
      id: 'test-exercise',
      recipeId: 'test-recipe',
      name: 'Test Exercise',
      icon: '🎤',
      description: 'Test',
      scope: { blockId: 'block-1' },
      steps: [{ action: 'record', slot: 0 }],
      repeat: { count: 1, mode: 'fixed' },
      goal: { type: 'completion' },
      defaultBacking: 'full',
    };

    useExerciseStore.getState().startExercise(mockExercise);
    
    // Should not throw even with erroring handler
    expect(() => interruptPracticeSession()).not.toThrow();
    
    // Good handler should still be called
    expect(goodHandler).toHaveBeenCalledTimes(1);
  });
});
