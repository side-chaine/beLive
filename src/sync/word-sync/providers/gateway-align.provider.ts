import { getGatewayUrl } from '../config';
import type { AlignmentJobRequest } from '../types';
import type {
  AlignmentProvider,
  AlignmentProviderHealth,
  AlignmentProviderResponse,
} from './base';

export type GatewayAlignProviderOptions = {
  endpoint?: string;
};

export class GatewayAlignProvider implements AlignmentProvider {
  readonly name = 'gateway-align';
  readonly version = 'stub-v1';
  readonly health: AlignmentProviderHealth = 'unknown';
  readonly endpoint: string;

  constructor(options: GatewayAlignProviderOptions = {}) {
    this.endpoint = options.endpoint ?? `${getGatewayUrl()}/v1/align`;
  }

  async align(request: AlignmentJobRequest): Promise<AlignmentProviderResponse> {
    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        return {
          ok: false,
          error: `GatewayAlignProvider HTTP ${response.status}`,
          retryable: response.status >= 500,
        };
      }

      const data = await response.json();

      if (!data || typeof data !== 'object' || !Array.isArray((data as any).lines)) {
        return {
          ok: false,
          error: 'GatewayAlignProvider returned invalid payload',
          retryable: false,
        };
      }

      return {
        ok: true,
        result: data as any,
      };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'GatewayAlignProvider request failed',
        retryable: true,
      };
    }
  }
}
