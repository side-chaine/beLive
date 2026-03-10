import type { AlignmentJobRequest, AlignmentResult } from '../types';

export type AlignmentProviderHealth =
  | 'unknown'
  | 'ready'
  | 'degraded'
  | 'unavailable';

export type AlignmentProviderFailure = {
  ok: false;
  error: string;
  retryable?: boolean;
};

export type AlignmentProviderSuccess = {
  ok: true;
  result: AlignmentResult;
};

export type AlignmentProviderResponse =
  | AlignmentProviderSuccess
  | AlignmentProviderFailure;

export interface AlignmentProvider {
  readonly name: string;
  readonly version?: string;
  readonly health?: AlignmentProviderHealth;

  align(request: AlignmentJobRequest): Promise<AlignmentProviderResponse>;
}

export function isAlignmentProvider(value: unknown): value is AlignmentProvider {
  if (!value || typeof value !== 'object') return false;

  const candidate = value as Partial<AlignmentProvider>;
  return (
    typeof candidate.name === 'string' &&
    typeof candidate.align === 'function'
  );
}
