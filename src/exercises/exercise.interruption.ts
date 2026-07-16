/**
 * Practice Session Interruption Bridge
 * 
 * Provides central interruption semantics for active practice sessions.
 * Allows users to exit practice sessions cleanly via:
 * - explicit Exit/Cancel button
 * - Escape key
 * - without destroying already committed takes
 * 
 * Architecture:
 * - If no active practice exists → action runs immediately
 * - If active practice exists:
 *   - calls registered interrupt handler (if any)
 *   - restores saved Inst/Voc volumes from exercise snapshot if they were set
 *   - cleanly cancels current practice session
 *   - then executes requested action
 */

import { useExerciseStore } from './exercise.store';
import { useAudioStore } from '../stores/audio.store';

/**
 * Interrupt handler function type
 */
export type PracticeInterruptHandler = () => void;

/**
 * Registry of interrupt handlers (one per consumer)
 */
let interruptHandlerRegistry: Map<string, PracticeInterruptHandler> = new Map();

/**
 * Register an interrupt handler for a specific consumer
 * @param consumerId Unique identifier for the consumer (e.g., 'takes-control-strip')
 * @param handler Function to call when interruption is requested
 */
export function registerPracticeInterruptHandler(
  consumerId: string,
  handler: PracticeInterruptHandler,
): void {
  interruptHandlerRegistry.set(consumerId, handler);
}

/**
 * Unregister an interrupt handler
 * @param consumerId Unique identifier for the consumer
 */
export function unregisterPracticeInterruptHandler(consumerId: string): void {
  interruptHandlerRegistry.delete(consumerId);
}

/**
 * Check if a practice session is currently active
 */
export function isPracticeSessionActive(): boolean {
  const exercise = useExerciseStore.getState();
  return !!exercise.activeExercise && exercise.phase !== 'idle' && exercise.phase !== 'exercise-complete';
}

/**
 * Interrupt the current practice session and optionally execute an action
 * 
 * Semantics:
 * - if active practice exists:
 *   - calls all registered interrupt handlers
 *   - restores saved volumes if they exist
 *   - cleanly cancels the practice session
 * - then executes the requested action (if provided)
 * 
 * @param action Optional action to execute after interruption
 */
export function interruptPracticeSession(action?: () => void): void {
  const exerciseState = useExerciseStore.getState();
  
  // Check if there's an active practice session
  if (!isPracticeSessionActive()) {
    // No active practice - just run the action if provided
    if (action) {
      action();
    }
    return;
  }

  // Call all registered interrupt handlers
  interruptHandlerRegistry.forEach((handler, consumerId) => {
    try {
      handler();
    } catch (error) {
      console.error(`[PracticeInterruption] Handler for ${consumerId} failed:`, error);
    }
  });

  // Restore saved volumes if they exist
  const savedVolumes = exerciseState.savedVolumes;
  if (savedVolumes) {
    try {
      // Access audio engine through window global (legacy bridge)
      const audioEngine = (window as any).audioEngine;
      if (audioEngine && typeof audioEngine.setVolumes === 'function') {
        audioEngine.setVolumes(savedVolumes.instrumental, savedVolumes.vocals);
      }
      // Mirror restored baseline values into audio.store for UI truth
      useAudioStore.setState({
        instrumentalVolume: savedVolumes.instrumental,
        vocalsVolume: savedVolumes.vocals,
      });
    } catch (error) {
      console.error('[PracticeInterruption] Failed to restore volumes:', error);
    }
  }

  // Cancel the practice session cleanly
  // This preserves committed takes - only clears exercise state
  useExerciseStore.getState().cancelExercise();

  // Execute the requested action after interruption
  if (action) {
    try {
      action();
    } catch (error) {
      console.error('[PracticeInterruption] Post-interruption action failed:', error);
    }
  }
}

/**
 * Run a function with practice interruption capability
 * 
 * Higher-order wrapper that ensures practice session is interrupted
 * before executing the wrapped function.
 * 
 * @param fn Function to wrap
 * @returns Wrapped function that interrupts practice before executing
 */
export function runWithPracticeInterruption<T extends (...args: any[]) => any>(
  fn: T,
): T {
  return ((...args: Parameters<T>) => {
    interruptPracticeSession(() => fn(...args));
  }) as T;
}

/**
 * Window bridge for legacy/global consumers
 * Exposes minimal API for interruption without importing modules
 */
export interface PracticeInterruptionBridge {
  /**
   * Check if a practice session is active
   */
  isActive: () => boolean;
  /**
   * Interrupt the current practice session
   * @param actionName Optional name of the action being performed (for logging)
   */
  interrupt: (actionName?: string) => void;
}

/**
 * Initialize the window bridge for legacy consumers
 * Call this once during app initialization
 */
export function initPracticeInterruptionBridge(): PracticeInterruptionBridge {
  const bridge: PracticeInterruptionBridge = {
    isActive: () => isPracticeSessionActive(),
    
    interrupt: (actionName?: string) => {
      if (actionName) {
        if (import.meta.env.DEV) console.log(`[PracticeInterruption] Interrupting for: ${actionName}`);
      }
      interruptPracticeSession();
    },
  };

  // Expose on window for legacy access
  (window as any).__belivePracticeInterruption = bridge;

  return bridge;
}

/**
 * Cleanup function to dispose of the bridge
 */
export function disposePracticeInterruptionBridge(): void {
  delete (window as any).__belivePracticeInterruption;
  interruptHandlerRegistry.clear();
}
