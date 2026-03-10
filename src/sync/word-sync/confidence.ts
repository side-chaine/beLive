export const LOW_CONFIDENCE = 0.55;
export const HIGH_CONFIDENCE = 0.8;

export type ConfidenceBand = 'low' | 'medium' | 'high';

export function getConfidenceBand(value?: number | null): ConfidenceBand {
  if (value == null || value < LOW_CONFIDENCE) return 'low';
  if (value >= HIGH_CONFIDENCE) return 'high';
  return 'medium';
}

export function shouldEnableWordHighlight(lineConfidence?: number | null): boolean {
  return getConfidenceBand(lineConfidence) !== 'low';
}

export function isRepairCandidate(lineConfidence?: number | null): boolean {
  return getConfidenceBand(lineConfidence) === 'medium';
}
