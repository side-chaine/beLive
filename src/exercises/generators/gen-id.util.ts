/**
 * Shared exercise ID generator
 * Extracted to eliminate 6x duplication across generators.
 */
export function genExerciseId(prefix: string, blockId: string): string {
  return `ex-${prefix}-${blockId}-${Date.now()}`;
}
