import { useEffect, useState } from 'react';
import type { TransportV3 } from '../core/TransportV3';

export interface AudioContextHealth {
  isHealthy: boolean;
  /** Clears the glitch flag without retrying playback — that's TransportV3's job,
   * not this hook's. Use for a "dismiss" affordance if you don't want to force reload. */
  acknowledge: () => void;
}

export function useAudioContextHealth(transport: TransportV3): AudioContextHealth {
  const [isHealthy, setIsHealthy] = useState(true);

  useEffect(() => {
    const onGlitch = () => setIsHealthy(false);
    transport.addEventListener('audioglitch', onGlitch);
    return () => transport.removeEventListener('audioglitch', onGlitch);
  }, [transport]);

  return { isHealthy, acknowledge: () => setIsHealthy(true) };
}
