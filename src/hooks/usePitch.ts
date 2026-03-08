import { usePitchStore } from '../stores/pitch.store';

/** Convenience hook — returns all pitch state */
export function usePitch() {
  return usePitchStore();
}

/** Selective hook — only current note info (minimal rerenders) */
export function usePitchNote() {
  return usePitchStore(s => ({
    note: s.note,
    cents: s.cents,
    confidence: s.confidence,
    isSinging: s.isSinging,
  }));
}

/** Selective hook — only status */
export function usePitchStatus() {
  return usePitchStore(s => s.status);
}
