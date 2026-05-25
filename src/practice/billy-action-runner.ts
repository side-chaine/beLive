/**
 * Billy Action Runner — Wave G
 * Serial multi-action executor for practice scenarios.
 * Runs tool calls in sequence with configurable delays.
 */

import { executeToolCall, type ToolCallResult } from '../components/TrackInfoBoard/ai-tools';

/* ═══ Types ═══ */

export interface PracticeAction {
  tool: string;
  args: Record<string, unknown>;
  /** Delay in ms AFTER this action before next one (default: 500) */
  delayMs?: number;
  /** Optional label for progress reporting */
  label?: string;
}

export interface PracticeStepResult {
  index: number;
  action: PracticeAction;
  result: ToolCallResult;
  timestamp: number;
}

export interface PracticeRunConfig {
  /** Actions to execute in sequence */
  actions: PracticeAction[];
  /** Called after each action completes */
  onStep?: (step: PracticeStepResult) => void;
  /** Called when all actions complete */
  onComplete?: (results: PracticeStepResult[]) => void;
  /** Called on first error (stops the run) */
  onError?: (step: PracticeStepResult) => void;
  /** Default delay between actions in ms (default: 500) */
  defaultDelayMs?: number;
  /** Abort signal for cancellation */
  signal?: AbortSignal;
}

/* ═══ Runner ═══ */

/**
 * Execute a sequence of practice actions serially.
 * Each action waits for the previous to complete before starting.
 */
export async function runPracticeActions(
  config: PracticeRunConfig
): Promise<PracticeStepResult[]> {
  const {
    actions,
    onStep,
    onComplete,
    onError,
    defaultDelayMs = 500,
    signal,
  } = config;

  const results: PracticeStepResult[] = [];

  for (let i = 0; i < actions.length; i++) {
    // Check for cancellation
    if (signal?.aborted) {
      break;
    }

    const action = actions[i];

    try {
      const toolResult = await executeToolCall(action.tool, action.args);
      const stepResult: PracticeStepResult = {
        index: i,
        action,
        result: toolResult,
        timestamp: Date.now(),
      };

      results.push(stepResult);
      onStep?.(stepResult);

      // Stop on failure
      if (!toolResult.success) {
        onError?.(stepResult);
        break;
      }

      // Delay before next action (skip after last)
      if (i < actions.length - 1) {
        const delay = action.delayMs ?? defaultDelayMs;
        if (delay > 0) {
          await delayAsync(delay, signal);
        }
      }
    } catch (err: any) {
      const errorResult: PracticeStepResult = {
        index: i,
        action,
        result: {
          tool: action.tool,
          success: false,
          message: err?.message || 'Unknown error',
        },
        timestamp: Date.now(),
      };
      results.push(errorResult);
      onError?.(errorResult);
      break;
    }
  }

  onComplete?.(results);
  return results;
}

/* ═══ Helpers ═══ */

/**
 * Promise-based delay with abort support.
 */
function delayAsync(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }

    const timer = setTimeout(resolve, ms);

    if (signal) {
      signal.addEventListener('abort', () => {
        clearTimeout(timer);
        resolve();
      }, { once: true });
    }
  });
}

/**
 * Create an AbortSignal to cancel a running practice sequence.
 */
export function createPracticeAbortController(): AbortController {
  return new AbortController();
}
