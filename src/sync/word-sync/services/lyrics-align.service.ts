import type { AlignmentJobRequest } from '../types';
import type { AlignmentProviderResponse } from '../providers/base';
import { GatewayAlignProvider } from '../providers/gateway-align.provider';

export type LyricsAlignServiceOptions = {
  provider?: GatewayAlignProvider;
};

export class LyricsAlignService {
  private readonly provider: GatewayAlignProvider;

  constructor(options: LyricsAlignServiceOptions = {}) {
    this.provider = options.provider ?? new GatewayAlignProvider();
  }

  getProvider() {
    return this.provider;
  }

  async align(request: AlignmentJobRequest): Promise<AlignmentProviderResponse> {
    return this.provider.align(request);
  }
}

export const lyricsAlignService = new LyricsAlignService();
