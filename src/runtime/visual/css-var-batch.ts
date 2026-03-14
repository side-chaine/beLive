/**
 * CSS Variable Batch Writer
 *
 * Hot-path visual optimization utility for batching CSS custom property writes.
 * Multiple systems can queue vars before a single write pass to reduce DOM reflows.
 *
 * Usage pattern:
 *   queueCssVar('--bl-word-active', '1');
 *   queueCssVar('--bl-word-progress', '0.5');
 *   flushQueuedCssVars(); // Single write pass
 *
 * @module css-var-batch
 */

/** Queue of pending CSS variable writes */
const queue = new Map<string, string>();

/**
 * Queue a CSS variable for batch write.
 * Duplicate keys are overwritten (last write wins).
 *
 * @param key - CSS custom property name (e.g., '--bl-word-active')
 * @param value - Value to set (will be stringified)
 */
export function queueCssVar(key: string, value: string): void {
  queue.set(key, value);
}

/**
 * Flush all queued CSS variables to the DOM in a single pass.
 * After flush, the queue is cleared.
 *
 * @param target - Target element for style.setProperty (default: document.documentElement)
 */
export function flushQueuedCssVars(target?: HTMLElement): void {
  if (queue.size === 0) return;

  const el = target ?? document.documentElement;

  // Single write pass for all queued vars
  queue.forEach((value, key) => {
    el.style.setProperty(key, value);
  });

  queue.clear();
}

/**
 * Clear all queued CSS variables without writing to DOM.
 * Use when aborting a batch (e.g., track change cleanup).
 */
export function clearQueuedCssVars(): void {
  queue.clear();
}

/**
 * Get current queue size (for debugging/monitoring).
 * @returns Number of queued CSS variables
 */
export function getQueuedCssVarCount(): number {
  return queue.size;
}
